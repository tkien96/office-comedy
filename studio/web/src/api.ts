// Thin client for the Studio backend (same origin). Mutating requests carry
// the X-Studio header the backend requires (CSRF guard).

export class ApiError extends Error {
  status: number;
  conflict: boolean;
  constructor(status: number, message: string, conflict = false) {
    super(message);
    this.status = status;
    this.conflict = conflict;
  }
}

const handle = async <T>(r: Response): Promise<T> => {
  const data = await r.json().catch(() => ({ error: `Máy chủ trả về lỗi ${r.status}.` }));
  if (!r.ok) throw new ApiError(r.status, (data as { error?: string }).error ?? `Lỗi ${r.status}`, Boolean((data as { conflict?: boolean }).conflict));
  return data as T;
};

export const get = <T>(path: string) =>
  fetch(path, { headers: { Accept: "application/json" } })
    .catch(() => {
      throw new ApiError(0, "Không kết nối được máy chủ Studio. Kiểm tra cửa sổ chạy Studio còn mở không.");
    })
    .then((r) => handle<T>(r));

export const send = <T>(method: "POST" | "PUT", path: string, body: unknown = {}) =>
  fetch(path, { method, headers: { "Content-Type": "application/json", "X-Studio": "1", Accept: "application/json" }, body: JSON.stringify(body) })
    .catch(() => {
      throw new ApiError(0, "Không kết nối được máy chủ Studio.");
    })
    .then((r) => handle<T>(r));

// ---- Types mirrored from the backend ---------------------------------------

export type ApprovalStatus = "approved" | "not_approved" | "needs_reapproval" | "needs_recheck" | "missing";

export type PartState = {
  part: string;
  label: string;
  production: string;
  status: ApprovalStatus;
  detail: string;
  hash: string | null;
  approvedAt: string | null;
  changedSources: string[];
  dependsOn: string[];
  viewToken: string | null;
};

export type PublishInfo = { state: string; label: string; jobs: { id: string; type: string; state: string; mode: string }[] };

export type EpisodeSummary = {
  id: string;
  ok: boolean;
  error?: string;
  title?: string;
  contentVersion?: number;
  durationSec?: number | null;
  durationInFrames?: number | null;
  hasVideo?: boolean;
  hasThumbnail?: boolean;
  updatedAt?: string;
  parts?: PartState[];
  problems?: string[];
  publishing?: Record<string, PublishInfo>;
};

export type Post = {
  kind?: string;
  postingMode?: string;
  optional?: boolean;
  supportedByApi?: boolean;
  title?: string;
  body?: string;
  hashtags?: string[];
  image?: string;
  coverImage?: string;
  thumbnail?: string;
  captionsFile?: string;
  coverTimestampMs?: number;
  note?: string;
};

export type SocialPost = { key: string; platform: string; name: string; post: Post; paste: string; token: string; editable: string[] };
export type Finding = { level: "BLOCK" | "WARN" | "INFO"; msg: string };
export type DryRunResult = { job: string; platform: string; type: string; state: string; mode: string; ready: boolean; findings: Finding[]; idempotencyKey: string | null; scheduleUtc: string | null; scheduleLocal: string | null };
export type DryRunReport = { episode: string; checkedAt: string; readyCount: number; total: number; results: DryRunResult[]; note: string };

export type Task = {
  id: string;
  type: string;
  episode: string;
  state: "queued" | "running" | "succeeded" | "failed" | "interrupted" | "cancelled";
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  message: string | null;
  result: unknown;
};

export type DeliveryCheck = { exists: boolean; ok: boolean; rows: { file: string; ok: boolean; problem: string | null }[]; extras: string[]; builtAt: string | null; error?: string };

export type Job = {
  id: string;
  platform: string;
  type: string;
  mode: string;
  state: string;
  target: string;
  contentRef: string;
  media: { role: string; path: string }[];
  scheduleLocal: string | null;
  scheduleUtc: string | null;
  remote: { id: string | null; url: string | null; platformStatus: string | null };
  attempts: number;
  lastError: string | null;
  history: { at: string; from: string | null; to: string; note: string }[];
};

export type Beat = {
  id: string;
  scene: string;
  kind: "line" | "action";
  role?: string;
  text?: string;
  desc?: string;
  visual?: string;
  expression?: Record<string, string>;
  time: { startSec: number; endSec: number; speechStartSec?: number; speechEndSec?: number } | null;
};

