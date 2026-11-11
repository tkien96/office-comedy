import type { SceneScript } from "./types";

// Demo (10 s): Kiên gets a message, reads it, goes from happy to stunned;
// Trinh looks over and reacts. Data only — rendered by ScriptedScene.

const KIEN_X = 40;
const TRINH_X = 540;
const ROW_Y = 420;
const SCALE = 1.25;
// Desk surface lines up with the rig's laptop base: ROW_Y + 690 * SCALE.
const DESK_TOP = ROW_Y + 690 * SCALE;

export const demoNotification: SceneScript = {
  id: "demo-notification",
  durationInFrames: 300,
  background: "office",
  deskTop: DESK_TOP,
  deskItems: [
    { kind: "papers", x: 470 },
    { kind: "mug", x: 1000, color: "#f97316" },
  ],
  cast: [
    {
      character: "kien",
      x: KIEN_X,
      y: ROW_Y,
      scale: SCALE,
      base: { pose: "computer", seated: true, laptop: true, lookY: 0.35 },
      keys: [
        { at: 38, pose: "phone", lookX: 0.25, lookY: 0.8 },
        { at: 64, expression: "happy" },
        { at: 128, expression: "neutral" },
        { at: 140, expression: "surprised", lookY: 0.4 },
        { at: 204, lookX: 1, lookY: 0 },
        { at: 262, expression: "embarrassed", lookX: 0.7, lookY: 0.25 },
      ],
    },
    {
      character: "trinh",
      x: TRINH_X,
      y: ROW_Y,
      scale: SCALE,
      base: { pose: "computer", seated: true, laptop: true, lookY: 0.35 },
      keys: [
        { at: 150, lookX: -1, lookY: 0 },
        { at: 162, expression: "suspicious" },
        { at: 192, expression: "surprised", lean: -5 },
        { at: 214, expression: "happy", talking: true, lean: -3 },
        { at: 288, talking: false },
      ],
    },
  ],
  camera: [
    { at: 0, zoom: 1, focusX: 540, focusY: 960 },
    { at: 132, zoom: 1, focusX: 540, focusY: 960 },
    { at: 144, zoom: 1.12, focusX: 290, focusY: 780 },
    { at: 196, zoom: 1.12, focusX: 290, focusY: 780 },
    { at: 214, zoom: 1, focusX: 540, focusY: 960 },
  ],
  overlays: [
    {
      kind: "deskPhone",
      from: 0,
      to: 38,
      x: 95,
      y: DESK_TOP,
      buzzFrom: 16,
      buzzTo: 38,
    },
    {
      kind: "notification",
      from: 46,
      to: 206,
      sender: "Sếp",
      parts: [
        { at: 50, text: "Chúc mừng em! Từ thứ Hai em làm Trưởng nhóm." },
        { at: 112, text: "\nKèm dự án Báo cáo năm, nộp sáng thứ Hai nhé." },
      ],
      charsPerFrame: 1.8,
      x: 70,
      y: 170,
      width: 940,
      tailX: 230,
      tailY: 610,
    },
    { kind: "shock", from: 140, to: 190, text: "HẢ?!", x: 540, y: 615 },
    { kind: "shake", from: 140, to: 158, amplitude: 14 },
  ],
  subtitles: [
    { from: 0, to: 44, text: "Chiều thứ Sáu. Kiên chỉ còn chờ giờ về." },
    { from: 50, to: 118, text: "Tin nhắn từ Sếp. Kiên mừng ra mặt." },
    { from: 122, to: 198, text: "…cho đến khi đọc tới dòng thứ hai." },
    {
      from: 214,
      to: 296,
      speaker: "trinh",
      text: "Chúc mừng nha! Dự án đó ba người trước đều xin nghỉ rồi.",
    },
  ],
};
