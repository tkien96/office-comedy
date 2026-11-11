// Episode services shared by the CLI (tools/episode/cli/*) and Office Comedy
// Studio (studio/server). Source of truth stays in the episode folder:
//   episode.json   metadata, production state, approvals (hash + basis)
//   social.json    social copy (one object per post)
//   publishing/jobs.json   publishing jobs
// Nothing here talks to Claude, TTS, Remotion or any platform.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { captionsFreshness } from "./captions.ts";
import { withFileLockSync, writeFileAtomic } from "./fsutil.ts";
import {
  basisFor,
  checkApproval,
  currentHashes,
  currentSources,
  dependsOn,
  hashJson,
  readManifest,
  readSocial,
  SOURCE_LABEL,
  type Approval,
  type ApprovalStatus,
  type Manifest,
  type SourceKey,
} from "./manifest.ts";
import { EPISODE_ID, episodePaths, type EpisodePaths } from "./paths.ts";
import { buildSocialMd, checkSocial, LIMITS, socialMdFreshness, socialMdPath, type Post, type SocialFinding } from "./social.ts";

export const MEDIA_PARTS = ["script", "audio", "video", "captions", "thumbnail9x16", "teaser1x1"] as const;
export type MediaPart = (typeof MEDIA_PARTS)[number];

export const PART_LABEL: Record<string, string> = {
  script: "Kịch bản",
  audio: "Âm thanh",
  video: "Video",
  captions: "Phụ đề (SRT)",
  thumbnail9x16: "Thumbnail 9:16",
  teaser1x1: "Ảnh nhá hàng 1:1",
};
const PLATFORM_LABEL: Record<string, string> = { youtube: "YouTube", facebook: "Facebook", tiktok: "TikTok" };
const POST_LABEL: Record<string, string> = { video: "video", teaser: "bài nhá hàng" };
export const partLabel = (part: string) => {
  if (!part.startsWith("social.")) return PART_LABEL[part] ?? part;
  const [, pl, post] = part.split(".");
  return `Social ${PLATFORM_LABEL[pl] ?? pl} – ${POST_LABEL[post] ?? post}`;
};

export type PartState = {
  part: string;
  label: string;
  production: string;
  status: ApprovalStatus;
  detail: string;
  hash: string | null;
  approvedAt: string | null;
  changedSources: string[];
  dependsOn: string[];
  /** Identifies exactly the version shown (own hash + current source hashes). Approving requires it. */
  viewToken: string | null;
};

export const viewTokenFor = (part: string, hash: string | null, src: Record<SourceKey, string | null>) =>
  hash ? hashJson({ part, hash, basis: basisFor(part, src) }).slice(0, 32) : null;

export const partStates = (P: EpisodePaths, m: Manifest = readManifest(P)): PartState[] => {
  const cur = currentHashes(P);
  const src = currentSources(P, m);
  const out: PartState[] = [];
  const add = (part: string, a: Approval | undefined, hash: string | null, production: string) => {
    const r = checkApproval(a, hash, src);
    out.push({
      part,
      label: partLabel(part),
      production,
      status: r.status,
      detail: r.detail,
      hash,
      approvedAt: r.status === "missing" || r.status === "not_approved" ? null : (a?.approvedAt ?? null),
      changedSources: r.changedSources.map((k) => SOURCE_LABEL[k as SourceKey] ?? k),
      dependsOn: dependsOn(part).map((k) => SOURCE_LABEL[k]),
      viewToken: viewTokenFor(part, hash, src),
    });
  };
  for (const k of MEDIA_PARTS) add(k, m.approvals[k], cur[k], m.production[k] ?? "chưa có");
  for (const [post, h] of Object.entries(cur.social)) add(`social.${post}`, m.approvals.social[post], h, m.production.social ?? "chưa có");
  return out;
};

// ---------------------------------------------------------------------------
// Approvals

export class ConflictError extends Error {}
export class ValidationError extends Error {}

/**
 * Records the user's approval of `part` bound to its current hash and source
 * hashes. With `viewToken`, refuses if the product or a source changed after
 * the user looked at it. Never approves anything implicitly.
 */
