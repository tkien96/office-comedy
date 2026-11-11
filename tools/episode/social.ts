import { existsSync, readFileSync } from "node:fs";
import { hashJson, readSocial, socialPostKeys, type SocialDoc } from "./manifest.ts";
import type { EpisodePaths } from "./paths.ts";

// Social copy helpers. social.json is the source; social.md is a readable
// export for review, generated deterministically (no approval state inside,
// so it only changes when the copy changes).

export type Post = {
  kind?: string;
  postingMode?: "api" | "manual";
  optional?: boolean;
  supportedByApi?: boolean;
  title?: string;
  body?: string;
  hashtags?: string[];
  image?: string;
  coverImage?: string;
  thumbnail?: string;
  captionsFile?: string;
  coverTimestampMs?: number;
  note?: string;
  [k: string]: unknown;
};

/** Text exactly as it is pasted/sent: body, blank line, hashtags. */
export const pasteText = (p: Post) => [p.body ?? "", (p.hashtags ?? []).join(" ")].filter(Boolean).join("\n\n");

export const DATE_PROMISE =
  /(\b\d{1,2}[/.-]\d{1,2}\b|\b\d{1,2}\s?(h|giờ)\b|ngày\s+\d|thứ\s+(hai|ba|tư|năm|sáu|bảy)\s+(này|tới|sau)|chủ nhật (này|tới)|tối nay|ngày mai|tuần (sau|tới)|sắp (lên|ra|có)|lên sóng|ra mắt|công chiếu|premiere)/iu;

/** Limits from each platform's own help/docs (checked 2026-11-11). */
export const LIMITS: Record<string, { title?: number; text?: number; hashtagsMax?: number; note: string }> = {
  "youtube.video": { title: 100, text: 5000, hashtagsMax: 15, note: "Tiêu đề ≤ 100 ký tự (nên ≤ 60 để không bị cắt); mô tả ≤ 5000; > 15 hashtag thì YouTube bỏ qua toàn bộ." },
  "youtube.teaser": { text: 5000, note: "Bài cộng đồng, đăng tay." },
  "facebook.video": { text: 63206, note: "Mô tả Reel: không có giới hạn ngắn; dòng đầu hiển thị khoảng 125 ký tự trước “Xem thêm”." },
  "facebook.teaser": { text: 63206, note: "Bài ảnh trên Page." },
  "tiktok.video": { text: 2200, note: "Caption TikTok ≤ 2200 ký tự (gồm hashtag)." },
  "tiktok.teaser": { text: 2200, note: "Bài ảnh TikTok, đăng tay." },
};

export type SocialFinding = { level: "LỖI" | "CẢNH BÁO" | "GHI CHÚ"; post: string; msg: string };

