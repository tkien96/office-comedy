// Delivery package (shared by the CLI and Office Comedy Studio).
//
// episodes/EPxxx/delivery/ is a BUILD OUTPUT: every file is copied/generated
// from the current sources and listed in delivery/manifest.json with its hash,
// its source and the approval state at build time. Building:
//   1. plans everything in memory (fails before touching disk if a source is missing),
//   2. refuses if delivery/ holds files it did not create (never deletes them silently),
//   3. writes into delivery.tmp-<time>/ and verifies every copy,
//   4. only then swaps it in place of the old folder (old kept on any failure).
// Building never changes any approval.
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { captionsFreshness } from "./captions.ts";
import { withFileLockSync } from "./fsutil.ts";
import { checkApproval, currentHashes, currentSources, gitCommit, hashFile, hashText, readManifest, readSocial, type ApprovalStatus } from "./manifest.ts";
import { rel, type EpisodePaths } from "./paths.ts";
import { ValidationError } from "./service.ts";
import { platformMd } from "./social.ts";
import { targetAccountInfo } from "../publish/connections.ts";
import { readJobs } from "../publish/jobs.ts";

export type Entry = {
  file: string;
  role: string;
  source: string;
  sha256: string;
  approvalPart: string;
  approval: ApprovalStatus;
  approvalDetail: string;
};

export const STATUS_VI: Record<ApprovalStatus, string> = {
  approved: "ĐÃ DUYỆT",
  not_approved: "CHỜ DUYỆT",
  needs_reapproval: "CẦN DUYỆT LẠI",
  needs_recheck: "CẦN KIỂM TRA LẠI",
  missing: "CHƯA CÓ",
};

const flat = (p: string) => basename(p); // social.json paths → delivery file names
const GENERATED = ["README.md", "manifest.json"];

