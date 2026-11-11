// npm run episode:stage-audio -- EP001
// Copies the episode's approved dialogue preview into public/ so Remotion can
// serve it (public/audio/episodes/ is not in Git). Refuses if the preview no
// longer matches the approved audio hash.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { checkApproval, currentHashes, hashFile, readManifest } from "../manifest.ts";
import { resolveEpisode } from "../paths.ts";

const P = resolveEpisode(process.argv[2] ?? "EP001");
const m = readManifest(P);
const audio = checkApproval(m.approvals.audio, currentHashes(P).audio);
if (audio.status !== "approved") {
  console.error(`DỪNG: âm thanh ${P.id} ${audio.detail}.`);
  process.exit(1);
}
mkdirSync(dirname(P.publicAudio), { recursive: true });
copyFileSync(P.preview, P.publicAudio);
if (hashFile(P.publicAudio) !== m.approvals.audio.sha256) throw new Error("Bản chép khác bản đã duyệt.");
console.log(`Đã chép âm thanh đã duyệt → ${P.publicAudio}`);
