import type { EpisodeStaging } from "../episode/types";

// EP002 staging (data only). Script and timing come from the approved
// episodes/EP002/script/script.json + script/timeline.json; this file only says
// where characters stand and which on-screen cards support the story.
// Uses the existing card kinds only (no change to the shared renderer, so
// EP001's approvals stay valid). Faces above the subtitle band, cards in the top half.

const ROW_Y = 420; // seated office row (same as EP001)
const SEATED = 1.25;
const DESK_TOP = ROW_Y + 690 * SEATED;

const kienSeat = { character: "kien" as const, x: 40, y: ROW_Y, scale: SEATED, seated: true, laptop: true };
const trinhSeat = { character: "trinh" as const, x: 540, y: ROW_Y, scale: SEATED, seated: true, laptop: true };

export const ep002Staging: EpisodeStaging = {
  episode: "EP002",
  scenes: [
    {
      scene: "S1",
      location: "office",
      deskTop: DESK_TOP,
      clockAt: { hour: 11, minute: 5 },
      cast: [kienSeat, trinhSeat],
      camera: [
        { atBeat: "n01", zoom: 1.12, focusX: 290, focusY: 760, rampFrames: 1 },
        { atBeat: "a01", zoom: 1, focusX: 540, focusY: 960, rampFrames: 12 },
      ],
      cards: [
        { kind: "checklist", fromBeat: "n03", toBeat: "n04", title: "Sếp: Lịch họp tuần", items: ["Thứ Hai 8:00 – 11:00", "Cả phòng tham dự"] },
        { kind: "progress", fromBeat: "a01", title: "Trả lời tất cả: “Họp gì mà dài như phim bộ”", doneLabel: "Đã gửi tới cả phòng (12 người)" },
      ],
      // a01: "Thẻ thông báo… Kiên đứng hình. Trinh ở bàn bên giật mình nhìn điện thoại."
      cues: { a01: { expression: { kien: "surprised", trinh: "surprised" } } },
    },
    {
      scene: "S2",
      location: "office",
      deskTop: DESK_TOP,
      clockAt: { hour: 11, minute: 6 },
      cast: [kienSeat, trinhSeat],
      cards: [
        { kind: "stamp", fromBeat: "k03", text: "Thu hồi: 11/12", color: "#16a34a", x: 540, y: 220, fontSize: 80 },
        { kind: "stamp", fromBeat: "k04", text: "Sếp: ĐÃ ĐỌC", color: "#dc2626", x: 540, y: 410, fontSize: 80 },
      ],
      cues: {
        // a02: "Kiên bấm loạn trên laptop. Trinh nín thở nhìn màn hình."
        a02: { expression: { kien: "surprised", trinh: "surprised" }, lean: { trinh: -6 } },
        // a03: "Trinh ôm đầu. Kiên gục xuống bàn phím."
        a03: { expression: { kien: "embarrassed", trinh: "annoyed" }, lean: { kien: 8, trinh: 0 } },
      },
    },
    {
      scene: "S3",
      location: "office",
      deskTop: DESK_TOP,
      clockAt: { hour: 11, minute: 8 },
      cast: [kienSeat, trinhSeat],
      camera: [
        { atBeat: "n05", zoom: 1.12, focusX: 290, focusY: 760, rampFrames: 12 },
      ],
      cards: [
        { kind: "progress", fromBeat: "a04", toBeat: "t05", title: "Thư 2: “Ý em là phim bộ tối qua dài quá ạ”", doneLabel: "Đã gửi tới cả phòng" },
        { kind: "progress", fromBeat: "a05", title: "Thư 3: “Họp với sếp thì dài mấy cũng vui ạ”", doneLabel: "Đã gửi tới cả phòng" },
        {
          kind: "checklist",
          fromBeat: "n05",
          toBeat: "n06",
          title: "Đã gửi cho cả phòng (5 phút)",
          items: ["Họp gì mà dài như phim bộ", "Ý em là phim bộ tối qua…", "Họp với sếp dài mấy cũng vui ạ"],
        },
      ],
      cues: {
        // a04: "Thẻ thư thứ hai… Kiên gật gù hài lòng."
        a04: { expression: { kien: "happy", trinh: "neutral" }, lean: { kien: 0 } },
        // a05: "Đã muộn. Thẻ thư thứ ba… Trinh che mặt."
        a05: { expression: { kien: "happy", trinh: "embarrassed" }, lean: { trinh: 6 } },
      },
    },
    {
      scene: "S4",
      location: "office",
      deskTop: DESK_TOP,
      clockAt: { hour: 11, minute: 15 },
      // Trinh is back at her own desk (off-frame); Sếp stands by Kiên's desk.
      cast: [kienSeat, { character: "sep", x: 560, y: 450, scale: SEATED, seated: false, laptop: false }],
      // Kiên stays at his laptop; the "standing" hint is not used here (same as EP001 S3).
      ignorePoses: [{ character: "kien", pose: "standing" }],
      camera: [
        { atBeat: "s07", zoom: 1.12, focusX: 290, focusY: 760, rampFrames: 10 },
      ],
      cards: [
        { kind: "stamp", fromBeat: "s03", toBeat: "k08", text: "Họp: 15 phút", color: "#16a34a", x: 540, y: 220, fontSize: 80 },
        { kind: "stamp", fromBeat: "s07", text: "3 TIẾNG", color: "#dc2626", x: 540, y: 420, fontSize: 96 },
      ],
      cues: {
        // a06: "Sếp đi tới bàn Kiên, tay cầm tách trà."
        a06: { expression: { kien: "embarrassed", sep: "neutral" } },
        // a07: "Kiên thở phào, cười toe."
        a07: { expression: { kien: "happy", sep: "neutral" }, lean: { kien: 4 } },
        // a08: "Sếp quay đi. Kiên đứng chết lặng."
        a08: { expression: { kien: "surprised", sep: "happy" }, lean: { kien: 0 } },
      },
    },
    {
      scene: "S5",
      location: "pantry",
      deskTop: null,
      cast: [
        { character: "trinh", x: 60, y: 500, scale: 1.1, seated: false, laptop: false, exit: { atBeat: "a09", toX: -520, frames: 18 } },
        { character: "kien", x: 560, y: 500, scale: 1.1, seated: false, laptop: false },
      ],
      camera: [
        { atBeat: "a09", zoom: 1.05, focusX: 780, focusY: 800, rampFrames: 14 },
        { atBeat: "n07", zoom: 1.22, focusX: 780, focusY: 760, rampFrames: 16 },
      ],
      cards: [
        { kind: "progress", fromBeat: "a09", toBeat: "a09", title: "Sếp → cả phòng: Từ tuần sau họp 15 phút", doneLabel: "Cảm ơn góp ý của Kiên" },
        { kind: "stamp", fromBeat: "n07", text: "Người hùng", color: "#16a34a", x: 290, y: 220 },
        { kind: "stamp", fromBeat: "n08", text: "Họp 3 tiếng", color: "#dc2626", x: 290, y: 410 },
      ],
      // a09: "Kiên nhìn theo, tay cầm cốc cà phê. Điện thoại rung: thư Sếp gửi cả phòng…"
      cues: { a09: { expression: { kien: "annoyed" } } },
    },
  ],
};
