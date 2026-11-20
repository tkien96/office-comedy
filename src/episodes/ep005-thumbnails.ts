import type { ThumbnailSpec } from "../thumbnails/EpisodeThumbnail";

// EP005 thumbnail + teaser layouts (data only). Same rig, office background and
// seated row as scene S2 of the video (Trinh smiling sweetly, Kiên already
// tired). Text shows the premise only — never the punchline
// (see episodes/EP005/social/social.json → spoilerGuard).

const ROW_Y = 420;
const SEATED = 1.25;
const DESK_TOP = ROW_Y + 690 * SEATED;

const cast: ThumbnailSpec["cast"] = [
  { character: "kien", x: 40, y: ROW_Y, scale: SEATED, state: { pose: "computer", seated: true, laptop: true, expression: "annoyed", lookX: 0.6, lookY: 0 } },
  { character: "trinh", x: 540, y: ROW_Y, scale: SEATED, state: { pose: "computer", seated: true, laptop: true, expression: "happy", lookX: -0.85, lookY: 0, lean: -6 } },
];

/** 9:16 cover for YouTube Shorts / Facebook Reels / TikTok. Rendered at 2x (2160x3840). */
export const ep005Thumb9x16: ThumbnailSpec = {
  width: 1080,
  height: 1920,
  location: "office",
  clock: { hour: 5, minute: 0 },
  camera: { zoom: 1.3, focusX: 540, focusY: 700 },
  deskTop: DESK_TOP,
  cast,
  text: { headline: ["“MỘT PHÚT", "THÔI MÀ", "ANH…”"], kicker: "…bắt đầu lúc 2 giờ chiều", top: 140, left: 60, width: 960, fontSize: 108 },
  freezeFrame: 40,
};

/** 1:1 teaser image (Facebook / TikTok photo post). */
export const ep005Teaser1x1: ThumbnailSpec = {
  width: 1080,
  height: 1080,
  location: "office",
  clock: { hour: 5, minute: 0 },
  camera: { zoom: 1.15, focusX: 540, focusY: 780 },
  deskTop: DESK_TOP,
  cast,
  text: { headline: ["“MỘT PHÚT THÔI.”"], kicker: "Phút thứ mấy rồi?", top: 44, left: 44, width: 990, fontSize: 84 },
  freezeFrame: 40,
};
