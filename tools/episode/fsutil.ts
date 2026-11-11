import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync, writeSync } from "node:fs";
import { dirname } from "node:path";

// Shared file primitives for the CLI and Office Comedy Studio:
//  - writeFileAtomic: temp file in the same folder + fsync + rename, so a crash
//    or a concurrent reader never sees half a JSON file.
//  - withFileLock: exclusive lock file (open "wx"). Stale locks are REPORTED,
//    never stolen silently.

export const writeFileAtomic = (file: string, data: string | Buffer) => {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  const fd = openSync(tmp, "w");
  try {
    if (typeof data === "string") writeSync(fd, data, null, "utf8");
    else writeSync(fd, data);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(tmp, file);
};

export class LockBusyError extends Error {
  stale: boolean;
  constructor(message: string, stale: boolean) {
    super(message);
    this.stale = stale;
  }
}

const LOCK_STALE_MS = 30 * 60_000;

/** Synchronous body under an exclusive lock file. */
export const withFileLockSync = <T>(lockPath: string, owner: string, label: string, fn: () => T): T => {
  const fd = acquire(lockPath, owner, label);
  try {
    closeSync(fd);
    return fn();
  } finally {
    release(lockPath);
  }
};

/** Async body under an exclusive lock file. */
export const withFileLock = async <T>(lockPath: string, owner: string, label: string, fn: () => Promise<T> | T): Promise<T> => {
  const fd = acquire(lockPath, owner, label);
  try {
    closeSync(fd);
    return await fn();
  } finally {
    release(lockPath);
  }
};

const acquire = (lockPath: string, owner: string, label: string) => {
  mkdirSync(dirname(lockPath), { recursive: true });
  try {
    const fd = openSync(lockPath, "wx");
    writeFileSync(fd, JSON.stringify({ owner, pid: process.pid, at: new Date().toISOString() }));
    return fd;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
    let age = 0;
    let holder = "";
    try {
      age = Date.now() - statSync(lockPath).mtimeMs;
      holder = readFileSync(lockPath, "utf8");
    } catch {
      /* lock vanished between calls */
    }
    const stale = age > LOCK_STALE_MS;
    throw new LockBusyError(
      stale
        ? `Khóa ${lockPath} đã cũ (${Math.round(age / 60000)} phút, ${holder}). Kiểm tra không còn tiến trình nào đang chạy rồi xoá khóa thủ công.`
        : `Đang có thao tác khác trên ${label} (${holder}). Thử lại sau.`,
      stale,
    );
  }
};

const release = (lockPath: string) => {
  try {
    if (existsSync(lockPath)) unlinkSync(lockPath);
  } catch {
    /* already removed */
  }
};
