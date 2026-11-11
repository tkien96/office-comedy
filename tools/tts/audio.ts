import { spawnSync } from "node:child_process";

// Small, explicit audio helpers (ffmpeg for decode/encode/measure, plain JS for
// the sample math). Everything is mono float32 at a fixed sample rate.

export const SR = 48_000;

export const decode = (file: string, sr = SR): Float32Array => {
  const r = spawnSync("ffmpeg", ["-v", "error", "-i", file, "-f", "f32le", "-ac", "1", "-ar", String(sr), "pipe:1"], {
    maxBuffer: 1 << 30,
  });
  if (r.status !== 0) throw new Error(`ffmpeg decode lỗi: ${r.stderr?.toString()}`);
  const buf = r.stdout as Buffer;
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4).slice();
};

export const encodeWav = (samples: Float32Array, file: string, sr = SR) => {
  const r = spawnSync(
    "ffmpeg",
    ["-v", "error", "-y", "-f", "f32le", "-ar", String(sr), "-ac", "1", "-i", "pipe:0", "-c:a", "pcm_s16le", file],
    { input: Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength) },
  );
  if (r.status !== 0) throw new Error(`ffmpeg encode lỗi: ${r.stderr?.toString()}`);
};

const db = (x: number) => (x > 0 ? 20 * Math.log10(x) : -120);

export type Window = { t: number; peakDb: number; rmsDb: number };

/** Peak/RMS per fixed window (default 10 ms). */
export const profile = (s: Float32Array, windowSec = 0.01, sr = SR): Window[] => {
  const n = Math.max(1, Math.round(windowSec * sr));
  const out: Window[] = [];
  for (let i = 0; i < s.length; i += n) {
    let peak = 0;
    let sum = 0;
    const end = Math.min(s.length, i + n);
    for (let j = i; j < end; j++) {
      const a = Math.abs(s[j]);
      if (a > peak) peak = a;
      sum += s[j] * s[j];
    }
    out.push({ t: i / sr, peakDb: db(peak), rmsDb: db(Math.sqrt(sum / (end - i))) });
  }
  return out;
};

export const EDGE_RULES = {
  /** A window counts as speech when RMS is above this... */
  speechRmsDb: -38,
  /** ...and its peak above this. */
  speechPeakDb: -30,
  /** The silence/noise before the onset must stay below this peak to be "extra". */
  floorMaxPeakDb: -35,
  /** Onset must stand this far above the median floor RMS. */
  minOnsetJumpDb: 15,
  /** Only trim a leading part longer than this. */
  minLeadSec: 0.15,
  /** The first part after the last speech window is the natural decay: always kept, not floor-checked. */
  decayGuardSec: 0.06,
  /** Keep this much before onset / after last speech. */
  prerollSec: 0.08,
  /** Part of the pre-roll treated as the syllable attack (must be < prerollSec). */
  attackGuardSec: 0.03,
  postrollSec: 0.12,
  fadeInSec: 0.015,
  fadeOutSec: 0.04,
};

export type EdgeDecision = {
  onsetSec: number;
  lastSpeechSec: number;
  leading: { lengthSec: number; floorPeakDb: number; floorMedianRmsDb: number; onsetJumpDb: number; trimmed: boolean; reason: string };
  trailing: { lengthSec: number; floorPeakDb: number; trimmed: boolean; reason: string };
  keepStartSec: number;
  keepEndSec: number;
};

const median = (a: number[]) => {
  if (a.length === 0) return -120;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};

