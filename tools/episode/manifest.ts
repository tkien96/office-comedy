import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { EpisodePaths } from "./paths.ts";

// episode.json helpers: content hashes, shared-asset versions, approval checks.
// An approval is valid ONLY while the hash it was given for still matches the
// current file/content. Any change → "cần duyệt lại" for that part.

export type ApprovalStatus = "approved" | "not_approved" | "needs_reapproval" | "missing";

export type Approval = {
  status: ApprovalStatus;
  approvedAt?: string;
  approvedBy?: string;
  /** Hash the approval was given for (file sha256 or content hash). */
  sha256?: string;
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

/** Compares an approval against the current hash. */
export const checkApproval = (a: Approval | undefined, currentHash: string | null): { status: ApprovalStatus; detail: string } => {
  if (currentHash === null) return { status: "missing", detail: "chưa có" };
  if (!a || a.status === "missing" || a.status === "not_approved" || !a.sha256) return { status: "not_approved", detail: "chưa duyệt" };
  if (a.sha256 !== currentHash) return { status: "needs_reapproval", detail: `đã thay đổi sau khi duyệt (duyệt ${a.sha256.slice(0, 12)}, hiện ${currentHash.slice(0, 12)}): cần duyệt lại` };
  return { status: "approved", detail: `đã duyệt ${a.approvedAt ?? ""} (${currentHash.slice(0, 12)})` };
};

export const readManifest = (P: EpisodePaths): Manifest => JSON.parse(readFileSync(P.episodeJson, "utf8")) as Manifest;

/** Current hashes of every approvable part of an episode. */
export const currentHashes = (P: EpisodePaths) => {
  const script = existsSync(P.script) ? (JSON.parse(readFileSync(P.script, "utf8")) as Record<string, unknown>) : null;
  const social = existsSync(P.social) ? (JSON.parse(readFileSync(P.social, "utf8")) as { platforms: Record<string, unknown> }) : null;
  return {
    script: script ? scriptContentHash(script) : null,
    audio: hashFile(P.preview),
    video: hashFile(P.video),
    captions: hashFile(P.captions),
    thumbnail9x16: hashFile(P.thumbnail9x16),
    teaser1x1: hashFile(P.teaser1x1),
    social: Object.fromEntries(Object.entries(social?.platforms ?? {}).map(([k, v]) => [k, hashJson(v)])),
  };
};
