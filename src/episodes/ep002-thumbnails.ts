import type { ThumbnailSpec } from "../thumbnails/EpisodeThumbnail";

// EP002 thumbnail + teaser layouts (data only). Same rig, background and
// placement as scenes S1–S2 of the video (Kiên and Trinh at their laptops,
// right after the "Trả lời tất cả"). Text shows the premise only — never the
// punchline (see episodes/EP002/social/social.json → spoilerGuard).

const ROW_Y = 420;
const SEATED = 1.25;
const DESK_TOP = ROW_Y + 690 * SEATED;

const kien = { character: "kien" as const, x: 40, y: ROW_Y, scale: SEATED };
const trinh = { character: "trinh" as const, x: 540, y: ROW_Y, scale: SEATED };

/** 9:16 cover for YouTube Shorts / Facebook Reels / TikTok. Rendered at 2x (2160x3840). */
export const ep002Thumb9x16: ThumbnailSpec = {
  width: 1080,
  height: 1920,
  location: "office",
  clock: { hour: 11, minute: 5 },
  camera: { zoom: 1.3, focusX: 540, focusY: 770 },
  deskTop: DESK_TOP,
  cast: [
    { ...kien, state: { pose: "computer", seated: true, laptop: true, expression: "surprised", lookX: -0.2, lookY: 0.3 } },
    { ...trinh, state: { pose: "phone", seated: true, laptop: true, expression: "surprised", lookX: -0.85, lookY: 0 } },
  ],
  text: { headline: ["LỠ BẤM", "TRẢ LỜI TẤT CẢ"], kicker: "…có cả sếp", top: 170, left: 60, width: 960, fontSize: 112 },
  freezeFrame: 40,
};

/** 1:1 teaser image (Facebook / TikTok photo post). */
export const ep002Teaser1x1: ThumbnailSpec = {
  width: 1080,
  height: 1080,
  location: "office",
  clock: { hour: 11, minute: 5 },
  camera: { zoom: 1.15, focusX: 540, focusY: 820 },
  deskTop: DESK_TOP,
  cast: [
    { ...kien, state: { pose: "computer", seated: true, laptop: true, expression: "surprised", lookX: -0.2, lookY: 0.3 } },
    { ...trinh, state: { pose: "phone", seated: true, laptop: true, expression: "surprised", lookX: -0.85, lookY: 0 } },
  ],
  text: { headline: ["GỬI NHẦM CẢ PHÒNG."], kicker: "Có cả sếp.", top: 44, left: 44, width: 990, fontSize: 84 },
  freezeFrame: 40,
};
