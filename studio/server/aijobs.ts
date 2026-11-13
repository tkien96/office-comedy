import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ClaudeProvider } from "../../tools/ai/claude.ts";
import { aiStatus, estimateCost, loadAiConfig, mockScenarioFile } from "../../tools/ai/config.ts";
import { MockProvider } from "../../tools/ai/mock.ts";
import { draftPrompt, ideasPrompt, repairPrompt, revisePrompt } from "../../tools/ai/prompts.ts";
import { AiError, type AiProvider, type AiRequest } from "../../tools/ai/provider.ts";
import { createEpisode } from "../../tools/episode/create.ts";
import { EPISODE_ID, episodePaths, type EpisodePaths } from "../../tools/episode/paths.ts";
import {
  CHARACTERS,
  checkDraftShape,
  checkIdeas,
  DRAFT_SCHEMA,
  draftToScript,
  IDEAS_SCHEMA,
  LOCATIONS,
  mergeScoped,
  validateScript,
  type DraftOutput,
  type ScriptDoc,
} from "../../tools/episode/scriptdoc.ts";
import { commitVersion, readCurrent, readRequest, saveProposal, saveRejected, writeRequest, type ScriptRequest } from "../../tools/episode/scriptstore.ts";
import { ConflictError, ValidationError } from "../../tools/episode/service.ts";
import { getTask, recordAiCall, startTask, type Task } from "./tasks.ts";

// AI jobs: Claude only writes or rewrites structured scripts. The backend
// allocates IDs, validates, stores versions/proposals and never approves.
// Nothing here runs when a page is only opened, read or approved.

let mockProvider: MockProvider | null = null;
const provider = (): AiProvider => {
  const mock = mockScenarioFile();
  if (mock) return (mockProvider ??= new MockProvider(mock));
  return new ClaudeProvider(loadAiConfig()); // throws AiError("not_configured") without a key
};

const assertConfigured = () => {
  const s = aiStatus();
  if (!s.configured) throw new AiError("not_configured", `Chưa cấu hình Claude. ${s.problems.join(" ")}`);
};

type Ctx = { signal: AbortSignal; task: Task; guard: () => void };

/** One model call, recorded with tokens + cost estimate (or "unknown"). */
const call = async (ctx: Ctx, req: Omit<AiRequest, "signal">) => {
  const p = provider();
  try {
    const r = await p.generate({ ...req, signal: ctx.signal });
    recordAiCall(ctx.task, { purpose: req.purpose, model: r.model, usage: r.usage, cost: estimateCost(r.usage), outcome: r.fallbackUsed ? "ok (fallback model)" : "ok" });
    return r;
  } catch (e) {
    const err = e as AiError;
    recordAiCall(ctx.task, { purpose: req.purpose, model: null, usage: err.usage ?? null, cost: estimateCost(err.usage ?? null), outcome: `lỗi: ${err.kind ?? "unknown"}` });
    throw e;
  }
};

/**
 * Asks for a script, validates it on the server, and asks for a fix at most
 * maxRepairAttempts times. Invalid output is kept under script/rejected/ for
 * diagnosis and never becomes the script.
 */
const generateValidScript = async (
  ctx: Ctx,
  P: EpisodePaths,
  purpose: "draft" | "revise",
  prompt: { system: string; user: string },
  toScript: (d: DraftOutput) => ScriptDoc,
  cast: string[],
) => {
  const { maxRepairAttempts } = loadAiConfig();
  let output: unknown = (await call(ctx, { purpose, ...prompt, schema: DRAFT_SCHEMA as unknown as Record<string, unknown> })).json;
  for (let attempt = 0; ; attempt++) {
    const shape = checkDraftShape(output);
    const script = shape.length ? null : toScript(output as DraftOutput);
    const check = script ? validateScript(script, { cast }) : { errors: shape, warnings: [], lint: null, estimateSec: null };
    if (script && !check.errors.length) return { script, check };
    if (attempt >= maxRepairAttempts) {
      ctx.guard();
      saveRejected(P, { jobId: ctx.task.id, errors: check.errors, output });
      throw new ValidationError(
        `Bản Claude viết chưa qua kiểm tra sau ${attempt + 1} lần (${check.errors.length} lỗi, ví dụ: ${check.errors.slice(0, 3).join(" | ")}). Bản lỗi được lưu để chẩn đoán, không thay kịch bản hiện hành.`,
      );
    }
    ctx.guard();
    output = (await call(ctx, { purpose: "repair", ...repairPrompt(prompt, output, check.errors), schema: DRAFT_SCHEMA as unknown as Record<string, unknown> })).json;
  }
};

