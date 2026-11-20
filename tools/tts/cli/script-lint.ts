// npm run script:lint -- EP001
// Static checks of an episode script against the project's language rules
// (CLAUDE.md). Offline; prints problems and a rough duration estimate.
// Logic in tools/tts/scriptlint.ts (shared with the Studio).
import { readFileSync } from "node:fs";
import { resolveEpisode } from "../../episode/paths.ts";
import { lintScript, type LintScript } from "../scriptlint.ts";

const file = resolveEpisode(process.argv[2] ?? "EP001").script;
const ep = JSON.parse(readFileSync(file, "utf8")) as LintScript;
const { problems, notes, estimateSec } = lintScript(ep);
const { minSec, targetRangeSec } = ep.duration;
console.log(
  `Ước lượng (chỉ để định hướng; thời lượng thật đo sau khi tạo âm thanh): ~${estimateSec.toFixed(1)} s. ` +
    `Tối thiểu ${minSec} s, mục tiêu ${targetRangeSec[0]}–${targetRangeSec[1]} s.`,
);
for (const n of notes) console.log(`LƯU Ý: ${n}`);
for (const p of problems) console.log(`LỖI: ${p}`);
if (problems.length) process.exit(1);
console.log("Không có lỗi tĩnh.");
