// npm run tts:vieneu:dialogue -- [config] [--dry-run]
// Generates each line separately (cached), trims only CONFIRMED extra
// leading/trailing noise, matches perceived loudness (EBU R128 LUFS, not
// peak), then joins the lines with the configured pauses.
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, win32 } from "node:path";
import {
  analyzeEdges,
  applyEdges,
  concat,
  decode,
  EDGE_RULES,
  encodeWav,
  gain,
  loudness,
  SR,
  silence,
} from "../audio.ts";
import { entryDir } from "../cache.ts";
import { qcAudio } from "../qc.ts";
import { synthesize } from "../synthesize.ts";
import type { VoiceSettings } from "../types.ts";
import { listVieneuVoices, VieneuProvider } from "../vieneu.ts";

type Line = { role: string; text: string; gapBeforeSec?: number; gapNote?: string };
/** Either a preset name or a reference clip declared in config/voice-refs.json. */
type VoiceSpec = { preset: string } | { reference: string };
type Config = {
  campaign: string;
  /** Legacy: take voice IDs + settings from a previous sample log. */
  voicesFromSamples?: Record<string, string> & { summary: string };
  /** Explicit voices (preset or reference) + shared settings. */
  voices?: Record<string, VoiceSpec>;
  settings?: VoiceSettings;
  mix: { targetLufs: number; maxTruePeakDb: number; defaultGapSec: number };
  lines: Line[];
};
type RefEntry = {
  extracted: { file: string; sha256: string; durationSec: number };
  usable: boolean;
  usableReason: string;
  rights: { confirmed: boolean; note: string };
};
const EXPECTED_GENDER: Record<string, string> = { kien: "male", trinh: "female", sep: "male", narrator: "male" };
const roleRegion = (role: string): string => {
  const casting = JSON.parse(readFileSync("config/casting.json", "utf8")) as { roles: Record<string, { region?: string }> };
  const r = casting.roles[role]?.region;
  if (!r) throw new Error(`config/casting.json chưa ghi region cho vai ${role}.`);
  return r;
};
type SampleResult = { file?: string; role?: string; voiceId?: string; settings?: VoiceSettings; model?: string };

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const cfgPath = args.find((a) => !a.startsWith("--")) ?? "tools/tts/auditions/dialogue-01.json";
const cfg = JSON.parse(readFileSync(cfgPath, "utf8")) as Config;

const r2 = (x: number) => Math.round(x * 100) / 100;