export const approvePart = (P: EpisodePaths, part: string, opts: { viewToken?: string; note?: string; revoke?: boolean; by?: string } = {}) =>
  withFileLockSync(P.episodeLock, "approve", P.id, () => {
    const m = readManifest(P);
    const cur = currentHashes(P);
    const src = currentSources(P, m);
    const isSocial = part.startsWith("social.");
    const key = isSocial ? part.slice("social.".length) : part;
    if (!isSocial && !(MEDIA_PARTS as readonly string[]).includes(part)) throw new ValidationError(`Phần không hợp lệ: ${part}`);
    if (isSocial && !(key in cur.social)) throw new ValidationError(`Không có bài "${key}" trong social.json.`);
    const hash = isSocial ? cur.social[key] : cur[part as MediaPart];

    let approval: Approval;
    if (opts.revoke) {
      approval = { status: "not_approved", note: opts.note ?? `Thu hồi duyệt ${new Date().toISOString().slice(0, 10)}` };
    } else {
      if (!hash) throw new ValidationError(`${partLabel(part)}: chưa có file/nội dung, không duyệt được.`);
      if (opts.viewToken !== undefined && opts.viewToken !== viewTokenFor(part, hash, src))
        throw new ConflictError(`${partLabel(part)} hoặc nguồn của nó đã thay đổi sau khi bạn mở trang. Tải lại để xem bản mới rồi duyệt lại.`);
      approval = {
        status: "approved",
        approvedAt: new Date().toISOString().slice(0, 10),
        approvedBy: opts.by ?? "người dùng",
        sha256: hash,
        basis: basisFor(part, src),
        ...(opts.note ? { note: opts.note } : {}),
      };
    }
    const raw = JSON.parse(readFileSync(P.episodeJson, "utf8"));
    if (isSocial) raw.approvals.social[key] = approval;
    else raw.approvals[part] = { ...(part === "audio" ? { lineCacheKeys: raw.approvals.audio?.lineCacheKeys } : {}), ...approval };
    writeFileAtomic(P.episodeJson, JSON.stringify(raw, null, 2) + "\n");
    return { part, status: approval.status, hash: approval.sha256 ?? null };
  });

// ---------------------------------------------------------------------------
// Social editing

/** Fields the Studio may edit, per post (only fields the schema already has). */
export const EDITABLE_FIELDS = ["title", "body", "hashtags", "coverTimestampMs"] as const;

export const postToken = (post: unknown) => hashJson(post).slice(0, 32);

export type SocialPatch = { title?: string; body?: string; hashtags?: string[]; coverTimestampMs?: number };

