"""Extra checks for a reference recording (read-only).

python -I -X utf8 ref_extra.py <wav>

- near-clipping: samples above -0.1 / -0.5 / -1 dBFS and the longest run of
  consecutive samples above -0.1 dBFS (flat tops = hard limiting/clipping)
- band energy share above 4/8/12 kHz in speech (band-limiting after cleanup)
- gate signature: how often speech is followed by exact digital silence
"""

import json
import sys

import numpy as np
import soundfile as sf

y, sr = sf.read(sys.argv[1], always_2d=True)
m = y.mean(axis=1)
a = np.abs(m)


def count_over(dbfs):
    return int(np.sum(a >= 10 ** (dbfs / 20)))


thr = 10 ** (-0.1 / 20)
run = best = 0
for v in a >= thr:
    run = run + 1 if v else 0
    best = max(best, run)

n = 2048
hop = 1024
frames = [m[i : i + n] for i in range(0, len(m) - n, hop)]
rms = np.array([np.sqrt(np.mean(f ** 2)) for f in frames])
speech = rms > np.percentile(rms, 90) * 0.1
spec = np.array([np.abs(np.fft.rfft(f * np.hanning(n))) ** 2 for f, s in zip(frames, speech) if s])
freqs = np.fft.rfftfreq(n, 1 / sr)
total = spec.sum()
share = {f"above_{k}k": round(float(spec[:, freqs >= k * 1000].sum() / total), 5) for k in (4, 8, 12)}
# highest frequency where median speech spectrum is within 60 dB of its peak
med = np.median(spec, axis=0)
med_db = 10 * np.log10(med + 1e-20)
top = float(freqs[np.where(med_db > med_db.max() - 60)[0].max()])

digital_zero = float(np.mean(a == 0))
print(
    json.dumps(
        {
            "file": sys.argv[1],
            "samples_over_-0.1dBFS": count_over(-0.1),
            "samples_over_-0.5dBFS": count_over(-0.5),
            "samples_over_-1dBFS": count_over(-1.0),
            "longest_run_over_-0.1dBFS": best,
            "speech_band_share": share,
            "speech_bandwidth_hz_within_60dB": round(top),
            "fraction_exact_zero_samples": round(digital_zero, 4),
        },
        ensure_ascii=False,
    )
)