/** Decide whether leading/trailing low-level parts are extra. Never trims into speech. */
export const analyzeEdges = (s: Float32Array, sr = SR): EdgeDecision => {
  const R = EDGE_RULES;
  const w = profile(s, 0.01, sr);
  const dur = s.length / sr;
  const isSpeech = (x: Window) => x.rmsDb > R.speechRmsDb && x.peakDb > R.speechPeakDb;
  const first = w.findIndex(isSpeech);
  let last = -1;
  for (let i = w.length - 1; i >= 0; i--) if (isSpeech(w[i])) { last = i; break; }
  if (first < 0) throw new Error("Không tìm thấy lời nói trong file.");

  const onsetSec = w[first].t;
  const lastSpeechSec = Math.min(dur, w[last].t + 0.01);

  // The ~30 ms right before the onset holds the attack of the first syllable:
  // it is kept (inside the pre-roll) and excluded from the noise-floor check.
  const attackWindows = Math.round(R.attackGuardSec / 0.01);
  const lead = w.slice(0, Math.max(0, first - attackWindows));
  const leadPeak = lead.length ? Math.max(...lead.map((x) => x.peakDb)) : -120;
  const leadMed = median(lead.map((x) => x.rmsDb));
  const onsetRms = Math.max(...w.slice(first, first + 5).map((x) => x.rmsDb));
  const jump = onsetRms - leadMed;
  let leadTrim = false;
  let leadReason = "";
  if (onsetSec < R.minLeadSec) leadReason = `ngắn (${onsetSec.toFixed(2)} s), giữ nguyên`;
  else if (leadPeak > R.floorMaxPeakDb) leadReason = `có đỉnh ${leadPeak.toFixed(1)} dBFS > ${R.floorMaxPeakDb}: có thể là âm thật, KHÔNG cắt`;
  else if (jump < R.minOnsetJumpDb) leadReason = `điểm vào lời chỉ cao hơn nền ${jump.toFixed(1)} dB: không chắc, KHÔNG cắt`;
  else {
    leadTrim = true;
    leadReason = `nền ${leadMed.toFixed(1)} dB RMS (đỉnh ≤ ${leadPeak.toFixed(1)} dBFS), lời vào cao hơn ${jump.toFixed(1)} dB: là khoảng thừa`;
  }

  const decayWindows = Math.round(R.decayGuardSec / 0.01);
  const tail = w.slice(last + 1 + decayWindows);
  const tailLen = dur - lastSpeechSec;
  const tailPeak = tail.length ? Math.max(...tail.map((x) => x.peakDb)) : -120;
  let tailTrim = false;
  let tailReason = "";
  if (tailLen <= R.postrollSec + 0.02) tailReason = `ngắn (${tailLen.toFixed(2)} s), giữ nguyên`;
  else if (tailPeak > R.floorMaxPeakDb) tailReason = `sau phần tắt dần còn đỉnh ${tailPeak.toFixed(1)} dBFS: có thể là âm thật, KHÔNG cắt`;
  else {
    tailTrim = true;
    tailReason = `đuôi ${tailLen.toFixed(2)} s, sau ${R.decayGuardSec * 1000} ms tắt dần chỉ còn nền (đỉnh ≤ ${tailPeak.toFixed(1)} dBFS); giữ ${R.postrollSec * 1000} ms`;
  }

  return {
    onsetSec,
    lastSpeechSec,
    leading: { lengthSec: +onsetSec.toFixed(3), floorPeakDb: +leadPeak.toFixed(1), floorMedianRmsDb: +leadMed.toFixed(1), onsetJumpDb: +jump.toFixed(1), trimmed: leadTrim, reason: leadReason },
    trailing: { lengthSec: +tailLen.toFixed(3), floorPeakDb: +tailPeak.toFixed(1), trimmed: tailTrim, reason: tailReason },
    keepStartSec: leadTrim ? Math.max(0, onsetSec - R.prerollSec) : 0,
    keepEndSec: tailTrim ? Math.min(dur, lastSpeechSec + R.postrollSec) : dur,
  };
};

/** Cuts to [start,end] and fades only the kept pre/post-roll (outside speech). */
export const applyEdges = (s: Float32Array, d: EdgeDecision, sr = SR): Float32Array => {
  const R = EDGE_RULES;
  const a = Math.round(d.keepStartSec * sr);
  const b = Math.round(d.keepEndSec * sr);
  const out = s.slice(a, b);
  if (d.leading.trimmed) {
    const n = Math.min(Math.round(R.fadeInSec * sr), Math.round(R.prerollSec * sr));
    for (let i = 0; i < n && i < out.length; i++) out[i] *= i / n;
  }
  if (d.trailing.trimmed) {
    const n = Math.min(Math.round(R.fadeOutSec * sr), Math.round(R.postrollSec * sr));
    for (let i = 0; i < n && i < out.length; i++) out[out.length - 1 - i] *= i / n;
  }
  return out;
};

export const gain = (s: Float32Array, gainDb: number) => {
  const g = Math.pow(10, gainDb / 20);
  const out = new Float32Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s[i] * g;
  return out;
};

/** EBU R128 integrated loudness (LUFS) and true peak (dBTP) via ffmpeg. */
export const loudness = (file: string): { lufs: number; truePeakDb: number } => {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-af", "ebur128=peak=true", "-f", "null", "-"], {
    encoding: "utf8",
  });
  const txt = r.stderr ?? "";
  const summary = txt.slice(txt.lastIndexOf("Summary:"));
  const i = summary.match(/I:\s+(-?[\d.]+) LUFS/);
  const tp = summary.match(/Peak:\s+(-?[\d.]+|-inf) dBFS/);
  if (!i) throw new Error(`Không đo được loudness: ${file}`);
  return { lufs: parseFloat(i[1]), truePeakDb: tp ? (tp[1] === "-inf" ? -120 : parseFloat(tp[1])) : NaN };
};

export const silence = (sec: number, sr = SR) => new Float32Array(Math.round(sec * sr));

export const concat = (parts: Float32Array[]) => {
  const out = new Float32Array(parts.reduce((a, p) => a + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
};