export const planDelivery = (P: EpisodePaths) => {
  const m = readManifest(P);
  const social = readSocial(P);
  const cur = currentHashes(P);
  const src = currentSources(P, m);





  // ---------------------------------------------------------------------------
  // Plan: which files, from which source, under which approval.

  const media = [
    { role: "Video cuối (đúng bản đã render và kiểm tra)", from: P.video, part: "video", hash: cur.video },
    { role: "Phụ đề SRT", from: P.captions, part: "captions", hash: cur.captions },
    { role: "Thumbnail / ảnh bìa 9:16", from: P.thumbnail9x16, part: "thumbnail9x16", hash: cur.thumbnail9x16 },
    { role: "Ảnh nhá hàng 1:1", from: P.teaser1x1, part: "teaser1x1", hash: cur.teaser1x1 },
  ];

  const missing = media.filter((x) => !x.hash).map((x) => rel(x.from));
  if (missing.length) throw new ValidationError(`Thiếu nguồn: ${missing.join(", ")}. Tạo trước rồi chạy lại (không dùng file thay thế).`);
  if (!social) throw new ValidationError(`Thiếu ${rel(P.social)}.`);
  if (captionsFreshness(P) !== "khớp nguồn") throw new ValidationError(`Phụ đề lệch timeline: chạy npm run episode:captions -- ${P.id} trước.`);

  const approvalOf = (part: string, hash: string | null) => {
    const a = part.startsWith("social.") ? m.approvals.social[part.slice(7)] : (m.approvals as unknown as Record<string, Parameters<typeof checkApproval>[0]>)[part];
    return checkApproval(a, hash, src);
  };

  // Target account (non-secret metadata from the shared connections service).
  const jobTargets = readJobs(P).jobs;
  const accountLine = (platform: string) => {
    const key = jobTargets.find((j) => j.platform === platform)?.target;
    const a = key ? targetAccountInfo(key) : null;
    if (!a) return "Tài khoản đích: chưa có job cho nền tảng này.";
    if (platform === "tiktok")
      return a.tiktok
        ? `Tài khoản đích: **@${a.tiktok.username}** (${a.tiktok.profileUrl}). Lưu trong Studio để đăng thủ công; **chưa xác minh bằng API**. Đăng nhập đúng tài khoản này trong app TikTok trước khi đăng.`
        : "Tài khoản đích: **chưa lưu** (Studio → Cấu hình → Kết nối mạng xã hội → TikTok).";
    if (a.identity && a.status === "verified") return `Tài khoản đích (${a.label}): **${a.identity.name}** (ID \`${a.identity.id}\`), đã xác minh qua API (chỉ danh tính, không phải quyền đăng).`;
    if (a.identity) return `Tài khoản đích (${a.label}): ${a.identity.name} (ID \`${a.identity.id}\`), kết nối hiện **chưa xác minh lại**.`;
    return `Tài khoản đích (${a.label}): **chưa xác minh**. Khi đăng tay, kiểm tra đúng kênh/Page trước khi bấm đăng.`;
  };

  // Per-platform guides (text generated from social.json + fixed posting notes).
  const GUIDE: Record<string, string> = {
    youtube: `## Đăng thủ công (YouTube Studio trên máy tính)

  1. Tải lên \`${flat(P.video)}\` (khung dọc, dưới 3 phút → được xếp vào Shorts; API/Studio không có cờ "Shorts" riêng).
  2. Dán tiêu đề và mô tả ở dưới. Hashtag đã nằm cuối mô tả.
  3. Khán giả: "Không, nội dung này không dành cho trẻ em".
  4. **Ảnh thu nhỏ:** tải \`${flat(P.thumbnail9x16)}\` (9:16, 2160x3840). Theo trợ giúp YouTube, ảnh thu nhỏ tùy chỉnh cho Shorts **chỉ đặt được trong YouTube Studio trên máy tính** và **tài khoản phải xác minh**. Trợ giúp không nói ảnh này có hiện trong luồng Shorts hay không.
  5. **Phụ đề:** Studio → Phụ đề → Tải tệp lên → \`${flat(P.captions)}\` (có mốc thời gian). Video đã in sẵn phụ đề; SRT để YouTube hiện phụ đề có thể bật/tắt và tìm kiếm.
  6. Chế độ hiển thị: chỉ chọn Lên lịch/Công khai khi đã có lịch được xác nhận.
  `,
    facebook: `## Đăng thủ công (Page)

  1. Reel: tải \`${flat(P.video)}\` (9:16, 3–90 s; EP001 dài ${m.duration.videoSec} s).
  2. Dán mô tả ở dưới.
  3. **Ảnh bìa:** dùng \`${flat(P.thumbnail9x16)}\` nếu giao diện đăng Reel có mục tải ảnh bìa. Mình chưa tìm được trang trợ giúp chính thức xác nhận mục này trong app/Meta Business Suite. Qua API: \`POST /{video-id}/thumbnails\` (ảnh ≤ 10 MB, cùng tỷ lệ với video), gọi sau khi Reel đã tạo; bước publish Reel không có tham số ảnh bìa.
  4. **Phụ đề:** tải \`${flat(P.captions)}\` nếu giao diện có mục phụ đề; video đã in sẵn phụ đề.
  5. Bài nhá hàng: bài ảnh với \`${flat(P.teaser1x1)}\` + nội dung "Bài nhá hàng". Tài liệu chính thức mình đọc không nêu tỷ lệ khuyến nghị cho bài ảnh; 1:1 hiển thị trọn trong bảng tin.
  `,
    tiktok: `## Đăng thủ công (app TikTok)

  1. Tải \`${flat(P.video)}\`, dán caption ở dưới (hashtag đã nằm cuối).
  2. **Ảnh bìa:** chọn khung hình ở **${((social.platforms.tiktok?.video as { coverTimestampMs?: number })?.coverTimestampMs ?? 0) / 1000} s** (Kiên cười, Sếp đứng sau). API của TikTok chỉ cho chọn khung hình (\`video_cover_timestamp_ms\`), không nhận ảnh riêng. Nếu app cho tải ảnh bìa lên thì có thể dùng \`${flat(P.thumbnail9x16)}\`; mình chưa xác minh được tính năng này qua trang trợ giúp chính thức.
  3. **Phụ đề:** video đã in sẵn phụ đề. Không bật thêm phụ đề tự động để tránh hai lớp chữ chồng nhau.
  4. Bài nhá hàng: bài ảnh với \`${flat(P.teaser1x1)}\` (tùy chọn).
  5. Sau khi đăng, ghi link bài vào \`publishing/jobs.json\` (job \`${P.id}-tiktok-video\`) để dự án biết đã đăng.
  `,
  };

  // ---------------------------------------------------------------------------
  // Build in memory.

  const entries: Entry[] = [];
  const files = new Map<string, Buffer | string>();

  for (const x of media) {
    const name = flat(x.from);
    const r = approvalOf(x.part, x.hash);
    entries.push({ file: name, role: x.role, source: rel(x.from), sha256: x.part === "captions" ? hashText(x.from)! : x.hash!, approvalPart: x.part, approval: r.status, approvalDetail: r.detail });
  }

  for (const platform of Object.keys(social.platforms)) {
    const posts = Object.keys(social.platforms[platform]).filter((k) => typeof social.platforms[platform][k] === "object");
    const states = posts.map((post) => {
      const key = `${platform}.${post}`;
      return { key, r: approvalOf(`social.${key}`, cur.social[key] ?? null) };
    });
    const md = `# ${P.id} · ${platform}

  Tạo tự động bằng \`npm run episode:delivery -- ${P.id}\` từ \`social/social.json\`. Không sửa file này.

  Trạng thái duyệt lúc xuất: ${states.map((s) => `\`${s.key}\` **${STATUS_VI[s.r.status]}**`).join(" · ")}. Chỉ đăng bài đã duyệt.

  ${accountLine(platform)}

  ${GUIDE[platform] ?? ""}
  ${platformMd(social, platform, { mapPath: flat })}`;
    const name = `${platform}.md`;
    files.set(name, md);
    const worst = states.find((s) => s.r.status !== "approved")?.r ?? states[0].r;
    entries.push({
      file: name,
      role: `Nội dung + hướng dẫn đăng ${platform}`,
      source: `${rel(P.social)} → ${states.map((s) => s.key).join(", ")}`,
      sha256: "",
      approvalPart: states.map((s) => `social.${s.key}`).join(", "),
      approval: worst.status,
      approvalDetail: states.map((s) => `${s.key}: ${s.r.detail}`).join("; "),
    });
  }

  const builtFrom = {
    episode: P.id,
    title: m.title,
    contentVersion: m.contentVersion,
    duration: m.duration,
    gitCommit: gitCommit(),
    sources: src,
  };

  const approved = entries.filter((e) => e.approval === "approved");
  const pending = entries.filter((e) => e.approval !== "approved");
  const readme = `# ${P.id}: bộ đăng thủ công

  **${m.title}** · phiên bản nội dung ${m.contentVersion} · ${m.duration.videoSec} s, ${m.duration.durationInFrames} khung @${m.duration.fps} fps, 1080x1920

  Thư mục này là **bản xuất**, tạo lại toàn bộ bằng \`npm run episode:delivery -- ${P.id}\`. Không sửa tay. Kiểm tra bộ còn khớp nguồn hay không: \`npm run episode:delivery -- ${P.id} --check\`.
  Xuất vào đây **không** làm thay đổi trạng thái duyệt. Trạng thái dưới đây là lúc xuất; trạng thái hiện tại xem bằng \`npm run episode:status -- ${P.id}\`.

  ## Đã duyệt

  ${approved.length ? approved.map((e) => `- \`${e.file}\`: ${e.role}`).join("\n") : "- (chưa có)"}

  ## Chờ duyệt hoặc cần duyệt lại: chưa dùng để đăng

  ${pending.length ? pending.map((e) => `- \`${e.file}\`: ${e.role} · **${STATUS_VI[e.approval]}**`).join("\n") : "- (không có)"}

  ## File nào dùng cho việc gì

  | File | Dùng cho |
  |---|---|
  | \`${flat(P.video)}\` | Video đăng trên YouTube Shorts, Facebook Reels, TikTok |
  | \`${flat(P.captions)}\` | Phụ đề tải lên YouTube (và Facebook nếu có mục phụ đề). Video đã in sẵn phụ đề |
  | \`${flat(P.thumbnail9x16)}\` | Ảnh thu nhỏ YouTube Shorts (Studio trên máy tính); ảnh bìa Reel Facebook |
  | \`${flat(P.teaser1x1)}\` | Bài ảnh nhá hàng trên Facebook Page / TikTok (tùy chọn) |
  | \`youtube.md\`, \`facebook.md\`, \`tiktok.md\` | Tiêu đề, mô tả hoặc caption, hashtag (bản dán) và các bước đăng |
  | \`manifest.json\` | Phiên bản, hash từng file, nguồn và trạng thái duyệt lúc xuất |

  Lưu ý: chưa có lịch đăng được xác nhận. Không có nội dung nào hứa ngày giờ ra mắt.
  `;
  files.set("README.md", readme);

  const manifestJson = () =>
    JSON.stringify(
      {
        $comment: "Bản xuất tạo bởi npm run episode:delivery. Hash = sha256 của file trong thư mục này (SRT/MD: sau khi đổi CRLF→LF).",
        ...builtFrom,
        files: entries.map((e) => ({ ...e, sha256: e.sha256 || (files.has(e.file) ? sha(files.get(e.file)!) : "") })),
        generated: ["README.md", "manifest.json"],
      },
      null,
      2,
    ) + "\n";

  const sha = (b: Buffer | string) => createHash("sha256").update(typeof b === "string" ? b.replace(/\r\n/g, "\n") : b).digest("hex");
  return { entries, files, media: media.map((x) => ({ name: flat(x.from), from: x.from })), manifestJson: manifestJson() };
};

