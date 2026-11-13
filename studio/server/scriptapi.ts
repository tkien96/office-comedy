import type { IncomingMessage, ServerResponse } from "node:http";
import { aiStatus, loadAiConfig } from "../../tools/ai/config.ts";
import { episodePaths, type EpisodePaths } from "../../tools/episode/paths.ts";
import { CHARACTERS, diffScripts, LOCATIONS, validateScript, type ScriptDoc } from "../../tools/episode/scriptdoc.ts";
import {
  acceptProposal,
  commitVersion,
  currentVersion,
  discardProposal,
  listProposals,
  listVersions,
  readCurrent,
  readProposal,
  readRequest,
  readVersion,
} from "../../tools/episode/scriptstore.ts";
import { listEpisodeIds, ValidationError } from "../../tools/episode/service.ts";
import { createEpisodeWithDraft, retryTask, startDraft, startIdeas, startRevise, validateCreate } from "./aijobs.ts";
import { HttpError, readJsonBody, sendJson, str } from "./http.ts";
import { activeFor, cancelTask, getTask, listTasks } from "./tasks.ts";

// Routes for creating episodes and writing/editing scripts with Claude.
// Opening, reading or approving NEVER calls the model: only the POST routes
// below that start an "ai-*" task do.

type Route = { method: string; re: RegExp; handler: (req: IncomingMessage, res: ServerResponse, m: RegExpMatchArray) => Promise<void> | void };

const episode = (id: string): EpisodePaths => {
  if (!listEpisodeIds().includes(id)) throw new HttpError(404, `Không có tập ${id}.`);
  return episodePaths(id);
};

const AI_TYPES = new Set(["ai-ideas", "ai-draft", "ai-revise"]);

const scriptState = (P: EpisodePaths) => {
  const cur = readCurrent(P);
  const versions = listVersions(P);
  const cv = currentVersion(P);
  return {
    current: cur
      ? {
          hash: cur.hash,
          script: cur.script,
          version: cv?.version ?? null,
          versionMeta: cv,
          check: validateScript(cur.script, { cast: [...CHARACTERS] }),
        }
      : null,
    versions: versions.reverse(),
    proposals: listProposals(P),
    request: readRequest(P),
    activeTask: activeFor(`ai-script:${P.id}`),
    tasks: listTasks({ episode: P.id }).filter((t) => AI_TYPES.has(t.type)),
  };
};

