import { spawnSync } from "node:child_process";

// Technical audio checks with tools available on this machine (ffmpeg/ffprobe).
// These are signals, not a listening review: they cannot prove that no word
// was dropped or repeated (that needs ASR or a human listener).

export type QcReport = {
  durationSec: number;
  sampleRate: number | null;
  channels: number | null;
  peakDb: number | null;
  leadingSilenceSec: number;
  trailingSilenceSec: number;
  /** RMS of the last 80 ms (dBFS). */
  tailRmsDb: number | null;
  /** Silences inside the speech (not at start/end). */
  innerSilences: { start: number; end: number; duration: number }[];
  speechSec: number;
  syllables: number;
  syllablesPerSec: number | null;
  flags: string[];
};

const run = (args: string[]) => {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-nostats", ...args], { encoding: "utf8" });
  return r.stderr ?? "";
};

const probe = (file: string) => {
  const r = spawnSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "stream=sample_rate,channels:format=duration", "-of", "json", file],
    { encoding: "utf8" },
  );
  const j = JSON.parse(r.stdout || "{}");
  return {
    duration: parseFloat(j.format?.duration ?? "0"),
    sampleRate: j.streams?.[0]?.sample_rate ? Number(j.streams[0].sample_rate) : null,
    channels: j.streams?.[0]?.channels ?? null,
  };
};

/** Vietnamese is written one syllable per space-separated token. */
export const countSyllables = (text: string) =>
  text
    .replace(/\[[^\]]*\]/g, " ")
    .split(/\s+/)
    .filter((t) => /[\p{L}\p{N}]/u.test(t)).length;

export const QC_LIMITS = {
  silenceThresholdDb: -40,
  silenceMinSec: 0.25,
  /** Inner pause longer than this is flagged (sentence pauses are usually shorter). */
  innerPauseMaxSec: 0.9,
  leadingMaxSec: 0.6,
  /** Less tail silence than this may mean the last word is cut. */
  trailingMinSec: 0.05,
  trailingMaxSec: 1.2,
  /** If the last 80 ms is louder than this, the audio likely ends mid-sound. */
  tailCutRmsDb: -45,
  clipPeakDb: -0.3,
  /** Plausible speech rate band; outside suggests dropped/repeated words. */
  minSylPerSec: 3.0,
  maxSylPerSec: 7.5,
};

export const qcAudio = (file: string, text: string): QcReport => {
  const L = QC_LIMITS;
  const { duration, sampleRate, channels } = probe(file);
  const sd = run(["-i", file, "-af", `silencedetect=noise=${L.silenceThresholdDb}dB:d=${L.silenceMinSec}`, "-f", "null", "-"]);
  const starts = [...sd.matchAll(/silence_start: (-?[\d.]+)/g)].map((m) => Math.max(0, parseFloat(m[1])));
  const ends = [...sd.matchAll(/silence_end: ([\d.]+)/g)].map((m) => parseFloat(m[1]));
  // Merge back-to-back segments (silencedetect can split one long silence).
  const silences: { start: number; end: number }[] = [];
  for (const [i, s] of starts.entries()) {
    const seg = { start: s, end: ends[i] ?? duration };
    const last = silences.at(-1);
    if (last && seg.start - last.end < 0.01) last.end = seg.end;
    else silences.push(seg);
  }

  const eps = 0.02;
  const leading = silences.find((s) => s.start <= eps);
  const trailing = silences.find((s) => s.end >= duration - eps && s !== leading);
  const inner = silences
    .filter((s) => s !== leading && s !== trailing)
    .map((s) => ({ start: +s.start.toFixed(3), end: +s.end.toFixed(3), duration: +(s.end - s.start).toFixed(3) }));

  const leadingSec = leading ? leading.end - leading.start : 0;
  const trailingSec = trailing ? trailing.end - trailing.start : 0;
  const silentTotal = silences.reduce((a, s) => a + (s.end - s.start), 0);
  const speechSec = Math.max(0, duration - silentTotal);

  const st = run(["-i", file, "-af", "astats=measure_overall=Peak_level:measure_perchannel=0", "-f", "null", "-"]);
  const peakMatch = st.match(/Peak level dB:\s*(-?[\d.]+|-inf)/);
  const peakDb = peakMatch ? (peakMatch[1] === "-inf" ? -Infinity : parseFloat(peakMatch[1])) : null;

  // Loudness of the last 80 ms: tells a short-but-faded tail from a hard cut.
  const tail = spawnSync(
    "ffmpeg",
    ["-hide_banner", "-nostats", "-sseof", "-0.08", "-i", file, "-af", "astats=measure_overall=RMS_level:measure_perchannel=0", "-f", "null", "-"],
    { encoding: "utf8" },
  ).stderr;
  const tailMatch = [...(tail ?? "").matchAll(/RMS level dB:\s*(-?[\d.]+|-inf)/g)].at(-1);
  const tailRmsDb = tailMatch ? (tailMatch[1] === "-inf" ? -120 : parseFloat(tailMatch[1])) : null;

  const syllables = countSyllables(text);
  const sps = speechSec > 0 ? +(syllables / speechSec).toFixed(2) : null;

  const flags: string[] = [];
  if (duration <= 0) flags.push("Không đọc được thời lượng");
  if (leadingSec > L.leadingMaxSec) flags.push(`Khoảng lặng đầu dài ${leadingSec.toFixed(2)} s`);
  if (trailingSec < L.trailingMinSec && tailRmsDb !== null && tailRmsDb > L.tailCutRmsDb) {
    flags.push(`80 ms cuối còn to (${tailRmsDb.toFixed(1)} dB): nghi bị cắt cuối câu`);
  }
  if (trailingSec > L.trailingMaxSec) flags.push(`Khoảng lặng cuối dài ${trailingSec.toFixed(2)} s`);
  for (const s of inner) {
    if (s.duration > L.innerPauseMaxSec) flags.push(`Ngắt giữa câu dài ${s.duration.toFixed(2)} s tại ${s.start.toFixed(2)} s`);
  }
  if (peakDb !== null && peakDb > L.clipPeakDb) flags.push(`Đỉnh ${peakDb.toFixed(2)} dBFS: có thể bị clip`);
  if (sps !== null && sps < L.minSylPerSec) flags.push(`Tốc độ ${sps} âm tiết/s thấp bất thường: có thể lặp hoặc kéo dài từ`);
  if (sps !== null && sps > L.maxSylPerSec) flags.push(`Tốc độ ${sps} âm tiết/s cao bất thường: có thể bỏ từ`);

  return {
    durationSec: +duration.toFixed(3),
    sampleRate,
    channels,
    peakDb: peakDb === null || !Number.isFinite(peakDb) ? peakDb : +peakDb.toFixed(2),
    leadingSilenceSec: +leadingSec.toFixed(3),
    trailingSilenceSec: +trailingSec.toFixed(3),
    tailRmsDb: tailRmsDb === null ? null : +tailRmsDb.toFixed(1),
    innerSilences: inner,
    speechSec: +speechSec.toFixed(3),
    syllables,
    syllablesPerSec: sps,
    flags,
  };
};
