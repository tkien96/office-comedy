"""Local VieNeu-TTS (v3 Turbo, ONNX/CPU) helper driven by tools/tts/vieneu.ts.

Modes:
  python -X utf8 vieneu_synth.py voices   -> JSON {voices: [...]} from the installed package
  python -X utf8 vieneu_synth.py serve    -> JSON-lines protocol on stdin/stdout:
      first line out: {"ready": true, "info": {...versions/revisions...}}
      each line in : {"id", "text", "voice", "out_wav", "params": {...}}
      each line out: {"id", "ok", "seconds", "sample_rate", "elapsed_sec"} or {"id", "ok": false, ...}

Runs fully offline after the first model download (HF cache = $HF_HOME).
Never calls the paid VieNeu API (mode "remote"/"api" is not used).
"""

import json
import os
import sys
import time
from pathlib import Path

# Keep the protocol channel clean: anything the library prints goes to stderr.
_proto = os.fdopen(os.dup(1), "w", encoding="utf-8", buffering=1)
os.dup2(2, 1)
sys.stdout = sys.stderr


def send(obj):
    _proto.write(json.dumps(obj, ensure_ascii=False) + "\n")
    _proto.flush()


def package_voices():
    import vieneu

    asset = Path(vieneu.__file__).parent / "assets" / "voices_v3_turbo.json"
    data = json.loads(asset.read_text(encoding="utf-8"))
    out = []
    for name, v in data["presets"].items():
        out.append(
            {
                "voice_id": name,
                "gender": v.get("gender"),
                "region": v.get("region"),
                "style": v.get("style"),
                "featured": v.get("featured"),
                "description": v.get("description"),
                "aliases": v.get("aliases") or [],
            }
        )
    return {
        "source": str(asset),
        "default_voice": data.get("default_voice"),
        "count": len(out),
        "voices": out,
    }


def hf_revision(repo_id):
    hub = Path(os.environ.get("HF_HOME", Path.home() / ".cache" / "huggingface")) / "hub"
    ref = hub / ("models--" + repo_id.replace("/", "--")) / "refs" / "main"
    return ref.read_text().strip() if ref.is_file() else None


BACKBONE = "pnnbao-ump/VieNeu-TTS-v3-Turbo"
TOKENIZER = "OpenMOSS-Team/MOSS-Audio-Tokenizer-Nano-ONNX"


def serve():
    import numpy as np
    import onnxruntime
    import soundfile as sf
    import vieneu
    from importlib.metadata import version

    t0 = time.time()
    # fp32: int8 may garble audio on CPUs without VNNI (i5-7500 has none).
    tts = vieneu.Vieneu(mode="v3turbo", precision="fp32", backend="onnx")
    live_ids = [vid for _, vid in tts.list_preset_voices()]
    send(
        {
            "ready": True,
            "info": {
                "vieneu": version("vieneu"),
                "onnxruntime": onnxruntime.__version__,
                "sea_g2p": version("sea-g2p"),
                "mode": "v3turbo",
                "backend": "onnx",
                "precision": "fp32",
                "backbone_repo": BACKBONE,
                "backbone_revision": hf_revision(BACKBONE),
                "tokenizer_repo": TOKENIZER,
                "tokenizer_revision": hf_revision(TOKENIZER),
                "sample_rate": tts.sample_rate,
                "watermarker": tts.watermarker is not None,
                "preset_voice_ids": live_ids,
                "load_sec": round(time.time() - t0, 2),
            },
        }
    )
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        req = json.loads(line)
        rid = req.get("id")
        try:
            p = req.get("params", {})
            t1 = time.time()
            ref = req.get("ref_audio")
            audio = tts.infer(
                req["text"],
                # Reference clone (local file) takes precedence over a preset name.
                voice=None if ref else req["voice"],
                ref_audio=ref,
                denoise=bool(p.get("ref_denoise", False)),
                temperature=float(p.get("temperature", 0.8)),
                top_k=int(p.get("top_k", 25)),
                top_p=float(p.get("top_p", 0.95)),
                repetition_penalty=float(p.get("repetition_penalty", 1.2)),
                max_chars=int(p.get("max_chars", 256)),
                silence_p=float(p.get("silence_p", 0.15)),
                crossfade_p=float(p.get("crossfade_p", 0.0)),
                apply_watermark=bool(p.get("apply_watermark", False)),
            )
            audio = np.asarray(audio, dtype=np.float32).reshape(-1)
            sf.write(req["out_wav"], audio, tts.sample_rate, subtype="PCM_16")
            send(
                {
                    "id": rid,
                    "ok": True,
                    "sample_rate": tts.sample_rate,
                    "seconds": round(len(audio) / tts.sample_rate, 3),
                    "elapsed_sec": round(time.time() - t1, 2),
                }
            )
        except Exception as e:  # noqa: BLE001
            send({"id": rid, "ok": False, "kind": "other", "message": f"{type(e).__name__}: {e}"})


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else ""
    try:
        if mode == "voices":
            send({"ok": True, **package_voices()})
        elif mode == "serve":
            serve()
        else:
            send({"ok": False, "kind": "usage", "message": "mode must be 'voices' or 'serve'"})
            sys.exit(2)
    except Exception as e:  # noqa: BLE001
        send({"ok": False, "kind": "other", "message": f"{type(e).__name__}: {e}"})
        sys.exit(2)


if __name__ == "__main__":
    main()
