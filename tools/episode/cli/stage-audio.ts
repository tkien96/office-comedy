// npm run episode:stage-audio -- EP001
// Copies the episode's dialogue preview into public/ so Remotion can serve it
// (public/audio/episodes/ is not in Git), and checks the copy byte for byte.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { hashFile } from "../manifest.ts";
import { rel, resolveEpisode } from "../paths.ts";

const P = resolveEpisode(process.argv[2] ?? "EP001");
if (!existsSync(P.preview)) {
  console.error(`DỪNG: chưa có ${rel(P.preview)}. Tạo âm thanh trước: npm run episode:audio -- ${P.id}`);
  process.exit(1);
}
mkdirSync(dirname(P.publicAudio), { recursive: true });
copyFileSync(P.preview, P.publicAudio);
if (hashFile(P.publicAudio) !== hashFile(P.preview)) throw new Error("Bản chép khác bản gốc.");
console.log(`Đã chép âm thanh → ${P.publicAudio}`);
