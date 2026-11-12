import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { AiError, sleep, type AiErrorKind, type AiProvider, type AiRequest, type AiResult } from "./provider.ts";

// TEST-ONLY provider. Enabled only with STUDIO_TEST=1 AND STUDIO_AI_MOCK=<scenario.json>.
// Everything it writes is marked "[MOCK]" so it can never pass for a real draft.
//
// scenario.json: { "steps": [ { "purpose"?: "draft", "delayMs"?: 3000,
//                   "error"?: "rate_limit"|"timeout_unknown"|"network"|"auth"|…,
//                   "json"?: <exact output> , "mutate"?: "bad-shape"|"lint-error" } ] }
// Each call removes the first matching step from the file (a test can queue steps
// while the server runs); with no step left, a valid output is generated.

type Step = { purpose?: AiRequest["purpose"]; delayMs?: number; error?: AiErrorKind; json?: unknown; mutate?: "bad-shape" | "lint-error" };

const USAGE = (purpose: string) => ({ model: "claude-opus-5-5", inputTokens: 1200 + purpose.length, outputTokens: 900, cacheReadTokens: 0, cacheWriteTokens: 0 });

const SAMPLE_DRAFT = (title: string) => ({
  title: `[MOCK] ${title}`,
  logline: "[MOCK] Kiên đặt lịch họp tự động, nhưng công cụ đặt luôn cả lịch nghỉ trưa của sếp.",
  premise: "Kiên muốn tiết kiệm thời gian đặt lịch họp nên nhờ công cụ tự động.",
  punchline: "Công cụ đặt lịch hiệu quả tới mức xếp luôn Kiên vào buổi họp đánh giá công cụ.",
  scenes: [
    { id: "S1", title: "Mở đầu", location: "office", speakers: ["narrator"], note: "Câu móc." },
    { id: "S2", title: "Khoe công cụ", location: "office", speakers: ["trinh", "kien"], note: "" },
    { id: "S3", title: "Sếp hỏi", location: "office", speakers: ["sep", "kien"], note: "" },
    { id: "S4", title: "Câu chốt", location: "pantry", speakers: ["trinh", "kien"], note: "" },
  ],
  beats: [
    ["n01", "S1", "line", "narrator", "Tôi viết công cụ tự đặt lịch họp cho cả phòng."],
    ["n02", "S1", "line", "narrator", "Tôi nghĩ mình vừa cứu cả công ty."],
    ["a01", "S1", "action", null, "Kiên bấm nút, lịch họp hiện kín màn hình.", 1.2],
    ["t01", "S2", "line", "trinh", "Anh làm gì mà cười hoài vậy?"],
    ["k01", "S2", "line", "kien", "Công cụ đặt lịch họp tự động nè em."],
    ["t02", "S2", "line", "trinh", "Thiệt hả? Đặt giùm em buổi họp chiều nay nha."],
    ["k02", "S2", "line", "kien", "Xong rồi đó, ba giây thôi."],
    ["a02", "S2", "action", null, "Trinh giơ ngón cái, quay về bàn.", 1],
    ["s01", "S3", "line", "sep", "Kiên này, lịch nghỉ trưa của anh sao thành họp thế?"],
    ["k03", "S3", "line", "kien", "Dạ, chắc công cụ thấy giờ đó còn trống, sếp."],
    ["s02", "S3", "line", "sep", "Thế em đặt cho anh một buổi họp đánh giá công cụ nhé."],
    ["k04", "S3", "line", "kien", "Dạ, em đặt liền ạ."],
    ["a03", "S3", "action", null, "Kiên bấm nút, màn hình báo đã đặt lịch.", 1.4],
    ["t03", "S4", "line", "trinh", "Anh ơi, công cụ vừa mời anh vào họp đánh giá đó."],
    ["k05", "S4", "line", "kien", "Ai cho nó mời anh vậy?"],
    ["t04", "S4", "line", "trinh", "Anh cài cho nó tự mời người phụ trách mà."],
    ["n03", "S4", "line", "narrator", "Công cụ tiết kiệm thời gian đặt lịch cho tôi."],
    ["n04", "S4", "line", "narrator", "Rồi đặt tôi vào lịch luôn."],
    ["a04", "S4", "action", null, "Kiên nhìn thẳng ống kính, cốc cà phê nguội.", 1],
  ].map(([id, scene, kind, role, text, sec]) => ({
    id,
    scene,
    kind,
    role: kind === "line" ? role : null,
    text: kind === "line" ? text : null,
    desc: kind === "action" ? text : null,
    sec: kind === "action" ? sec : null,
    sameTurn: false,
    visual: "",
    expressions: [],
    poses: [],
  })),
});

