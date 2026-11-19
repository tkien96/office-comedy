// Script documents: the script.json shape (same as EP001, so render/TTS tools
// keep working), server-side validation and a beat-level diff. No I/O here.
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

const str = (v: unknown) => (typeof v === "string" ? v.replace(/\r\n/g, "\n").normalize("NFC").trim() : "");

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
