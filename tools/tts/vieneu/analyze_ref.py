"""Technical analysis of a candidate voice-reference recording (read-only).

python -I -X utf8 analyze_ref.py <stereo.wav> <out.json>

Reports signals only (no diarization/ASR available on this machine):
- level, true clipping count, silence map and noise floor in pauses
- stereo width in speech vs pauses (wide, non-speech energy hints at music)
- spectral flatness in pauses (tonal bed vs broadband noise)
- F0 distribution (pyin) per voiced segment: a second, distinct pitch cluster
  hints at another speaker
- decay after speech offsets (rough reverb hint)
"""

import json
import sys

import librosa
import numpy as np
import soundfile as sf


def db(x):
    return float(20 * np.log10(max(float(x), 1e-12)))


def main(path, out):
    y, sr = sf.read(path, always_2d=True)
    y = y.astype(np.float32)
    left, right = y[:, 0], y[:, 1] if y.shape[1] > 1 else y[:, 0]
    mono = (left + right) / 2
    side = (left - right) / 2
    dur = len(mono) / sr

    clip = int(np.sum(np.abs(y) >= 0.999))
    peak = db(np.max(np.abs(y)))

    # 20 ms frames
    hop = int(0.02 * sr)
    frames = librosa.util.frame(np.pad(mono, (0, hop)), frame_length=hop, hop_length=hop)
    sframes = librosa.util.frame(np.pad(side, (0, hop)), frame_length=hop, hop_length=hop)
    rms = np.sqrt(np.mean(frames ** 2, axis=0) + 1e-12)
    srms = np.sqrt(np.mean(sframes ** 2, axis=0) + 1e-12)
    rms_db = 20 * np.log10(rms)
    speech_thr = np.percentile(rms_db, 90) - 25
    speech = rms_db > speech_thr

    # pauses (>= 0.25 s below threshold)
    pauses = []
    start = None
    for i, s in enumerate(list(speech) + [True]):
        if not s and start is None:
            start = i
        elif s and start is not None:
            if (i - start) * 0.02 >= 0.25:
                pauses.append((start * 0.02, i * 0.02))
            start = None
    pause_mask = np.zeros_like(speech)
    for a, b in pauses:
        pause_mask[int(a / 0.02): int(b / 0.02)] = True

    def med_db(mask, arr):
        v = arr[mask]
        return float(np.median(20 * np.log10(v))) if v.size else None

    speech_rms_db = med_db(speech, rms)
    pause_rms_db = med_db(pause_mask.astype(bool), rms)
    side_speech_db = med_db(speech, srms)
    side_pause_db = med_db(pause_mask.astype(bool), srms)

    # spectral flatness in pauses (1 = noise-like, ~0 = tonal/music)
    flat = librosa.feature.spectral_flatness(y=mono, n_fft=2048, hop_length=hop)[0][: len(speech)]
    pf = flat[pause_mask[: len(flat)].astype(bool)]
    pause_flatness = float(np.median(pf)) if pf.size else None

    # F0 per voiced region
    y16 = librosa.resample(mono, orig_sr=sr, target_sr=16000)
    f0, vflag, _ = librosa.pyin(y16, fmin=60, fmax=400, sr=16000, frame_length=1024, hop_length=320)
    f0v = f0[vflag & ~np.isnan(f0)]
    f0_stats = None
    if f0v.size:
        f0_stats = {
            "median_hz": round(float(np.median(f0v)), 1),
            "p10_hz": round(float(np.percentile(f0v, 10)), 1),
            "p90_hz": round(float(np.percentile(f0v, 90)), 1),
            "voiced_sec": round(f0v.size * 0.02, 1),
        }
    # per-segment median F0 (speech segments between pauses)
    segs = []
    edges = [0.0] + [p for ab in pauses for p in ab] + [dur]
    for i in range(0, len(edges) - 1, 2):
        a, b = edges[i], edges[i + 1]
        if b - a < 0.4:
            continue
        ia, ib = int(a / 0.02), int(b / 0.02)
        seg_f0 = f0[ia:ib]
        seg_v = vflag[ia:ib]
        v = seg_f0[seg_v & ~np.isnan(seg_f0)]
        segs.append(
            {
                "start": round(a, 2),
                "end": round(b, 2),
                "dur": round(b - a, 2),
                "f0_median_hz": round(float(np.median(v)), 1) if v.size else None,
                "rms_db": round(float(np.median(rms_db[ia:ib])), 1),
                "peak_db": round(db(np.max(np.abs(mono[int(a * sr): int(b * sr)]))), 1),
            }
        )

    # rough decay after offsets: frames until -20 dB below offset level
    decays = []
    for a, _ in pauses:
        i = int(a / 0.02)
        if i < 2:
            continue
        ref = rms_db[i - 1]
        n = 0
        while i + n < len(rms_db) and rms_db[i + n] > ref - 20 and n < 50:
            n += 1
        decays.append(n * 0.02)

    res = {
        "file": path,
        "sample_rate": sr,
        "channels": y.shape[1],
        "duration_sec": round(dur, 2),
        "peak_dbfs": round(peak, 2),
        "clipped_samples": clip,
        "speech_threshold_db": round(float(speech_thr), 1),
        "speech_median_rms_db": round(speech_rms_db, 1) if speech_rms_db is not None else None,
        "pause_median_rms_db": round(pause_rms_db, 1) if pause_rms_db is not None else None,
        "speech_to_pause_db": round(speech_rms_db - pause_rms_db, 1) if pause_rms_db is not None else None,
        "side_minus_mid_speech_db": round(side_speech_db - speech_rms_db, 1) if side_speech_db is not None else None,
        "side_minus_mid_pause_db": round(side_pause_db - pause_rms_db, 1) if side_pause_db is not None and pause_rms_db is not None else None,
        "pause_spectral_flatness": round(pause_flatness, 4) if pause_flatness is not None else None,
        "pauses": [(round(a, 2), round(b, 2)) for a, b in pauses],
        "speech_segments": segs,
        "f0": f0_stats,
        "median_decay_20db_sec": round(float(np.median(decays)), 2) if decays else None,
    }
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(res, fh, ensure_ascii=False, indent=1)
    print(json.dumps({k: v for k, v in res.items() if k not in ("pauses", "speech_segments")}, ensure_ascii=False))
    for s in segs:
        print("  seg", s)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
