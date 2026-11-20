import type { EpisodeStaging } from "../episode/types";

// EP004 staging (data only). Script and timing come from
// episodes/EP004/script/script.json + script/timeline.json; this file only says
// where characters stand and which on-screen cards support the story.
// Kiên and Trinh join the online meeting from their desks (same seated row as
// EP001/EP002); Sếp runs it from the meeting room, where Kiên is only a voice.
// Existing card kinds only (no change to the shared renderer).
// Faces above the subtitle band, cards in the top half.

const ROW_Y = 420;
const SEATED = 1.25;
const DESK_TOP = ROW_Y + 690 * SEATED;

const kienSeat = { character: "kien" as const, x: 40, y: ROW_Y, scale: SEATED, seated: true, laptop: true };
const trinhSeat = { character: "trinh" as const, x: 540, y: ROW_Y, scale: SEATED, seated: true, laptop: true };

export const ep004Staging: EpisodeStaging = {
  episode: "EP004",
  scenes: [
    {
      scene: "S1",
      location: "office",
      deskTop: DESK_TOP,
      clockAt: { hour: 9, minute: 2 },
      cast: [kienSeat, trinhSeat],
      camera: [
        { atBeat: "n01", zoom: 1.12, focusX: 290, focusY: 760, rampFrames: 1 },
        { atBeat: "a01", zoom: 1, focusX: 540, focusY: 960, rampFrames: 12 },
      ],
      cards: [{ kind: "checklist", fromBeat: "a01", title: "Họp phòng · 9:00", items: ["12 người tham dự", "Micro của Kiên: đã tắt?"] }],
      // a01: "Kiên ngả ghế, Trinh ở bàn bên đeo tai nghe."
      cues: { a01: { expression: { kien: "happy", trinh: "neutral" }, lean: { kien: 4 } } },
    },
    {
      scene: "S2",
      location: "office",
      deskTop: DESK_TOP,
      clockAt: { hour: 9, minute: 20 },
      cast: [kienSeat, trinhSeat],
      cards: [
        { kind: "checklist", fromBeat: "a03", toBeat: "k03b", title: "Tin nhắn từ Trinh", items: ["Anh ơi", "Anh ơi!!", "MICRO"] },
        { kind: "stamp", fromBeat: "k04", text: "La la la…", color: "#7c3aed", x: 300, y: 250, fontSize: 80 },
        { kind: "stamp", fromBeat: "n03", text: "12 người đang nghe", color: "#dc2626", x: 420, y: 450, fontSize: 66 },
      ],
      cues: {
        // a02: "Kiên xé gói bánh, nhai rôm rốp. Trinh quay phắt sang nhìn."
        a02: { expression: { kien: "happy", trinh: "surprised" }, lean: { kien: 0, trinh: -6 } },
        // a03: "Trinh gõ điện thoại lia lịa."
        a03: { expression: { kien: "happy", trinh: "annoyed" }, lean: { trinh: 0 } },
      },
    },
    {
      scene: "S3",
      location: "meeting",
      deskTop: null,
      // Kiên is only a voice on the call here (not in frame).
      cast: [{ character: "sep", x: 300, y: 520, scale: 1.05, seated: false, laptop: false }],
      camera: [
        { atBeat: "s03", zoom: 1.12, focusX: 510, focusY: 820, rampFrames: 12 },
        { atBeat: "a05", zoom: 1, focusX: 540, focusY: 960, rampFrames: 12 },
      ],
      cards: [
        { kind: "checklist", fromBeat: "s05", toBeat: "s06", title: "Biên bản họp", items: ["1. Doanh số tháng", "2. Kế hoạch quý", "3. Kiên: “tan ca rồi về…”"] },
      ],
      cues: {
        // a04: "Sếp đứng trước màn hình chiếu, hắng giọng, nhìn vào camera."
        a04: { expression: { sep: "neutral" } },
        // a05: "Sếp bấm kết thúc cuộc họp, nhấp ngụm trà, khẽ cười."
        a05: { expression: { sep: "happy" } },
      },
    },
    {
      scene: "S4",
      location: "office",
      deskTop: DESK_TOP,
      clockAt: { hour: 10, minute: 0 },
      cast: [kienSeat, trinhSeat],
      camera: [{ atBeat: "n04", zoom: 1.12, focusX: 290, focusY: 760, rampFrames: 14 }],
      cards: [
        { kind: "progress", fromBeat: "a06", toBeat: "a06", title: "Micro của Kiên", doneLabel: "ĐANG BẬT (từ 9:00)" },
        { kind: "checklist", fromBeat: "a07", toBeat: "a07", title: "Chat cuộc họp", items: ["Kiên hát hay quá", "Xin link bài hát", "Bánh gì vậy anh?"] },
        { kind: "stamp", fromBeat: "t07", text: "Gửi: cả công ty", color: "#dc2626", x: 380, y: 370, fontSize: 76 },
      ],
      cues: {
        // a06: "Kiên nhìn laptop: biểu tượng micro vẫn sáng. Kiên chết lặng."
        a06: { expression: { kien: "surprised", trinh: "annoyed" } },
        // a07: "Kiên úp mặt xuống bàn."
        a07: { expression: { kien: "embarrassed", trinh: "happy" }, lean: { kien: 8 } },
      },
    },
  ],
};
