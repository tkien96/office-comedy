import type { EpisodeStaging } from "../episode/types";

// EP003 staging (data only). Script and timing come from
// episodes/EP003/script/script.json + script/timeline.json; this file only says
// where characters stand and which on-screen cards support the story.
// Everything happens in the pantry, Kiên next to the fridge (right side of the
// background). Existing card kinds only (no change to the shared renderer).
// Faces above the subtitle band, cards in the top half.

const Y = 500;
const S = 1.1;
const kien = { character: "kien" as const, x: 560, y: Y, scale: S, seated: false, laptop: false };

export const ep003Staging: EpisodeStaging = {
  episode: "EP003",
  scenes: [
    {
      scene: "S1",
      location: "pantry",
      deskTop: null,
      cast: [{ ...kien, x: 480 }],
      camera: [
        { atBeat: "n01", zoom: 1.15, focusX: 700, focusY: 820, rampFrames: 1 },
        { atBeat: "a01", zoom: 1, focusX: 540, focusY: 960, rampFrames: 14 },
      ],
      cards: [{ kind: "stamp", fromBeat: "n02", text: "“Cảm ơn, ngon lắm!”", color: "#f59e0b", x: 450, y: 320, fontSize: 62 }],
      // a01: "Kiên cầm tờ giấy, nheo mắt nhìn quanh pantry như thám tử."
      cues: { a01: { expression: { kien: "suspicious" }, lean: { kien: 5 } } },
    },
    {
      scene: "S2",
      location: "pantry",
      deskTop: null,
      cast: [{ character: "trinh", x: 60, y: Y, scale: S, seated: false, laptop: false }, kien],
      cards: [
        { kind: "checklist", fromBeat: "t02", toBeat: "k03", title: "So sánh hộp cơm", items: ["Hộp Trinh: màu hồng, có tên", "Hộp Kiên: màu xanh, không tên"] },
        { kind: "stamp", fromBeat: "n03", text: "Nghi phạm số 2: ???", color: "#dc2626", x: 450, y: 320, fontSize: 70 },
      ],
      cues: {
        // a02: "Trinh bước vào, tay cầm hộp cơm đang ăn dở, vừa đi vừa nhai."
        a02: { expression: { trinh: "happy", kien: "suspicious" } },
        // a03: "Trinh nhún vai, cầm hộp cơm đi ra. Kiên nuốt nước bọt."
        a03: { expression: { trinh: "neutral", kien: "embarrassed" }, lean: { kien: 0 } },
      },
    },
    {
      scene: "S3",
      location: "pantry",
      deskTop: null,
      cast: [{ character: "sep", x: 40, y: 470, scale: S, seated: false, laptop: false }, kien],
      camera: [
        { atBeat: "a05", zoom: 1.08, focusX: 540, focusY: 820, rampFrames: 10 },
        { atBeat: "s03", zoom: 1, focusX: 540, focusY: 960, rampFrames: 12 },
        { atBeat: "a06", zoom: 1.18, focusX: 780, focusY: 780, rampFrames: 12 },
      ],
      cards: [
        { kind: "checklist", fromBeat: "s05", toBeat: "s07", title: "Quy định tủ lạnh (mới)", items: ["Dán tên", "Ghi ngày", "Người phụ trách: ……"] },
        { kind: "stamp", fromBeat: "k07", text: "Phụ trách: KIÊN", color: "#dc2626", x: 440, y: 320, fontSize: 72 },
      ],
      cues: {
        // a04: "Sếp bước vào pantry, cầm tách trà. Kiên vội giấu tờ giấy ra sau lưng."
        a04: { expression: { kien: "embarrassed", sep: "neutral" } },
        // a05: "Kiên chậm rãi giơ tay lên. Sếp nhìn Kiên, rồi nhìn tách trà."
        a05: { expression: { kien: "embarrassed", sep: "surprised" } },
        // a06: "Sếp đi ra. Kiên đứng chết lặng cạnh tủ lạnh."
        a06: { expression: { kien: "surprised", sep: "happy" } },
      },
    },
    {
      scene: "S4",
      location: "pantry",
      deskTop: null,
      cast: [{ character: "trinh", x: 60, y: Y, scale: S, seated: false, laptop: false, exit: { atBeat: "a08", toX: -520, frames: 18 } }, kien],
      camera: [
        { atBeat: "a08", zoom: 1.05, focusX: 780, focusY: 800, rampFrames: 14 },
        { atBeat: "n04", zoom: 1.2, focusX: 780, focusY: 760, rampFrames: 16 },
      ],
      cards: [
        { kind: "checklist", fromBeat: "t05", toBeat: "t06", title: "Nhãn tủ lạnh", items: ["Trinh – hộp 1", "Trinh – hộp 2", "???"] },
        { kind: "stamp", fromBeat: "n04", text: "−1 hộp cơm", color: "#dc2626", x: 300, y: 230 },
        { kind: "stamp", fromBeat: "n05", text: "+1 tủ lạnh", color: "#16a34a", x: 300, y: 400 },
      ],
      cues: {
        // a07: "Sáng hôm sau. Kiên đứng cạnh tủ lạnh, ôm xấp nhãn tên và cây bút."
        a07: { expression: { kien: "annoyed", trinh: "happy" } },
        // a08: "Kiên nhìn hộp cơm, mỉm cười, rồi cẩn thận viết tên mình lên nhãn thật to."
        a08: { expression: { kien: "happy" } },
      },
    },
  ],
};
