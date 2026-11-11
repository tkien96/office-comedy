import { existsSync, readFileSync } from "node:fs";

// Read-only, browser-safe view of the project configuration.
// Never sends secrets: environment variables are reported as present/absent by
// NAME only, voice references by short hash (no local file paths).

const readJson = (p: string) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null);

type Role = { displayName: string; direction: string; approved?: { voiceId: string; type: string; ref: string; model?: string; settings?: Record<string, unknown>; approvedAt?: string } };
type Target = { platform: string; label: string; credentialEnv: string[]; [k: string]: unknown };

const ID_FIELD: Record<string, string> = { youtube: "channelId", facebook: "pageId", tiktok: "username" };
/** Platform adapters that actually exist in code. None yet: only dry-run. */
const IMPLEMENTED: Record<string, boolean> = { youtube: false, facebook: false, tiktok: false };
const PLAN: Record<string, string> = {
  youtube: "Có kế hoạch: docs/youtube-integration-plan.md (OAuth trên máy, upload resumable, đối chiếu sau timeout).",
  facebook: "Tích hợp sau YouTube (Reels hẹn giờ qua Graph API).",
  tiktok: "Đăng thủ công trong app TikTok (API không hẹn giờ; công cụ tự đăng cho tài khoản của mình không qua được audit).",
};

export const configView = () => {
  const casting = readJson("config/casting.json") as { roles: Record<string, Role>; addressing?: Record<string, string> } | null;
  const refs = readJson("config/voice-refs.json") as { refs: Record<string, { usable?: boolean; rights?: { confirmed?: boolean } }> } | null;
  const pub = readJson("config/publishing.json") as {
    timezone: string;
    utcOffset: string;
    missedGraceMinutes: number;
    maxAttempts: number;
    targets: Record<string, Target>;
    capabilities: Record<string, Record<string, { api: boolean; schedule?: boolean; note?: string }>>;
  } | null;

  const voices = Object.entries(casting?.roles ?? {}).map(([id, r]) => ({
    id,
    displayName: r.displayName,
    direction: r.direction,
    voice: r.approved
      ? {
          voiceId: r.approved.voiceId.replace(/^(ref:[0-9a-f]{8})[0-9a-f]+$/, "$1…"),
          type: r.approved.type,
          ref: r.approved.ref,
          model: r.approved.model ?? null,
          approvedAt: r.approved.approvedAt ?? null,
          settings: r.approved.settings ?? {},
          rightsConfirmed: refs?.refs?.[r.approved.ref]?.rights?.confirmed === true,
          usable: refs?.refs?.[r.approved.ref]?.usable === true,
        }
      : null,
  }));

  const integrations = Object.entries(pub?.targets ?? {}).map(([key, t]) => {
    const idField = ID_FIELD[t.platform];
    const hasId = Boolean(t[idField]);
    const envPresent = t.credentialEnv.map((n) => ({ name: n, present: Boolean(process.env[n]) }));
    const implemented = IMPLEMENTED[t.platform] ?? false;
    const manual = t.platform === "tiktok";
    let state: "manual" | "not_implemented" | "not_configured" | "configured_unverified" | "verified";
    if (manual) state = "manual";
    else if (!implemented) state = "not_implemented";
    else if (!hasId || envPresent.some((e) => !e.present)) state = "not_configured";
    else state = "configured_unverified"; // "verified" only after a real connection check exists
    return {
      key,
      platform: t.platform,
      label: t.label,
      state,
      idField,
      hasId,
      envPresent,
      configComplete: hasId && envPresent.every((e) => e.present),
      plan: PLAN[t.platform] ?? "",
      capabilities: pub?.capabilities?.[t.platform] ?? {},
    };
  });

  return {
    production: {
      video: "1080x1920 (9:16), 30 fps, H.264 yuv420p bt709 + AAC (remotion.config.ts)",
      duration: "Tối thiểu 60 s, mục tiêu 60–90 s; số khung = ceil(contentEndSec × fps) lấy từ timeline.json",
      tts: "VieNeu-TTS 3.8.4, v3 Turbo, ONNX CPU fp32, chạy cục bộ (tools/tts)",
      render: "Remotion 4.0.542, concurrency 2–3",
      style: "Hoạt hình 2D, rig SVG phẳng dùng chung (src/characters)",
    },
    voices,
    addressing: casting?.addressing ?? {},
    folders: [
      { path: "episodes/EPxxx/", note: "Dữ liệu từng tập: episode.json (metadata, duyệt), script/, social/, publishing/, reports/" },
      { path: "episodes/EPxxx/exports/", note: "Video cuối (không đưa vào Git) và phụ đề SRT" },
      { path: "episodes/EPxxx/thumbnails/", note: "Thumbnail 9:16, ảnh nhá hàng 1:1 (không đưa vào Git)" },
      { path: "episodes/EPxxx/delivery/", note: "Bộ đăng thủ công, tạo lại bằng lệnh (không đưa vào Git)" },
      { path: "runtime/studio/", note: "Dữ liệu vận hành của Studio: lịch sử công việc nền (không đưa vào Git)" },
      { path: "cache/", note: "Model TTS, cache giọng, giọng tham chiếu (không đưa vào Git)" },
    ],
    publishing: pub ? { timezone: pub.timezone, utcOffset: pub.utcOffset, missedGraceMinutes: pub.missedGraceMinutes, maxAttempts: pub.maxAttempts } : null,
    integrations,
    notImplemented: [
      "Tạo ý tưởng và kịch bản bằng Claude",
      "Tạo giọng (TTS) và render video từ giao diện (dùng lệnh npm hiện có)",
      "Đăng nhập OAuth với nền tảng",
      "Upload, đặt lịch và đăng thật",
    ],
  };
};
