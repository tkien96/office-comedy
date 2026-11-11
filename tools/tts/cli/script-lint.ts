// npm run script:lint -- EP001
// Static checks of an episode script against the project's language rules
// (CLAUDE.md). Offline; prints problems and a rough duration estimate.
import { readFileSync } from "node:fs";
import { resolveEpisode } from "../../episode/paths.ts";

type Beat = { id: string; scene: string; kind: "line" | "action"; role?: string; text?: string; sec?: number; sameTurn?: boolean };
type Ep = {
  scenes: { id: string; speakers: string[] }[];
  beats: Beat[];
  timing: { turnGapSec: number; sameTurnGapSec: number; leadInSec: number };
  duration: { minSec: number; targetRangeSec: [number, number] };
};

const file = resolveEpisode(process.argv[2] ?? "EP001").script;
const ep = JSON.parse(readFileSync(file, "utf8")) as Ep;
const problems: string[] = [];
const notes: string[] = [];

const MAX_CHARS = 58; // ~2 subtitle lines at the project's subtitle size
const SOUTHERN = /\b(nha|nè|thiệt|giùm|tụi|hông|nhen|vầy|mấy cái)\b/iu;
const speakerOf = (role: string) => (role === "narrator" ? "kien" : role);
const syll = (t: string) => t.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

for (const s of ep.scenes) {
  const speakers = new Set(ep.beats.filter((b) => b.scene === s.id && b.kind === "line").map((b) => speakerOf(b.role!)));
  if (speakers.size > 2) problems.push(`${s.id}: ${speakers.size} nhân vật có thoại (${[...speakers].join(", ")}), tối đa 2.`);
}

let est = ep.timing.leadInSec;
let prevLine = false;
for (const b of ep.beats) {
  if (b.kind === "action") {
    if (!(b.sec! > 0)) problems.push(`${b.id}: nhịp hành động thiếu "sec".`);
    est += b.sec ?? 0;
    prevLine = false;
    continue;
  }
  const t = b.text!;
  const n = [...t].length;
  if (n > MAX_CHARS) problems.push(`${b.id}: ${n} ký tự > ${MAX_CHARS} (phụ đề có thể quá 2 dòng).`);
  if (b.role === "sep" && SOUTHERN.test(t)) problems.push(`${b.id} (Sếp, miền Bắc) có từ miền Nam: "${t}"`);
  if ((b.role === "kien" || b.role === "trinh") && /\bsếp\b/iu.test(t) === false && /\banh\b/iu.test(t) && ep.scenes.find((s) => s.id === b.scene)?.speakers.includes("sep")) {
    notes.push(`${b.id}: ${b.role} nói "anh" trong cảnh có Sếp. Kiểm tra lại không phải đang gọi Sếp: "${t}"`);
  }
  if (b.role === "narrator" && !/\btôi\b/iu.test(t)) notes.push(`${b.id}: lời dẫn không có "tôi" (ngôi thứ nhất vẫn có thể ngầm hiểu): "${t}"`);
  if (prevLine) est += b.sameTurn ? ep.timing.sameTurnGapSec : ep.timing.turnGapSec;
  est += syll(t) / 4.7 + 0.15; // rough: ~4.7 syllables/s + edge silence
  prevLine = true;
}
const sepCount = ep.beats.filter((b) => b.kind === "line" && (b.role === "kien" || b.role === "trinh") && /\bsếp\b/iu.test(b.text!)).length;
notes.push(`Số câu Kiên/Trinh có từ "sếp": ${sepCount}`);

const { minSec, targetRangeSec } = ep.duration;
console.log(
  `Ước lượng (chỉ để định hướng; thời lượng thật đo sau khi tạo âm thanh): ~${est.toFixed(1)} s. ` +
    `Tối thiểu ${minSec} s, mục tiêu ${targetRangeSec[0]}–${targetRangeSec[1]} s.`,
);
if (est < minSec) notes.push(`Ước lượng dưới ${minSec} s: cân nhắc bổ sung diễn biến (không thêm lặng hay làm chậm).`);
for (const n of notes) console.log(`LƯU Ý: ${n}`);
for (const p of problems) console.log(`LỖI: ${p}`);
if (problems.length) process.exit(1);
console.log("Không có lỗi tĩnh.");