const fileHash = (p: string) => (/\.(md|srt)$/.test(p) ? hashText(p) : hashFile(p));

/** Files currently in delivery/ that the previous build did not create. */
export const deliveryExtras = (P: EpisodePaths): string[] => {
  const D = P.deliveryDir;
  if (!existsSync(D)) return [];
  let known: string[] = [];
  try {
    known = (JSON.parse(readFileSync(join(D, "manifest.json"), "utf8")) as { files: { file: string }[] }).files.map((f) => f.file);
  } catch {
    known = [];
  }
  return readdirSync(D).filter((f) => !known.includes(f) && !GENERATED.includes(f));
};

export type DeliveryCheck = {
  exists: boolean;
  ok: boolean;
  rows: { file: string; ok: boolean; problem: string | null }[];
  extras: string[];
  builtAt: string | null;
  error?: string;
};

export const checkDelivery = (P: EpisodePaths): DeliveryCheck => {
  const D = P.deliveryDir;
  const mf = join(D, "manifest.json");
  if (!existsSync(mf)) return { exists: false, ok: false, rows: [], extras: deliveryExtras(P), builtAt: null };
  let want: { files: Entry[] };
  try {
    want = JSON.parse(planDelivery(P).manifestJson) as { files: Entry[] };
  } catch (e) {
    return { exists: true, ok: false, rows: [], extras: deliveryExtras(P), builtAt: null, error: (e as Error).message };
  }
  const old = JSON.parse(readFileSync(mf, "utf8")) as { files: Entry[]; builtAt?: string | null };
  const rows = want.files.map((w) => {
    const o = old.files.find((f) => f.file === w.file);
    const onDisk = existsSync(join(D, w.file)) ? fileHash(join(D, w.file)) : null;
    const problems = [
      !o && "chưa có trong bộ",
      onDisk !== w.sha256 && (onDisk === null ? "thiếu file" : onDisk === o?.sha256 ? "khác nguồn hiện tại (bộ cũ)" : "file đã bị sửa tay"),
      o && o.approval !== w.approval && `trạng thái duyệt đổi: ${STATUS_VI[o.approval]} → ${STATUS_VI[w.approval]}`,
    ].filter(Boolean) as string[];
    return { file: w.file, ok: problems.length === 0, problem: problems.length ? problems.join("; ") : null };
  });
  const extras = deliveryExtras(P);
  return { exists: true, ok: rows.every((r) => r.ok) && extras.length === 0, rows, extras, builtAt: old.builtAt ?? null };
};

