// npm run publish:plan -- EP001 <jobId> "YYYY-MM-DD HH:mm"   (giờ Việt Nam)
// npm run publish:plan -- EP001 <jobId> --clear
// Sets or clears a job's schedule IN THE PROJECT ONLY (state draft ↔ planned).
// Nothing is sent to any platform. Only use a time the user has confirmed.
import { resolveEpisode } from "../../episode/paths.ts";
import { appendLog, localToUtc, readJobs, transition, withLock, writeJobs } from "../jobs.ts";

const [epArg, jobId, when] = process.argv.slice(2);
const P = resolveEpisode(epArg);
if (!jobId || !when) {
  console.error('Cách dùng: npm run publish:plan -- EP001 <jobId> "YYYY-MM-DD HH:mm" | --clear');
  process.exit(1);
}

await withLock(P, "publish:plan", () => {
  const data = readJobs(P);
  const job = data.jobs.find((j) => j.id === jobId);
  if (!job) throw new Error(`Không có job ${jobId}.`);
  if (when === "--clear") {
    if (job.state !== "planned") throw new Error(`Chỉ bỏ lịch được khi job đang planned (hiện: ${job.state}).`);
    job.schedule = { ...job.schedule, local: null, utc: null };
    transition(job, "draft", "Bỏ lịch trong dự án.");
  } else {
    const utc = localToUtc(when);
    if (Date.parse(utc) <= Date.now()) throw new Error("Giờ đăng phải ở tương lai.");
    if (!["draft", "planned", "missed", "failed"].includes(job.state)) throw new Error(`Không đổi lịch được khi job đang ${job.state}.`);
    job.schedule = { local: when.replace(" ", "T"), timezone: "Asia/Ho_Chi_Minh", utc };
    if (job.state !== "planned") transition(job, "planned", `Đặt lịch trong dự án: ${when} (UTC ${utc}).`);
    else job.history.push({ at: new Date().toISOString(), from: "planned", to: "planned", note: `Đổi lịch: ${when} (UTC ${utc}).` });
  }
  writeJobs(P, data);
  appendLog(P, { event: "plan", job: job.id, state: job.state, schedule: job.schedule });
  console.log(`${job.id}: ${job.state} ${job.schedule.local ?? ""} ${job.schedule.utc ? `(UTC ${job.schedule.utc})` : ""}`);
});
