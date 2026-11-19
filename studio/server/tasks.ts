import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { writeFileAtomic } from "../../tools/episode/fsutil.ts";

// Background tasks (operational data only — never approvals, scripts or
// publishing state). Stored in runtime/studio/tasks.json (ignored by Git) so a
// reopened tab sees what ran. Rules:
//  - A task queued/running when the backend stopped becomes "interrupted" at
//    the next start. It is NOT re-run automatically.
//  - A result that arrives after the task was marked otherwise is dropped:
//    runners call ctx.guard() right before writing anything.
// Older records may carry types "ai-ideas" / "ai-draft" / "ai-revise" from the
// removed Claude API flow: they are only displayed, never run again.

export type TaskType = "delivery-build";
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
  /** What the task was asked to do (no secrets). */
  input?: Record<string, unknown>;
};

export class TaskCancelled extends Error {}

type Ctx = { signal: AbortSignal; task: Task; guard: () => void; save: () => void };
type Spec = {
  type: TaskType;
  episode: string | null;
  input?: Record<string, unknown>;
  /** Tasks with the same key can't run at the same time. */
  exclusiveKey: string;
  /** "dedupe": return the running one; "reject": throw ActiveTaskError. */
  onActive: "dedupe" | "reject";
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
const KEEP = 300;
let tasks: Task[] = [];
const keys = new Map<string, string>(); // task id → exclusive key

export const saveTasks = () => writeFileAtomic(FILE, JSON.stringify({ tasks: tasks.slice(-KEEP) }, null, 2) + "\n");

export const loadTasks = () => {
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
      t.state = "interrupted";
      t.finishedAt = new Date().toISOString();
      t.message = "Máy chủ Studio đã dừng khi công việc chưa xong. Kết quả không được xác nhận: kiểm tra rồi chạy lại nếu cần.";
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
    throw new ActiveTaskError(active, "Đang có một công việc khác cùng loại cho tập này. Chờ xong rồi thử lại.");
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
  };
  tasks.push(task);
  keys.set(task.id, spec.exclusiveKey);
  saveTasks();
  execute(task, spec);
  return { task, deduped: false };
};

const execute = (task: Task, spec: Spec) => {
  const ac = new AbortController();
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
        if (task.state === "cancelled") return; // late result: dropped
        task.result = result;
        task.state = "succeeded";
      },
      (e: Error) => {
        if (task.state === "cancelled") return;
        if (e instanceof TaskCancelled) {
          task.state = "cancelled";
          task.message = "Đã huỷ.";
          return;
        }
        task.state = "failed";
        task.message = e.message;
      },
    )
    .finally(() => {
      if (!task.finishedAt) task.finishedAt = new Date().toISOString();
      saveTasks();
    });
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
