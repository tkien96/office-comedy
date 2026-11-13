import { existsSync, readFileSync } from "node:fs";
import { connectionsView } from "../../tools/publish/connections.ts";

// Read-only, browser-safe view of the project configuration.
// Never sends secrets: environment variables are reported as present/absent by
// NAME only, voice references by short hash (no local file paths).

const readJson = (p: string) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null);

type Role = { displayName: string; direction: string; approved?: { voiceId: string; type: string; ref: string; model?: string; settings?: Record<string, unknown>; approvedAt?: string } };

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

  // Status comes from the shared connections service (same as dry-run and CLI). No network call here.
  const integrations = connectionsView().targets.map((t) => ({
    key: t.key,
    platform: t.platform,
    label: t.label,
    source: t.source,
    status: t.status,
    identity: t.identity,
    lastCheckedAt: t.lastCheck?.at ?? null,
    plan: PLAN[t.platform] ?? "",
    capabilities: pub?.capabilities?.[t.platform] ?? {},
  }));

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
      "Tạo giọng (TTS) và render video từ giao diện (dùng lệnh npm hiện có)",
      "Upload, đặt lịch và đăng thật",
    ],
  };
};
