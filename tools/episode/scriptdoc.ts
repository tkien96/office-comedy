// Script documents: the AI output schema, conversion to the existing
// script.json format (same shape as EP001, so render/TTS tools keep working),
// server-side validation and a beat-level diff. No I/O here.
import { lintScript, type LintResult } from "../tts/scriptlint.ts";

export const ROLES = ["narrator", "kien", "trinh", "sep"] as const;
export const CHARACTERS = ["kien", "trinh", "sep"] as const;
export const LOCATIONS = ["office", "meeting", "pantry"] as const;
export const EXPRESSIONS = ["neutral", "happy", "suspicious", "surprised", "annoyed", "embarrassed"] as const;
export const POSES = ["standing", "computer", "phone", "pointing"] as const;
export const DEFAULT_TIMING = { turnGapSec: 0.22, sameTurnGapSec: 0.2, leadInSec: 0.25 };

export type Role = (typeof ROLES)[number];
export type Character = (typeof CHARACTERS)[number];

/** script.json as stored (compatible with EP001; extra fields are kept). */
export type ScriptBeat = {
  id: string;
  scene: string;
  kind: "line" | "action";
  role?: string;
  text?: string;
  desc?: string;
  sec?: number;
  sameTurn?: boolean;
  gapBeforeSec?: number;
  visual?: string;
  expression?: Record<string, string>;
  pose?: Record<string, string>;
  [k: string]: unknown;
};
export type ScriptScene = { id: string; title: string; location: string; speakers: string[]; note?: string; [k: string]: unknown };
export type ScriptDoc = {
  id: string;
  title: string;
  logline: string;
  creative?: { premise?: string; punchline?: string };
  fps: number;
  timing: { turnGapSec: number; sameTurnGapSec: number; leadInSec: number };
  scenes: ScriptScene[];
  beats: ScriptBeat[];
  duration: { minSec: number; targetRangeSec: [number, number] };
  [k: string]: unknown;
};

// ---- AI output schema (structured outputs: every object closed, every field required) ----

const nullable = (s: Record<string, unknown>) => ({ anyOf: [s, { type: "null" }] });

export const DRAFT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "logline", "premise", "punchline", "scenes", "beats"],
  properties: {
    title: { type: "string", description: "Tiêu đề tập, ngắn, tiếng Việt" },
    logline: { type: "string", description: "Tóm tắt 1–2 câu" },
    premise: { type: "string", description: "Tiền đề và mâu thuẫn" },
    punchline: { type: "string", description: "Câu chốt / cú twist cuối, gắn với tiền đề" },
    scenes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "title", "location", "speakers", "note"],
        properties: {
          id: { type: "string", description: "S1, S2, …" },
          title: { type: "string" },
          location: { type: "string", enum: [...LOCATIONS] },
          speakers: { type: "array", items: { type: "string", enum: [...ROLES] } },
          note: { type: "string" },
        },
      },
    },
    beats: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "scene", "kind", "role", "text", "desc", "sec", "sameTurn", "visual", "expressions", "poses"],
        properties: {
          id: { type: "string", description: "ID ổn định: chữ cái đầu của vai + số (n01, k01, t01, s01), hành động a01" },
          scene: { type: "string" },
          kind: { type: "string", enum: ["line", "action"] },
          role: nullable({ type: "string", enum: [...ROLES] }),
          text: nullable({ type: "string" }),
          desc: nullable({ type: "string" }),
          sec: nullable({ type: "number" }),
          sameTurn: { type: "boolean" },
          visual: { type: "string" },
          expressions: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["character", "expression"],
              properties: { character: { type: "string", enum: [...CHARACTERS] }, expression: { type: "string", enum: [...EXPRESSIONS] } },
            },
          },
          poses: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["character", "pose"],
              properties: { character: { type: "string", enum: [...CHARACTERS] }, pose: { type: "string", enum: [...POSES] } },
            },
          },
        },
      },
    },
  },
} as const;

export type DraftOutput = {
  title: string;
  logline: string;
  premise: string;
  punchline: string;
  scenes: { id: string; title: string; location: string; speakers: string[]; note: string }[];
  beats: {
    id: string;
    scene: string;
    kind: "line" | "action";
    role: string | null;
    text: string | null;
    desc: string | null;
    sec: number | null;
    sameTurn: boolean;
    visual: string;
    expressions: { character: string; expression: string }[];
    poses: { character: string; pose: string }[];
  }[];
};