export type BuildResult = { files: number; entries: Entry[] };

/** Builds delivery/ atomically. `injectFailure` is for tests only (simulates a failed copy). */
export const buildDelivery = (P: EpisodePaths, opts: { injectFailure?: boolean } = {}): BuildResult =>
  withFileLockSync(P.episodeLock, "delivery", P.id, () => {
    const plan = planDelivery(P);
    const extras = deliveryExtras(P);
    if (extras.length)
      throw new ValidationError(`Thư mục delivery có file không do lệnh tạo ra: ${extras.join(", ")}. Chuyển các file này ra chỗ khác rồi tạo lại (không tự xoá).`);
    const D = P.deliveryDir;
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const tmp = `${D}.tmp-${stamp}`;
    const old = `${D}.old-${stamp}`;
    try {
      mkdirSync(tmp, { recursive: true });
      for (const x of plan.media) copyFileSync(x.from, join(tmp, x.name));
      for (const [name, body] of plan.files) writeFileSync(join(tmp, name), body);
      const manifest = JSON.parse(plan.manifestJson) as Record<string, unknown>;
      manifest.builtAt = new Date().toISOString();
      writeFileSync(join(tmp, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
      for (const x of plan.media) if (fileHash(x.from) !== fileHash(join(tmp, x.name))) throw new Error(`Bản sao khác nguồn: ${x.name}`);
      if (opts.injectFailure) throw new Error("Lỗi giả lập (kiểm thử).");
    } catch (e) {
      rmSync(tmp, { recursive: true, force: true });
      throw new Error(`Tạo bộ delivery thất bại, bộ cũ giữ nguyên: ${(e as Error).message}`);
    }
    // Swap: old → .old, tmp → delivery, then remove .old. Restore on failure.
    const hadOld = existsSync(D);
    try {
      if (hadOld) renameSync(D, old);
      renameSync(tmp, D);
    } catch (e) {
      if (hadOld && !existsSync(D) && existsSync(old)) renameSync(old, D);
      rmSync(tmp, { recursive: true, force: true });
      throw new Error(`Không thay được thư mục delivery (có thể đang mở trong ứng dụng khác), bộ cũ giữ nguyên: ${(e as Error).message}`);
    }
    if (hadOld) rmSync(old, { recursive: true, force: true });
    return { files: readdirSync(D).length, entries: plan.entries };
  });

/** Files allowed in the ZIP: exactly those listed in delivery/manifest.json (+ README, manifest), each verified. */
export const deliveryZipEntries = (P: EpisodePaths) => {
  const D = P.deliveryDir;
  const mf = join(D, "manifest.json");
  if (!existsSync(mf)) throw new ValidationError("Chưa có bộ delivery. Tạo bộ trước.");
  const manifest = JSON.parse(readFileSync(mf, "utf8")) as { files: Entry[] };
  const out: { name: string; path: string }[] = [];
  for (const f of manifest.files) {
    if (f.file !== basename(f.file) || f.file.startsWith(".")) throw new ValidationError(`Tên file không hợp lệ trong manifest: ${f.file}`);
    const p = join(D, f.file);
    if (!existsSync(p) || fileHash(p) !== f.sha256) throw new ValidationError(`${f.file} không khớp manifest. Tạo lại bộ delivery.`);
    out.push({ name: f.file, path: p });
  }
  for (const g of GENERATED) out.push({ name: g, path: join(D, g) });
  return out;
};
