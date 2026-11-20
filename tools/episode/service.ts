// Episode services shared by the CLI (tools/episode/cli/*) and Office Comedy
// Studio (studio/server). Source of truth stays in the episode folder:
//   episode.json   metadata, versions, checks
//   social.json    social copy (one object per post), posted by hand
// Nothing here talks to Claude, TTS, Remotion or any platform.
// (Per-part approvals and publishing integrations were removed on 2026-11-16.)
import { existsSync, readdirSync, statSync } from "node:fs";
import { captionsFreshness } from "./captions.ts";
import { withFileLockSync, writeFileAtomic } from "./fsutil.ts";
import { currentHashes, hashJson, readManifest, readSocial, type Manifest } from "./manifest.ts";
import { EPISODE_ID, episodePaths, type EpisodePaths } from "./paths.ts";
import { buildSocialMd, checkSocial, LIMITS, socialMdFreshness, socialMdPath, type Post, type SocialFinding } from "./social.ts";

export const PARTS = ["script", "audio", "video", "captions", "thumbnail9x16", "teaser1x1", "social"] as const;
export type Part = (typeof PARTS)[number];

export const PART_LABEL: Record<Part, string> = {
  script: "Kịch bản",
  audio: "Âm thanh",
  video: "Video",
  captions: "Phụ đề (SRT)",
  thumbnail9x16: "Thumbnail 9:16",
  teaser1x1: "Ảnh nhá hàng 1:1",
  social: "Nội dung social",
};

/** A product of the episode: does its file/content exist right now? */
export type PartState = { part: Part; label: string; exists: boolean; hash: string | null };

export const partStates = (P: EpisodePaths): PartState[] => {
  const cur = currentHashes(P);
  const socialHash = existsSync(P.social) && Object.keys(cur.social).length ? hashJson(cur.social) : null;
  const hashes: Record<Part, string | null> = { ...cur, social: socialHash };
  return PARTS.map((part) => ({ part, label: PART_LABEL[part], exists: hashes[part] !== null, hash: hashes[part] }));
};

export class ConflictError extends Error {}
export class ValidationError extends Error {}

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
};

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
    const parts = partStates(P);
    const problems: string[] = [];
    if (existsSync(P.social)) {
      try {
        readSocial(P);
      } catch (e) {
        problems.push(`social.json lỗi: ${(e as Error).message}`);
      }
    }
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
  "script-md": { file: (P) => P.scriptMd, label: "Kịch bản (bản đọc)", kind: "md" },
  "social-md": { file: (P) => socialMdPath(P), label: "Social (bản đọc)", kind: "md" },
};
