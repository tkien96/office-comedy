import type { EpisodePaths } from "../episode/paths.ts";
import { ConflictError, ValidationError } from "../episode/service.ts";
import { connectionsView } from "./connections.ts";
import { readJobs, withLock, writeJobs, type Job } from "./jobs.ts";

// Binding a job to a verified account. Only the user does this (Studio
// "Gắn tài khoản"). Switching the default connection later never moves a job:
// the dry-run blocks jobs whose bound account differs from the active one.

const BINDABLE: Job["state"][] = ["draft", "planned", "failed", "missed"];

export const bindJobAccount = (P: EpisodePaths, jobId: string, p: { connectionId: string; platformAccountId: string; replace?: boolean }) =>
  withLock(P, "studio:bind-account", () => {
    const data = readJobs(P);
    const job = data.jobs.find((j) => j.id === jobId);
    if (!job) throw new ValidationError(`Không có job ${jobId}.`);
    if (job.mode !== "api") throw new ValidationError("Job đăng thủ công không cần gắn tài khoản API.");
    if (!BINDABLE.includes(job.state)) throw new ValidationError(`Job đang ở trạng thái ${job.state}: không đổi tài khoản đích.`);
    if (job.remote.id) throw new ValidationError("Job đã có remote ID trên nền tảng: không đổi tài khoản đích.");
    const t = connectionsView().targets.find((x) => x.key === job.target);
    if (!t) throw new ValidationError(`Không có tài khoản đích ${job.target}.`);
    const activeId = t.source === "studio" ? t.active?.id : t.source === "env" ? `env:${t.key}` : null;
    if (t.status !== "verified" || !t.identity || !activeId) throw new ValidationError("Tài khoản đích chưa được xác minh: kiểm tra kết nối trước khi gắn.");
    // The page must show exactly what is active now (no stale tab).
    if (activeId !== p.connectionId || t.identity.id !== p.platformAccountId)
      throw new ConflictError("Kết nối đang dùng đã thay đổi so với trang bạn đang xem. Tải lại rồi xác nhận lại.");
    if (job.account && job.account.platformAccountId !== p.platformAccountId && !p.replace)
      throw new ConflictError(`Job đang gắn với ${job.account.name} (${job.account.platformAccountId}). Xác nhận rõ việc đổi sang tài khoản khác.`);
    const at = new Date().toISOString();
    const before = job.account ? `${job.account.name} (${job.account.platformAccountId})` : "chưa gắn";
    job.account = { connectionId: activeId, platformAccountId: t.identity.id, name: t.identity.name, boundAt: at };
    job.history.push({ at, from: job.state, to: job.state, note: `Gắn tài khoản đích: ${before} → ${t.identity.name} (${t.identity.id}).` });
    writeJobs(P, data);
    return { job: job.id, account: job.account };
  });
