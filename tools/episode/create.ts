import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gitCommit, sharedAssetsHash, voiceConfigHash, type Manifest } from "./manifest.ts";
import { EPISODE_ID, episodePaths, rel, type EpisodePaths } from "./paths.ts";

// Allocates the next free episode ID atomically: the episode folder itself is
// the lock (mkdir without `recursive` fails if it exists), so re-runs and
// concurrent runs (CLI or Studio) can never get the same ID. Creates the
// standard layout and a skeleton episode.json where every deliverable is
// "chưa có". An ID is never reused, even if a later step fails.

export const createEpisode = (title: string): EpisodePaths => {
  const t = title.trim();
  if (!t) throw new Error("Thiếu tiêu đề tập.");
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
  for (const d of [P.scriptDir, P.audioDir, P.assetsDir, P.exportsDir, P.thumbnailsDir, P.socialDir, P.reportsDir]) {
    mkdirSync(d, { recursive: true });
  }
  for (const d of [P.assetsDir, P.thumbnailsDir]) writeFileSync(join(d, ".gitkeep"), "");

  const manifest: Manifest = {
    id,
    title: t,
    contentVersion: 0,
    contentHash: "",
    createdAt: new Date().toISOString(),
    duration: { contentEndSec: null, videoSec: null, durationInFrames: null, fps: 30 },
    paths: Object.fromEntries(Object.entries(P).filter(([k]) => k !== "id" && k !== "publicAudioSrc").map(([k, v]) => [k, rel(v)])),
    versions: { voiceConfigHash: voiceConfigHash(), sharedAssetsHash: sharedAssetsHash(), gitCommit: gitCommit(), ttsModel: null, stagingFile: null, stagingHash: null },
    checks: {},
  };
  writeFileSync(P.episodeJson, JSON.stringify(manifest, null, 2) + "\n");
  return P;
};