export const IDEAS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["ideas"],
  properties: {
    ideas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "premise", "conflict", "punchlineDirection", "characters", "setting"],
        properties: {
          title: { type: "string" },
          premise: { type: "string" },
          conflict: { type: "string" },
          punchlineDirection: { type: "string" },
          characters: { type: "array", items: { type: "string", enum: [...CHARACTERS] } },
          setting: { type: "string", enum: [...LOCATIONS] },
        },
      },
    },
  },
} as const;

export type Idea = { title: string; premise: string; conflict: string; punchlineDirection: string; characters: string[]; setting: string };

const str = (v: unknown) => (typeof v === "string" ? v.replace(/\r\n/g, "\n").normalize("NFC").trim() : "");

/** Basic shape check of model output before conversion (structured outputs should already guarantee it). */
export const checkDraftShape = (v: unknown): string[] => {
  const e: string[] = [];
  const o = v as DraftOutput;
  if (!o || typeof o !== "object") return ["Kết quả không phải object JSON."];
  for (const k of ["title", "logline", "premise", "punchline"] as const) if (typeof o[k] !== "string") e.push(`Thiếu "${k}".`);
  if (!Array.isArray(o.scenes) || !o.scenes.length) e.push("Thiếu danh sách cảnh.");
  if (!Array.isArray(o.beats) || !o.beats.length) e.push("Thiếu danh sách lượt thoại/hành động.");
  return e;
};

export const checkIdeas = (v: unknown): { ideas: Idea[]; errors: string[] } => {
  const o = v as { ideas?: Idea[] };
  const ideas = Array.isArray(o?.ideas) ? o.ideas : [];
  const errors: string[] = [];
  if (ideas.length !== 3) errors.push(`Cần đúng 3 ý tưởng, nhận ${ideas.length}.`);
  ideas.forEach((i, n) => {
    for (const k of ["title", "premise", "conflict", "punchlineDirection"] as const) if (!str(i?.[k])) errors.push(`Ý tưởng ${n + 1} thiếu "${k}".`);
  });
  return { ideas: ideas.map((i) => ({ ...i, title: str(i.title), premise: str(i.premise), conflict: str(i.conflict), punchlineDirection: str(i.punchlineDirection) })), errors };
};

/** Model output → script.json (same field names as EP001). Scene speakers are recomputed from the beats. */
export const draftToScript = (d: DraftOutput, base: { id: string; duration: ScriptDoc["duration"]; timing?: ScriptDoc["timing"] }): ScriptDoc => {
  const beats: ScriptBeat[] = d.beats.map((b) => {
    const out: ScriptBeat = { id: str(b.id), scene: str(b.scene), kind: b.kind };
    if (b.kind === "line") {
      out.role = b.role ?? undefined;
      out.text = str(b.text);
      if (b.sameTurn) out.sameTurn = true;
    } else {
      out.desc = str(b.desc);
      out.sec = typeof b.sec === "number" ? Math.round(b.sec * 10) / 10 : undefined;
    }
    if (str(b.visual)) out.visual = str(b.visual);
    if (b.expressions?.length) out.expression = Object.fromEntries(b.expressions.map((x) => [x.character, x.expression]));
    if (b.poses?.length) out.pose = Object.fromEntries(b.poses.map((x) => [x.character, x.pose]));
    return out;
  });
  const scenes: ScriptScene[] = d.scenes.map((s) => ({
    id: str(s.id),
    title: str(s.title),
    location: s.location,
    speakers: speakersOf(beats, str(s.id), s.speakers),
    ...(str(s.note) ? { note: str(s.note) } : {}),
  }));
  return {
    id: base.id,
    title: str(d.title),
    logline: str(d.logline),
    creative: { premise: str(d.premise), punchline: str(d.punchline) },
    fps: 30,
    timing: base.timing ?? DEFAULT_TIMING,
    scenes,
    beats,
    duration: base.duration,
  };
};

const speakersOf = (beats: ScriptBeat[], scene: string, fallback: string[]) => {
  const roles = [...new Set(beats.filter((b) => b.scene === scene && b.kind === "line" && b.role).map((b) => b.role!))];
  return roles.length ? roles : fallback.filter((r) => (ROLES as readonly string[]).includes(r)).slice(0, 2);
};

