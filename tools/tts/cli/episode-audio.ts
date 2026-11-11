// npm run episode:audio -- EP001 [--dry-run]
// Builds the full-episode dialogue preview on a DYNAMIC timeline:
// 1) every line with the APPROVED voice of its role (config/casting.json),
//    cached by content/voice/model/settings (exact match only);
// 2) trims only confirmed extra silence, levels by EBU R128 (LUFS);
// 3) places lines at their natural length with fixed speech-to-speech gaps
//    and each action beat at its own content-based length (`sec`).
// Total = end of the last item; durationInFrames = ceil(total * fps).
// Nothing is stretched, sped up, padded or trimmed to hit a target length.
// Below the project minimum (60 s) it stops: add story, not silence.
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { analyzeEdges, applyEdges, concat, decode, EDGE_RULES, encodeWav, gain, loudness, SR, silence } from "../audio.ts";
import { entryDir } from "../cache.ts";
import { qcAudio } from "../qc.ts";
import { synthesize } from "../synthesize.ts";
import type { VoiceSettings } from "../types.ts";
import { VieneuProvider } from "../vieneu.ts";
import { resolveEpisode } from "../../episode/paths.ts";

type Beat = {
  id: string;
  scene: string;
  kind: "line" | "action";
  role?: string;
  text?: string;
  sameTurn?: boolean;
  gapBeforeSec?: number;
  /** Action beats: content-based length in seconds (no speech during it). */
  sec?: number;
  desc?: string;
};
type Episode = {
  id: string;
  duration: { minSec: number; targetRangeSec: [number, number] };
  fps: number;
  timing: { turnGapSec: number; sameTurnGapSec: number; leadInSec: number };
  beats: Beat[];
};
type Approved = { voiceId: string; referenceFile: string; referenceSha256: string; model: string; settings: VoiceSettings; ref: string };

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const P = resolveEpisode(args.find((a) => !a.startsWith("--")) ?? "EP001");
const file = P.script;
const ep = JSON.parse(readFileSync(file, "utf8")) as Episode;
const epDir = P.root;
const MIX = { targetLufs: -18, maxTruePeakDb: -1.5 };
const r3 = (x: number) => Math.round(x * 1000) / 1000;

