import type { PlaylistCoverSpec } from "../thumbnails/PlaylistCover";

// Office Comedy playlist / series cover (data only), 16:9.
// Scene panel: the office row from the episodes (Kiên and Trinh at their
// laptops, Sếp standing between them behind the desks), same rig and placement
// scale as the episode staging. Text: series name only, no episode spoilers.
// Icons: original flat SVG drawings (src/thumbnails/PlaylistCover.tsx).

const ROW_Y = 420;
const SEATED = 1.25;
const DESK_TOP = ROW_Y + 690 * SEATED;

export const playlistCover16x9: PlaylistCoverSpec = {
  width: 1920,
  height: 1080,
  title: ["OFFICE", "COMEDY"],
  kicker: "Hài công sở",
  titleTop: 300,
  icons: [
    { kind: "laugh", x: 560, y: 70, size: 170, rotate: 12 },
    { kind: "haha", x: 70, y: 70, size: 190, rotate: -8 },
    { kind: "sparkle", x: 330, y: 130, size: 80, rotate: 0 },
    { kind: "mail", x: 530, y: 780, size: 180, rotate: 10 },
    { kind: "coffee", x: 80, y: 820, size: 170, rotate: -10 },
    { kind: "clock", x: 330, y: 860, size: 130, rotate: 6 },
    { kind: "star", x: 690, y: 640, size: 90, rotate: -14 },
    { kind: "sparkle", x: 700, y: 260, size: 64, rotate: 0 },
  ],
  scene: {
    width: 1080,
    height: 1080,
    location: "office",
    clock: { hour: 9, minute: 0 },
    camera: { zoom: 1.0, focusX: 540, focusY: 880 },
    deskTop: DESK_TOP,
    cast: [
      // Sếp first so the seated pair is drawn in front of him.
      { character: "sep", x: 330, y: 330, scale: 1.05, state: { pose: "standing", expression: "suspicious", lookX: 0, lookY: 0.2 } },
      { character: "kien", x: 40, y: ROW_Y, scale: SEATED, state: { pose: "computer", seated: true, laptop: true, expression: "happy", lookX: 0.4, lookY: 0 } },
      { character: "trinh", x: 540, y: ROW_Y, scale: SEATED, state: { pose: "computer", seated: true, laptop: true, expression: "happy", lookX: -0.4, lookY: 0 } },
    ],
    text: { headline: [], top: 0, left: 0, width: 0, fontSize: 10 },
    freezeFrame: 40,
  },
};

/** 1:1 square version: title + icons on top, the same office scene as a framed card below. */
export const playlistCover1x1: PlaylistCoverSpec = {
  width: 1080,
  height: 1080,
  title: ["OFFICE", "COMEDY"],
  kicker: "Hài công sở",
  titleTop: 48,
  titleLeft: 56,
  titleSize: 100,
  icons: [
    { kind: "laugh", x: 800, y: 40, size: 170, rotate: 12 },
    { kind: "haha", x: 620, y: 205, size: 170, rotate: -8 },
    { kind: "sparkle", x: 640, y: 60, size: 70 },
    { kind: "star", x: 900, y: 250, size: 90, rotate: -14 },
    { kind: "mail", x: 470, y: 330, size: 130, rotate: 10 },
    { kind: "sparkle", x: 990, y: 380, size: 54 },
  ],
  sceneBox: { x: 80, y: 470 },
  scene: {
    width: 900,
    height: 550,
    location: "office",
    clock: { hour: 9, minute: 0 },
    camera: { zoom: 0.833, focusX: 540, focusY: 715 },
    deskTop: DESK_TOP,
    cast: [
      { character: "sep", x: 330, y: 330, scale: 1.05, state: { pose: "standing", expression: "suspicious", lookX: 0, lookY: 0.2 } },
      { character: "kien", x: 40, y: ROW_Y, scale: SEATED, state: { pose: "computer", seated: true, laptop: true, expression: "happy", lookX: 0.4, lookY: 0 } },
      { character: "trinh", x: 540, y: ROW_Y, scale: SEATED, state: { pose: "computer", seated: true, laptop: true, expression: "happy", lookX: -0.4, lookY: 0 } },
    ],
    text: { headline: [], top: 0, left: 0, width: 0, fontSize: 10 },
    freezeFrame: 40,
  },
};
