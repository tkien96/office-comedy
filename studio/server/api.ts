import { existsSync, readFileSync, statSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import { parseSrt } from "../../tools/episode/captions.ts";
import { checkDelivery, deliveryZipEntries } from "../../tools/episode/delivery.ts";
import { LockBusyError } from "../../tools/episode/fsutil.ts";
import { readManifest, readSocial, socialPostKeys } from "../../tools/episode/manifest.ts";
import { episodePaths, rel, type EpisodePaths } from "../../tools/episode/paths.ts";
import {
  approvePart,
  ConflictError,
  EDITABLE_FIELDS,
  episodeSummary,
  freshness,
  listEpisodeIds,
  listEpisodes,
  partStates,
  postToken,
  REPORTS,
  socialFindings,
  updateSocialPost,
  ValidationError,
  type SocialPatch,
} from "../../tools/episode/service.ts";
import { pasteText, type Post } from "../../tools/episode/social.ts";
import { readJobs } from "../../tools/publish/jobs.ts";
import { runDryRun, writeDryRunReport } from "../../tools/publish/dryrun.ts";
import { configView } from "./config.ts";
import { insideRoot, serveFile } from "./files.ts";
import { HttpError, readJsonBody, sendError, sendJson, SECURITY_HEADERS, str } from "./http.ts";
import { ActiveTaskError, getTask, listTasks, runNodeScript, startTask } from "./tasks.ts";
import { AiError } from "../../tools/ai/provider.ts";
import { SCRIPT_ROUTES } from "./scriptapi.ts";
import { writeZip } from "./zip.ts";

// API routes. Every route takes an episode ID (validated against the folders
// that exist) and a fixed product/report/media name — never a path or command.

const episode = (id: string): EpisodePaths => {
  if (!listEpisodeIds().includes(id)) throw new HttpError(404, `Không có tập ${id}.`);
  return episodePaths(id);
};

const MEDIA: Record<string, (P: EpisodePaths) => string> = {
  video: (P) => P.video,
  audio: (P) => P.preview,
  thumb9x16: (P) => P.thumbnail9x16,
  teaser1x1: (P) => P.teaser1x1,
  srt: (P) => P.captions,
};

const fileInfo = (p: string) => (existsSync(p) ? { exists: true, size: statSync(p).size, path: rel(p) } : { exists: false, size: 0, path: rel(p) });

const detail = (P: EpisodePaths) => {
  const summary = episodeSummary(P.id);
  if (!summary.ok) return { summary };
  const m = readManifest(P);
  const script = existsSync(P.script) ? JSON.parse(readFileSync(P.script, "utf8")) : null;
  const timeline = existsSync(P.timeline) ? JSON.parse(readFileSync(P.timeline, "utf8")) : null;
  const times = new Map<string, { startSec: number; endSec: number; speechStartSec?: number; speechEndSec?: number }>(
    (timeline?.items ?? []).map((i: { id: string; startSec: number; endSec: number; speechStartSec?: number; speechEndSec?: number }) => [i.id, i]),
  );
  const social = (() => {
    try {
      return readSocial(P);
    } catch {
      return null;
    }
  })();
  const posts = socialPostKeys(social).map((key) => {
    const [pl, name] = key.split(".");
    const post = social!.platforms[pl][name] as Post;
    return {
      key,
      platform: pl,
      name,
      post,
      paste: pasteText(post),
      token: postToken(post),
      editable: EDITABLE_FIELDS.filter((f) => post[f] !== undefined),
    };
  });
  const jobs = readJobs(P).jobs.map((j) => ({
    id: j.id,
    platform: j.platform,
    type: j.type,
    mode: j.mode,
    state: j.state,
    target: j.target,
    contentRef: j.content.ref,
    media: j.media,
    scheduleLocal: j.schedule.local,
    scheduleUtc: j.schedule.utc,
    remote: { id: j.remote.id, url: j.remote.url, platformStatus: j.remote.platformStatus },
    attempts: j.attempts,
    lastError: j.lastError,
    history: j.history,
  }));
  const dryRunFile = join(P.reportsDir, "publish-dry-run.json");
  return {
    summary,
    manifest: { id: m.id, title: m.title, contentVersion: m.contentVersion, contentHash: m.contentHash, createdAt: m.createdAt, duration: m.duration, versions: m.versions, checks: m.checks, production: m.production },
    parts: partStates(P, m),
    freshness: freshness(P),
    script: script
      ? {
          title: script.title,
          logline: script.logline,
          scenes: script.scenes,
          beats: (script.beats as Record<string, unknown>[]).map((b) => ({ ...b, time: times.get(b.id as string) ?? null })),
        }
      : null,
    captions: existsSync(P.captions) ? parseSrt(readFileSync(P.captions, "utf8")) : null,
    media: Object.fromEntries(Object.entries(MEDIA).map(([k, f]) => [k, fileInfo(f(P))])),
    social: { posts, findings: socialFindings(P), guard: social?.spoilerGuard ?? null },
    jobs,
    lastDryRun: existsSync(dryRunFile) ? JSON.parse(readFileSync(dryRunFile, "utf8")) : null,
    reports: Object.entries(REPORTS).map(([key, r]) => ({ key, label: r.label, kind: r.kind, exists: existsSync(r.file(P)) })),
    delivery: checkDelivery(P),
    tasks: listTasks({ episode: P.id }),
  };
};

type Route = { method: string; re: RegExp; handler: (req: IncomingMessage, res: ServerResponse, m: RegExpMatchArray) => Promise<void> | void };

export const ROUTES: Route[] = [
  { method: "GET", re: /^\/api\/health$/, handler: (_q, res) => sendJson(res, 200, { ok: true }) },
  { method: "GET", re: /^\/api\/episodes$/, handler: (_q, res) => sendJson(res, 200, { episodes: listEpisodes() }) },
  { method: "GET", re: /^\/api\/episodes\/(EP\d{3,})$/, handler: (_q, res, m) => sendJson(res, 200, detail(episode(m[1]))) },
  {
    method: "GET",
    re: /^\/api\/episodes\/(EP\d{3,})\/reports\/([a-z-]+)$/,
    handler: (_q, res, m) => {
      const P = episode(m[1]);
      const r = REPORTS[m[2]];
      if (!r) throw new HttpError(404, "Không có báo cáo này.");
      const real = insideRoot(P.root, r.file(P));
      sendJson(res, 200, { key: m[2], label: r.label, kind: r.kind, text: readFileSync(real, "utf8") });
    },
  },
  {
    method: "GET",
    re: /^\/api\/episodes\/(EP\d{3,})\/media\/([a-z0-9]+)$/,
    handler: (req, res, m) => {
      const P = episode(m[1]);
      const f = MEDIA[m[2]];
      if (!f) throw new HttpError(404, "Không có loại media này.");
      serveFile(req, res, insideRoot(P.root, f(P)));
    },
  },
  {
    method: "POST",
    re: /^\/api\/episodes\/(EP\d{3,})\/approve$/,
    handler: async (req, res, m) => {
      const P = episode(m[1]);
      const body = await readJsonBody(req);
      const part = str(body.part, "part", 60);
      const revoke = body.revoke === true;
      const viewToken = revoke ? undefined : str(body.viewToken, "viewToken", 64);
      const note = typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 300) : undefined;
      const r = approvePart(P, part, { viewToken, note, revoke });
      sendJson(res, 200, { ok: true, ...r });
    },
  },
  {
    method: "PUT",
    re: /^\/api\/episodes\/(EP\d{3,})\/social\/([a-z]+\.[a-z]+)$/,
    handler: async (req, res, m) => {
      const P = episode(m[1]);
      const body = await readJsonBody(req);
      const baseToken = str(body.baseToken, "baseToken", 64);
      const patch = body.patch;
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) throw new HttpError(400, 'Thiếu "patch".');
      const r = updateSocialPost(P, m[2], patch as SocialPatch, baseToken);
      sendJson(res, 200, { ok: true, ...r });
    },
  },
  {
    method: "POST",
    re: /^\/api\/episodes\/(EP\d{3,})\/dry-run$/,
    handler: (_q, res, m) => {
      const P = episode(m[1]);
      const report = runDryRun(P, new Date());
      writeDryRunReport(P, report);
      sendJson(res, 200, report);
    },
  },
  { method: "GET", re: /^\/api\/episodes\/(EP\d{3,})\/delivery\/check$/, handler: (_q, res, m) => sendJson(res, 200, checkDelivery(episode(m[1]))) },
  {
    method: "POST",
    re: /^\/api\/episodes\/(EP\d{3,})\/delivery\/build$/,
    handler: (_q, res, m) => {
      const P = episode(m[1]);
      // Same code path as `npm run episode:delivery`, in a child process.
      const { task, deduped } = startTask({
        type: "delivery-build",
        episode: P.id,
        exclusiveKey: `delivery:${P.id}`,
        onActive: "dedupe",
        queue: "none",
        run: async () => {
          const r = await runNodeScript("tools/episode/cli/delivery.ts", [P.id]);
          return { summary: r.stdout.trim().split("\n")[0] ?? "" };
        },
      });
      sendJson(res, 202, { task, deduped });
    },
  },
  {
    method: "GET",
    re: /^\/api\/episodes\/(EP\d{3,})\/delivery\.zip$/,
    handler: async (_q, res, m) => {
      const P = episode(m[1]);
      const entries = deliveryZipEntries(P).map((e) => ({ name: e.name, path: insideRoot(P.deliveryDir, e.path) }));
      res.writeHead(200, { ...SECURITY_HEADERS, "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${P.id}-delivery.zip"`, "Cache-Control": "no-store" });
      await writeZip(res, entries);
      res.end();
    },
  },
  {
    method: "GET",
    re: /^\/api\/tasks$/,
    handler: (req, res) => {
      const ep = new URL(req.url ?? "/", "http://x").searchParams.get("episode") ?? undefined;
      sendJson(res, 200, { tasks: listTasks(ep && /^EP\d{3,}$/.test(ep) ? { episode: ep } : {}) });
    },
  },
  {
    method: "GET",
    re: /^\/api\/tasks\/([0-9a-f-]{36})$/,
    handler: (_q, res, m) => {
      const t = getTask(m[1]);
      if (!t) throw new HttpError(404, "Không có công việc này.");
      sendJson(res, 200, t);
    },
  },
  { method: "GET", re: /^\/api\/config$/, handler: (_q, res) => sendJson(res, 200, configView()) },
  ...SCRIPT_ROUTES,
];

export const handleApiError = (res: ServerResponse, e: unknown) => {
  if (res.headersSent) {
    res.destroy();
    return;
  }
  if (e instanceof HttpError) return sendError(res, e.status, e.message);
  if (e instanceof ConflictError) return sendError(res, 409, e.message, { conflict: true });
  if (e instanceof ValidationError) return sendError(res, 422, e.message);
  if (e instanceof LockBusyError) return sendError(res, 423, e.message);
  if (e instanceof ActiveTaskError) return sendError(res, 409, e.message, { activeTask: e.task.id });
  if (e instanceof AiError) return sendError(res, e.kind === "not_configured" ? 503 : 502, e.message, { aiError: e.kind });
  console.error(`[studio] lỗi: ${(e as Error).message}`);
  sendError(res, 500, `Lỗi máy chủ: ${(e as Error).message}`);
};