/** script.json → the same shape the model writes (for revisions). */
export const scriptToDraft = (s: ScriptDoc): DraftOutput => ({
  title: s.title,
  logline: s.logline,
  premise: s.creative?.premise ?? "",
  punchline: s.creative?.punchline ?? "",
  scenes: s.scenes.map((x) => ({ id: x.id, title: x.title, location: x.location, speakers: x.speakers, note: x.note ?? "" })),
  beats: s.beats.map((b) => ({
    id: b.id,
    scene: b.scene,
    kind: b.kind,
    role: b.kind === "line" ? (b.role ?? null) : null,
    text: b.kind === "line" ? (b.text ?? "") : null,
    desc: b.kind === "action" ? (b.desc ?? "") : null,
    sec: b.kind === "action" ? (b.sec ?? null) : null,
    sameTurn: Boolean(b.sameTurn),
    visual: b.visual ?? "",
    expressions: Object.entries(b.expression ?? {}).map(([character, expression]) => ({ character, expression })),
    poses: Object.entries(b.pose ?? {}).map(([character, pose]) => ({ character, pose })),
  })),
});

/**
 * Scene-scoped revision: take the model's version of the selected scenes only;
 * every other scene and its beats stay exactly as they were.
 */
export const mergeScoped = (current: ScriptDoc, revised: ScriptDoc, sceneIds: string[]): ScriptDoc => {
  const scope = new Set(sceneIds);
  const scenes = current.scenes.map((s) => (scope.has(s.id) ? (revised.scenes.find((r) => r.id === s.id) ?? s) : s));
  const beats: ScriptBeat[] = [];
  for (const s of current.scenes) {
    const src = scope.has(s.id) ? revised : current;
    beats.push(...src.beats.filter((b) => b.scene === s.id));
  }
  return { ...current, scenes, beats };
};

export type CheckResult = { errors: string[]; warnings: string[]; lint: LintResult | null; estimateSec: number | null };

/** Server-side validation. `errors` block saving; `warnings` are shown to the user. */
export const validateScript = (s: ScriptDoc, opts: { cast?: string[] } = {}): CheckResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!str(s.title)) errors.push("Thiếu tiêu đề.");
  if (!Array.isArray(s.scenes) || !s.scenes.length) errors.push("Không có cảnh nào.");
  if (!Array.isArray(s.beats) || !s.beats.length) errors.push("Không có lượt thoại hay hành động nào.");
  if (errors.length) return { errors, warnings, lint: null, estimateSec: null };

  const sceneIds = new Set<string>();
  for (const sc of s.scenes) {
    if (!/^S\d{1,2}[a-z]?$/.test(sc.id)) errors.push(`ID cảnh không hợp lệ: "${sc.id}" (dạng S1, S2…).`);
    if (sceneIds.has(sc.id)) errors.push(`Trùng ID cảnh ${sc.id}.`);
    sceneIds.add(sc.id);
    if (!(LOCATIONS as readonly string[]).includes(sc.location)) errors.push(`${sc.id}: bối cảnh "${sc.location}" chưa có (chỉ có ${LOCATIONS.join(", ")}).`);
    if (!str(sc.title)) warnings.push(`${sc.id}: chưa có tên cảnh.`);
  }
  const beatIds = new Set<string>();
  const order = s.scenes.map((x) => x.id);
  let lastScene = 0;
  const cast = new Set(opts.cast ?? CHARACTERS);
  for (const b of s.beats) {
    if (!/^[a-z][a-z0-9]{1,7}$/.test(b.id)) errors.push(`ID lượt không hợp lệ: "${b.id}".`);
    if (beatIds.has(b.id)) errors.push(`Trùng ID lượt ${b.id}.`);
    beatIds.add(b.id);
    if (!sceneIds.has(b.scene)) {
      errors.push(`${b.id}: cảnh "${b.scene}" không tồn tại.`);
      continue;
    }
    const idx = order.indexOf(b.scene);
    if (idx < lastScene) errors.push(`${b.id}: thứ tự lượt không theo thứ tự cảnh.`);
    lastScene = Math.max(lastScene, idx);
    if (b.kind === "line") {
      if (!(ROLES as readonly string[]).includes(b.role ?? "")) errors.push(`${b.id}: vai "${b.role}" không hợp lệ.`);
      else if (b.role !== "narrator" && !cast.has(b.role as string)) errors.push(`${b.id}: ${b.role} không có trong dàn nhân vật đã chọn.`);
      else if (b.role === "narrator" && !cast.has("kien")) errors.push(`${b.id}: lời dẫn là giọng Kiên nhưng Kiên không có trong dàn nhân vật.`);
      if (!str(b.text)) errors.push(`${b.id}: lời thoại trống.`);
    } else if (b.kind === "action") {
      if (!str(b.desc)) errors.push(`${b.id}: hành động chưa có mô tả.`);
      if (typeof b.sec !== "number" || b.sec < 0.3 || b.sec > 6) errors.push(`${b.id}: thời lượng hành động phải từ 0,3 đến 6 giây (đang là ${b.sec ?? "trống"}).`);
    } else errors.push(`${b.id}: loại "${String(b.kind)}" không hợp lệ.`);
    for (const [c, e] of Object.entries(b.expression ?? {})) {
      if (!(CHARACTERS as readonly string[]).includes(c)) errors.push(`${b.id}: biểu cảm cho nhân vật lạ "${c}".`);
      if (!(EXPRESSIONS as readonly string[]).includes(e)) errors.push(`${b.id}: biểu cảm "${e}" không có trong rig.`);
    }
    for (const [c, p] of Object.entries(b.pose ?? {})) {
      if (!(CHARACTERS as readonly string[]).includes(c)) errors.push(`${b.id}: tư thế cho nhân vật lạ "${c}".`);
      if (!(POSES as readonly string[]).includes(p)) errors.push(`${b.id}: tư thế "${p}" không có trong rig.`);
    }
  }
  for (const sc of s.scenes) if (!s.beats.some((b) => b.scene === sc.id)) errors.push(`${sc.id}: cảnh không có lượt nào.`);
  if (errors.length) return { errors, warnings, lint: null, estimateSec: null };

  const lint = lintScript(s as never);
  errors.push(...lint.problems.map((p) => `Quy tắc ngôn ngữ: ${p}`));
  warnings.push(...lint.notes);
  const [lo, hi] = s.duration.targetRangeSec;
  if (lint.estimateSec > hi) warnings.push(`Ước lượng ~${lint.estimateSec} s, dài hơn mục tiêu ${lo}–${hi} s (được phép nếu diễn biến cần).`);
  return { errors, warnings, lint, estimateSec: lint.estimateSec };
};

