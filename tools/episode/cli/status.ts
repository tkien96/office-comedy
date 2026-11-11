// npm run episode:status -- EP001
// Prints the production + approval state of an episode by recomputing every
// hash and comparing it with what was approved. Read-only.
import { existsSync } from "node:fs";
import { checkApproval, currentHashes, readManifest, sharedAssetsHash, voiceConfigHash } from "../manifest.ts";
import { resolveEpisode } from "../paths.ts";

const P = resolveEpisode(process.argv[2] ?? "EP001");
const m = readManifest(P);
const cur = currentHashes(P);

console.log(`${m.id} — ${m.title} · phiên bản nội dung ${m.contentVersion}`);
console.log(`Thời lượng: ${m.duration.videoSec ?? "chưa có"} s video · ${m.duration.durationInFrames ?? "?"} khung @${m.duration.fps}`);
const vc = voiceConfigHash() === m.versions.voiceConfigHash;
const sa = sharedAssetsHash() === m.versions.sharedAssetsHash;
console.log(`Cấu hình giọng: ${vc ? "khớp bản đã dùng" : "ĐÃ ĐỔI so với lúc sản xuất"} · Tài nguyên dựng chung: ${sa ? "khớp" : "đã đổi (dựng lại có thể khác bản đã duyệt)"}`);

const rows: [string, string, string][] = [];
const parts = ["script", "audio", "video", "captions", "thumbnail9x16", "teaser1x1"] as const;
for (const k of parts) {
  const r = checkApproval(m.approvals[k], cur[k]);
  rows.push([k, m.production[k] ?? "?", r.detail]);
}
for (const [platform, h] of Object.entries(cur.social)) {
  const r = checkApproval(m.approvals.social[platform], h);
  rows.push([`social.${platform}`, m.production.social ?? "?", r.detail]);
}
if (!existsSync(P.social)) rows.push(["social", "chưa có", "chưa có"]);

for (const [k, prod, ap] of rows) console.log(`  ${k.padEnd(18)} sản xuất: ${prod.padEnd(8)} duyệt: ${ap}`);
