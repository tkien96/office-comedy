import { existsSync, readFileSync } from "node:fs";

// Read-only, browser-safe view of the project configuration.
// Voice references are shown by short hash only (no local file paths).

const readJson = (p: string) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null);

type Role = { displayName: string; direction: string; approved?: { voiceId: string; type: string; ref: string; model?: string; settings?: Record<string, unknown>; approvedAt?: string } };

export const configView = () => {
  const casting = readJson("config/casting.json") as { roles: Record<string, Role>; addressing?: Record<string, string> } | null;
  const refs = readJson("config/voice-refs.json") as { refs: Record<string, { usable?: boolean; rights?: { confirmed?: boolean } }> } | null;

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

  return {
    production: {
      video: "1080x1920 (9:16), 30 fps, H.264 yuv420p bt709 + AAC (remotion.config.ts)",
      duration: "Tối thiểu 60 s, mục tiêu 60–90 s; số khung = ceil(contentEndSec × fps) lấy từ timeline.json",
      tts: "VieNeu-TTS 3.8.4, v3 Turbo, ONNX CPU fp32, chạy cục bộ (tools/tts)",
      render: "Remotion 4.0.542, concurrency 2–3",
      style: "Hoạt hình 2D, rig SVG phẳng dùng chung (src/characters)",
      social: "Đăng thủ công bằng bộ delivery của từng tập (không có tích hợp đăng bài)",
    },
    voices,
    addressing: casting?.addressing ?? {},
    folders: [
      { path: "episodes/EPxxx/", note: "Dữ liệu từng tập: episode.json (metadata), script/, social/, reports/" },
      { path: "episodes/EPxxx/exports/", note: "Video cuối (không đưa vào Git) và phụ đề SRT" },
      { path: "episodes/EPxxx/thumbnails/", note: "Thumbnail 9:16, ảnh nhá hàng 1:1 (không đưa vào Git)" },
      { path: "episodes/EPxxx/delivery/", note: "Bộ đăng thủ công, tạo lại bằng lệnh (không đưa vào Git)" },
      { path: "runtime/studio/", note: "Dữ liệu vận hành của Studio: lịch sử công việc nền (không đưa vào Git)" },
      { path: "cache/", note: "Model TTS, cache giọng, giọng tham chiếu (không đưa vào Git)" },
    ],
    notImplemented: ["Tạo giọng (TTS) và render video từ giao diện (dùng lệnh npm hiện có)"],
  };
};