// ---- Diff ----------------------------------------------------------------------

export type BeatDiff = { id: string; scene: string; status: "added" | "removed" | "changed" | "same"; fields: string[]; from: ScriptBeat | null; to: ScriptBeat | null };
export type ScriptDiff = {
  meta: { field: string; from: string; to: string }[];
  scenes: { id: string; status: "added" | "removed" | "changed" | "same"; fields: string[] }[];
  beats: BeatDiff[];
  summary: { added: number; removed: number; changed: number };
};

const BEAT_FIELDS = ["scene", "kind", "role", "text", "desc", "sec", "sameTurn", "visual", "expression", "pose"] as const;
const eq = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export const diffScripts = (a: ScriptDoc | null, b: ScriptDoc): ScriptDiff => {
  const meta: ScriptDiff["meta"] = [];
  for (const f of ["title", "logline"] as const) if (!a || a[f] !== b[f]) meta.push({ field: f, from: a?.[f] ?? "", to: b[f] });
  for (const f of ["premise", "punchline"] as const)
    if ((a?.creative?.[f] ?? "") !== (b.creative?.[f] ?? "")) meta.push({ field: f, from: a?.creative?.[f] ?? "", to: b.creative?.[f] ?? "" });
  const scenes: ScriptDiff["scenes"] = [];
  const aScenes = new Map((a?.scenes ?? []).map((s) => [s.id, s]));
  for (const s of b.scenes) {
    const o = aScenes.get(s.id);
    if (!o) scenes.push({ id: s.id, status: "added", fields: [] });
    else {
      const fields = (["title", "location", "speakers", "note"] as const).filter((f) => !eq(o[f], s[f]));
      scenes.push({ id: s.id, status: fields.length ? "changed" : "same", fields });
    }
  }
  for (const s of a?.scenes ?? []) if (!b.scenes.some((x) => x.id === s.id)) scenes.push({ id: s.id, status: "removed", fields: [] });
  const aBeats = new Map((a?.beats ?? []).map((x) => [x.id, x]));
  const beats: BeatDiff[] = [];
  for (const x of b.beats) {
    const o = aBeats.get(x.id);
    if (!o) beats.push({ id: x.id, scene: x.scene, status: "added", fields: [], from: null, to: x });
    else {
      const fields = BEAT_FIELDS.filter((f) => !eq(o[f], x[f]));
      beats.push({ id: x.id, scene: x.scene, status: fields.length ? "changed" : "same", fields, from: o, to: x });
    }
  }
  for (const o of a?.beats ?? []) if (!b.beats.some((x) => x.id === o.id)) beats.push({ id: o.id, scene: o.scene, status: "removed", fields: [], from: o, to: null });
  return {
    meta,
    scenes,
    beats,
    summary: {
      added: beats.filter((x) => x.status === "added").length,
      removed: beats.filter((x) => x.status === "removed").length,
      changed: beats.filter((x) => x.status === "changed").length,
    },
  };
};
