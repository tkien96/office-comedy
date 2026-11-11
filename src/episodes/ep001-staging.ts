import type { EpisodeStaging } from "../episode/types";

// EP001 staging (data only). Script and timing come from the approved
// episodes/EP001/script/script.json + script/timeline.json; this file only says where
// characters stand and which on-screen cards support the story.
// Layout rules: faces above the subtitle band, cards in the top half.

const ROW_Y = 420; // seated office row (same as the demo scene)
const SEATED = 1.25;
const DESK_TOP = ROW_Y + 690 * SEATED;

export const ep001Staging: EpisodeStaging = {
  episode: "EP001",
  scenes: [
    {
      scene: "S1",
      location: "office",
      deskTop: DESK_TOP,
      clockAt: { hour: 4, minute: 50 },
      cast: [
        { character: "kien", x: 40, y: ROW_Y, scale: SEATED, seated: true, laptop: true },
        { character: "trinh", x: 540, y: ROW_Y, scale: SEATED, seated: true, laptop: true },
      ],
      camera: [
        { atBeat: "n01", zoom: 1.12, focusX: 290, focusY: 760, rampFrames: 1 },
        { atBeat: "a01", zoom: 1, focusX: 540, focusY: 960, rampFrames: 14 },
      ],
      cards: [{ kind: "progress", fromBeat: "n01", toBeat: "n02", title: "Báo cáo tuần", doneLabel: "Xong trong 4 giây" }],
      // a01: "Kiên ngả ghế, cười mãn nguyện. Trinh ở bàn bên liếc sang."
      cues: { a01: { expression: { kien: "happy", trinh: "suspicious" }, lean: { kien: 4 } } },
    },
    {
      scene: "S2",
      location: "office",
      deskTop: DESK_TOP,
      clockAt: { hour: 4, minute: 52 },
      cast: [
        { character: "kien", x: 40, y: ROW_Y, scale: SEATED, seated: true, laptop: true },
        { character: "trinh", x: 540, y: ROW_Y, scale: SEATED, seated: true, laptop: true },
      ],
      cards: [{ kind: "progress", fromBeat: "k01", toBeat: "a02", title: "Công cụ báo cáo tự động", doneLabel: "Bấm một cái: xong" }],
      cues: {
        // a02: "Trinh ghé sát màn hình, mắt sáng lên."
        a02: { expression: { trinh: "surprised" }, lean: { trinh: -6 } },
        // a03: "Sếp xuất hiện sau lưng Kiên. Trinh quay về bàn mình."
        a03: { expression: { kien: "neutral", trinh: "neutral" }, lean: { trinh: 0 } },
      },
    },
    {
      scene: "S3",
      location: "office",
      deskTop: DESK_TOP,
      clockAt: { hour: 4, minute: 55 },
      cast: [
        { character: "kien", x: 40, y: ROW_Y, scale: SEATED, seated: true, laptop: true },
        { character: "sep", x: 560, y: 450, scale: SEATED, seated: false, laptop: false },
      ],
      // Kiên stays at his laptop; the "standing" hint is not used here.
      ignorePoses: [{ character: "kien", pose: "standing" }],
      camera: [
        { atBeat: "a04", zoom: 1.14, focusX: 290, focusY: 760, rampFrames: 8 },
        { atBeat: "k05a", zoom: 1, focusX: 540, focusY: 960, rampFrames: 12 },
        { atBeat: "a05", zoom: 1.1, focusX: 290, focusY: 760, rampFrames: 10 },
      ],
      cards: [
        {
          kind: "checklist",
          fromBeat: "s03",
          toBeat: "k05",
          title: "Báo cáo về công cụ",
          items: ["Tiết kiệm bao nhiêu", "Ở khâu nào", "Số liệu cụ thể"],
        },
      ],
      cues: {
        // a04: "Kiên khựng lại, mắt chớp hai cái."
        a04: { expression: { kien: "surprised" } },
        // a05: "Kiên đứng chết lặng nhìn theo."
        a05: { expression: { kien: "surprised", sep: "neutral" } },
      },
    },
    {
      scene: "S4",
      location: "office",
      deskTop: DESK_TOP,
      clock: { fromHour: 9, toHour: 9 + 24 + 14.8 }, // thứ Bảy 9:00 → Chủ nhật ~23:48
      mugs: { xs: [770, 830, 890, 950], color: "#3b82f6" },
      cast: [{ character: "kien", x: 290, y: ROW_Y, scale: SEATED, seated: true, laptop: true }],
      cards: [
        { kind: "stamp", fromBeat: "n03", text: "Thứ Bảy → Chủ nhật", color: "#f59e0b", x: 540, y: 290, fontSize: 70 },
        { kind: "progress", fromBeat: "a06", title: "Gửi báo cáo cho sếp", doneLabel: "Đã gửi lúc 23:52" },
      ],
      // a06: "Kiên bấm gửi báo cáo lúc gần nửa đêm Chủ nhật, gục xuống bàn."
      cues: { a06: { expression: { kien: "embarrassed" }, lean: { kien: 8 } } },
    },
    {
      scene: "S5",
      location: "meeting",
      deskTop: null,
      cast: [
        { character: "sep", x: -10, y: 560, scale: 0.95, seated: false, laptop: false },
        { character: "kien", x: 345, y: 560, scale: 0.95, seated: false, laptop: false },
        { character: "trinh", x: 700, y: 560, scale: 0.95, seated: false, laptop: false },
      ],
      camera: [
        { atBeat: "a07", zoom: 1.15, focusX: 535, focusY: 800, rampFrames: 10 },
      ],
      // a07: "Kiên quay sang Trinh, mặt chết lặng. Trinh giơ ngón cái, cười tươi."
      cues: { a07: { expression: { kien: "surprised", trinh: "happy" } } },
    },
    {
      scene: "S6",
      location: "pantry",
      deskTop: null,
      cast: [
        { character: "trinh", x: 60, y: 500, scale: 1.1, seated: false, laptop: false, exit: { atBeat: "a08", toX: -520, frames: 18 } },
        { character: "kien", x: 560, y: 500, scale: 1.1, seated: false, laptop: false },
      ],
      camera: [
        { atBeat: "a08", zoom: 1.05, focusX: 780, focusY: 800, rampFrames: 14 },
        { atBeat: "n04", zoom: 1.22, focusX: 780, focusY: 760, rampFrames: 16 },
      ],
      cards: [
        {
          kind: "calendar",
          fromBeat: "t04",
          toBeat: "k06",
          title: "Lịch họp tuần này",
          items: ["T2 09:00 Phòng Kinh doanh", "T2 14:00 Phòng Kế toán", "T3 09:00 Phòng Nhân sự", "T3 15:00 Phòng IT", "T4 10:00 Phòng Marketing", "T5 09:00 Ban Giám đốc", "T6 16:00 Họp tổng kết"],
        },
        { kind: "stamp", fromBeat: "n04", text: "+3 giờ", color: "#16a34a", x: 290, y: 250 },
        { kind: "stamp", fromBeat: "n05", text: "−7 giờ", color: "#dc2626", x: 290, y: 380 },
      ],
      // a08: "Kiên nhìn theo, cầm cốc cà phê nguội."
      cues: { a08: { expression: { kien: "annoyed" } } },
    },
  ],
};
