import { existsSync, readFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { writeFileAtomic } from "../../tools/episode/fsutil.ts";

// Background tasks (operational data only — never approvals or publishing state).
// Stored in runtime/studio/tasks.json (ignored by Git) so a reopened tab can
// see what ran. A task that was queued/running when the backend stopped is
// marked "interrupted" at the next start: its result is NOT assumed.

export type TaskState = "queued" | "running" | "succeeded" | "failed" | "interrupted";
export type Task = {
  id: string;
  type: "delivery-build";
  episode: string;
  state: TaskState;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  message: string | null;
  result: unknown;
};

const FILE = "runtime/studio/tasks.json";
const KEEP = 200;
let tasks: Task[] = [];

const save = () => writeFileAtomic(FILE, JSON.stringify({ tasks: tasks.slice(-KEEP) }, null, 2) + "\n");

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
      t.message = "Backend đã dừng khi công việc chưa xong. Kết quả không được xác nhận: kiểm tra bộ delivery rồi chạy lại nếu cần.";
      changed = true;
    }
  if (changed) save();
};

export const listTasks = (episode?: string) => tasks.filter((t) => !episode || t.episode === episode).slice(-50).reverse();
export const getTask = (id: string) => tasks.find((t) => t.id === id) ?? null;

/** Starts `run` in the background unless the same task is already queued/running (then returns that one). */
export const startTask = (type: Task["type"], episode: string, run: () => Promise<unknown>): { task: Task; deduped: boolean } => {
  const active = tasks.find((t) => t.type === type && t.episode === episode && (t.state === "queued" || t.state === "running"));
  if (active) return { task: active, deduped: true };
  const task: Task = { id: randomUUID(), type, episode, state: "queued", createdAt: new Date().toISOString(), startedAt: null, finishedAt: null, message: null, result: null };
  tasks.push(task);
  save();
  task.state = "running";
  task.startedAt = new Date().toISOString();
  save();
  run().then(
    (result) => {
      task.result = result;
      task.state = "succeeded";
    },
    (e: Error) => {
      task.state = "failed";
      task.message = e.message;
    },
  ).finally(() => {
    task.finishedAt = new Date().toISOString();
    save();
  });
  return { task, deduped: false };
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