export const updateSocialPost = (P: EpisodePaths, postKey: string, patch: SocialPatch, baseToken: string) =>
  withFileLockSync(P.episodeLock, "social-edit", P.id, () => {
    const social = readSocial(P);
    if (!social) throw new ValidationError("Chưa có social.json.");
    const [platform, name, extra] = postKey.split(".");
    const post = social.platforms[platform]?.[name] as Post | undefined;
    if (extra !== undefined || !post || typeof post !== "object") throw new ValidationError(`Không có bài "${postKey}".`);
    if (postToken(post) !== baseToken) throw new ConflictError("Bài này đã bị thay đổi ở nơi khác (CLI hoặc tab khác) sau khi bạn mở. Tải lại rồi sửa tiếp.");

    const next: Post = { ...post };
    for (const k of Object.keys(patch)) if (!(EDITABLE_FIELDS as readonly string[]).includes(k)) throw new ValidationError(`Không sửa được trường "${k}".`);
    const errors: string[] = [];
    const str = (v: unknown, field: string, max: number) => {
      if (typeof v !== "string") return errors.push(`${field} phải là chữ.`), undefined;
      const s = v.replace(/\r\n/g, "\n").normalize("NFC");
      if ([...s].length > max) errors.push(`${field} dài ${[...s].length} ký tự, tối đa ${max}.`);
      return s;
    };
    const lim = LIMITS[postKey];
    if (patch.title !== undefined) {
      if (post.title === undefined) errors.push("Bài này không có tiêu đề.");
      const t = str(patch.title, "Tiêu đề", lim?.title ?? 200);
      if (t !== undefined && !t.trim()) errors.push("Tiêu đề không được để trống.");
      if (t !== undefined && /\n/.test(t)) errors.push("Tiêu đề không được xuống dòng.");
      next.title = t;
    }
    if (patch.body !== undefined) {
      const b = str(patch.body, "Nội dung", lim?.text ?? 5000);
      if (b !== undefined && !b.trim()) errors.push("Nội dung không được để trống.");
      next.body = b;
    }
    if (patch.hashtags !== undefined) {
      if (!Array.isArray(patch.hashtags)) errors.push("Hashtag phải là danh sách.");
      else {
        const tags = patch.hashtags.map((h) => String(h).trim().normalize("NFC")).filter(Boolean);
        for (const h of tags) if (!/^#[\p{L}\p{N}_]+$/u.test(h)) errors.push(`Hashtag không hợp lệ: "${h}" (bắt đầu bằng #, không dấu cách).`);
        if (lim?.hashtagsMax && tags.length > lim.hashtagsMax) errors.push(`Tối đa ${lim.hashtagsMax} hashtag.`);
        next.hashtags = tags;
      }
    }
    if (patch.coverTimestampMs !== undefined) {
      if (post.coverTimestampMs === undefined) errors.push("Bài này không có khung bìa.");
      const ms = patch.coverTimestampMs;
      const maxMs = Math.floor((readManifest(P).duration.videoSec ?? 0) * 1000);
      if (!Number.isInteger(ms) || ms < 0 || (maxMs > 0 && ms > maxMs)) errors.push(`Khung bìa phải là số mili-giây từ 0 đến ${maxMs}.`);
      next.coverTimestampMs = ms;
    }
    if (errors.length) throw new ValidationError(errors.join(" "));

    const changed = postToken(next) !== baseToken;
    if (changed) {
      social.platforms[platform][name] = next;
      writeFileAtomic(P.social, JSON.stringify(social, null, 2) + "\n");
      writeFileAtomic(socialMdPath(P), buildSocialMd(P, social));
    }
    const findings = checkSocial(social).filter((f) => f.post === postKey);
    return { changed, token: postToken(next), findings };
  });

// ---------------------------------------------------------------------------
// Episode listing / detail (read-only, per-episode errors never break the list)

export const listEpisodeIds = () =>
  existsSync("episodes")
    ? readdirSync("episodes")
        .filter((d) => EPISODE_ID.test(d))
        .sort()
    : [];

export type EpisodeSummary = {
  id: string;
  ok: boolean;
  error?: string;
  title?: string;
  contentVersion?: number;
  durationSec?: number | null;
  durationInFrames?: number | null;
  hasVideo?: boolean;
  hasThumbnail?: boolean;
  updatedAt?: string;
  parts?: PartState[];
  problems?: string[];
  publishing?: Record<string, { state: string; label: string; jobs: { id: string; type: string; state: string; mode: string }[] }>;
};

const PUBLISH_PLATFORMS = ["facebook", "youtube", "tiktok"] as const;

export const episodeSummary = (id: string): EpisodeSummary => {
  try {
    const P = episodePaths(id);
    if (!existsSync(P.episodeJson)) return { id, ok: false, error: "Thiếu episode.json." };
    let m: Manifest;
    try {
      m = readManifest(P);
    } catch (e) {
      return { id, ok: false, error: `episode.json lỗi: ${(e as Error).message}` };
    }
    const parts = partStates(P, m);
    const problems: string[] = [];
    if (existsSync(P.social)) {
      try {
        readSocial(P);
      } catch (e) {
        problems.push(`social.json lỗi: ${(e as Error).message}`);
      }
    }
    for (const p of parts) if (p.production === "done" && p.status === "missing") problems.push(`${p.label}: đánh dấu đã làm nhưng không tìm thấy file.`);
    const jobs = existsSync(P.jobs) ? (JSON.parse(readFileSync(P.jobs, "utf8")).jobs as { id: string; platform: string; type: string; state: string; mode: string }[]) : [];
    const publishing = Object.fromEntries(
      PUBLISH_PLATFORMS.map((pl) => {
        const js = jobs.filter((j) => j.platform === pl).map((j) => ({ id: j.id, type: j.type, state: j.state, mode: j.mode }));
        const main = js.find((j) => j.type === "video") ?? js[0];
        return [pl, { state: main?.state ?? "none", label: main ? main.state : "không có job", jobs: js }];
      }),
    );
    return {
      id,
      ok: true,
      title: m.title,
      contentVersion: m.contentVersion,
      durationSec: existsSync(P.video) ? m.duration.videoSec : null,
      durationInFrames: existsSync(P.video) ? m.duration.durationInFrames : null,
      hasVideo: existsSync(P.video),
      hasThumbnail: existsSync(P.thumbnail9x16),
      updatedAt: statSync(P.episodeJson).mtime.toISOString(),
      parts,
      problems,
      publishing,
    };
  } catch (e) {
    return { id, ok: false, error: (e as Error).message };
  }
};

export const listEpisodes = () => listEpisodeIds().map(episodeSummary);

export const freshness = (P: EpisodePaths) => ({ captions: captionsFreshness(P), socialMd: socialMdFreshness(P) });

export const socialFindings = (P: EpisodePaths): SocialFinding[] => {
  const s = readSocial(P);
  return s ? checkSocial(s) : [];
};

/** Report files the Studio may show (fixed list, never arbitrary paths). */
export const REPORTS: Record<string, { file: (P: EpisodePaths) => string; label: string; kind: "md" | "json" }> = {
  "qa-report": { file: (P) => P.qaReport, label: "QC tập (âm thanh, video)", kind: "md" },
  "captions-qc": { file: (P) => P.captionsQc, label: "Kiểm tra phụ đề", kind: "md" },
  "publish-dry-run": { file: (P) => join(P.reportsDir, "publish-dry-run.json"), label: "Dry-run phát hành (lần chạy gần nhất)", kind: "json" },
  "script-md": { file: (P) => P.scriptMd, label: "Kịch bản (bản đọc)", kind: "md" },
  "social-md": { file: (P) => socialMdPath(P), label: "Social (bản đọc)", kind: "md" },
};