const main = async () => {
  type Resolved = { voiceId: string; label: string; settings: VoiceSettings; sampleModel: string | null; refFile?: string; refSha?: string };
  const voices: Record<string, Resolved> = {};
  const roles = [...new Set(cfg.lines.map((l) => l.role))];

  if (cfg.voicesFromSamples) {
    // Legacy: voice IDs + settings from the sample LOG, never from file names.
    const summary = JSON.parse(readFileSync(cfg.voicesFromSamples.summary, "utf8")) as { results: SampleResult[] };
    for (const role of roles) {
      const fileName = cfg.voicesFromSamples[role];
      const hit = summary.results.find((r) => r.file && win32.basename(r.file) === fileName);
      if (!hit?.voiceId || !hit.settings || !hit.model) throw new Error(`Không tìm thấy mẫu ${fileName} cho vai ${role} trong log.`);
      if (hit.role !== role) throw new Error(`Mẫu ${fileName} thuộc vai ${hit.role}, không phải ${role}.`);
      voices[role] = { voiceId: hit.voiceId, label: hit.voiceId, settings: hit.settings, sampleModel: hit.model };
    }
  } else {
    if (!cfg.voices || !cfg.settings) throw new Error("Cấu hình cần voices + settings hoặc voicesFromSamples.");
    const meta = await listVieneuVoices();
    const refs = (JSON.parse(readFileSync("config/voice-refs.json", "utf8")) as { refs: Record<string, RefEntry> }).refs;
    for (const role of roles) {
      const spec = cfg.voices[role];
      if (!spec) throw new Error(`Thiếu giọng cho vai ${role}.`);
      if ("preset" in spec) {
        const v = meta.voices.find((x) => x.voice_id === spec.preset);
        if (!v) throw new Error(`Preset "${spec.preset}" không có trong metadata gói đã cài.`);
        // Region per role comes from config/casting.json (Kiên/Trinh/người kể: Nam; Sếp: Bắc).
        const wantRegion = roleRegion(role);
        if (v.region !== wantRegion) throw new Error(`Preset "${spec.preset}" có region=${v.region}, vai ${role} cần ${wantRegion}.`);
        if (EXPECTED_GENDER[role] && v.gender !== EXPECTED_GENDER[role]) throw new Error(`Preset "${spec.preset}" sai giới tính cho vai ${role}.`);
        voices[role] = { voiceId: spec.preset, label: spec.preset, settings: cfg.settings, sampleModel: null };
      } else {
        const r = refs[spec.reference];
        if (!r) throw new Error(`Không có tham chiếu "${spec.reference}" trong config/voice-refs.json.`);
        // Hard gates: only clone voices whose use is confirmed and whose source is clean enough.
        if (!r.rights.confirmed) throw new Error(`Chưa xác nhận quyền dùng giọng tham chiếu "${spec.reference}": ${r.rights.note}`);
        if (!r.usable) throw new Error(`Tham chiếu "${spec.reference}" không đạt: ${r.usableReason}`);
        if (r.extracted.durationSec > 8.0) throw new Error(`Tham chiếu "${spec.reference}" dài hơn 8,0 s (model sẽ tự cắt).`);
        voices[role] = { voiceId: "", label: `ref-${spec.reference}`, settings: cfg.settings, sampleModel: null, refFile: r.extracted.file, refSha: r.extracted.sha256 };
      }
    }
  }
  console.log("Giọng theo vai:");
  for (const [r, v] of Object.entries(voices)) console.log(`  ${r} → ${v.refFile ? `tham chiếu ${v.refFile}` : `"${v.voiceId}"`} ${JSON.stringify(v.settings)}`);
  for (const l of cfg.lines) console.log(`  [${l.role}] ${l.text}${l.gapBeforeSec !== undefined ? `  (khoảng lặng trước ${l.gapBeforeSec}s)` : ""}`);
  if (dryRun) return console.log("--dry-run: không tạo âm thanh.");

  // 2) Generate each line separately.
  const provider = new VieneuProvider();
  for (const v of Object.values(voices)) {
    if (v.refFile) v.voiceId = provider.registerReference(v.refFile, v.refSha);
  }
  const info = await provider.start();
  const modelId = provider.modelId();
  for (const [r, v] of Object.entries(voices)) {
    if (v.sampleModel && v.sampleModel !== modelId) throw new Error(`Model hiện tại khác model lúc tạo mẫu vai ${r}: ${v.sampleModel}`);
  }
  const outDir = join("out", "tts-vieneu", cfg.campaign);
  const rawDir = join(outDir, "raw");
  mkdirSync(rawDir, { recursive: true });

  const raws: { line: Line; idx: number; rawFile: string; cacheKey: string; fromCache: boolean; createdAt: string }[] = [];
  try {
    for (const [i, line] of cfg.lines.entries()) {
      const v = voices[line.role];
      const label = `${String(i + 1).padStart(2, "0")}_${line.role}`;
      const { meta, fromCache } = await synthesize(
        provider,
        { text: line.text, voiceId: v.voiceId, modelId, languageCode: "vi", settings: v.settings, seed: null, outputFormat: `wav-pcm16-${info.sample_rate}` },
        { campaign: cfg.campaign, budgetChars: 5000, label, maxAttempts: 2, timeoutMs: 10 * 60_000 },
      );
      const rawFile = join(rawDir, `${label}_raw.wav`);
      copyFileSync(join(entryDir(meta.key), meta.audioFile), rawFile);
      raws.push({ line, idx: i, rawFile, cacheKey: meta.key, fromCache, createdAt: meta.createdAt });
      console.log(`Tạo ${label}${fromCache ? " (cache)" : ""}`);
    }
  } finally {
    provider.close();
  }

  // 3) Edges: trim only confirmed extra noise/silence.
  const processed = raws.map((r) => {
    const s = decode(r.rawFile);
    const edges = analyzeEdges(s);
    return { ...r, samples: applyEdges(s, edges), edges, rawDurationSec: s.length / SR };
  });

  // 4) Loudness: measure each trimmed line, gain to a common LUFS target.
  const tmp = join(outDir, "_tmp.wav");
  const measured = processed.map((p) => {
    encodeWav(p.samples, tmp);
    return loudness(tmp);
  });
  let target = cfg.mix.targetLufs;
  // Lower the common target if any line would exceed the true-peak ceiling.
  for (const m of measured) {
    const tpAfter = m.truePeakDb + (target - m.lufs);
    if (tpAfter > cfg.mix.maxTruePeakDb) target -= tpAfter - cfg.mix.maxTruePeakDb;
  }

  const lineRows: Record<string, unknown>[] = [];
  const parts: Float32Array[] = [];
  const timeline: { role: string; text: string; startSec: number; endSec: number; speechStartSec: number; speechEndSec: number }[] = [];
  let cursor = 0;
  for (const [k, p] of processed.entries()) {
    const g = target - measured[k].lufs;
    const leveled = gain(p.samples, g);
    const label = `${String(p.idx + 1).padStart(2, "0")}_${p.line.role}__${slugVoice(voices[p.line.role].label)}`;
    const lineFile = join(outDir, `${label}.wav`);
    encodeWav(leveled, lineFile);
    const after = loudness(lineFile);
    const qc = qcAudio(lineFile, p.line.text);

    // Gap = silence between the END OF SPEECH of the previous line and the
    // START OF SPEECH of this one (kept tail + inserted pause + kept lead-in).
    const wantGap = k === 0 ? 0 : p.line.gapBeforeSec ?? cfg.mix.defaultGapSec;
    let pause = 0;
    let gapNote: string | null = null;
    if (k > 0) {
      const prev = processed[k - 1].edges;
      const prevTailKept = prev.keepEndSec - prev.lastSpeechSec;
      const leadKept = p.edges.onsetSec - p.edges.keepStartSec;
      pause = Math.max(0, wantGap - prevTailKept - leadKept);
      if (wantGap - prevTailKept - leadKept < 0) {
        gapNote = `Khoảng lặng tự nhiên ${r2(prevTailKept + leadKept)} s đã dài hơn mục tiêu ${wantGap} s`;
      }
      parts.push(silence(pause));
      cursor += pause;
    }
    const startSec = cursor;
    const lenSec = leveled.length / SR;
    timeline.push({
      role: p.line.role,
      text: p.line.text,
      startSec: Math.round(startSec * 1000) / 1000,
      endSec: Math.round((startSec + lenSec) * 1000) / 1000,
      speechStartSec: Math.round((startSec + (p.edges.onsetSec - p.edges.keepStartSec)) * 1000) / 1000,
      speechEndSec: Math.round((startSec + (p.edges.lastSpeechSec - p.edges.keepStartSec)) * 1000) / 1000,
    });
    parts.push(leveled);
    cursor += lenSec;

    lineRows.push({
      file: lineFile,
      rawFile: p.rawFile,
      role: p.line.role,
      voiceId: voices[p.line.role].voiceId,
      status: "chưa duyệt",
      text: p.line.text,
      model: modelId,
      settings: voices[p.line.role].settings,
      createdAt: p.createdAt,
      fromCache: p.fromCache,
      cacheKey: p.cacheKey,
      rawDurationSec: r2(p.rawDurationSec),
      edges: p.edges,
      loudnessBefore: measured[k],
      gainDb: r2(g),
      loudnessAfter: after,
      targetGapBeforeSec: wantGap,
      insertedPauseSec: Math.round(pause * 1000) / 1000,
      gapNote: gapNote ?? p.line.gapNote ?? null,
      qc,
    });
    console.log(
      `${label}: thô ${r2(p.rawDurationSec)}s → ${r2(lenSec)}s · đầu: ${p.edges.leading.trimmed ? "CẮT" : "giữ"} (${p.edges.leading.reason}) · ` +
        `${measured[k].lufs} → ${after.lufs} LUFS (gain ${r2(g)} dB, TP ${after.truePeakDb} dBTP)${qc.flags.length ? " · CỜ: " + qc.flags.join("; ") : ""}`,
    );
  }

  const full = concat(parts);
  const fullFile = join(outDir, `${cfg.campaign}_ghep.wav`);
  encodeWav(full, fullFile);
  const fullLoud = loudness(fullFile);
  const fullQc = qcAudio(fullFile, cfg.lines.map((l) => l.text).join(" "));
  rmSync(tmp, { force: true });

  writeFileSync(
    join(outDir, "summary.json"),
    JSON.stringify(
      { campaign: cfg.campaign, status: "chưa duyệt", engine: info, modelId, edgeRules: EDGE_RULES, mix: { ...cfg.mix, appliedTargetLufs: r2(target) }, full: { file: fullFile, durationSec: r2(full.length / SR), ...fullLoud, qc: fullQc }, timeline, lines: lineRows },
      null,
      2,
    ) + "\n",
  );
  console.log(`\nFile ghép: ${fullFile} · ${r2(full.length / SR)} s · ${fullLoud.lufs} LUFS · TP ${fullLoud.truePeakDb} dBTP`);
  console.log(`Đã ghi ${join(outDir, "summary.json")}`);
};

const slugVoice = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();

main().catch((err) => {
  console.error(`Lỗi: ${(err as Error).message}`);
  process.exit(1);
});
