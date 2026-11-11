// npm run episode:status -- EP001
// Production + approval state of an episode. Recomputes every hash and compares
// it with the approval (integrity) and with the approval's source hashes
// (freshness). Also checks derived files against what their source would
// produce now. Read-only.
import { existsSync } from "node:fs";
import { captionsFreshness } from "../captions.ts";
import { checkApproval, currentHashes, currentSources, readManifest, SOURCE_LABEL, type SourceKey } from "../manifest.ts";
import { resolveEpisode } from "../paths.ts";
import { socialMdFreshness } from "../social.ts";

const P = resolveEpisode(process.argv[2] ?? "EP001");
const m = readManifest(P);
const cur = currentHashes(P);
const src = currentSources(P, m);

console.log(`${m.id} — ${m.title} · phiên bản nội dung ${m.contentVersion}`);
console.log(`Thời lượng: ${m.duration.videoSec ?? "chưa có"} s video · ${m.duration.durationInFrames ?? "?"} khung @${m.duration.fps}`);
const vc = src.voiceConfig === m.versions.voiceConfigHash;
const sa = src.sharedAssets === m.versions.sharedAssetsHash;
console.log(`Cấu hình giọng: ${vc ? "khớp bản đã dùng" : "ĐÃ ĐỔI so với lúc sản xuất"} · Tài nguyên dựng chung: ${sa ? "khớp" : "đã đổi (dựng lại có thể khác bản đã duyệt)"}`);

const rows: [string, string, string][] = [];
for (const k of ["script", "audio", "video", "captions", "thumbnail9x16", "teaser1x1"] as const) {
  rows.push([k, m.production[k] ?? "?", checkApproval(m.approvals[k], cur[k], src).detail]);
}
for (const [post, h] of Object.entries(cur.social)) {
  rows.push([`social.${post}`, m.production.social ?? "?", checkApproval(m.approvals.social[post], h, src).detail]);
}
if (!existsSync(P.social)) rows.push(["social", "chưa có", "chưa có"]);
for (const [k, prod, ap] of rows) console.log(`  ${k.padEnd(22)} sản xuất: ${prod.padEnd(8)} duyệt: ${ap}`);

console.log("File xuất từ nguồn (so với bản lệnh sẽ tạo ra bây giờ):");
for (const [name, r] of [["exports/*.srt ← timeline", captionsFreshness(P)], ["social/social.md ← social.json", socialMdFreshness(P)]] as const) {
  console.log(`  ${name.padEnd(34)} ${r}`);
}
const missingSrc = (Object.keys(src) as SourceKey[]).filter((k) => src[k] === null);
if (missingSrc.length) console.log(`Nguồn chưa có: ${missingSrc.map((k) => SOURCE_LABEL[k]).join(", ")}`);
