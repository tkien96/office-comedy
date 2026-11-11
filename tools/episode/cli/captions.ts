// npm run episode:captions -- EP001 [--check]
//
// Rebuilds exports/EPxxx.srt from the measured timeline (deterministic) and
// writes reports/captions-qc.md: automatic checks + what still needs a human
// to watch/listen. --check: only compare, write nothing to exports/.
// Never marks captions approved (the user runs episode:approve).
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { buildCues, buildSrt, CAPTION_RULES, parseSrt, readTimeline, srtTime } from "../captions.ts";
import { checkApproval, currentSources, hashText, readManifest } from "../manifest.ts";
import { rel, resolveEpisode } from "../paths.ts";

const args = process.argv.slice(2);
const P = resolveEpisode(args.find((a) => !a.startsWith("--")) ?? "EP001");
const checkOnly = args.includes("--check");
const tl = readTimeline(P);
const script = JSON.parse(readFileSync(P.script, "utf8")) as {
  scenes: { id: string; speakers: string[] }[];
  beats: { id: string; scene: string; kind: string; role?: string; text?: string }[];
};
const m = readManifest(P);
const cues = buildCues(tl);
const srt = buildSrt(tl);
const videoEnd = tl.durationInFrames / tl.fps;

type F = { level: "LỖI" | "CẢNH BÁO" | "GHI CHÚ"; cue?: number; msg: string };
const f: F[] = [];
const err = (msg: string, cue?: number) => f.push({ level: "LỖI", msg, cue });
const warn = (msg: string, cue?: number) => f.push({ level: "CẢNH BÁO", msg, cue });
const note = (msg: string, cue?: number) => f.push({ level: "GHI CHÚ", msg, cue });
const len = (s: string) => [...s].length;

// 1) Text = what was actually synthesized (timeline) = script.
const scriptLines = script.beats.filter((b) => b.kind === "line");
if (scriptLines.length !== cues.length) err(`Số câu: kịch bản ${scriptLines.length}, timeline ${cues.length}.`);
const beatOf = new Map(script.beats.map((b) => [b.id, b]));
for (const c of cues) {
  const b = beatOf.get(c.id);
  if (!b) err(`${c.id} không có trong kịch bản.`, c.index);
  else if (b.text !== c.text) err(`Chữ khác kịch bản: "${c.text}" ≠ "${b.text}".`, c.index);
  if (c.lines.join(" ") !== c.text) err("Ngắt dòng làm đổi chữ.", c.index);
}

// 2) Timing.
cues.forEach((c, i) => {
  const item = tl.items.find((x) => x.id === c.id)!;
  if (c.start < 0 || c.end <= c.start) err(`Mốc không hợp lệ ${c.start}–${c.end}.`, c.index);
  if (c.end > videoEnd + 1e-6) err(`Kết thúc ${c.end} s vượt thời lượng video ${videoEnd.toFixed(3)} s.`, c.index);
  if (c.speechStart < item.startSec - 1e-6 || c.speechEnd > item.endSec + 1e-6) err("Khoảng lời nằm ngoài clip của câu trên timeline.", c.index);
  const next = cues[i + 1];
  if (next && c.end > next.start) err(`Chồng lên cue ${next.index} (${srtTime(c.end)} > ${srtTime(next.start)}).`, c.index);
  else if (next && next.start - c.end < CAPTION_RULES.minGapSec - 1e-6)
    warn(`Sát cue ${next.index} (${Math.round((next.start - c.end) * 1000)} ms), có thể nháy.`, c.index);
  const d = c.end - c.start;
  if (d < CAPTION_RULES.minDisplaySec - 1e-6) warn(`Hiển thị ${d.toFixed(2)} s < ${CAPTION_RULES.minDisplaySec} s (không kéo dài được vì sát câu sau).`, c.index);
  if (c.extended)
    note(`Lời dài ${(c.speechEnd - c.speechStart).toFixed(2)} s; giữ chữ trên màn hình ${d.toFixed(2)} s (kéo vào khoảng lặng sau câu, không chồng câu sau).`, c.index);
  const cps = len(c.text.replace(/\s/g, "")) / d;
  if (cps > CAPTION_RULES.maxCharsPerSec) warn(`Tốc độ đọc ${cps.toFixed(1)} ký tự/giây > ${CAPTION_RULES.maxCharsPerSec}.`, c.index);
});

// 3) Layout + hygiene.
for (const c of cues) {
  if (c.lines.length > CAPTION_RULES.maxLines) err(`${c.lines.length} dòng > ${CAPTION_RULES.maxLines}.`, c.index);
  for (const l of c.lines) if (len(l) > CAPTION_RULES.maxLineChars) err(`Dòng ${len(l)} ký tự > ${CAPTION_RULES.maxLineChars}: "${l}"`, c.index);
  if (c.text !== c.text.normalize("NFC")) err("Chữ chưa chuẩn hoá Unicode NFC (dấu tiếng Việt tách rời).", c.index);
  if (/\s{2,}|^\s|\s$|\s[,.?!…]/.test(c.text)) err("Khoảng trắng thừa hoặc trước dấu câu.", c.index);
  if (/\.\.\./.test(c.text)) warn('Dùng "..." thay vì "…".', c.index);
  if (!/[.?!…]$/.test(c.text)) warn("Câu không kết thúc bằng dấu câu.", c.index);
  if (/(^|[^\p{L}])(Nam|Linh|Kien|Kiến|Trin)(?![\p{L}])/u.test(c.text)) err("Có tên cũ hoặc tên viết sai (Nam/Linh/Kien/Kiến/Trin).", c.index);
}