export const SCRIPT_ROUTES: Route[] = [
  { method: "GET", re: /^\/api\/ai\/status$/, handler: (_q, res) => sendJson(res, 200, { ...aiStatus(), maxConcurrentJobs: loadAiConfig().maxConcurrentJobs }) },
  {
    method: "GET",
    re: /^\/api\/ai\/options$/,
    handler: (_q, res) => sendJson(res, 200, { characters: [...CHARACTERS], locations: [...LOCATIONS], defaults: { minSec: 60, targetMinSec: 60, targetMaxSec: 90 } }),
  },
  {
    method: "POST",
    re: /^\/api\/ideas$/,
    handler: async (req, res) => {
      const b = await readJsonBody(req);
      const hint = typeof b.hint === "string" ? b.hint.slice(0, 1000) : "";
      const characters = Array.isArray(b.characters) ? (b.characters as unknown[]).map(String) : [];
      const { task, deduped } = startIdeas({ hint, characters });
      sendJson(res, 202, { task, deduped });
    },
  },
  {
    method: "POST",
    re: /^\/api\/episodes\/create$/,
    handler: async (req, res) => {
      const input = validateCreate(await readJsonBody(req));
      const r = createEpisodeWithDraft(input);
      sendJson(res, r.created ? 201 : 200, r);
    },
  },
  { method: "GET", re: /^\/api\/episodes\/(EP\d{3,})\/script$/, handler: (_q, res, m) => sendJson(res, 200, scriptState(episode(m[1]))) },
  {
    method: "GET",
    re: /^\/api\/episodes\/(EP\d{3,})\/script\/versions\/(\d{1,5})$/,
    handler: (_q, res, m) => {
      const P = episode(m[1]);
      const v = readVersion(P, Number(m[2]));
      if (!v) throw new HttpError(404, "Không có phiên bản này.");
      const cur = readCurrent(P);
      sendJson(res, 200, { version: v, diffFromCurrent: diffScripts(cur?.script ?? null, v.script) });
    },
  },
  {
    method: "GET",
    re: /^\/api\/episodes\/(EP\d{3,})\/script\/proposals\/(p-[0-9a-z-]{8,40})$/,
    handler: (_q, res, m) => {
      const P = episode(m[1]);
      const p = readProposal(P, m[2]);
      if (!p) throw new HttpError(404, "Không có bản đề xuất này.");
      const cur = readCurrent(P);
      sendJson(res, 200, { proposal: p, currentHash: cur?.hash ?? null, diff: diffScripts(cur?.script ?? null, p.script) });
    },
  },
  {
    method: "POST",
    re: /^\/api\/episodes\/(EP\d{3,})\/script\/proposals\/(p-[0-9a-z-]{8,40})\/accept$/,
    handler: async (req, res, m) => {
      const P = episode(m[1]);
      const b = await readJsonBody(req);
      const viewedHash = b.viewedHash === null ? null : str(b.viewedHash, "viewedHash", 80);
      const v = acceptProposal(P, m[2], viewedHash);
      sendJson(res, 200, { ok: true, version: v });
    },
  },
  {
    method: "POST",
    re: /^\/api\/episodes\/(EP\d{3,})\/script\/proposals\/(p-[0-9a-z-]{8,40})\/discard$/,
    handler: (_q, res, m) => {
      discardProposal(episode(m[1]), m[2]);
      sendJson(res, 200, { ok: true });
    },
  },
  {
    method: "PUT",
    re: /^\/api\/episodes\/(EP\d{3,})\/script$/,
    handler: async (req, res, m) => {
      const P = episode(m[1]);
      const b = await readJsonBody(req);
      const baseHash = b.baseHash === null ? null : str(b.baseHash, "baseHash", 80);
      const script = b.script as ScriptDoc;
      if (!script || typeof script !== "object" || Array.isArray(script)) throw new ValidationError('Thiếu "script".');
      if (script.id !== P.id) throw new ValidationError(`Kịch bản phải có id "${P.id}".`);
      const check = validateScript(script, { cast: [...CHARACTERS] });
      if (check.errors.length) {
        sendJson(res, 422, { error: `Chưa lưu: ${check.errors.length} lỗi chặn.`, check });
        return;
      }
      const note = typeof b.note === "string" && b.note.trim() ? b.note.trim().slice(0, 300) : "Sửa thủ công";
      const v = commitVersion(P, script, { expectedHash: baseHash, source: "user", note });
      sendJson(res, 200, { ok: true, version: v, check });
    },
  },
  {
    method: "POST",
    re: /^\/api\/episodes\/(EP\d{3,})\/script\/restore$/,
    handler: async (req, res, m) => {
      const P = episode(m[1]);
      const b = await readJsonBody(req);
      const n = Number(b.version);
      const old = Number.isInteger(n) ? readVersion(P, n) : null;
      if (!old) throw new ValidationError("Không có phiên bản này.");
      const baseHash = b.baseHash === null ? null : str(b.baseHash, "baseHash", 80);
      const check = validateScript(old.script, { cast: [...CHARACTERS] });
      if (check.errors.length) throw new ValidationError(`Phiên bản ${n} có lỗi chặn theo quy tắc hiện tại: ${check.errors.slice(0, 3).join(" | ")}`);
      const v = commitVersion(P, old.script, { expectedHash: baseHash, source: "restore", note: `Phục hồi từ phiên bản ${n}`, restoredFrom: n });
      sendJson(res, 200, { ok: true, version: v });
    },
  },
  {
    method: "POST",
    re: /^\/api\/episodes\/(EP\d{3,})\/script\/draft$/,
    handler: (_q, res, m) => {
      const { task } = startDraft(episode(m[1]));
      sendJson(res, 202, { task });
    },
  },
  {
    method: "POST",
    re: /^\/api\/episodes\/(EP\d{3,})\/script\/revise$/,
    handler: async (req, res, m) => {
      const P = episode(m[1]);
      const b = await readJsonBody(req);
      const scope = Array.isArray(b.scope) ? (b.scope as unknown[]).map(String).slice(0, 30) : [];
      const { task } = startRevise(P, { instruction: typeof b.instruction === "string" ? b.instruction : "", scope, baseHash: str(b.baseHash, "baseHash", 80) });
      sendJson(res, 202, { task });
    },
  },
  {
    method: "POST",
    re: /^\/api\/tasks\/([0-9a-f-]{36})\/cancel$/,
    handler: (_q, res, m) => {
      if (!getTask(m[1])) throw new HttpError(404, "Không có công việc này.");
      sendJson(res, 200, cancelTask(m[1]));
    },
  },
  {
    method: "POST",
    re: /^\/api\/tasks\/([0-9a-f-]{36})\/retry$/,
    handler: (_q, res, m) => {
      const { task } = retryTask(m[1]);
      sendJson(res, 202, { task });
    },
  },
];
