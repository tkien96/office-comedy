// npm run episode:status -- EP001
// What exists for an episode (same service as the Studio), whether shared
// voices/rendering changed since it was produced, and whether derived files
// still match what their source would produce now. Read-only.
import { readManifest, sharedAssetsHash, voiceConfigHash } from "../manifest.ts";
import { resolveEpisode } from "../paths.ts";
import { freshness, partStates } from "../service.ts";

const P = resolveEpisode(process.argv[2] ?? "EP001");
const m = readManifest(P);

console.log(`${m.id} — ${m.title} · phiên bản nội dung ${m.contentVersion}`);
console.log(`Thời lượng: ${m.duration.videoSec ?? "chưa có"} s video · ${m.duration.durationInFrames ?? "?"} khung @${m.duration.fps}`);
const vc = voiceConfigHash() === m.versions.voiceConfigHash;
const sa = sharedAssetsHash() === m.versions.sharedAssetsHash;
console.log(`Cấu hình giọng: ${vc ? "khớp bản đã dùng" : "ĐÃ ĐỔI so với lúc sản xuất"} · Tài nguyên dựng chung: ${sa ? "khớp" : "đã đổi (dựng lại có thể khác bản cũ)"}`);

for (const p of partStates(P)) console.log(`  ${p.label.padEnd(20)} ${p.exists ? "có" : "chưa có"}`);

const fr = freshness(P);
console.log("File xuất từ nguồn (so với bản lệnh sẽ tạo ra bây giờ):");
console.log(`  ${"exports/*.srt ← timeline".padEnd(34)} ${fr.captions}`);
console.log(`  ${"social/social.md ← social.json".padEnd(34)} ${fr.socialMd}`);