// 4) Addressing (CLAUDE.md): Kiên/Trinh → Sếp: "sếp"/"em"; Kiên ↔ Trinh: anh–em; Sếp: "anh"/"em".
const word = (w: string) => new RegExp(`(^|[^\\p{L}])(${w})(?![\\p{L}])`, "iu");
const sceneSpeakers = new Map(script.scenes.map((s) => [s.id, s.speakers]));
const addressing: string[] = [];
for (const c of cues) {
  const b = beatOf.get(c.id)!;
  const withSep = (sceneSpeakers.get(b.scene) ?? []).includes("sep");
  const t = c.text;
  const who = c.role === "kien" ? "Kiên" : "Trinh";
  if ((c.role === "kien" || c.role === "trinh") && withSep) {
    if (word("sếp").test(t) && word("anh").test(t)) err(`Gọi Sếp nhưng có "anh": "${t}"`, c.index);
    if (word("tôi|mình").test(t)) err(`Nói với Sếp nhưng không xưng "em": "${t}"`, c.index);
    addressing.push(`${c.index}. ${who} → Sếp: "${t}"`);
  } else if (c.role === "kien" || c.role === "trinh") {
    if (word("sếp").test(t)) note(`Nhắc "sếp" khi nói với đồng nghiệp: "${t}"`, c.index);
    if (word("anh|em").test(t)) addressing.push(`${c.index}. ${c.role === "kien" ? "Kiên → Trinh" : "Trinh → Kiên"}: "${t}"`);
  } else if (c.role === "sep") {
    if (word("tôi|ông").test(t)) err(`Sếp không xưng "anh": "${t}"`, c.index);
    if (word("anh|em").test(t)) addressing.push(`${c.index}. Sếp: "${t}"`);
  }
}

// 5) Audio of the APPROVED video: speech inside cues, no uncaptioned speech.
const readAudioDb = (): number[] | null => {
  if (!existsSync(P.video)) return null;
  const r = spawnSync("ffmpeg", ["-v", "error", "-i", P.video, "-map", "0:a:0", "-ac", "1", "-ar", "16000", "-f", "s16le", "-"], { maxBuffer: 1 << 28 });
  if (r.status !== 0) return null;
  const buf = Buffer.from(r.stdout);
  const pcm = new Int16Array(buf.buffer, buf.byteOffset, Math.floor(buf.length / 2));
  const hop = 160; // 10 ms @16 kHz
  const db: number[] = [];
  for (let i = 0; i + hop <= pcm.length; i += hop) {
    let s = 0;
    for (let j = i; j < i + hop; j++) s += pcm[j] * pcm[j];
    db.push(10 * Math.log10(s / hop / (32768 * 32768) + 1e-12));
  }
  return db;
};
const audio = readAudioDb();
const ACTIVE_DB = -45;
if (!audio) warn("Không đọc được âm thanh từ video (ffmpeg): bỏ qua kiểm tra theo âm thanh.");
else {
  const at = (t: number) => Math.min(audio.length - 1, Math.max(0, Math.floor(t * 100)));
  for (const c of cues) {
    const seg = audio.slice(at(c.speechStart), at(c.speechEnd));
    const ratio = seg.filter((d) => d > ACTIVE_DB).length / Math.max(1, seg.length);
    if (ratio < 0.4) warn(`Trong khoảng lời chỉ ${(ratio * 100).toFixed(0)}% khung 10 ms có tiếng (> ${ACTIVE_DB} dBFS).`, c.index);
    const head = Math.max(...audio.slice(at(c.speechStart), at(c.speechStart + 0.15)));
    const tail = Math.max(...audio.slice(at(c.speechEnd - 0.15), at(c.speechEnd)));
    if (head < ACTIVE_DB) warn("150 ms đầu cue chưa có tiếng (cue có thể hiện sớm).", c.index);
    if (tail < ACTIVE_DB) warn("150 ms cuối khoảng lời không có tiếng (lời có thể dứt sớm hơn).", c.index);
  }
  const covered = (t: number) => cues.some((c) => t >= c.speechStart - 0.1 && t <= c.speechEnd + 0.1);
  let run = 0;
  let from = 0;
  for (let i = 0; i <= audio.length; i++) {
    const active = i < audio.length && audio[i] > ACTIVE_DB && !covered(i / 100);
    if (active) {
      if (!run) from = i;
      run++;
    } else {
      if (run >= 25) err(`Có tiếng ${(run / 100).toFixed(2)} s ở ${(from / 100).toFixed(2)} s nhưng không có phụ đề.`);
      run = 0;
    }
  }
  note(`Âm thanh lấy từ video đã duyệt (${rel(P.video)}, ${(audio.length / 100).toFixed(2)} s). Cue cuối kết thúc ${Math.max(...cues.map((c) => c.end)).toFixed(3)} s; video dài ${videoEnd.toFixed(3)} s.`);
}

