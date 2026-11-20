import type { EpisodeStaging } from "../episode/types";

// EP005 staging (data only). Script and timing come from
// episodes/EP005/script/script.json + script/timeline.json; this file only says
// where characters stand and which on-screen cards support the story.
// Same seated office row as EP001/EP002/EP004. S2: the wall clock runs fast
// (montage) and the minute counter stacks up on the window. S3: Sếp stands
// behind, between the two desks (drawn first, so the seated pair is in front).
// Existing card kinds only (no change to the shared renderer).

const ROW_Y = 420;
const SEATED = 1.25;
const DESK_TOP = ROW_Y + 690 * SEATED;

const kienSeat = { character: "kien" as const, x: 40, y: ROW_Y, scale: SEATED, seated: true, laptop: true };
const trinhSeat = { character: "trinh" as const, x: 540, y: ROW_Y, scale: SEATED, seated: true, laptop: true };

export const ep005Staging: EpisodeStaging = {
  episode: "EP005",
  scenes: [
    {
      scene: "S1",
      location: "office",
      deskTop: DESK_TOP,
      clockAt: { hour: 2, minute: 0 },
      cast: [kienSeat, trinhSeat],
      camera: [
        { atBeat: "n01", zoom: 1.12, focusX: 290, focusY: 760, rampFrames: 1 },
        { atBeat: "a01", zoom: 1, focusX: 540, focusY: 960, rampFrames: 12 },
      ],
      // a01: "Trinh trượt ghế sang bàn Kiên, ôm laptop, cười ngọt."
      cues: { a01: { expression: { trinh: "happy", kien: "neutral" }, lean: { trinh: -8 } } },
    },
    {
      scene: "S2",
      location: "office",
      deskTop: DESK_TOP,
      clock: { fromHour: 14, toHour: 17.2 }, // 2 giờ → hơn 5 giờ chiều trong cảnh
      cast: [kienSeat, trinhSeat],
      cards: [
        // Running task list: the title is the minute counter, the tasks pile up.
        { kind: "checklist", fromBeat: "k01", toBeat: "k02", title: "Phút 1", items: ["Đổi màu ô"] },
        { kind: "checklist", fromBeat: "n03", toBeat: "t05", title: "Phút 15", items: ["Đổi màu ô", "Căn lề"] },
        { kind: "checklist", fromBeat: "n04", toBeat: "a02", title: "Phút 40", items: ["Đổi màu ô", "Căn lề", "Biểu đồ cột + tròn", "Tiêu đề “sang”"] },
        { kind: "stamp", fromBeat: "n05", text: "Phút 90!", color: "#dc2626", x: 330, y: 330, fontSize: 96 },
      ],
      cues: {
        // a02: "Kiên gõ phím như vũ bão. Đồng hồ treo tường quay tít."
        a02: { expression: { kien: "annoyed", trinh: "happy" }, lean: { kien: 6 } },
      },
    },
    {
      scene: "S3",
      location: "office",
      deskTop: DESK_TOP,
      clockAt: { hour: 5, minute: 15 },
      cast: [{ character: "sep", x: 330, y: 360, scale: 1.05, seated: false, laptop: false }, kienSeat, trinhSeat],
      cards: [{ kind: "stamp", fromBeat: "s03", text: "+3 trang", color: "#dc2626", x: 230, y: 250, fontSize: 90 }],
      cues: {
        // a03: "Trinh kéo laptop về bàn mình. Sếp đi ngang, dừng lại nhìn màn hình của Trinh."
        a03: { expression: { sep: "neutral", trinh: "happy", kien: "neutral" }, lean: { kien: 0, trinh: 0 } },
        // a04: "Sếp đi khỏi. Trinh từ từ quay sang Kiên, cười tươi hơn bao giờ hết."
        a04: { expression: { sep: "happy", trinh: "happy", kien: "suspicious" } },
      },
    },
    {
      scene: "S4",
      location: "office",
      deskTop: DESK_TOP,
      clockAt: { hour: 5, minute: 30 },
      cast: [kienSeat, trinhSeat],
      camera: [{ atBeat: "n06", zoom: 1.12, focusX: 290, focusY: 760, rampFrames: 14 }],
      cards: [{ kind: "stamp", fromBeat: "t12", text: "3 trang × “1 phút”", color: "#dc2626", x: 340, y: 340, fontSize: 64 }],
      cues: {
        // a05: "Kiên gục xuống bàn phím. Đồng hồ treo tường chỉ năm rưỡi chiều."
        a05: { expression: { kien: "embarrassed", trinh: "happy" }, lean: { kien: 8 } },
      },
    },
  ],
};
