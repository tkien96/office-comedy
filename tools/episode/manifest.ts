import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { EpisodePaths } from "./paths.ts";

// episode.json helpers: content hashes, shared-asset versions, approval checks.
// An approval is valid ONLY while the hash it was given for still matches the
// current file/content. Any change → "cần duyệt lại" for that part.

export type ApprovalStatus = "approved" | "not_approved" | "needs_reapproval" | "needs_recheck" | "missing";

export type Approval = {
  status: ApprovalStatus;
  approvedAt?: string;
  approvedBy?: string;
  /** Hash the approval was given for (file sha256 or content hash). */
  sha256?: string;
  /** Hashes of the SOURCES this product was approved against (see DEPENDS_ON). */
  basis?: Record<string, string | null>;
  note?: string;
};

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
  };
  production: Record<string, "done" | "draft" | "chưa có">;
  checks: Record<string, unknown>;
  approvals: {
    script: Approval;
    audio: Approval & { lineCacheKeys?: string[] };
    video: Approval;
    captions: Approval;
    thumbnail9x16: Approval;
    teaser1x1: Approval;
    /** One approval per post: "youtube.video", "facebook.teaser", … */
    social: Record<string, Approval>;
  };
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

/** Script content hash: story content only (no status/approval fields). */
export const scriptContentHash = (script: Record<string, unknown>) =>
  hashJson({ id: script.id, title: script.title, logline: script.logline, scenes: script.scenes, beats: script.beats, timing: script.timing, duration: script.duration });

/** Voice config version: the approved voices actually used for production. */
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

// ---------------------------------------------------------------------------
// Sources and dependencies.
//
// Two separate questions for every product:
//  1. Integrity: is the file still the one that was approved?  (own hash)
//  2. Freshness: were its SOURCES changed after approval?        (basis hashes)
// A product whose own hash still matches but whose source changed is
// "needs_recheck": the file is intact, but it may no longer match the story.

export type SourceKey = "script" | "timeline" | "audio" | "voiceConfig" | "staging" | "sharedAssets" | "thumbnailDesign";

export const DEPENDS_ON: Record<string, SourceKey[]> = {
  script: [],
  audio: ["script", "voiceConfig"],
  video: ["script", "timeline", "audio", "staging", "sharedAssets"],
  captions: ["script", "timeline"],
  thumbnail9x16: ["script", "sharedAssets", "thumbnailDesign"],
  teaser1x1: ["script", "sharedAssets", "thumbnailDesign"],
  social: ["script"],
};
export const dependsOn = (part: string) => DEPENDS_ON[part.startsWith("social.") ? "social" : part] ?? [];

export const SOURCE_LABEL: Record<SourceKey, string> = {
  script: "kịch bản",
  timeline: "timeline",
  audio: "âm thanh",
  voiceConfig: "cấu hình giọng",
  staging: "dàn cảnh",
  sharedAssets: "rig/nền/UI dùng chung",
  thumbnailDesign: "thiết kế ảnh bìa",
};

/** Per-episode thumbnail layout file (data only) — part of the thumbnails' sources. */
export const thumbnailDesignFile = (id: string) => `src/episodes/${id.toLowerCase()}-thumbnails.ts`;

export const currentSources = (P: EpisodePaths, m?: Manifest): Record<SourceKey, string | null> => {
  const script = existsSync(P.script) ? scriptContentHash(JSON.parse(readFileSync(P.script, "utf8")) as Record<string, unknown>) : null;
  const staging = m?.versions.stagingFile ? hashText(m.versions.stagingFile) : null;
  const thumbFile = thumbnailDesignFile(P.id);
  const thumbComponent = "src/thumbnails/EpisodeThumbnail.tsx";
  const thumbnailDesign = existsSync(thumbFile) ? hashJson([hashText(thumbFile), hashText(thumbComponent)]) : null;
  return {
    script,
    timeline: hashJsonFile(P.timeline),
    audio: hashFile(P.preview),
    voiceConfig: voiceConfigHash(),
    staging,
    sharedAssets: sharedAssetsHash(),
    thumbnailDesign,
  };
};

export const basisFor = (part: string, src: Record<SourceKey, string | null>) =>
  Object.fromEntries(dependsOn(part).map((k) => [k, src[k]])) as Record<string, string | null>;

/** Compares an approval with the product's current hash and its sources. */
export const checkApproval = (
  a: Approval | undefined,
  currentHash: string | null,
  src?: Record<SourceKey, string | null>,
): { status: ApprovalStatus; detail: string; changedSources: string[] } => {
  if (currentHash === null) return { status: "missing", detail: "chưa có", changedSources: [] };
  if (!a || a.status === "missing" || a.status === "not_approved" || !a.sha256) return { status: "not_approved", detail: "chưa duyệt", changedSources: [] };
  if (a.sha256 !== currentHash)
    return { status: "needs_reapproval", detail: `file/nội dung đã đổi sau khi duyệt (duyệt ${a.sha256.slice(0, 12)}, hiện ${currentHash.slice(0, 12)}): cần duyệt lại`, changedSources: [] };
  const changed = src && a.basis ? Object.entries(a.basis).filter(([k, h]) => src[k as SourceKey] !== h).map(([k]) => k) : [];
  if (changed.length)
    return {
      status: "needs_recheck",
      detail: `file còn nguyên bản đã duyệt, nhưng nguồn đã đổi (${changed.map((k) => SOURCE_LABEL[k as SourceKey] ?? k).join(", ")}): cần kiểm tra lại`,
      changedSources: changed,
    };
  return { status: "approved", detail: `đã duyệt ${a.approvedAt ?? ""} (${currentHash.slice(0, 12)})${a.basis ? "" : " · chưa ghi nguồn"}`, changedSources: [] };
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

/** Current hashes of every approvable part of an episode. Each social POST is hashed on its own. */
export const currentHashes = (P: EpisodePaths) => {
  const social = readSocial(P);
  return {
    script: currentSources(P).script,
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
