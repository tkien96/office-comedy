"""Objective voice descriptors for listening triage (NOT an age estimate).

python -I -X utf8 voice_metrics.py <wav> [<wav> ...]

Per file: median/p10/p90 F0 (pyin), F0 spread in semitones, spectral centroid
(brightness), and speech rate proxy are printed as JSON lines. Lower F0 and a
darker spectrum are often heard as "deeper/thicker", but neither proves age.
"""

import json
import sys

import librosa
import numpy as np


def metrics(path):
    y, sr = librosa.load(path, sr=16000, mono=True)
    f0, v, _ = librosa.pyin(y, fmin=60, fmax=400, sr=sr, frame_length=1024, hop_length=320)
    f0v = f0[v & ~np.isnan(f0)]
    cent = librosa.feature.spectral_centroid(y=y, sr=sr, hop_length=320)[0]
    rms = librosa.feature.rms(y=y, hop_length=320)[0]
    voiced_mask = rms > np.percentile(rms, 90) * 0.1
    semis = 12 * np.log2(f0v / np.median(f0v)) if f0v.size else np.array([0.0])
    return {
        "file": path,
        "f0_median_hz": round(float(np.median(f0v)), 1) if f0v.size else None,
        "f0_p10_hz": round(float(np.percentile(f0v, 10)), 1) if f0v.size else None,
        "f0_p90_hz": round(float(np.percentile(f0v, 90)), 1) if f0v.size else None,
        "f0_spread_semitones_p10_p90": round(float(np.percentile(semis, 90) - np.percentile(semis, 10)), 1),
        "spectral_centroid_hz": round(float(np.median(cent[voiced_mask[: len(cent)]])), 0),
    }


if __name__ == "__main__":
    for p in sys.argv[1:]:
        print(json.dumps(metrics(p), ensure_ascii=False))
