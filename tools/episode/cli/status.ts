// npm run episode:status -- EP001
// Production + approval state of an episode (same service as the Studio):
// recomputes every hash, compares it with the approval (integrity) and with
// the approval's source hashes (freshness), and checks derived files against
// what their source would produce now. Read-only.
import { currentSources, readManifest, SOURCE_LABEL, type SourceKey } from "../manifest.ts";
import { resolveEpisode } from "../paths.ts";
import { freshness, partStates } from "../service.ts";

const P = resolveEpisode(process.argv[2] ?? "EP001");
const m = readManifest(P);
const src = currentSources(P, m);

console.log(`${m.id} — ${m.title} · phiên bản nội dung ${m.contentVersion}`);
console.log(`Thời lượng: ${m.duration.videoSec ?? "chưa có"} s video · ${m.duration.durationInFrames ?? "?"} khung @${m.duration.fps}`);
const vc = src.voiceConfig === m.versions.voiceConfigHash;
const sa = src.sharedAssets === m.versions.sharedAssetsHash;
console.log(`Cấu hình giọng: ${vc ? "khớp bản đã dùng" : "ĐÃ ĐỔI so với lúc sản xuất"} · Tài nguyên dựng chung: ${sa ? "khớp" : "đã đổi (dựng lại có thể khác bản đã duyệt)"}`);

for (const p of partStates(P, m)) console.log(`  ${p.part.padEnd(22)} sản xuất: ${p.production.padEnd(8)} duyệt: ${p.detail}`);

const fr = freshness(P);
console.log("File xuất từ nguồn (so với bản lệnh sẽ tạo ra bây giờ):");
console.log(`  ${"exports/*.srt ← timeline".padEnd(34)} ${fr.captions}`);
console.log(`  ${"social/social.md ← social.json".padEnd(34)} ${fr.socialMd}`);
const missingSrc = (Object.keys(src) as SourceKey[]).filter((k) => src[k] === null);
if (missingSrc.length) console.log(`Nguồn chưa có: ${missingSrc.map((k) => SOURCE_LABEL[k]).join(", ")}`);
