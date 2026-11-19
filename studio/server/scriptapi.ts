import type { IncomingMessage, ServerResponse } from "node:http";
import { episodePaths, type EpisodePaths } from "../../tools/episode/paths.ts";
import { CHARACTERS, diffScripts, validateScript, type ScriptDoc } from "../../tools/episode/scriptdoc.ts";
import { createEpisodeWithRequest, validateCreate } from "../../tools/episode/scriptrequest.ts";
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
import { HttpError, readJsonBody, sendJson, str } from "./http.ts";

// Routes for creating episodes (from a brief) and for script versions and
// proposals. No model is called from the Studio: scripts are written in a
// Claude Code session and arrive as proposals (npm run script:propose).

type Route = { method: string; re: RegExp; handler: (req: IncomingMessage, res: ServerResponse, m: RegExpMatchArray) => Promise<void> | void };

const episode = (id: string): EpisodePaths => {
  if (!listEpisodeIds().includes(id)) throw new HttpError(404, `Không có tập ${id}.`);
  return episodePaths(id);
};

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
  };
};

export const SCRIPT_ROUTES: Route[] = [
  {
    method: "POST",
    re: /^\/api\/episodes\/create$/,
    handler: async (req, res) => {
      const input = validateCreate(await readJsonBody(req));
      const r = createEpisodeWithRequest(input);
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
];