export type EpisodeDetail = {
  summary: EpisodeSummary;
  manifest?: {
    id: string;
    title: string;
    contentVersion: number;
    contentHash: string;
    createdAt: string;
    duration: { contentEndSec: number | null; videoSec: number | null; durationInFrames: number | null; fps: number };
    versions: Record<string, unknown>;
    checks: Record<string, unknown>;
    production: Record<string, string>;
  };
  parts?: PartState[];
  freshness?: { captions: string; socialMd: string };
  script?: { title: string; logline: string; scenes: { id: string; title: string; location: string; speakers: string[]; note?: string }[]; beats: Beat[] } | null;
  captions?: { index: number; start: number; end: number; lines: string[] }[] | null;
  media?: Record<string, { exists: boolean; size: number; path: string }>;
  social?: { posts: SocialPost[]; findings: { level: string; post: string; msg: string }[]; guard: { punchline?: string; keepSecret?: string[]; note?: string } | null };
  jobs?: Job[];
  lastDryRun?: DryRunReport | null;
  reports?: { key: string; label: string; kind: "md" | "json"; exists: boolean }[];
  delivery?: DeliveryCheck;
  tasks?: Task[];
};

// ---- AI / scripts ---------------------------------------------------------------

export type AiStatus = { provider: "claude" | "mock"; configured: boolean; keyPresent: boolean; model: string; modelKnown: boolean; effort: string; problems: string[]; maxConcurrentJobs: number };
export type CostEstimate = { kind: "estimated" | "unknown"; usd: number | null; note: string };
export type AiCall = { purpose: string; model: string | null; usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number } | null; cost: CostEstimate; at: string; outcome: string };
export type AiTask = Task & { input?: Record<string, unknown>; retryOf?: string; errorKind?: string; mayHaveBeenProcessed?: boolean; aiCalls?: AiCall[] };
export type Idea = { title: string; premise: string; conflict: string; punchlineDirection: string; characters: string[]; setting: string };

export type ScriptBeatDoc = {
  id: string;
  scene: string;
  kind: "line" | "action";
  role?: string;
  text?: string;
  desc?: string;
  sec?: number;
  sameTurn?: boolean;
  visual?: string;
  expression?: Record<string, string>;
  pose?: Record<string, string>;
  [k: string]: unknown;
};
export type ScriptDocT = {
  id: string;
  title: string;
  logline: string;
  creative?: { premise?: string; punchline?: string };
  scenes: { id: string; title: string; location: string; speakers: string[]; note?: string; [k: string]: unknown }[];
  beats: ScriptBeatDoc[];
  duration: { minSec: number; targetRangeSec: [number, number] };
  [k: string]: unknown;
};
export type CheckResult = { errors: string[]; warnings: string[]; estimateSec: number | null };
export type VersionMeta = { version: number; createdAt: string; source: "user" | "claude" | "restore" | "import"; note: string; baseVersion: number | null; hash: string; jobId?: string; restoredFrom?: number };
export type ProposalMeta = { id: string; createdAt: string; jobId: string; kind: "draft" | "revise"; instruction: string; scope: string[]; baseHash: string | null; hash: string; status: "pending" | "accepted" | "discarded" | "conflict"; statusNote?: string; check: CheckResult };
export type ScriptState = {
  current: { hash: string; script: ScriptDocT; version: number | null; versionMeta: VersionMeta | null; check: CheckResult } | null;
  versions: VersionMeta[];
  proposals: ProposalMeta[];
  request: { title: string; idea: string; characters: string[]; setting: string; notes: string; duration: { minSec: number; targetRangeSec: [number, number] }; createdAt: string; ideaSource: string } | null;
  activeTask: AiTask | null;
  tasks: AiTask[];
};
export type BeatDiff = { id: string; scene: string; status: "added" | "removed" | "changed" | "same"; fields: string[]; from: ScriptBeatDoc | null; to: ScriptBeatDoc | null };
export type ScriptDiff = {
  meta: { field: string; from: string; to: string }[];
  scenes: { id: string; status: string; fields: string[] }[];
  beats: BeatDiff[];
  summary: { added: number; removed: number; changed: number };
};
