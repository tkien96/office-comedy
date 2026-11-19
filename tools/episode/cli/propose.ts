// npm run script:propose -- EPxxx <file.json> [--note "ghi chú"] [--check]
//
// Takes a script written in a Claude Code session (same shape as
// script/script.json) and stores it as a PROPOSAL for that episode. The
// current version is never changed here: the user opens the Studio
// (Tập → Kịch bản), reviews the diff and accepts or discards it.
//   --check  validate only, save nothing.
// Blocking errors → nothing is saved (exit 1).
import { existsSync, readFileSync } from "node:fs";
import { resolveEpisode } from "../paths.ts";
import { validateScript, type ScriptDoc } from "../scriptdoc.ts";
import { castOf, proposeScript, readRequest } from "../scriptstore.ts";

const args = process.argv.slice(2);
const noteAt = args.indexOf("--note");
const note = noteAt >= 0 ? (args[noteAt + 1] ?? "") : "";
const positional = args.filter((a, i) => !a.startsWith("--") && (noteAt < 0 || i !== noteAt + 1));
const [epArg, file] = positional;
if (!epArg || !file) {
  console.error('Dùng: npm run script:propose -- EPxxx <file.json> [--note "ghi chú"] [--check]');
  process.exit(1);
}
const P = resolveEpisode(epArg);
if (!existsSync(file)) {
  console.error(`Không thấy file ${file}.`);
  process.exit(1);
}
let script: ScriptDoc;
try {
  script = JSON.parse(readFileSync(file, "utf8").replace(/^﻿/, "")) as ScriptDoc;
} catch (e) {
  console.error(`File không phải JSON hợp lệ: ${(e as Error).message}`);
  process.exit(1);
}
if (!script || typeof script !== "object" || Array.isArray(script)) {
  console.error("File phải chứa một đối tượng kịch bản (title, logline, scenes, beats…).");
  process.exit(1);
}

const show = (check: { errors: string[]; warnings: string[]; estimateSec: number | null }) => {
  for (const e of check.errors) console.log(`  LỖI       ${e}`);
  for (const w of check.warnings) console.log(`  LƯU Ý     ${w}`);
  if (check.estimateSec !== null) console.log(`  Thời lượng ước tính ~${check.estimateSec} s (từ số âm tiết; thời lượng thật đo sau khi tạo giọng).`);
};

if (args.includes("--check")) {
  const cast = readRequest(P) ? castOf(P, null) : undefined;
  const check = validateScript({ ...script, id: P.id, duration: script.duration ?? { minSec: 60, targetRangeSec: [60, 90] } }, { cast });
  console.log(`${P.id}: kiểm tra (không lưu)`);
  show(check);
  process.exit(check.errors.length ? 1 : 0);
}

try {
  const r = proposeScript(P, script, { note: note || "Viết bằng Claude Code" });
  if (r.duplicateOf) {
    console.log(`${P.id}: nội dung này đã có trong đề xuất ${r.duplicateOf} (đang chờ xem). Không lưu thêm.`);
    process.exit(0);
  }
  if (!r.proposal) {
    console.log(`${P.id}: CHƯA LƯU — ${r.check.errors.length} lỗi chặn:`);
    show(r.check);
    process.exit(1);
  }
  console.log(`${P.id}: đã lưu bản đề xuất ${r.proposal.id} (${r.proposal.kind === "draft" ? "bản nháp đầu" : "bản sửa"}).`);
  show(r.check);
  console.log("Kịch bản hiện hành CHƯA đổi. Mở Studio → tập → Kịch bản để xem khác biệt rồi chấp nhận hoặc bỏ.");
} catch (e) {
  console.error(`${P.id}: ${(e as Error).message}`);
  process.exit(1);
}
