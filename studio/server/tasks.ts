import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { writeFileAtomic } from "../../tools/episode/fsutil.ts";

// Background tasks (operational data only — never approvals, scripts or
// publishing state). Stored in runtime/studio/tasks.json (ignored by Git) so a
// reopened tab sees what ran. Rules:
//  - A task queued/running when the backend stopped becomes "interrupted" at
//    the next start. It is NOT re-run automatically (an AI call could be billed twice).
//  - Cancel aborts the work; a result that still arrives afterwards is dropped:
//    runners call ctx.guard() right before writing anything.
//  - AI tasks share one queue limited to maxConcurrent (default 1).

export type TaskType = "delivery-build" | "ai-ideas" | "ai-draft" | "ai-revise";
export type TaskState = "queued" | "running" | "succeeded" | "failed" | "interrupted" | "cancelled";
export type Task = {
  id: string;
  type: TaskType;
  episode: string | null;
  state: TaskState;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  message: string | null;
  result: unknown;
  /** What the task was asked to do (no secrets), used for "Thử lại". */
  input?: Record<string, unknown>;
  retryOf?: string;
  errorKind?: string;
  mayHaveBeenProcessed?: boolean;
  /** One entry per model call: tokens reported by the API + cost estimate. */
  aiCalls?: { purpose: string; model: string | null; usage: unknown; cost: unknown; at: string; outcome: string }[];
};

export class TaskCancelled extends Error {}

type Ctx = { signal: AbortSignal; task: Task; guard: () => void; save: () => void };
type Spec = {
  type: TaskType;
  episode: string | null;
  input?: Record<string, unknown>;
  retryOf?: string;
  /** Tasks with the same key can't run at the same time. */
  exclusiveKey: string;
  /** "dedupe": return the running one; "reject": throw ActiveTaskError. */
  onActive: "dedupe" | "reject";
  queue: "ai" | "none";
  run: (ctx: Ctx) => Promise<unknown>;
};

export class ActiveTaskError extends Error {
  task: Task;
  constructor(task: Task, message: string) {
    super(message);
    this.task = task;
  }
}

const FILE = "runtime/studio/tasks.json";
const LEDGER = "runtime/studio/ai-usage.jsonl";
const KEEP = 300;
let tasks: Task[] = [];
const keys = new Map<string, string>(); // task id → exclusive key
const controllers = new Map<string, AbortController>();
const pending: { task: Task; spec: Spec }[] = [];
let aiLimit = 1;

export const saveTasks = () => writeFileAtomic(FILE, JSON.stringify({ tasks: tasks.slice(-KEEP) }, null, 2) + "\n");

export const loadTasks = (opts: { aiConcurrency: number }) => {
  aiLimit = Math.max(1, opts.aiConcurrency);
  tasks = [];
  if (existsSync(FILE)) {
    try {
      tasks = (JSON.parse(readFileSync(FILE, "utf8")) as { tasks: Task[] }).tasks ?? [];
    } catch {
      tasks = [];
    }
  }
  let changed = false;
  for (const t of tasks)
    if (t.state === "queued" || t.state === "running") {
      const wasRunning = t.state === "running";
      t.state = "interrupted";
      t.finishedAt = new Date().toISOString();
      t.message = t.type.startsWith("ai-")
        ? wasRunning
          ? "Máy chủ Studio đã dừng khi đang chờ Claude. Không biết yêu cầu đã được xử lý chưa (có thể đã tính phí); Studio không tự gọi lại. Bấm Thử lại nếu muốn gửi lại."
          : "Máy chủ Studio đã dừng trước khi công việc bắt đầu. Chưa gọi Claude. Bấm Thử lại nếu muốn chạy."
        : "Máy chủ Studio đã dừng khi công việc chưa xong. Kết quả không được xác nhận: kiểm tra rồi chạy lại nếu cần.";
      if (t.type.startsWith("ai-")) t.mayHaveBeenProcessed = wasRunning;
      changed = true;
    }
  if (changed) saveTasks();
};

export const listTasks = (filter: { episode?: string; type?: string } = {}) =>
  tasks
    .filter((t) => (!filter.episode || t.episode === filter.episode) && (!filter.type || t.type === filter.type))
    .slice(-60)
    .reverse();
export const getTask = (id: string) => tasks.find((t) => t.id === id) ?? null;
const isActive = (t: Task) => t.state === "queued" || t.state === "running";
export const activeFor = (key: string) => tasks.find((t) => isActive(t) && keys.get(t.id) === key) ?? null;

