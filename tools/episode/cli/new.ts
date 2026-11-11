// npm run episode:new -- "Tiêu đề tập"
// Allocates the next free episode ID atomically: the episode folder itself is
// the lock (mkdir without `recursive` fails if it exists), so re-runs and
// concurrent runs can never get the same ID. Creates the standard layout and
// a skeleton episode.json where every deliverable is "chưa có".
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gitCommit, sharedAssetsHash, voiceConfigHash, type Manifest } from "../manifest.ts";
import { EPISODE_ID, episodePaths, rel } from "../paths.ts";

const title = process.argv.slice(2).join(" ").trim();
if (!title) {
  console.error('Thiếu tiêu đề: npm run episode:new -- "Tiêu đề tập"');
  process.exit(1);
}

mkdirSync("episodes", { recursive: true });
const used = readdirSync("episodes")
  .filter((d) => EPISODE_ID.test(d))
  .map((d) => Number(d.slice(2)));
let n = (used.length ? Math.max(...used) : 0) + 1;

let id = "";
for (let tries = 0; tries < 1000; tries++, n++) {
  const candidate = `EP${String(n).padStart(3, "0")}`;
  try {
    mkdirSync(join("episodes", candidate)); // atomic claim; throws EEXIST if taken
    id = candidate;
    break;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
  }
}
if (!id) throw new Error("Không cấp được mã tập.");

const P = episodePaths(id);
for (const d of [P.scriptDir, P.audioDir, P.assetsDir, P.exportsDir, P.thumbnailsDir, P.socialDir, P.publishingDir, P.reportsDir]) {
  mkdirSync(d, { recursive: true });
}
for (const d of [P.assetsDir, P.thumbnailsDir]) writeFileSync(join(d, ".gitkeep"), "");

const manifest: Manifest = {
  id,
  title,
  contentVersion: 0,
  contentHash: "",
  createdAt: new Date().toISOString(),
  duration: { contentEndSec: null, videoSec: null, durationInFrames: null, fps: 30 },
  paths: Object.fromEntries(Object.entries(P).filter(([k]) => k !== "id" && k !== "publicAudioSrc").map(([k, v]) => [k, rel(v)])),
  versions: { voiceConfigHash: voiceConfigHash(), sharedAssetsHash: sharedAssetsHash(), gitCommit: gitCommit(), ttsModel: null, stagingFile: null, stagingHash: null },
  production: { script: "chưa có", audio: "chưa có", video: "chưa có", captions: "chưa có", thumbnail9x16: "chưa có", teaser1x1: "chưa có", social: "chưa có" },
  checks: {},
  approvals: {
    script: { status: "missing" },
    audio: { status: "missing" },
    video: { status: "missing" },
    captions: { status: "missing" },
    thumbnail9x16: { status: "missing" },
    teaser1x1: { status: "missing" },
    social: {},
  },
};
writeFileSync(P.episodeJson, JSON.stringify(manifest, null, 2) + "\n");
writeFileSync(P.jobs, JSON.stringify({ episode: id, jobs: [] }, null, 2) + "\n");
console.log(`Đã tạo ${id}: ${rel(P.root)}`);
