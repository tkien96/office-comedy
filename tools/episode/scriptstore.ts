// Script versions, AI proposals and the creation request, per episode:
//
//   script/script.json            current version (what tools and approvals read)
//   script/request.json           the user's original request (idea, cast, duration…)
//   script/versions/v0001.json    every committed version {meta + script}; never deleted
//   script/proposals/<id>.json    AI suggestions, never applied automatically
//   script/rejected/<id>.json     model output that failed validation (diagnostics only)
//
// The current version only changes through commitVersion(), under the episode
// lock, and only if the caller saw the current hash (no silent overwrite).
// Restoring an old version creates a NEW version; history is append-only.
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { withFileLockSync, writeFileAtomic } from "./fsutil.ts";
import { scriptContentHash } from "./manifest.ts";
import type { EpisodePaths } from "./paths.ts";
import type { CheckResult, ScriptDoc } from "./scriptdoc.ts";
import { ConflictError, ValidationError } from "./service.ts";

export type VersionSource = "user" | "claude" | "restore" | "import";
export type VersionMeta = {
  version: number;
  createdAt: string;
  source: VersionSource;
  note: string;
  baseVersion: number | null;
  hash: string;
  jobId?: string;
  proposalId?: string;
  restoredFrom?: number;
};
export type ProposalStatus = "pending" | "accepted" | "discarded" | "conflict";
export type Proposal = {
  id: string;
  createdAt: string;
  jobId: string;
  kind: "draft" | "revise";
  instruction: string;
  scope: string[]; // scene ids; empty = whole script
  baseVersion: number | null;
  baseHash: string | null;
  hash: string;
  status: ProposalStatus;
  statusNote?: string;
  check: CheckResult;
  script: ScriptDoc;
};
export type ScriptRequest = {
  createdAt: string;
  requestToken: string;
  ideaSource: "user" | "claude";
  title: string;
  idea: string;
  premise?: string;
  punchlineDirection?: string;
  characters: string[];
  setting: string;
  notes: string;
  duration: { minSec: number; targetRangeSec: [number, number] };
};

const dirs = (P: EpisodePaths) => ({
  versions: join(P.scriptDir, "versions"),
  proposals: join(P.scriptDir, "proposals"),
  rejected: join(P.scriptDir, "rejected"),
  request: join(P.scriptDir, "request.json"),
});
const vfile = (P: EpisodePaths, n: number) => join(dirs(P).versions, `v${String(n).padStart(4, "0")}.json`);
const readJson = <T>(p: string): T => JSON.parse(readFileSync(p, "utf8")) as T;

export const hashScript = (s: ScriptDoc) => scriptContentHash(s as unknown as Record<string, unknown>);

export const readCurrent = (P: EpisodePaths): { script: ScriptDoc; hash: string } | null => {
  if (!existsSync(P.script)) return null;
  const script = readJson<ScriptDoc>(P.script);
  return { script, hash: hashScript(script) };
};

export const listVersions = (P: EpisodePaths): VersionMeta[] => {
  const d = dirs(P).versions;
  if (!existsSync(d)) return [];
  return readdirSync(d)
    .filter((f) => /^v\d{4}\.json$/.test(f))
    .sort()
    .map((f) => {
      const { script: _s, ...meta } = readJson<VersionMeta & { script: ScriptDoc }>(join(d, f));
      void _s;
      return meta;
    });
};

export const readVersion = (P: EpisodePaths, n: number): (VersionMeta & { script: ScriptDoc }) | null => {
  const f = vfile(P, n);
  return existsSync(f) ? readJson<VersionMeta & { script: ScriptDoc }>(f) : null;
};

/** Which committed version the current script.json is (null if it predates history or was edited outside the Studio). */
export const currentVersion = (P: EpisodePaths): VersionMeta | null => {
  const cur = readCurrent(P);
  if (!cur) return null;
  const vs = listVersions(P);
  const last = vs[vs.length - 1];
  return last && last.hash === cur.hash ? last : (vs.find((v) => v.hash === cur.hash) ?? null);
};

const writeVersion = (P: EpisodePaths, script: ScriptDoc, meta: Omit<VersionMeta, "version" | "createdAt" | "hash">): VersionMeta => {
  mkdirSync(dirs(P).versions, { recursive: true });
  const n = listVersions(P).length + 1;
  const v: VersionMeta = { version: n, createdAt: new Date().toISOString(), hash: hashScript(script), ...meta };
  writeFileAtomic(vfile(P, n), JSON.stringify({ ...v, script }, null, 2) + "\n");
  return v;
};

/**
 * Makes `script` the current version. Refuses if the current script is not the
 * one the caller based its change on (expectedHash; null = "there is none yet").
 */
