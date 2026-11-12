// Publishing dry-run (shared by the CLI and Office Comedy Studio).
// Checks every job WITHOUT uploading, scheduling or changing any job.
// Each job is only blocked by the media/content that job itself uses.
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { writeFileAtomic } from "../episode/fsutil.ts";
import { join } from "node:path";
import { checkApproval, currentHashes, currentSources, hashFile, hashJson, hashText, readManifest } from "../episode/manifest.ts";
import { rel, type EpisodePaths } from "../episode/paths.ts";
import { partLabel } from "../episode/service.ts";
import { DATE_PROMISE } from "../episode/social.ts";
import { idempotencyKey, isMissed, localToUtc, mustReconcileBeforeSend, readJobs, type Job } from "./jobs.ts";

export type Cap = { api: boolean; schedule?: boolean; minLeadMinutes?: number; maxAheadDays?: number | null; minDurationSec?: number; maxDurationSec?: number; note?: string };
type Target = { platform: string; label: string; credentialEnv: string[]; [k: string]: unknown };
/** A valid environment variable NAME (upper-case, digits, underscore). Values never match. */
export const isEnvName = (s: string) => /^[A-Z][A-Z0-9_]{1,63}$/.test(s);

export type Finding ={ level: "BLOCK" | "WARN" | "INFO"; msg: string };
export type DryRunResult = { job: string; platform: string; type: string; state: string; mode: string; ready: boolean; findings: Finding[]; idempotencyKey: string | null; scheduleUtc: string | null; scheduleLocal: string | null };
export type DryRunReport = { episode: string; dryRun: true; note: string; checkedAt: string; readyCount: number; total: number; results: DryRunResult[] };

const ROLE_LABEL: Record<string, string> = { video: "Video", captions: "Phụ đề", thumbnail: "Thumbnail 9:16", cover: "Ảnh bìa 9:16", image: "Ảnh nhá hàng 1:1" };

export const runDryRun = (P: EpisodePaths, now: Date = new Date()): DryRunReport => {
  const cfg = JSON.parse(readFileSync("config/publishing.json", "utf8")) as {
    missedGraceMinutes: number;
    targets: Record<string, Target>;
    capabilities: Record<string, Record<string, Cap>>;
  };
  const manifest = readManifest(P);
  const hashes = currentHashes(P);
  const sources = currentSources(P, manifest);
  const social = existsSync(P.social) ? JSON.parse(readFileSync(P.social, "utf8")) : null;
  const jobs = readJobs(P).jobs;

  const get = (obj: unknown, path: string) => path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), obj);
  const TARGET_ID_FIELD: Record<string, string> = { youtube: "channelId", facebook: "pageId", tiktok: "username" };

  const results: DryRunResult[] = [];
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
      const h = m.role === "captions" ? hashText(abs) : hashFile(abs);
      mediaHashes.push(h);
      if (!h) {
        block(`${ROLE_LABEL[m.role] ?? m.role}: chưa có (${rel(abs)}).`);
        continue;
      }
      const part = m.role === "video" ? "video" : m.role === "captions" ? "captions" : m.path.includes("teaser-1x1") ? "teaser1x1" : "thumbnail9x16";
      const r = checkApproval(manifest.approvals[part], h, sources);
      if (r.status !== "approved") block(`${ROLE_LABEL[m.role] ?? m.role}: ${r.detail}.`);
    }
    if (job.type === "video") {
      const dur = manifest.duration.videoSec ?? 0;
      if (cap?.maxDurationSec && dur > cap.maxDurationSec) block(`Video ${dur} s > giới hạn ${cap.maxDurationSec} s của ${job.platform}.`);
      if (cap?.minDurationSec && dur < cap.minDurationSec) block(`Video ${dur} s < tối thiểu ${cap.minDurationSec} s.`);
    }

    // Content + approval + guards.
    const content = get(social, job.content.ref);
    let contentHash: string | null = null;
    if (!content) block(`Nội dung social chưa có (${job.content.ref}).`);
    else {
      // Each post is approved on its own: "platforms.youtube.video" → "youtube.video".
      const postKey = job.content.ref.replace(/^platforms./, "");
      contentHash = hashJson(content);
      const r = checkApproval(manifest.approvals.social[postKey], hashes.social[postKey] ?? null, sources);
      if (r.status !== "approved") block(`${partLabel(`social.${postKey}`)}: ${r.detail}.`);
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
        // credentialEnv must hold variable NAMES. Anything else may be a pasted secret: never echo it.
        const bad = target.credentialEnv.filter((n) => !isEnvName(n));
        if (bad.length)
          block(
            `config/publishing.json → targets["${job.target}"].credentialEnv có ${bad.length} mục không phải tên biến môi trường (có thể là giá trị bí mật dán nhầm; không in ra). Chỉ ghi TÊN biến ở đây, đặt giá trị trong .env.`,
          );
        const missing = target.credentialEnv.filter(isEnvName).filter((n) => !process.env[n]);
        if (missing.length) block(`Thiếu biến môi trường: ${missing.join(", ")} (không in giá trị).`);
        else if (!bad.length) info("Biến môi trường thông tin đăng nhập: có (không in giá trị).");
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
    results.push({ job: job.id, platform: job.platform, type: job.type, state: job.state, mode: job.mode, ready, findings: f, idempotencyKey: key, scheduleUtc, scheduleLocal: job.schedule.local });
  }


  return {
    episode: P.id,
    dryRun: true,
    note: "Không upload, không đặt lịch, không sửa job.",
    checkedAt: now.toISOString(),
    readyCount: results.filter((r) => r.ready).length,
    total: results.length,
    results,
  };
};

export const writeDryRunReport = (P: EpisodePaths, report: DryRunReport) => {
  mkdirSync(P.reportsDir, { recursive: true });
  const file = join(P.reportsDir, "publish-dry-run.json");
  writeFileAtomic(file, JSON.stringify(report, null, 2) + "\n");
  return file;
};
