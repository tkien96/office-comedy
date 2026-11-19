import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { EpisodePaths } from "./paths.ts";

// episode.json helpers: content hashes and shared-asset versions.
// (The per-part approval workflow was removed on 2026-11-16: the Studio only
// manages episodes, and social posting is done by hand.)

export type Manifest = {
  id: string;
  title: string;
  contentVersion: number;
  contentHash: string;
  createdAt: string;
  duration: { contentEndSec: number | null; videoSec: number | null; durationInFrames: number | null; fps: number };
  paths: Record<string, string>;
  versions: {
    voiceConfigHash: string;
    sharedAssetsHash: string;
    gitCommit: string | null;
    ttsModel: string | null;
    stagingFile: string | null;
    stagingHash: string | null;
    thumbnailDesignHash?: string | null;
  };
  checks: Record<string, unknown>;
};

const stable = (v: unknown): unknown =>
  Array.isArray(v)
    ? v.map(stable)
    : v && typeof v === "object"
      ? Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, stable((v as Record<string, unknown>)[k])]))
      : v;

export const sha256 = (data: string | Buffer) => createHash("sha256").update(data).digest("hex");
export const hashJson = (v: unknown) => sha256(JSON.stringify(stable(v)));
export const hashFile = (p: string): string | null => (existsSync(p) ? sha256(readFileSync(p)) : null);
/** Text files (SRT, Markdown): CRLF → LF first, so a Windows checkout hashes the same. */
export const hashText = (p: string): string | null => (existsSync(p) ? sha256(readFileSync(p, "utf8").replace(/\r\n/g, "\n")) : null);
/** JSON files: hash of the parsed content (formatting / line endings do not matter). */
export const hashJsonFile = (p: string): string | null => (existsSync(p) ? hashJson(JSON.parse(readFileSync(p, "utf8"))) : null);

/** Script content hash: story content only (no status fields). */
export const scriptContentHash = (script: Record<string, unknown>) =>
  hashJson({ id: script.id, title: script.title, logline: script.logline, scenes: script.scenes, beats: script.beats, timing: script.timing, duration: script.duration });

/** Voice config version: the voices (casting.json → approved) used for production. */
export const voiceConfigHash = () => {
  const casting = JSON.parse(readFileSync("config/casting.json", "utf8")) as { roles: Record<string, { approved: unknown }>; addressing?: unknown };
  return hashJson({ approved: Object.fromEntries(Object.entries(casting.roles).map(([k, v]) => [k, v.approved])), addressing: casting.addressing });
};

/** Hash over the shared rendering code + design (characters, backgrounds, UI, renderer). */
export const sharedAssetsHash = () => {
  const dirs = ["src/characters", "src/backgrounds", "src/ui", "src/episode", "src/design", "src/lib"];
  const files: string[] = [];
  const walk = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else files.push(p);
    }
  };
  dirs.filter(existsSync).forEach(walk);
  files.sort();
  // Normalize line endings so CRLF checkouts hash the same as LF.
  return hashJson(files.map((f) => [f.replace(/\\/g, "/"), sha256(readFileSync(f, "utf8").replace(/\r\n/g, "\n"))]));
};

export const gitCommit = () => {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
};

/** Per-episode thumbnail layout file (data only). */
export const thumbnailDesignFile = (id: string) => `src/episodes/${id.toLowerCase()}-thumbnails.ts`;

/** Hash of the thumbnail layout + shared thumbnail component (recorded when thumbnails are rendered). */
export const thumbnailDesignHash = (P: EpisodePaths) => {
  const file = thumbnailDesignFile(P.id);
  return existsSync(file) ? hashJson([hashText(file), hashText("src/thumbnails/EpisodeThumbnail.tsx")]) : null;
};

export const readManifest = (P: EpisodePaths): Manifest => JSON.parse(readFileSync(P.episodeJson, "utf8")) as Manifest;

export type SocialDoc = { platforms: Record<string, Record<string, unknown>> } & Record<string, unknown>;
export const readSocial = (P: EpisodePaths): SocialDoc | null => (existsSync(P.social) ? (JSON.parse(readFileSync(P.social, "utf8")) as SocialDoc) : null);

/** Post keys in social.json: "<platform>.<post>" for every object under platforms.<platform> (skips "status"). */
export const socialPostKeys = (social: SocialDoc | null) =>
  Object.entries(social?.platforms ?? {}).flatMap(([p, v]) =>
    Object.entries(v)
      .filter(([, x]) => x && typeof x === "object" && !Array.isArray(x))
      .map(([k]) => `${p}.${k}`),
  );

/** Current hashes of every product of an episode. */
export const currentHashes = (P: EpisodePaths) => {
  const social = readSocial(P);
  return {
    script: existsSync(P.script) ? scriptContentHash(JSON.parse(readFileSync(P.script, "utf8")) as Record<string, unknown>) : null,
    audio: hashFile(P.preview),
    video: hashFile(P.video),
    captions: hashText(P.captions),
    thumbnail9x16: hashFile(P.thumbnail9x16),
    teaser1x1: hashFile(P.teaser1x1),
    social: Object.fromEntries(
      socialPostKeys(social).map((k) => {
        const [p, post] = k.split(".");
        return [k, hashJson(social!.platforms[p][post])];
      }),
    ) as Record<string, string>,
  };
};