export const startTask = (spec: Spec): { task: Task; deduped: boolean } => {
  const active = activeFor(spec.exclusiveKey);
  if (active) {
    if (spec.onActive === "dedupe") return { task: active, deduped: true };
    throw new ActiveTaskError(active, "Đang có một công việc AI khác cho tập này. Chờ xong hoặc huỷ trước khi tạo việc mới.");
  }
  const task: Task = {
    id: randomUUID(),
    type: spec.type,
    episode: spec.episode,
    state: "queued",
    createdAt: new Date().toISOString(),
    startedAt: null,
    finishedAt: null,
    message: null,
    result: null,
    ...(spec.input ? { input: spec.input } : {}),
    ...(spec.retryOf ? { retryOf: spec.retryOf } : {}),
  };
  tasks.push(task);
  keys.set(task.id, spec.exclusiveKey);
  saveTasks();
  if (spec.queue === "ai") {
    pending.push({ task, spec });
    pump();
  } else execute(task, spec);
  return { task, deduped: false };
};

const runningAi = () => tasks.filter((t) => t.state === "running" && t.type.startsWith("ai-")).length;

const pump = () => {
  while (pending.length && runningAi() < aiLimit) {
    const next = pending.shift()!;
    if (next.task.state !== "queued") continue; // cancelled while waiting
    execute(next.task, next.spec);
  }
};

const execute = (task: Task, spec: Spec) => {
  const ac = new AbortController();
  controllers.set(task.id, ac);
  task.state = "running";
  task.startedAt = new Date().toISOString();
  saveTasks();
  const ctx: Ctx = {
    signal: ac.signal,
    task,
    guard: () => {
      if (task.state === "cancelled" || ac.signal.aborted) throw new TaskCancelled("Đã huỷ.");
    },
    save: saveTasks,
  };
  spec
    .run(ctx)
    .then(
      (result) => {
        if (task.state === "cancelled") return; // late result after cancel: dropped
        task.result = result;
        task.state = "succeeded";
      },
      (e: Error & { kind?: string; mayHaveBeenProcessed?: boolean }) => {
        if (task.state === "cancelled") return;
        if (e instanceof TaskCancelled || e.kind === "cancelled") {
          task.state = "cancelled";
          task.message = "Đã huỷ.";
          return;
        }
        task.state = "failed";
        task.message = e.message;
        if (e.kind) task.errorKind = e.kind;
        if (e.mayHaveBeenProcessed !== undefined) task.mayHaveBeenProcessed = e.mayHaveBeenProcessed;
      },
    )
    .finally(() => {
      controllers.delete(task.id);
      if (!task.finishedAt) task.finishedAt = new Date().toISOString();
      saveTasks();
      pump();
    });
};

/** Cancels a queued or running task. Anything it returns afterwards is ignored. */
export const cancelTask = (id: string): Task => {
  const t = getTask(id);
  if (!t) throw new Error("Không có công việc này.");
  if (!isActive(t)) return t;
  const wasRunning = t.state === "running";
  t.state = "cancelled";
  t.finishedAt = new Date().toISOString();
  t.message = wasRunning
    ? "Đã huỷ khi đang chạy. Nếu Claude đã nhận yêu cầu thì có thể vẫn bị tính phí; kết quả trả về sau đó sẽ bị bỏ, không ghi vào kịch bản."
    : "Đã huỷ trước khi chạy (chưa gọi Claude).";
  if (t.type.startsWith("ai-")) t.mayHaveBeenProcessed = wasRunning;
  controllers.get(id)?.abort();
  saveTasks();
  pump();
  return t;
};

/** Usage ledger (tokens + cost estimate per model call; never prompts or keys). */
export const recordAiCall = (task: Task, entry: { purpose: string; model: string | null; usage: unknown; cost: unknown; outcome: string }) => {
  const e = { ...entry, at: new Date().toISOString() };
  (task.aiCalls ??= []).push(e);
  mkdirSync("runtime/studio", { recursive: true });
  appendFileSync(LEDGER, JSON.stringify({ task: task.id, type: task.type, episode: task.episode, ...e }) + "\n");
  saveTasks();
};

/**
 * Runs a project CLI script in a child process (node, fixed argument array, no
 * shell): the server stays responsive and the task really is "running" until
 * the work is done. Rejects with the script's last error line.
 */
export const runNodeScript = (script: string, args: string[]) =>
  new Promise<{ stdout: string }>((resolve, reject) => {
    execFile(process.execPath, [script, ...args], { cwd: process.cwd(), maxBuffer: 4 * 1024 * 1024, windowsHide: true }, (err, stdout, stderr) => {
      if (err) {
        const msg = (stderr || stdout || err.message).trim().split("\n").filter(Boolean).pop() ?? err.message;
        reject(new Error(msg));
      } else resolve({ stdout });
    });
  });
