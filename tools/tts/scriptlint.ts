// Static checks of an episode script against the project's language rules
// (CLAUDE.md). Pure function: shared by `npm run script:lint` and the Studio
// (AI drafts and manual edits). Offline; never calls TTS.
//
// "problems" block saving a draft; "notes" are warnings for the user to read.
// Passing lint does NOT mean the content is good — only that these rules hold.

export type LintBeat = { id: string; scene: string; kind: "line" | "action"; role?: string; text?: string; sec?: number; sameTurn?: boolean };
export type LintScript = {
  scenes: { id: string; speakers: string[] }[];
  beats: LintBeat[];
  timing: { turnGapSec: number; sameTurnGapSec: number; leadInSec: number };
  duration: { minSec: number; targetRangeSec: [number, number] };
};
export type LintResult = { problems: string[]; notes: string[]; estimateSec: number };

export const MAX_LINE_CHARS = 58; // ~2 subtitle lines at the project's subtitle size
const SOUTHERN = /(^|[^\p{L}])(nha|nè|thiệt|giùm|tụi|hông|nhen|vầy)(?![\p{L}])/iu;
const word = (w: string) => new RegExp(`(^|[^\\p{L}])(${w})(?![\\p{L}])`, "iu");
const speakerOf = (role: string) => (role === "narrator" ? "kien" : role);
const syll = (t: string) => t.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

export const lintScript = (ep: LintScript): LintResult => {
  const problems: string[] = [];
  const notes: string[] = [];

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
    const t = b.text ?? "";
    const n = [...t].length;
    if (n > MAX_LINE_CHARS) problems.push(`${b.id}: ${n} ký tự > ${MAX_LINE_CHARS} (phụ đề có thể quá 2 dòng).`);
    if (b.role === "sep" && SOUTHERN.test(t)) problems.push(`${b.id} (Sếp, miền Bắc) có từ miền Nam: "${t}"`);
    const sceneHasSep = ep.scenes.find((s) => s.id === b.scene)?.speakers.includes("sep");
    if ((b.role === "kien" || b.role === "trinh") && sceneHasSep) {
      if (word("sếp").test(t) && word("anh").test(t)) problems.push(`${b.id}: gọi Sếp nhưng có "anh" (Kiên/Trinh gọi Sếp là "sếp", xưng "em"): "${t}"`);
      else if (!word("sếp").test(t) && word("anh").test(t)) notes.push(`${b.id}: ${b.role} nói "anh" trong cảnh có Sếp. Kiểm tra lại không phải đang gọi Sếp: "${t}"`);
      if (word("tôi").test(t)) problems.push(`${b.id}: nói với Sếp nhưng xưng "tôi" (phải xưng "em"): "${t}"`);
    }
    if (b.role === "sep" && word("tôi").test(t)) problems.push(`${b.id}: Sếp xưng "tôi" (Sếp xưng "anh"): "${t}"`);
    if (b.role === "narrator" && !word("tôi").test(t)) notes.push(`${b.id}: lời dẫn không có "tôi" (ngôi thứ nhất vẫn có thể ngầm hiểu): "${t}"`);
    if (prevLine) est += b.sameTurn ? ep.timing.sameTurnGapSec : ep.timing.turnGapSec;
    est += syll(t) / 4.7 + 0.15; // rough: ~4.7 syllables/s + edge silence
    prevLine = true;
  }
  const sepCount = ep.beats.filter((b) => b.kind === "line" && (b.role === "kien" || b.role === "trinh") && word("sếp").test(b.text ?? "")).length;
  notes.push(`Số câu Kiên/Trinh có từ "sếp": ${sepCount}`);

  const { minSec } = ep.duration;
  if (est < minSec) notes.push(`Ước lượng ~${est.toFixed(1)} s, dưới ${minSec} s: cân nhắc bổ sung diễn biến (không thêm lặng hay làm chậm).`);
  return { problems, notes, estimateSec: Math.round(est * 10) / 10 };
};