const main = async () => {
  const casting = JSON.parse(readFileSync("config/casting.json", "utf8")) as { roles: Record<string, { approved: Approved | null }> };
  const refs = JSON.parse(readFileSync("config/voice-refs.json", "utf8")).refs as Record<string, { rights: { confirmed: boolean }; extracted: { sha256: string } }>;
  const lines = ep.beats.filter((b) => b.kind === "line");
  const roles = [...new Set(lines.map((b) => b.role!))];
  const voices: Record<string, Approved> = {};
  for (const r of roles) {
    const a = casting.roles[r]?.approved;
    if (!a) throw new Error(`Vai ${r} chưa có giọng đã duyệt trong config/casting.json.`);
    if (!refs[a.ref]?.rights.confirmed) throw new Error(`Tham chiếu ${a.ref} chưa xác nhận quyền.`);
    if (refs[a.ref].extracted.sha256 !== a.referenceSha256) throw new Error(`Tham chiếu ${a.ref} khác bản đã duyệt.`);
    voices[r] = a;
  }
  console.log(`${ep.id}: ${lines.length} câu, ${ep.beats.length - lines.length} nhịp hành động, vai: ${roles.join(", ")}`);
  if (dryRun) return console.log("--dry-run: không tạo âm thanh.");

  // 1) Generate (or reuse exact cache) per line.
  const provider = new VieneuProvider();
  const ids = new Map<string, string>();
  for (const r of roles) ids.set(r, provider.registerReference(voices[r].referenceFile, voices[r].referenceSha256));
  const info = await provider.start();
  const modelId = provider.modelId();
  for (const r of roles) if (voices[r].model !== modelId) throw new Error(`Model đang chạy khác model đã duyệt cho vai ${r}.`);

  const linesDir = P.linesDir;
  mkdirSync(join(linesDir, "raw"), { recursive: true });
  type Gen = { beat: Beat; raw: string; cacheKey: string; fromCache: boolean; createdAt: string };
  const gens: Gen[] = [];
  try {
    for (const [i, b] of lines.entries()) {
      const v = voices[b.role!];
      const label = `${String(i + 1).padStart(2, "0")}_${b.id}_${b.role}`;
      const { meta, fromCache } = await synthesize(
        provider,
        { text: b.text!, voiceId: ids.get(b.role!)!, modelId, languageCode: "vi", settings: v.settings, seed: null, outputFormat: `wav-pcm16-${info.sample_rate}` },
        { campaign: `episode-${ep.id}`, budgetChars: 20000, label, maxAttempts: 2, timeoutMs: 10 * 60_000 },
      );
      const raw = join(linesDir, "raw", `${label}_raw.wav`);
      copyFileSync(join(entryDir(meta.key), meta.audioFile), raw);
      gens.push({ beat: b, raw, cacheKey: meta.key, fromCache, createdAt: meta.createdAt });
      console.log(`${fromCache ? "cache" : "tạo "} ${label}`);
    }
  } finally {
    provider.close();
  }

  // 2) Edges + loudness.
  const proc = gens.map((g) => {
    const s = decode(g.raw);
    const edges = analyzeEdges(s);
    return { ...g, samples: applyEdges(s, edges), edges, rawSec: s.length / SR };
  });
  const tmp = join(epDir, "_tmp.wav");
  const before = proc.map((p) => {
    encodeWav(p.samples, tmp);
    return loudness(tmp);
  });
  let target = MIX.targetLufs;
  for (const m of before) {
    const tp = m.truePeakDb + (target - m.lufs);
    if (tp > MIX.maxTruePeakDb) target -= tp - MIX.maxTruePeakDb;
  }

  // 3) Timeline from natural lengths: lines + speech-to-speech gaps + actions.
  const leadKept = new Map(proc.map((p) => [p.beat.id, p.edges.onsetSec - p.edges.keepStartSec]));
  const tailKept = new Map(proc.map((p) => [p.beat.id, p.edges.keepEndSec - p.edges.lastSpeechSec]));
  type Slot = { beat: Beat; pauseBefore: number; actionSec?: number };
  const slots: Slot[] = [];
  let prev: Beat | null = null;
  const notes: string[] = [];
  for (const b of ep.beats) {
    if (b.kind === "action") {
      if (!(b.sec! > 0)) throw new Error(`Nhịp hành động ${b.id} thiếu "sec" (thời lượng theo nội dung).`);
      slots.push({ beat: b, pauseBefore: 0, actionSec: b.sec! });
      prev = b;
      continue;
    }
    let pause = 0;
    if (!prev) pause = Math.max(0, ep.timing.leadInSec - leadKept.get(b.id)!);
    else if (prev.kind === "line") {
      const want = b.gapBeforeSec ?? (b.sameTurn ? ep.timing.sameTurnGapSec : ep.timing.turnGapSec);
      const natural = tailKept.get(prev.id)! + leadKept.get(b.id)!;
      if (natural > want) notes.push(`${prev.id}→${b.id}: khoảng lặng tự nhiên ${r3(natural)} s > mục tiêu ${want} s`);
      pause = Math.max(0, want - natural);
    }
    slots.push({ beat: b, pauseBefore: pause });
    prev = b;
  }
  // 4) Render the timeline at natural length. Positions come from the real
  //    sample count so nothing drifts through rounding.
  const parts: Float32Array[] = [];
  const items: Record<string, unknown>[] = [];
  let samplesSoFar = 0;
  const push = (a: Float32Array) => {
    parts.push(a);
    samplesSoFar += a.length;
  };
  let cursor = 0;
  const lineRows = new Map(proc.map((p, k) => [p.beat.id, { p, k }]));
  mkdirSync(linesDir, { recursive: true });
  for (const s of slots) {
    cursor = samplesSoFar / SR;
    if (s.beat.kind === "action") {
      const sil = silence(s.actionSec!);
      push(sil);
      const sec = sil.length / SR;
      items.push({ id: s.beat.id, scene: s.beat.scene, kind: "action", startSec: r3(cursor), endSec: r3(cursor + sec), durationSec: r3(sec), startFrame: Math.round(cursor * ep.fps), endFrame: Math.round((cursor + sec) * ep.fps), desc: s.beat.desc });
      continue;
    }
    if (s.pauseBefore > 0) push(silence(s.pauseBefore));
    cursor = samplesSoFar / SR;
    const { p, k } = lineRows.get(s.beat.id)!;
    const g = target - before[k].lufs;
    const leveled = gain(p.samples, g);
    const out = join(linesDir, `${String(k + 1).padStart(2, "0")}_${p.beat.id}_${p.beat.role}.wav`);
    encodeWav(leveled, out);
    const after = loudness(out);
    const qc = qcAudio(out, p.beat.text!);
    const len = leveled.length / SR;
    items.push({
      id: p.beat.id,
      scene: p.beat.scene,
      kind: "line",
      role: p.beat.role,
      voiceId: voices[p.beat.role!].voiceId,
      text: p.beat.text,
      file: out.replace(/\\/g, "/"),
      startSec: r3(cursor),
      endSec: r3(cursor + len),
      speechStartSec: r3(cursor + (p.edges.onsetSec - p.edges.keepStartSec)),
      speechEndSec: r3(cursor + (p.edges.lastSpeechSec - p.edges.keepStartSec)),
      startFrame: Math.round(cursor * ep.fps),
      endFrame: Math.round((cursor + len) * ep.fps),
      cacheKey: p.cacheKey,
      fromCache: p.fromCache,
      createdAt: p.createdAt,
      rawSec: r3(p.rawSec),
      edges: { leading: p.edges.leading, trailing: p.edges.trailing },
      loudness: { before: before[k], gainDb: r3(g), after },
      qc,
    });
    push(leveled);
  }

  // Total = end of the last item on the timeline (audio or action), measured.
  const contentEnd = samplesSoFar / SR;
  const durationInFrames = Math.ceil(contentEnd * ep.fps - 1e-9);
  const frameAlignedSec = durationInFrames / ep.fps;
  // Only pad the audio up to the last video frame boundary (< 1 frame) so the
  // audio and video end together; never pad to reach a target length.
  const frameTail = Math.round(frameAlignedSec * SR) - samplesSoFar;
  const full = concat(frameTail > 0 ? [...parts, new Float32Array(frameTail)] : parts);
  const preview = P.preview;
  mkdirSync(P.audioDir, { recursive: true });
  encodeWav(full, preview);
  rmSync(tmp, { force: true });
  const fullLoud = loudness(preview);

  const { minSec, targetRangeSec } = ep.duration;
  const status =
    contentEnd < minSec
      ? `DƯỚI ${minSec} s: cần bổ sung diễn biến (không chèn lặng, không làm chậm)`
      : contentEnd > targetRangeSec[1]
        ? `trên khoảng mục tiêu ${targetRangeSec[0]}–${targetRangeSec[1]} s (được phép nếu diễn biến cần)`
        : `trong khoảng mục tiêu ${targetRangeSec[0]}–${targetRangeSec[1]} s`;
  const lineSec = items.filter((i) => i.kind === "line").reduce((a, i) => a + ((i.endSec as number) - (i.startSec as number)), 0);
  const actionSec = items.filter((i) => i.kind === "action").reduce((a, i) => a + (i.durationSec as number), 0);

  const timeline = {
    episode: ep.id,
    contentEndSec: r3(contentEnd),
    durationSec: r3(frameAlignedSec),
    fps: ep.fps,
    durationInFrames,
    durationRule: "durationInFrames = ceil(contentEndSec × fps); contentEndSec = điểm kết thúc của mục cuối cùng trên timeline (âm thanh hoặc hành động)",
    minDurationSec: minSec,
    targetRangeSec,
    durationStatus: status,
    sampleRate: SR,
    model: modelId,
    voices: Object.fromEntries(roles.map((r) => [r, { voiceId: voices[r].voiceId, ref: voices[r].ref, settings: voices[r].settings }])),
    mix: { ...MIX, appliedTargetLufs: r3(target), preview: preview.replace(/\\/g, "/"), ...fullLoud },
    edgeRules: EDGE_RULES,
    breakdown: { lineClipsSec: r3(lineSec), actionSec: r3(actionSec), gapsSec: r3(contentEnd - lineSec - actionSec), frameAlignTailSec: r3(frameAlignedSec - contentEnd), gapNotes: notes },
    items,
  };
  writeFileSync(P.timeline, JSON.stringify(timeline, null, 2) + "\n");

  // 5) Captions: one cue per line, speech start → speech end (sentence-level).
  const fmt = (t: number) => {
    const ms = Math.round(t * 1000);
    const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000), f = ms % 1000;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(f).padStart(3, "0")}`;
  };
  const cues = items.filter((i) => i.kind === "line") as { speechStartSec: number; speechEndSec: number; text: string; role: string }[];
  const srt = cues.map((c, i) => `${i + 1}\n${fmt(c.speechStartSec)} --> ${fmt(c.speechEndSec)}\n${c.text}\n`).join("\n");
  mkdirSync(P.exportsDir, { recursive: true });
  writeFileSync(P.captions, srt, "utf8");

  console.log(`\nTimeline: nội dung kết thúc ở ${r3(contentEnd)} s → ${durationInFrames} khung hình (${r3(frameAlignedSec)} s) · ${status}`);
  console.log(`  clip lời ${r3(lineSec)} s · hành động ${r3(actionSec)} s · khoảng lặng giữa câu ${r3(contentEnd - lineSec - actionSec)} s`);
  console.log(`Preview: ${preview} · ${r3(full.length / SR)} s · ${fullLoud.lufs} LUFS · TP ${fullLoud.truePeakDb} dBTP (mục tiêu áp dụng ${r3(target)} LUFS)`);
  for (const n of notes) console.log(`LƯU Ý: ${n}`);
  if (contentEnd < minSec) {
    console.error(`\nDỪNG: ${ep.id} dài ${r3(contentEnd)} s < ${minSec} s. Bổ sung diễn biến có giá trị trong kịch bản rồi chạy lại.`);
    process.exit(2);
  }
};

main().catch((err) => {
  console.error(`Lỗi: ${(err as Error).message}`);
  process.exit(1);
});
