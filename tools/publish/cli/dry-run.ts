// npm run publish:dry-run -- EP001 [--now "YYYY-MM-DD HH:mm"]
// Checks every publishing job of an episode WITHOUT uploading, scheduling or
// changing any job: files + hashes, approvals (bound to hashes), target
// account + credential presence (names only, never values), schedule in
// Asia/Ho_Chi_Minh → UTC and platform windows, missed detection, platform
// capability (API vs manual), duration limits, spoiler/date-promise guard,
// duplicates (idempotency key) and remote ids that need reconciling.
// Writes reports/publish-dry-run.json. Exit 0 = report written (not "ready").
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { checkApproval, currentHashes, hashFile, hashJson, readManifest } from "../../episode/manifest.ts";
import { rel, resolveEpisode } from "../../episode/paths.ts";
import { idempotencyKey, isMissed, localToUtc, mustReconcileBeforeSend, readJobs, type Job } from "../jobs.ts";

const args = process.argv.slice(2);
const P = resolveEpisode(args.find((a) => !a.startsWith("--")));
const nowArg = args.includes("--now") ? args[args.indexOf("--now") + 1] : null;
const now = nowArg ? new Date(localToUtc(nowArg)) : new Date();

type Cap = { api: boolean; schedule?: boolean; minLeadMinutes?: number; maxAheadDays?: number | null; minDurationSec?: number; maxDurationSec?: number; note?: string };
type Target = { platform: string; label: string; credentialEnv: string[]; [k: string]: unknown };
const cfg = JSON.parse(readFileSync("config/publishing.json", "utf8")) as {
  missedGraceMinutes: number;
  targets: Record<string, Target>;
  capabilities: Record<string, Record<string, Cap>>;
};
const manifest = readManifest(P);
const hashes = currentHashes(P);
const social = existsSync(P.social) ? JSON.parse(readFileSync(P.social, "utf8")) : null;
const jobs = readJobs(P).jobs;

const get = (obj: unknown, path: string) => path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), obj);
const TARGET_ID_FIELD: Record<string, string> = { youtube: "channelId", facebook: "pageId", tiktok: "username" };
const DATE_PROMISE = /(\b\d{1,2}[/.-]\d{1,2}\b|\b\d{1,2}\s?(h|giờ)\b|ngày\s+\d|thứ\s+(hai|ba|tư|năm|sáu|bảy)\s+(này|tới|sau)|chủ nhật (này|tới)|tối nay|ngày mai|tuần sau)/iu;

type Finding = { level: "BLOCK" | "WARN" | "INFO"; msg: string };
const results: { job: string; state: string; mode: string; ready: boolean; findings: Finding[]; idempotencyKey: string | null; scheduleUtc: string | null }[] = [];
const keys = new Map<string, string>();