export const checkSocial = (social: SocialDoc): SocialFinding[] => {
  const out: SocialFinding[] = [];
  const guard = ((social.spoilerGuard as { punchlineMustNotAppear?: string[] })?.punchlineMustNotAppear ?? []).map((s) => s.toLowerCase());
  for (const key of socialPostKeys(social)) {
    const [pl, name] = key.split(".");
    const p = social.platforms[pl][name] as Post;
    const text = [p.title ?? "", pasteText(p)].join("\n");
    const lim = LIMITS[key];
    const len = (s: string) => [...s].length;
    if (!p.body) out.push({ level: "LỖI", post: key, msg: "Chưa có nội dung." });
    for (const g of guard) if (text.toLowerCase().includes(g)) out.push({ level: "LỖI", post: key, msg: `Có cụm bị cấm vì lộ câu chốt: "${g}".` });
    if (DATE_PROMISE.test(text)) out.push({ level: "LỖI", post: key, msg: `Có vẻ hứa ngày/giờ phát hành: "${text.match(DATE_PROMISE)![0]}".` });
    if (lim?.title && p.title && len(p.title) > lim.title) out.push({ level: "LỖI", post: key, msg: `Tiêu đề ${len(p.title)} > ${lim.title} ký tự.` });
    if (p.title && len(p.title) > 60) out.push({ level: "CẢNH BÁO", post: key, msg: `Tiêu đề ${len(p.title)} ký tự, có thể bị cắt trên điện thoại.` });
    if (lim?.text && len(pasteText(p)) > lim.text) out.push({ level: "LỖI", post: key, msg: `Nội dung ${len(pasteText(p))} > ${lim.text} ký tự.` });
    if (lim?.hashtagsMax && (p.hashtags?.length ?? 0) > lim.hashtagsMax) out.push({ level: "LỖI", post: key, msg: `Quá ${lim.hashtagsMax} hashtag.` });
    for (const h of p.hashtags ?? []) if (!/^#[\p{L}\p{N}_]+$/u.test(h)) out.push({ level: "LỖI", post: key, msg: `Hashtag không hợp lệ: "${h}".` });
    if (text !== text.normalize("NFC")) out.push({ level: "LỖI", post: key, msg: "Chữ chưa chuẩn hoá Unicode NFC." });
  }
  return out;
};

const PLATFORM_LABEL: Record<string, string> = { youtube: "YouTube", facebook: "Facebook Page", tiktok: "TikTok" };
const POST_LABEL: Record<string, string> = { video: "Video", teaser: "Bài nhá hàng" };

/** Per-platform Markdown (also used for delivery/<platform>.md). */
export const platformMd = (social: SocialDoc, platform: string, opts: { mapPath?: (p: string) => string } = {}) => {
  const mp = opts.mapPath ?? ((p: string) => p);
  const posts = Object.entries(social.platforms[platform] ?? {}).filter(([, v]) => v && typeof v === "object" && !Array.isArray(v)) as [string, Post][];
  const parts = posts.map(([name, p]) => {
    const key = `${platform}.${name}`;
    const media = [p.thumbnail && `ảnh bìa \`${mp(p.thumbnail)}\``, p.coverImage && `ảnh bìa \`${mp(p.coverImage)}\``, p.image && `ảnh \`${mp(p.image)}\``, p.captionsFile && `phụ đề \`${mp(p.captionsFile)}\``]
      .filter(Boolean)
      .join(" · ");
    return [
      `### ${POST_LABEL[name] ?? name}${p.optional ? " (tùy chọn)" : ""} · \`${key}\``,
      "",
      `- Cách đăng: **${p.postingMode === "manual" ? "thủ công" : "API (sau khi tích hợp)"}**${p.kind ? ` · loại: ${p.kind}` : ""}`,
      media ? `- Media: ${media}` : null,
      p.coverTimestampMs !== undefined ? `- Khung bìa gợi ý: ${(p.coverTimestampMs / 1000).toFixed(1)} s` : null,
      p.note ? `- Ghi chú: ${p.note}` : null,
      LIMITS[key] ? `- Giới hạn: ${LIMITS[key].note}` : null,
      `- Hash nội dung: \`${hashJson(p).slice(0, 16)}\``,
      "",
      p.title ? `**Tiêu đề**\n\n\`\`\`text\n${p.title}\n\`\`\`\n` : null,
      `**${p.title ? "Mô tả" : "Nội dung"} (bản dán)**`,
      "",
      "```text",
      pasteText(p),
      "```",
      "",
    ]
      .filter((x) => x !== null)
      .join("\n");
  });
  return `## ${PLATFORM_LABEL[platform] ?? platform}\n\n${parts.join("\n")}`;
};

export const buildSocialMd = (P: EpisodePaths, social: SocialDoc) => {
  const g = social.spoilerGuard as { punchline?: string; keepSecret?: string[]; allowedPremise?: string; note?: string };
  return `# ${P.id}: nội dung social (bản đọc để duyệt)

Tạo từ \`social/social.json\` bằng \`npm run episode:social -- ${P.id}\`. Đừng sửa file này; sửa \`social.json\` rồi chạy lại lệnh.
Mỗi bài duyệt riêng, gắn với hash nội dung của bài đó: \`npm run episode:approve -- ${P.id} social.<nền tảng>.<bài>\` (ví dụ \`social.youtube.video\`). Trạng thái duyệt xem bằng \`npm run episode:status -- ${P.id}\`.

## Giữ bí mật

- Câu chốt (không đưa vào bài): ${g?.punchline ?? "—"}
- Không nhắc: ${(g?.keepSecret ?? []).join("; ")}.
- Được dùng: ${g?.allowedPremise ?? "—"}
- ${g?.note ?? ""}

${Object.keys(social.platforms).map((p) => platformMd(social, p)).join("\n")}`;
};

export const socialMdPath = (P: EpisodePaths) => `${P.socialDir}/social.md`;

export const socialMdFreshness = (P: EpisodePaths) => {
  const social = readSocial(P);
  const md = socialMdPath(P);
  if (!social) return "chưa có social.json";
  if (!existsSync(md)) return "chưa có";
  return readFileSync(md, "utf8").replace(/\r\n/g, "\n") === buildSocialMd(P, social) ? "khớp nguồn" : "LỆCH NGUỒN: chạy lại npm run episode:social";
};