const castOf = (P: EpisodePaths, script: ScriptDoc | null) => {
  const req = readRequest(P);
  const roles = new Set(req?.characters ?? []);
  for (const b of script?.beats ?? []) if (b.kind === "line" && b.role && b.role !== "narrator") roles.add(b.role);
  if (script?.beats.some((b) => b.role === "narrator")) roles.add("kien");
  return roles.size ? [...roles] : [...CHARACTERS];
};

// ---- Ideas ------------------------------------------------------------------------

export const startIdeas = (input: { hint: string; characters: string[] }, retryOf?: string) => {
  assertConfigured();
  const cast = input.characters.filter((c) => (CHARACTERS as readonly string[]).includes(c));
  return startTask({
    type: "ai-ideas",
    episode: null,
    input: { hint: input.hint, characters: cast },
    retryOf,
    exclusiveKey: "ai-ideas",
    onActive: "dedupe",
    queue: "ai",
    run: async (ctx) => {
      const r = await call(ctx, { purpose: "ideas", ...ideasPrompt(input.hint, cast.length ? cast : [...CHARACTERS]), schema: IDEAS_SCHEMA as unknown as Record<string, unknown> });
      const { ideas, errors } = checkIdeas(r.json);
      if (errors.length) throw new AiError("invalid_output", `Claude trả về ý tưởng không đúng yêu cầu: ${errors.join(" ")}`, { mayHaveBeenProcessed: true });
      return { ideas };
    },
  });
};

// ---- Create episode + first draft ---------------------------------------------------

export type CreateInput = {
  requestToken: string;
  ideaSource: "user" | "claude";
  title: string;
  idea: string;
  premise?: string;
  punchlineDirection?: string;
  characters: string[];
  setting: string;
  notes: string;
  minSec: number;
  targetMinSec: number;
  targetMaxSec: number;
};

export const validateCreate = (b: Record<string, unknown>): CreateInput => {
  const s = (k: string, max: number, required = false) => {
    const v = typeof b[k] === "string" ? (b[k] as string).replace(/\r\n/g, "\n").normalize("NFC").trim() : "";
    if (required && !v) throw new ValidationError(`Thiếu "${k}".`);
    if ([...v].length > max) throw new ValidationError(`"${k}" dài quá ${max} ký tự.`);
    return v;
  };
  const n = (k: string) => {
    const v = Number(b[k]);
    if (!Number.isFinite(v)) throw new ValidationError(`"${k}" phải là số.`);
    return Math.round(v);
  };
  const token = s("requestToken", 64, true);
  if (!/^[A-Za-z0-9-]{8,64}$/.test(token)) throw new ValidationError("requestToken không hợp lệ.");
  const characters = Array.isArray(b.characters) ? (b.characters as unknown[]).map(String) : [];
  if (!characters.length || characters.some((c) => !(CHARACTERS as readonly string[]).includes(c))) throw new ValidationError("Chọn ít nhất một nhân vật trong danh sách có sẵn.");
  const setting = s("setting", 40, true);
  if (!(LOCATIONS as readonly string[]).includes(setting)) throw new ValidationError(`Bối cảnh phải là một trong: ${LOCATIONS.join(", ")}.`);
  const minSec = n("minSec");
  const targetMinSec = n("targetMinSec");
  const targetMaxSec = n("targetMaxSec");
  if (minSec < 60) throw new ValidationError("Thời lượng tối thiểu không được dưới 60 giây.");
  if (targetMinSec < minSec || targetMaxSec < targetMinSec || targetMaxSec > 300) throw new ValidationError("Khoảng thời lượng mục tiêu không hợp lệ (tối thiểu ≤ từ ≤ đến ≤ 300 s).");
  return {
    requestToken: token,
    ideaSource: b.ideaSource === "claude" ? "claude" : "user",
    title: s("title", 120, true),
    idea: s("idea", 2000, true),
    premise: s("premise", 1000),
    punchlineDirection: s("punchlineDirection", 1000),
    characters: [...new Set(characters)],
    setting,
    notes: s("notes", 2000),
    minSec,
    targetMinSec,
    targetMaxSec,
  };
};

