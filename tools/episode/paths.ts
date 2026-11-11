import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Single source of truth for the per-episode folder layout:
//
// episodes/EPxxx/
//   episode.json            metadata, versions, approvals (bound to hashes)
//   script/                 script.json (source), script.md, timeline.json
//   audio/                  dialogue-preview.wav, lines/ (not in Git)
//   assets/                 episode-only assets (shared assets stay outside)
//   exports/                EPxxx.mp4 (not in Git), EPxxx.srt
//   thumbnails/             thumb-9x16.png, teaser-1x1.png (not in Git)
//   social/                 social.json (per-platform copy)
//   publishing/             jobs.json, log.jsonl (not in Git), .lock
//   reports/                qa-report.md, verify/dry-run reports

export const EPISODE_ID = /^EP\d{3,}$/;

export const episodePaths = (id: string) => {
  if (!EPISODE_ID.test(id)) throw new Error(`Mã tập không hợp lệ: ${id}`);
  const root = join("episodes", id);
  return {
    id,
    root,
    episodeJson: join(root, "episode.json"),
    scriptDir: join(root, "script"),
    script: join(root, "script", "script.json"),
    scriptMd: join(root, "script", "script.md"),
    timeline: join(root, "script", "timeline.json"),
    audioDir: join(root, "audio"),
    preview: join(root, "audio", "dialogue-preview.wav"),
    linesDir: join(root, "audio", "lines"),
    assetsDir: join(root, "assets"),
    exportsDir: join(root, "exports"),
    video: join(root, "exports", `${id}.mp4`),
    captions: join(root, "exports", `${id}.srt`),
    thumbnailsDir: join(root, "thumbnails"),
    thumbnail9x16: join(root, "thumbnails", "thumb-9x16.png"),
    teaser1x1: join(root, "thumbnails", "teaser-1x1.png"),
    socialDir: join(root, "social"),
    social: join(root, "social", "social.json"),
    publishingDir: join(root, "publishing"),
    jobs: join(root, "publishing", "jobs.json"),
    publishLog: join(root, "publishing", "log.jsonl"),
    publishLock: join(root, "publishing", ".lock"),
    reportsDir: join(root, "reports"),
    qaReport: join(root, "reports", "qa-report.md"),
    captionsQc: join(root, "reports", "captions-qc.md"),
    /** Manual-posting package, rebuilt from sources by episode:delivery (not in Git). */
    deliveryDir: join(root, "delivery"),
    /** Copy of the approved preview used by Remotion (public/ is served). */
    publicAudio: join("public", "audio", "episodes", id, "dialogue.wav"),
    publicAudioSrc: `audio/episodes/${id}/dialogue.wav`,
  };
};

export type EpisodePaths = ReturnType<typeof episodePaths>;

/** Accepts "EP001" or a path to a script.json; returns the episode paths. */
export const resolveEpisode = (arg?: string): EpisodePaths => {
  if (!arg) throw new Error("Thiếu mã tập (ví dụ EP001).");
  if (EPISODE_ID.test(arg)) return episodePaths(arg);
  if (existsSync(arg)) {
    const id = (JSON.parse(readFileSync(arg, "utf8")) as { id?: string }).id;
    if (id) return episodePaths(id);
  }
  throw new Error(`Không xác định được tập từ "${arg}".`);
};

/** Repo-relative path with forward slashes (stored in JSON). */
export const rel = (p: string) => p.replace(/\\/g, "/");
