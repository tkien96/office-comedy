// npm run episode:social -- EP001
// Checks social.json (spoiler keywords, date promises, platform limits) and
// writes the readable file social/social.md. Posting is done by hand.
import { writeFileSync } from "node:fs";
import { readSocial } from "../manifest.ts";
import { rel, resolveEpisode } from "../paths.ts";
import { buildSocialMd, checkSocial, socialMdPath } from "../social.ts";

const P = resolveEpisode(process.argv[2] ?? "EP001");
const social = readSocial(P);
if (!social) {
  console.error(`Chưa có ${rel(P.social)}.`);
  process.exit(1);
}
const findings = checkSocial(social);
writeFileSync(socialMdPath(P), buildSocialMd(P, social));
console.log(`Đã ghi ${rel(socialMdPath(P))}`);
for (const f of findings) console.log(`${f.level} [${f.post}]: ${f.msg}`);
console.log("Lưu ý: bộ lọc từ khóa không chứng minh bài không lộ câu chốt; cần người đọc lại.");
if (findings.some((f) => f.level === "LỖI")) process.exit(1);
