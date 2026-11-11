"""Thin wrapper around edge-tts, driven by the TypeScript adapter.

Usage:
  python edge_synth.py voices            -> JSON list of voices on stdout
  python edge_synth.py synth < req.json  -> writes audio/SRT/boundaries, JSON status on stdout

Errors are reported as JSON {"ok": false, "kind": ..., "message": ...} with exit
code 2, so the caller can decide whether a retry makes sense. No API key is
involved: edge-tts uses Microsoft Edge's online read-aloud service.
"""

import asyncio
import json
import sys

import aiohttp
import edge_tts


def emit(obj, code=0):
    sys.stdout.write(json.dumps(obj, ensure_ascii=False))
    sys.stdout.flush()
    sys.exit(code)


async def voices():
    data = await edge_tts.list_voices()
    emit({"ok": True, "edge_tts_version": edge_tts.__version__, "voices": data})


async def synth(req):
    communicate = edge_tts.Communicate(
        req["text"],
        req["voice"],
        rate=req.get("rate", "+0%"),
        volume=req.get("volume", "+0%"),
        pitch=req.get("pitch", "+0Hz"),
        boundary=req.get("boundary", "SentenceBoundary"),
        connect_timeout=int(req.get("connect_timeout", 10)),
        receive_timeout=int(req.get("receive_timeout", 60)),
    )
    submaker = edge_tts.SubMaker()
    boundaries = []
    audio_bytes = 0
    with open(req["out_audio"], "wb") as f:
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
                audio_bytes += len(chunk["data"])
            elif chunk["type"] in ("WordBoundary", "SentenceBoundary"):
                submaker.feed(chunk)
                # offset/duration are 100-ns ticks.
                boundaries.append(
                    {
                        "type": chunk["type"],
                        "text": chunk["text"],
                        "start": chunk["offset"] / 10_000_000,
                        "end": (chunk["offset"] + chunk["duration"]) / 10_000_000,
                    }
                )
    if audio_bytes == 0:
        emit({"ok": False, "kind": "other", "message": "No audio received"}, 2)
    with open(req["out_srt"], "w", encoding="utf-8") as f:
        f.write(submaker.get_srt())
    with open(req["out_boundaries"], "w", encoding="utf-8") as f:
        json.dump(boundaries, f, ensure_ascii=False, indent=1)
    emit({"ok": True, "edge_tts_version": edge_tts.__version__, "audio_bytes": audio_bytes, "boundaries": len(boundaries)})


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else ""
    try:
        if mode == "voices":
            asyncio.run(voices())
        elif mode == "synth":
            asyncio.run(synth(json.loads(sys.stdin.buffer.read().decode("utf-8"))))
        else:
            emit({"ok": False, "kind": "usage", "message": "mode must be 'voices' or 'synth'"}, 2)
    except SystemExit:
        raise
    except (asyncio.TimeoutError, TimeoutError) as e:
        emit({"ok": False, "kind": "timeout", "message": str(e) or "timeout"}, 2)
    except aiohttp.ClientResponseError as e:
        emit({"ok": False, "kind": "http", "status": e.status, "message": str(e)}, 2)
    except aiohttp.ClientError as e:
        emit({"ok": False, "kind": "network", "message": str(e)}, 2)
    except edge_tts.exceptions.NoAudioReceived as e:
        emit({"ok": False, "kind": "other", "message": f"NoAudioReceived: {e}"}, 2)
    except Exception as e:  # noqa: BLE001
        emit({"ok": False, "kind": "other", "message": f"{type(e).__name__}: {e}"}, 2)


if __name__ == "__main__":
    main()