for (const job of jobs as Job[]) {
  const f: Finding[] = [];
  const block = (msg: string) => f.push({ level: "BLOCK", msg });
  const warn = (msg: string) => f.push({ level: "WARN", msg });
  const info = (msg: string) => f.push({ level: "INFO", msg });

  // State.
  if (["published", "cancelled"].includes(job.state)) info(`Trạng thái ${job.state}: bỏ qua.`);
  if (job.state === "scheduled") info("Nền tảng đã giữ lịch: chỉ kiểm tra trạng thái, không gửi lại.");
  if (mustReconcileBeforeSend(job)) warn(`Có remote id hoặc đang dở (${job.state}): phải đối chiếu trạng thái trên nền tảng trước, không gửi lại.`);
  if (job.contentVersion !== manifest.contentVersion) block(`Job dùng phiên bản nội dung ${job.contentVersion}, tập hiện là ${manifest.contentVersion}.`);

  // Capability.
  const cap = cfg.capabilities[job.platform]?.[job.type];
  if (!cap) block(`Chưa khai báo khả năng ${job.platform}/${job.type}.`);
  else if (!cap.api && job.mode === "api") block(`${job.platform}/${job.type} không đăng được qua API: ${cap.note}`);
  else if (!cap.api) info(`Đăng THỦ CÔNG: ${cap.note ?? ""}`);

  // Media files + approvals bound to hashes.
  const mediaHashes: (string | null)[] = [];
  for (const m of job.media) {
    const abs = join(P.root, m.path);
    const h = hashFile(abs);
    mediaHashes.push(h);
    if (!h) {
      block(`${m.role}: chưa có (${rel(abs)}).`);
      continue;
    }
    const part = m.role === "video" ? "video" : m.role === "captions" ? "captions" : m.path.includes("teaser-1x1") ? "teaser1x1" : "thumbnail9x16";
    const r = checkApproval(manifest.approvals[part], h);
    if (r.status !== "approved") block(`${m.role}: ${r.detail}.`);
  }
  if (job.type === "video") {
    const dur = manifest.duration.videoSec ?? 0;
    if (cap?.maxDurationSec && dur > cap.maxDurationSec) block(`Video ${dur} s > giới hạn ${cap.maxDurationSec} s của ${job.platform}.`);
    if (cap?.minDurationSec && dur < cap.minDurationSec) block(`Video ${dur} s < tối thiểu ${cap.minDurationSec} s.`);
  }

  // Content + approval + guards.
  const platformContent = social?.platforms?.[job.platform];
  const content = get(social, job.content.ref);
  let contentHash: string | null = null;
  if (!content) block(`Nội dung social chưa có (${job.content.ref}).`);
  else {
    contentHash = hashJson(platformContent);
    const r = checkApproval(manifest.approvals.social[job.platform], hashes.social[job.platform] ?? null);
    if (r.status !== "approved") block(`Nội dung social ${job.platform}: ${r.detail}.`);
    const text = JSON.stringify(content);
    for (const p of (social.spoilerGuard?.punchlineMustNotAppear ?? []) as string[]) {
      if (text.toLowerCase().includes(p.toLowerCase())) block(`Nội dung lộ câu chốt ("${p}").`);
    }
    if (DATE_PROMISE.test(text)) warn("Nội dung có vẻ nhắc ngày/giờ: chỉ giữ khi lịch đã được xác nhận.");
  }

  // Target + credentials (names only).
  const target = cfg.targets[job.target];
  if (!target) block(`Không có tài khoản đích "${job.target}" trong config/publishing.json.`);
  else {
    if (target.platform !== job.platform) block(`Tài khoản đích ${job.target} không thuộc ${job.platform}.`);
    const idField = TARGET_ID_FIELD[job.platform];
    if (!target[idField]) (job.mode === "api" ? block : warn)(`Tài khoản đích "${target.label}" chưa có ${idField}.`);
    if (job.mode === "api") {
      const missing = target.credentialEnv.filter((n) => !process.env[n]);
      if (missing.length) block(`Thiếu biến môi trường: ${missing.join(", ")} (không in giá trị).`);
      else info("Biến môi trường thông tin đăng nhập: có (không in giá trị).");
    }
  }

  // Schedule.
  let scheduleUtc: string | null = null;
  if (!job.schedule.local) (job.mode === "api" ? block : warn)("Chưa có lịch đăng được xác nhận.");
  else {
    try {
      scheduleUtc = localToUtc(job.schedule.local);
      if (job.schedule.utc && job.schedule.utc !== scheduleUtc) block(`UTC lưu (${job.schedule.utc}) không khớp giờ Việt Nam (${scheduleUtc}).`);
      const leadMin = (Date.parse(scheduleUtc) - now.getTime()) / 60000;
      if (isMissed({ ...job, schedule: { ...job.schedule, utc: scheduleUtc } }, now, cfg.missedGraceMinutes)) block(`ĐÃ LỠ GIỜ (${job.schedule.local}): sẽ đánh dấu missed, không tự đăng.`);
      else if (leadMin < 0) warn(`Giờ đăng vừa qua ${Math.round(-leadMin)} phút (trong thời gian ân hạn).`);
      if (job.mode === "api" && cap?.schedule) {
        if (cap.minLeadMinutes && leadMin < cap.minLeadMinutes) block(`Phải hẹn trước ít nhất ${cap.minLeadMinutes} phút (còn ${Math.round(leadMin)}).`);
        if (cap.maxAheadDays && leadMin > cap.maxAheadDays * 1440) block(`Quá xa: ${job.platform} chỉ hẹn trong ${cap.maxAheadDays} ngày.`);
      }
    } catch (e) {
      block((e as Error).message);
    }
  }

  // Duplicates.
  const key = idempotencyKey(job, mediaHashes, contentHash);
  if (keys.has(key)) block(`Trùng nội dung với job ${keys.get(key)} (cùng khóa chống trùng).`);
  keys.set(key, job.id);
  if (job.idempotencyKey && job.idempotencyKey !== key) warn("Nội dung/media đã đổi so với lúc job được gửi: cần duyệt lại và tạo job mới, không gửi đè.");

  const ready = !f.some((x) => x.level === "BLOCK") && !["published", "cancelled", "scheduled"].includes(job.state);
  results.push({ job: job.id, state: job.state, mode: job.mode, ready, findings: f, idempotencyKey: key, scheduleUtc });
}

const report = {
  episode: P.id,
  dryRun: true,
  note: "Không upload, không đặt lịch, không sửa job.",
  checkedAt: now.toISOString(),
  readyCount: results.filter((r) => r.ready).length,
  total: results.length,
  results,
};
mkdirSync(P.reportsDir, { recursive: true });
writeFileSync(join(P.reportsDir, "publish-dry-run.json"), JSON.stringify(report, null, 2) + "\n");

console.log(`DRY-RUN ${P.id} (không upload): ${report.readyCount}/${report.total} job sẵn sàng · giờ kiểm tra ${now.toISOString()}`);
for (const r of results) {
  console.log(`\n${r.ready ? "SẴN SÀNG" : "CHƯA    "} ${r.job} [${r.mode}, ${r.state}]${r.scheduleUtc ? ` UTC ${r.scheduleUtc}` : ""}`);
  for (const x of r.findings) console.log(`   ${x.level.padEnd(5)} ${x.msg}`);
}
console.log(`\nBáo cáo: ${rel(join(P.reportsDir, "publish-dry-run.json"))}`);