/** Finds an episode already created for this request token (server-side double-submit guard). */
const episodeForToken = (token: string) => {
  if (!existsSync("episodes")) return null;
  for (const d of readdirSync("episodes").filter((x) => EPISODE_ID.test(x))) {
    const r = readRequest(episodePaths(d));
    if (r?.requestToken === token) return d;
  }
  return null;
};

/**
 * Allocates a NEW episode ID (shared allocator), stores the request, then
 * queues the first draft. Same requestToken twice → same episode, no new ID.
 * If the AI call fails later, the episode stays as it is for "Thử lại".
 */
export const createEpisodeWithDraft = (input: CreateInput) => {
  assertConfigured();
  const existing = episodeForToken(input.requestToken);
  if (existing) return { episode: existing, created: false, task: null as Task | null };
  const P = createEpisode(input.title);
  const req: ScriptRequest = {
    createdAt: new Date().toISOString(),
    requestToken: input.requestToken,
    ideaSource: input.ideaSource,
    title: input.title,
    idea: input.idea,
    premise: input.premise,
    punchlineDirection: input.punchlineDirection,
    characters: input.characters,
    setting: input.setting,
    notes: input.notes,
    duration: { minSec: input.minSec, targetRangeSec: [input.targetMinSec, input.targetMaxSec] },
  };
  writeRequest(P, req);
  const { task } = startDraft(P);
  return { episode: P.id, created: true, task };
};

export const startDraft = (P: EpisodePaths, retryOf?: string) => {
  assertConfigured();
  const req = readRequest(P);
  if (!req) throw new ValidationError("Tập này không có yêu cầu ban đầu (script/request.json), nên không viết nháp tự động được.");
  return startTask({
    type: "ai-draft",
    episode: P.id,
    input: { episode: P.id },
    retryOf,
    exclusiveKey: `ai-script:${P.id}`,
    onActive: "reject",
    queue: "ai",
    run: async (ctx) => {
      const before = readCurrent(P);
      const { script, check } = await generateValidScript(
        ctx,
        P,
        "draft",
        draftPrompt(req, P.id),
        (d) => draftToScript(d, { id: P.id, duration: req.duration }),
        req.characters,
      );
      ctx.guard(); // cancelled meanwhile → drop the result
      const now = readCurrent(P);
      if (!before && !now) {
        const v = commitVersion(P, script, { expectedHash: null, source: "claude", note: "Bản nháp đầu tiên do Claude viết", jobId: ctx.task.id });
        return { kind: "version", version: v.version, warnings: check.warnings, estimateSec: check.estimateSec };
      }
      // A script exists (written meanwhile, or this is a retry): never overwrite it — keep as a proposal.
      const p = saveProposal(P, {
        jobId: ctx.task.id,
        kind: "draft",
        instruction: "Bản nháp mới do Claude viết",
        scope: [],
        baseVersion: null,
        baseHash: now?.hash ?? null,
        status: before?.hash === now?.hash ? "pending" : "conflict",
        check,
        script,
      });
      return { kind: "proposal", proposalId: p.id, conflict: p.status === "conflict", warnings: check.warnings, estimateSec: check.estimateSec };
    },
  });
};