// 6) Round-trip of the generated file.
const parsed = parseSrt(srt);
if (
  parsed.length !== cues.length ||
  parsed.some((p, i) => Math.abs(p.start - cues[i].start) > 0.0015 || Math.abs(p.end - cues[i].end) > 0.0015 || p.lines.join(" ") !== cues[i].text)
)
  err("Đọc lại file SRT không khớp dữ liệu cue.");

const errors = f.filter((x) => x.level === "LỖI").length;
const warns = f.filter((x) => x.level === "CẢNH BÁO").length;

const before = hashText(P.captions);
if (!checkOnly) {
  mkdirSync(P.exportsDir, { recursive: true });
  writeFileSync(P.captions, srt, "utf8");
}
const after = hashText(P.captions);
const ap = checkApproval(m.approvals.captions, after, currentSources(P, m));
const role = (r: string) => ({ narrator: "Kiên (lời dẫn)", kien: "Kiên", trinh: "Trinh", sep: "Sếp" })[r] ?? r;

const md = `# Phụ đề ${P.id}: kiểm tra

File: \`${rel(P.captions)}\` · hash \`${after?.slice(0, 16)}\` · trạng thái duyệt: **${ap.detail}**

Tạo bằng \`npm run episode:captions -- ${P.id}\` từ \`${rel(P.timeline)}\` (khoảng lời đo trên âm thanh thật của từng câu). Chữ đúng nguyên văn câu đã tạo giọng; chỉ thêm ngắt dòng.

## Kiểm tra tự động

- ${cues.length} cue · ${errors} lỗi · ${warns} cảnh báo.
- Quy tắc: tối đa ${CAPTION_RULES.maxLines} dòng, ${CAPTION_RULES.maxLineChars} ký tự mỗi dòng. Hiển thị tối thiểu ${CAPTION_RULES.minDisplaySec} s: chỉ kéo vào khoảng lặng sau câu, không chồng câu sau, cách câu sau ít nhất 2 khung. Tốc độ đọc tối đa ${CAPTION_RULES.maxCharsPerSec} ký tự/giây.
- Đã kiểm:
  - chữ = timeline = kịch bản;
  - mốc nằm trong thời lượng video; không chồng cue; độ dài cue;
  - ngắt dòng; Unicode NFC; khoảng trắng và dấu câu;
  - tên Kiên/Trinh; xưng hô theo quan hệ;
  - tiếng nói trong âm thanh của video đã duyệt nằm trong cue, không có đoạn nói nào thiếu phụ đề.

${f.length ? f.map((x) => `- **${x.level}**${x.cue ? ` (cue ${x.cue})` : ""}: ${x.msg}`).join("\n") : "- Không có phát hiện."}

## Xưng hô (để đối chiếu nhanh)

${addressing.map((a) => `- ${a}`).join("\n")}

## Toàn bộ cue

| # | Thời gian | Hiển thị | Người nói | Chữ (ngắt dòng bằng /) |
|---|---|---|---|---|
${cues.map((c) => `| ${c.index} | ${srtTime(c.start)} → ${srtTime(c.end)} | ${(c.end - c.start).toFixed(2)} s${c.extended ? " *" : ""} | ${role(c.role)} | ${c.lines.join(" / ")} |`).join("\n")}

\\* Kéo dài hiển thị vào khoảng lặng sau câu cho đủ ${CAPTION_RULES.minDisplaySec} s.

## Cần người xem và nghe (máy không kiểm được)

- [ ] Chính tả và dấu tiếng Việt từng câu. Máy chỉ so với kịch bản, không bắt được lỗi có sẵn trong kịch bản.
- [ ] Chữ khớp lời nghe được. TTS có thể đọc lệch hoặc nuốt chữ mà mốc thời gian vẫn đúng.
- [ ] Ngắt dòng đọc tự nhiên, không tách cụm từ.
- [ ] Mở \`${rel(P.video)}\` bằng một trình phát (ví dụ VLC: Phụ đề → Thêm file phụ đề), nạp SRT, xem phụ đề hiện và ẩn đúng lúc.
- [ ] SRT không có nhãn người nói (video đã in phụ đề kèm nhãn). Quyết định có cần nhãn trong SRT không.

Duyệt sau khi xem: \`npm run episode:approve -- ${P.id} captions\`
`;
mkdirSync(P.reportsDir, { recursive: true });
writeFileSync(`${P.reportsDir}/captions-qc.md`, md);
console.log(
  `${checkOnly ? "Kiểm tra" : "Đã ghi"} ${rel(P.captions)} (${before === after ? "không đổi" : `đổi ${before?.slice(0, 12) ?? "∅"} → ${after?.slice(0, 12)}`}) · ${cues.length} cue · ${errors} lỗi · ${warns} cảnh báo`,
);
console.log(`Báo cáo: ${rel(P.reportsDir)}/captions-qc.md`);
if (errors) process.exit(1);
