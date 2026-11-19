import type { ThumbnailSpec } from "../thumbnails/EpisodeThumbnail";

// EP003 thumbnail + teaser layouts (data only). Same rig, pantry background and
// placement as scene S2 of the video (Trinh with her lunch, Kiên by the fridge,
// suspicious). Text shows the premise only — never the punchline
// (see episodes/EP003/social/social.json → spoilerGuard).

const Y = 500;
const S = 1.1;

const cast: ThumbnailSpec["cast"] = [
  { character: "trinh", x: 60, y: Y, scale: S, state: { pose: "standing", expression: "happy", lookX: 0.6, lookY: 0 } },
  { character: "kien", x: 560, y: Y, scale: S, state: { pose: "standing", expression: "suspicious", lookX: -0.85, lookY: 0 } },
];

/** 9:16 cover for YouTube Shorts / Facebook Reels / TikTok. Rendered at 2x (2160x3840). */
export const ep003Thumb9x16: ThumbnailSpec = {
  width: 1080,
  height: 1920,
  location: "pantry",
  camera: { zoom: 1.25, focusX: 560, focusY: 760 },
  cast,
  text: { headline: ["AI LẤY", "HỘP CƠM", "CỦA TÔI?"], kicker: "…còn để lại lời cảm ơn", top: 140, left: 60, width: 960, fontSize: 112 },
  freezeFrame: 40,
};

/** 1:1 teaser image (Facebook / TikTok photo post). */
export const ep003Teaser1x1: ThumbnailSpec = {
  width: 1080,
  height: 1080,
  location: "pantry",
  camera: { zoom: 1.0, focusX: 540, focusY: 860 },
  cast,
  text: { headline: ["HỘP CƠM BIẾN MẤT."], kicker: "Ai là thủ phạm?", top: 44, left: 44, width: 990, fontSize: 84 },
  freezeFrame: 40,
};
