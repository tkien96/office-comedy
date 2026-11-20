import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { withFileLock, writeFileAtomic } from "../episode/fsutil.ts";
import { dirname } from "node:path";
import { hashJson } from "../episode/manifest.ts";
import type { EpisodePaths } from "../episode/paths.ts";

// Publishing jobs: one job = one post on one platform/target.
//
// States (only these):
//   draft       content prepared, no schedule yet
//   planned     has a schedule in THIS PROJECT only (nothing sent)
//   uploading   media being sent (remote id may not exist yet)
//   processing  platform accepted the upload, still processing
//   scheduled   the PLATFORM confirmed it holds the schedule
//   published   verified publicly visible via a status check
//   failed      gave up after maxAttempts or a non-retryable error
//   cancelled   cancelled by the user
//   missed      planned time passed while nothing ran; never auto-published
//
// HTTP success or "upload complete" is NOT "published".

export const STATES = ["draft", "planned", "uploading", "processing", "scheduled", "published", "failed", "cancelled", "missed"] as const;
export type JobState = (typeof STATES)[number];

const TRANSITIONS: Record<JobState, JobState[]> = {
  draft: ["planned", "cancelled"],
  planned: ["uploading", "missed", "cancelled", "draft"],
  uploading: ["processing", "failed", "uploading"],
  processing: ["scheduled", "published", "failed"],
  scheduled: ["published", "cancelled", "failed"],
  published: [],
  failed: ["planned", "cancelled"],
  cancelled: [],
  missed: ["planned", "cancelled"],
};

export type Job = {
  id: string;
  episodeId: string;
  contentVersion: number;
  platform: "youtube" | "facebook" | "tiktok";
  target: string;
  type: "video" | "teaser_photo" | "teaser_text";
  mode: "api" | "manual";
  media: { role: string; path: string }[];
  content: { ref: string };
  schedule: { local: string | null; timezone: "Asia/Ho_Chi_Minh"; utc: string | null };
  state: JobState;
  idempotencyKey: string | null;
  remote: { id: string | null; url: string | null; platformStatus: string | null; lastCheckedAt: string | null };
  attempts: number;
  lastError: string | null;
  /**
   * Verified account this job posts to (set only by the user: Studio "Gắn tài
   * khoản" / bindJobAccount). Changing the default connection never rewrites it.
   * Missing on old jobs → API posting is blocked until the user confirms.
   */
  account?: JobAccount | null;
  history: { at: string; from: JobState | null; to: JobState; note: string }[];
};

export type JobAccount = { connectionId: string; platformAccountId: string; name: string; boundAt: string };

export type JobsFile = { episode: string; jobs: Job[] };

export const readJobs = (P: EpisodePaths): JobsFile =>
  existsSync(P.jobs) ? (JSON.parse(readFileSync(P.jobs, "utf8")) as JobsFile) : { episode: P.id, jobs: [] };

/** Atomic write: temp file + rename, so a crash never leaves half a file. */
export const writeJobs = (P: EpisodePaths, data: JobsFile) => writeFileAtomic(P.jobs, JSON.stringify(data, null, 2) + "\n");

// ---- Time: Asia/Ho_Chi_Minh is UTC+7 all year (no DST). -------------------

const LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})$/;

/** "2026-11-20 19:00" (giờ Việt Nam) → "2026-11-20T12:00:00.000Z". */
export const localToUtc = (local: string): string => {
  const m = local.match(LOCAL_RE);
  if (!m) throw new Error(`Giờ không đúng dạng YYYY-MM-DD HH:mm: "${local}"`);
  const [, y, mo, d, h, mi] = m.map(Number);
  const utc = new Date(Date.UTC(y, mo - 1, d, h - 7, mi));
  // Reject impossible dates (e.g. 2026-02-30) that Date silently rolls over.
  const back = new Date(utc.getTime() + 7 * 3600_000);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) throw new Error(`Ngày không tồn tại: "${local}"`);
  return utc.toISOString();
};

// ---- Idempotency: same content to the same target = same key. --------------

export const idempotencyKey = (job: Job, mediaHashes: (string | null)[], contentHash: string | null) =>
  hashJson({ e: job.episodeId, v: job.contentVersion, p: job.platform, t: job.target, ty: job.type, m: mediaHashes, c: contentHash }).slice(0, 32);

// ---- Lock: one processor per episode at a time. -----------------------------

/** Runs fn while holding publishing/.lock (exclusive create). Stale locks (>30 min) are reported, not stolen silently. */
export const withLock = <T>(P: EpisodePaths, owner: string, fn: () => Promise<T> | T): Promise<T> => withFileLock(P.publishLock, owner, `phát hành ${P.id}`, fn);

// ---- Log: append-only, secrets redacted. -------------------------------------

const SECRET_KEYS = /(token|secret|key|authorization|password|access)/i;

export const redact = (v: unknown): unknown => {
  if (Array.isArray(v)) return v.map(redact);
  if (v && typeof v === "object") {
    return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, SECRET_KEYS.test(k) ? "<redacted>" : redact(x)]));
  }
  if (typeof v === "string") return v.replace(/(access_token|refresh_token|key)=([^&\s]+)/gi, "$1=<redacted>");
  return v;
};

export const appendLog = (P: EpisodePaths, entry: Record<string, unknown>) => {
  mkdirSync(dirname(P.publishLog), { recursive: true });
  appendFileSync(P.publishLog, JSON.stringify(redact({ at: new Date().toISOString(), ...entry })) + "\n");
};

// ---- State transitions -------------------------------------------------------

export const transition = (job: Job, to: JobState, note: string, at = new Date().toISOString()) => {
  if (!TRANSITIONS[job.state].includes(to)) throw new Error(`Không được chuyển ${job.id} từ ${job.state} sang ${to}.`);
  job.history.push({ at, from: job.state, to, note });
  job.state = to;
};

/**
 * Missed rule: a planned job whose time is more than `graceMinutes` in the
 * past becomes "missed". It is never sent automatically afterwards; the user
 * must plan it again. This stops a machine that was off from bulk-posting.
 */
export const isMissed = (job: Job, now: Date, graceMinutes: number) =>
  job.state === "planned" && job.schedule.utc !== null && now.getTime() > Date.parse(job.schedule.utc) + graceMinutes * 60_000;

/** Before re-sending after a timeout: a job that already has a remote id must be reconciled, never re-uploaded. */
export const mustReconcileBeforeSend = (job: Job) => job.remote.id !== null || job.state === "uploading" || job.state === "processing";