const IDEAS = {
  ideas: [1, 2, 3].map((n) => ({
    title: `[MOCK] Ý tưởng ${n}`,
    premise: `[MOCK] Tiền đề ${n}: Kiên thử một mẹo tiết kiệm thời gian.`,
    conflict: `[MOCK] Mâu thuẫn ${n}: sếp muốn số liệu chứng minh.`,
    punchlineDirection: `[MOCK] Hướng chốt ${n}: mẹo tạo thêm việc.`,
    characters: ["kien", "trinh", "sep"],
    setting: "office",
  })),
};

export class MockProvider implements AiProvider {
  readonly name = "mock" as const;
  private file: string;
  constructor(file: string) {
    this.file = file;
  }

  /** Takes the first matching step out of the scenario file (so a test can queue steps while the server runs). */
  private nextStep(purpose: AiRequest["purpose"]): Step | null {
    if (!existsSync(this.file)) return null;
    const doc = JSON.parse(readFileSync(this.file, "utf8")) as { steps?: Step[] };
    const steps = doc.steps ?? [];
    const i = steps.findIndex((s) => !s.purpose || s.purpose === purpose);
    if (i < 0) return null;
    const [step] = steps.splice(i, 1);
    writeFileSync(this.file, JSON.stringify({ ...doc, steps }, null, 2));
    return step;
  }

  async generate(req: AiRequest): Promise<AiResult> {
    const step = this.nextStep(req.purpose);
    if (step?.delayMs) await sleep(step.delayMs, req.signal);
    if (req.signal.aborted) throw new AiError("cancelled", "Đã huỷ.", { mayHaveBeenProcessed: true });
    if (step?.error) {
      const may = step.error === "timeout_unknown" || step.error === "network";
      throw new AiError(step.error, `[MOCK] Lỗi giả lập: ${step.error}`, { mayHaveBeenProcessed: may });
    }
    let json: unknown = step?.json;
    if (json === undefined) {
      if (req.purpose === "ideas") json = IDEAS;
      else if (req.purpose === "draft") json = SAMPLE_DRAFT((/"title":\s*"([^"]*)"/.exec(req.user)?.[1] ?? "Bản nháp").slice(0, 60));
      else {
        // revise / repair: echo the current script from the prompt with one marked change per scope.
        const m = /<kich_ban_hien_tai>\s*([\s\S]*?)\s*<\/kich_ban_hien_tai>/.exec(req.user);
        const cur = m ? JSON.parse(m[1]) : SAMPLE_DRAFT("Bản nháp");
        const scope = /<canh_can_sua>([^<]*)<\/canh_can_sua>/.exec(req.user)?.[1].split(",").map((s) => s.trim()).filter(Boolean) ?? [];
        const line = cur.beats.find((b: { kind: string; scene: string }) => b.kind === "line" && (!scope.length || scope.includes(b.scene)));
        if (line) line.text = `${String(line.text).replace(/\s*\[MOCK sửa\]$/, "")} [MOCK sửa]`.slice(0, 58);
        json = cur;
      }
    }
    if (step?.mutate === "bad-shape") json = { title: "[MOCK] thiếu cảnh" };
    if (step?.mutate === "lint-error") {
      const d = JSON.parse(JSON.stringify(json));
      const sepLine = d.beats.find((b: { role: string }) => b.role === "sep");
      if (sepLine) sepLine.text = "Tôi muốn em làm giùm nha.";
      json = d;
    }
    return { json, usage: USAGE(req.purpose), model: "claude-opus-5-5", fallbackUsed: false, rateLimitRetries: 0 };
  }
}
