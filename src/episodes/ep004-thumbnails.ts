import type { ThumbnailSpec } from "../thumbnails/EpisodeThumbnail";

// EP004 thumbnail + teaser layouts (data only). Same rig, office background and
// seated row as scene S2 of the video (Kiên happily humming at his laptop,
// Trinh horrified). Text shows the premise only — never the punchline
// (see episodes/EP004/social/social.json → spoilerGuard).

const ROW_Y = 420;
const SEATED = 1.25;
const DESK_TOP = ROW_Y + 690 * SEATED;

const cast: ThumbnailSpec["cast"] = [
  { character: "kien", x: 40, y: ROW_Y, scale: SEATED, state: { pose: "computer", seated: true, laptop: true, expression: "happy", lookX: -0.2, lookY: 0.3 } },
  { character: "trinh", x: 540, y: ROW_Y, scale: SEATED, state: { pose: "computer", seated: true, laptop: true, expression: "surprised", lookX: -0.85, lookY: 0 } },
];

/** 9:16 cover for YouTube Shorts / Facebook Reels / TikTok. Rendered at 2x (2160x3840). */
export const ep004Thumb9x16: ThumbnailSpec = {
  width: 1080,
  height: 1920,
  location: "office",
  clock: { hour: 9, minute: 20 },
  camera: { zoom: 1.3, focusX: 540, focusY: 700 },
  deskTop: DESK_TOP,
  cast,
  text: { headline: ["MICRO", "ĐÃ TẮT…", "CHƯA?"], kicker: "…họp online 12 người", top: 140, left: 60, width: 960, fontSize: 112 },
  freezeFrame: 40,
};

/** 1:1 teaser image (Facebook / TikTok photo post). */
export const ep004Teaser1x1: ThumbnailSpec = {
  width: 1080,
  height: 1080,
  location: "office",
  clock: { hour: 9, minute: 20 },
  camera: { zoom: 1.15, focusX: 540, focusY: 780 },
  deskTop: DESK_TOP,
  cast,
  text: { headline: ["HỌP ONLINE."], kicker: "Micro tắt chưa nhỉ?", top: 44, left: 44, width: 990, fontSize: 84 },
  freezeFrame: 40,
};
