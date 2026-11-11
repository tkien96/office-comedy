import type { ThumbnailSpec } from "../thumbnails/EpisodeThumbnail";

// EP001 thumbnail + teaser layouts (data only). Same rig, background and
// placement scale as scene S3 of the approved video (Kiên at his laptop, Sếp
// arriving behind him). Text shows the premise only — never the punchline
// (see episodes/EP001/social/social.json → spoilerGuard).

const ROW_Y = 420;
const SEATED = 1.25;
const DESK_TOP = ROW_Y + 690 * SEATED;

const kien = { character: "kien" as const, x: 40, y: ROW_Y, scale: SEATED };
const sep = { character: "sep" as const, x: 560, y: 450, scale: SEATED };

/** 9:16 cover for YouTube Shorts / Facebook Reels / TikTok. Rendered at 2x (2160x3840). */
export const ep001Thumb9x16: ThumbnailSpec = {
  width: 1080,
  height: 1920,
  location: "office",
  clock: { hour: 4, minute: 55 },
  camera: { zoom: 1.35, focusX: 560, focusY: 770 },
  deskTop: DESK_TOP,
  cast: [
    { ...kien, state: { pose: "computer", seated: true, laptop: true, expression: "happy", lookX: -0.2, lookY: 0.3 } },
    { ...sep, state: { pose: "standing", expression: "suspicious", lookX: -0.85, lookY: 0.35 } },
  ],
  text: { headline: ["TIẾT KIỆM", "3 TIẾNG/TUẦN"], kicker: "…rồi sếp biết", top: 170, left: 60, width: 960, fontSize: 112 },
  freezeFrame: 40,
};

/** 1:1 teaser image (Facebook / TikTok photo post). */
export const ep001Teaser1x1: ThumbnailSpec = {
  width: 1080,
  height: 1080,
  location: "office",
  clock: { hour: 4, minute: 55 },
  camera: { zoom: 1.18, focusX: 560, focusY: 820 },
  deskTop: DESK_TOP,
  cast: [
    { ...kien, state: { pose: "computer", seated: true, laptop: true, expression: "happy", lookX: -0.2, lookY: 0.3 } },
    { ...sep, state: { pose: "standing", expression: "suspicious", lookX: -0.85, lookY: 0.35 } },
  ],
  text: { headline: ["BA TIẾNG MỖI TUẦN."], kicker: "Đổi lại cái gì?", top: 44, left: 44, width: 990, fontSize: 84 },
  freezeFrame: 40,
};