// ---- Revise -------------------------------------------------------------------------

export const startRevise = (P: EpisodePaths, input: { instruction: string; scope: string[]; baseHash: string }, retryOf?: string) => {
  assertConfigured();
  const cur = readCurrent(P);
  if (!cur) throw new ValidationError("Chưa có kịch bản để sửa.");
  if (cur.hash !== input.baseHash) throw new ConflictError("Kịch bản đã thay đổi sau khi bạn mở trang. Tải lại rồi yêu cầu sửa trên bản mới nhất.");
  const instruction = input.instruction.replace(/\r\n/g, "\n").normalize("NFC").trim();
  if (!instruction) throw new ValidationError("Nhập yêu cầu sửa.");
  if ([...instruction].length > 2000) throw new ValidationError("Yêu cầu sửa dài quá 2000 ký tự.");
  const sceneIds = cur.script.scenes.map((s) => s.id);
  const scope = [...new Set(input.scope)].filter((s) => sceneIds.includes(s));
  if (input.scope.length && scope.length !== new Set(input.scope).size) throw new ValidationError("Có cảnh được chọn không tồn tại trong kịch bản.");
  const snapshot = cur; // the version Claude is asked to change
  const cast = castOf(P, cur.script);
  return startTask({
    type: "ai-revise",
    episode: P.id,
    input: { episode: P.id, instruction, scope },
    retryOf,
    exclusiveKey: `ai-script:${P.id}`,
    onActive: "reject",
    queue: "ai",
    run: async (ctx) => {
      const { script, check } = await generateValidScript(
        ctx,
        P,
        "revise",
        revisePrompt(snapshot.script, instruction, scope, cast),
        (d) => {
          const full = draftToScript(d, { id: P.id, duration: snapshot.script.duration, timing: snapshot.script.timing });
          return scope.length ? mergeScoped(snapshot.script, full, scope) : { ...snapshot.script, ...full, creative: full.creative };
        },
        cast,
      );
      ctx.guard();
      const now = readCurrent(P);
      const conflict = now?.hash !== snapshot.hash;
      const p = saveProposal(P, {
        jobId: ctx.task.id,
        kind: "revise",
        instruction,
        scope,
        baseVersion: null,
        baseHash: snapshot.hash,
        status: conflict ? "conflict" : "pending",
        ...(conflict ? { statusNote: "Kịch bản hiện hành đã đổi trong lúc Claude sửa." } : {}),
        check,
        script,
      });
      return { kind: "proposal", proposalId: p.id, conflict, warnings: check.warnings, estimateSec: check.estimateSec };
    },
  });
};

// ---- Retry ----------------------------------------------------------------------------

/** User-initiated retry of a finished AI task with the same input (never automatic). */
export const retryTask = (id: string) => {
  const t = getTask(id);
  if (!t) throw new ValidationError("Không có công việc này.");
  if (t.state === "queued" || t.state === "running") throw new ValidationError("Công việc đang chạy.");
  if (t.state === "succeeded") throw new ValidationError("Công việc đã xong; tạo yêu cầu mới thay vì thử lại.");
  const inp = (t.input ?? {}) as Record<string, unknown>;
  if (t.type === "ai-ideas") return startIdeas({ hint: String(inp.hint ?? ""), characters: (inp.characters as string[]) ?? [] }, t.id);
  const ep = String(inp.episode ?? t.episode ?? "");
  if (!EPISODE_ID.test(ep) || !existsSync(join("episodes", ep))) throw new ValidationError("Tập của công việc này không còn.");
  const P = episodePaths(ep);
  if (t.type === "ai-draft") return startDraft(P, t.id);
  if (t.type === "ai-revise") {
    const cur = readCurrent(P);
    return startRevise(P, { instruction: String(inp.instruction ?? ""), scope: (inp.scope as string[]) ?? [], baseHash: cur?.hash ?? "" }, t.id);
  }
  throw new ValidationError("Loại công việc này không thử lại từ đây.");
};
