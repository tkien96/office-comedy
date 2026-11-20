import { existsSync, readdirSync } from "node:fs";
import { createEpisode } from "./create.ts";
import { EPISODE_ID, episodePaths } from "./paths.ts";
import { CHARACTERS, LOCATIONS } from "./scriptdoc.ts";
import { readRequest, writeRequest, type ScriptRequest } from "./scriptstore.ts";
import { ValidationError } from "./service.ts";

// Creating an episode from a brief (Studio "Tạo tập mới"): allocates the next
// episode ID with the shared allocator and stores the brief in
// script/request.json. No model is called. The script itself is written in a
// Claude Code session and comes back as a proposal (npm run script:propose).

export type CreateInput = {
  requestToken: string;
  title: string;
  idea: string;
  punchlineDirection: string;
  characters: string[];
  setting: string;
  notes: string;
  minSec: number;
  targetMinSec: number;
  targetMaxSec: number;
};

export const validateCreate = (b: Record<string, unknown>): CreateInput => {
  const s = (k: string, max: number, required = false) => {
    const v = typeof b[k] === "string" ? (b[k] as string).replace(/\r\n/g, "\n").normalize("NFC").trim() : "";
    if (required && !v) throw new ValidationError(`Thiếu "${k}".`);
    if ([...v].length > max) throw new ValidationError(`"${k}" dài quá ${max} ký tự.`);
    return v;
  };
  const n = (k: string) => {
    const v = Number(b[k]);
    if (!Number.isFinite(v)) throw new ValidationError(`"${k}" phải là số.`);
    return Math.round(v);
  };
  const token = s("requestToken", 64, true);
  if (!/^[A-Za-z0-9-]{8,64}$/.test(token)) throw new ValidationError("requestToken không hợp lệ.");
  const characters = Array.isArray(b.characters) ? (b.characters as unknown[]).map(String) : [];
  if (!characters.length || characters.some((c) => !(CHARACTERS as readonly string[]).includes(c))) throw new ValidationError("Chọn ít nhất một nhân vật trong danh sách có sẵn.");
  const setting = s("setting", 40, true);
  if (!(LOCATIONS as readonly string[]).includes(setting)) throw new ValidationError(`Bối cảnh phải là một trong: ${LOCATIONS.join(", ")}.`);
  const minSec = n("minSec");
  const targetMinSec = n("targetMinSec");
  const targetMaxSec = n("targetMaxSec");
  if (minSec < 60) throw new ValidationError("Thời lượng tối thiểu không được dưới 60 giây.");
  if (targetMinSec < minSec || targetMaxSec < targetMinSec || targetMaxSec > 300) throw new ValidationError("Khoảng thời lượng mục tiêu không hợp lệ (tối thiểu ≤ từ ≤ đến ≤ 300 s).");
  return {
    requestToken: token,
    title: s("title", 120, true),
    idea: s("idea", 2000, true),
    punchlineDirection: s("punchlineDirection", 1000),
    characters: [...new Set(characters)],
    setting,
    notes: s("notes", 2000),
    minSec,
    targetMinSec,
    targetMaxSec,
  };
};

/** Finds an episode already created for this request token (double-submit guard). */
const episodeForToken = (token: string) => {
  if (!existsSync("episodes")) return null;
  for (const d of readdirSync("episodes").filter((x) => EPISODE_ID.test(x))) {
    if (readRequest(episodePaths(d))?.requestToken === token) return d;
  }
  return null;
};

/** New episode ID + stored brief. Same requestToken twice → same episode, no new ID. */
export const createEpisodeWithRequest = (input: CreateInput) => {
  const existing = episodeForToken(input.requestToken);
  if (existing) return { episode: existing, created: false };
  const P = createEpisode(input.title);
  const req: ScriptRequest = {
    createdAt: new Date().toISOString(),
    requestToken: input.requestToken,
    ideaSource: "user",
    title: input.title,
    idea: input.idea,
    punchlineDirection: input.punchlineDirection,
    characters: input.characters,
    setting: input.setting,
    notes: input.notes,
    duration: { minSec: input.minSec, targetRangeSec: [input.targetMinSec, input.targetMaxSec] },
  };
  writeRequest(P, req);
  return { episode: P.id, created: true };
};