export const commitVersion = (
  P: EpisodePaths,
  script: ScriptDoc,
  opts: { expectedHash: string | null; source: VersionSource; note: string; jobId?: string; proposalId?: string; restoredFrom?: number },
): VersionMeta =>
  withFileLockSync(P.episodeLock, "script-commit", P.id, () => {
    const cur = readCurrent(P);
    if ((cur?.hash ?? null) !== opts.expectedHash)
      throw new ConflictError("Kịch bản hiện hành đã thay đổi (từ CLI, tab khác hoặc thao tác khác) sau khi bạn mở. Tải lại để xem bản mới nhất.");
    // First change to a script that has no history yet: keep the existing file as v0001.
    let base = currentVersion(P);
    if (cur && !base) base = writeVersion(P, cur.script, { source: "import", note: "Bản có sẵn trước khi có lịch sử phiên bản", baseVersion: null });
    const v = writeVersion(P, script, {
      source: opts.source,
      note: opts.note,
      baseVersion: base?.version ?? null,
      ...(opts.jobId ? { jobId: opts.jobId } : {}),
      ...(opts.proposalId ? { proposalId: opts.proposalId } : {}),
      ...(opts.restoredFrom ? { restoredFrom: opts.restoredFrom } : {}),
    });
    writeFileAtomic(P.script, JSON.stringify(script, null, 2) + "\n");
    // Keep episode.json in step (title, content hash, production state). Approvals are NOT touched:
    // the script approval is bound to its hash, so it becomes "cần duyệt lại" by itself.
    const m = JSON.parse(readFileSync(P.episodeJson, "utf8"));
    m.title = script.title;
    m.contentHash = v.hash;
    m.production = { ...m.production, script: "done" };
    if (m.approvals?.script?.status === "missing") m.approvals.script = { status: "not_approved" };
    writeFileAtomic(P.episodeJson, JSON.stringify(m, null, 2) + "\n");
    return v;
  });

// ---- Proposals ------------------------------------------------------------------

export const listProposals = (P: EpisodePaths): Omit<Proposal, "script">[] => {
  const d = dirs(P).proposals;
  if (!existsSync(d)) return [];
  return readdirSync(d)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const { script: _s, ...p } = readJson<Proposal>(join(d, f));
      void _s;
      return p;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};

const PROPOSAL_ID = /^p-[0-9a-z-]{8,40}$/;
export const readProposal = (P: EpisodePaths, id: string): Proposal | null => {
  if (!PROPOSAL_ID.test(id)) return null;
  const f = join(dirs(P).proposals, `${id}.json`);
  return existsSync(f) ? readJson<Proposal>(f) : null;
};

export const saveProposal = (P: EpisodePaths, p: Omit<Proposal, "id" | "createdAt" | "hash">): Proposal => {
  mkdirSync(dirs(P).proposals, { recursive: true });
  const id = `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const full: Proposal = { id, createdAt: new Date().toISOString(), hash: hashScript(p.script), ...p };
  writeFileAtomic(join(dirs(P).proposals, `${id}.json`), JSON.stringify(full, null, 2) + "\n");
  return full;
};

const setProposalStatus = (P: EpisodePaths, p: Proposal, status: ProposalStatus, note?: string) => {
  writeFileAtomic(join(dirs(P).proposals, `${p.id}.json`), JSON.stringify({ ...p, status, ...(note ? { statusNote: note } : {}) }, null, 2) + "\n");
};

/** Applies a pending proposal as a new version (only if the current script is still the one it was based on). */
export const acceptProposal = (P: EpisodePaths, id: string, viewedHash: string | null): VersionMeta => {
  const p = readProposal(P, id);
  if (!p) throw new ValidationError("Không có bản đề xuất này.");
  if (p.status !== "pending") throw new ValidationError(`Bản đề xuất đang ở trạng thái "${p.status}", không áp dụng được.`);
  if (p.check.errors.length) throw new ValidationError("Bản đề xuất còn lỗi chặn, không áp dụng được.");
  const cur = readCurrent(P);
  if ((cur?.hash ?? null) !== p.baseHash) {
    setProposalStatus(P, p, "conflict", "Kịch bản hiện hành đã đổi sau khi Claude bắt đầu sửa.");
    throw new ConflictError("Kịch bản hiện hành đã thay đổi sau khi Claude bắt đầu sửa, nên không áp dụng tự động bản đề xuất này. Bản đề xuất vẫn được giữ để xem.");
  }
  const v = commitVersion(P, p.script, { expectedHash: viewedHash, source: "claude", note: p.instruction || "Bản nháp do Claude viết", jobId: p.jobId, proposalId: p.id });
  setProposalStatus(P, p, "accepted", `Thành phiên bản ${v.version}`);
  return v;
};

export const discardProposal = (P: EpisodePaths, id: string) => {
  const p = readProposal(P, id);
  if (!p) throw new ValidationError("Không có bản đề xuất này.");
  if (p.status === "accepted") throw new ValidationError("Bản đề xuất đã được áp dụng.");
  setProposalStatus(P, p, "discarded");
};

// ---- Request + rejected output ---------------------------------------------------

export const readRequest = (P: EpisodePaths): ScriptRequest | null => (existsSync(dirs(P).request) ? readJson<ScriptRequest>(dirs(P).request) : null);
export const writeRequest = (P: EpisodePaths, r: ScriptRequest) => writeFileAtomic(dirs(P).request, JSON.stringify(r, null, 2) + "\n");

/** Model output that failed validation: kept for diagnosis, never used as the script. */
export const saveRejected = (P: EpisodePaths, entry: { jobId: string; errors: string[]; output: unknown }) => {
  mkdirSync(dirs(P).rejected, { recursive: true });
  const f = join(dirs(P).rejected, `${new Date().toISOString().replace(/[:.]/g, "-")}-${entry.jobId.slice(0, 8)}.json`);
  writeFileAtomic(f, JSON.stringify({ at: new Date().toISOString(), ...entry }, null, 2) + "\n");
  return f;
};
