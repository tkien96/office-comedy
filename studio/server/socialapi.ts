import type { IncomingMessage, ServerResponse } from "node:http";
import { episodePaths } from "../../tools/episode/paths.ts";
import { listEpisodeIds } from "../../tools/episode/service.ts";
import { bindJobAccount } from "../../tools/publish/accounts.ts";
import {
  checkTarget,
  connectionsView,
  discardDraft,
  importFromEnv,
  parseGoogleClientJson,
  readTargets,
  removeFromStudio,
  removeTiktok,
  removeYoutubeClient,
  resolveCredentials,
  saveFacebook,
  saveTiktok,
  saveYoutubeClient,
  setEnvMode,
} from "../../tools/publish/connections.ts";
import { googleRevoke, GRAPH_VERSION, PlatformError, YOUTUBE_SCOPES } from "../../tools/publish/platforms.ts";
import { secretStoreHealth } from "../../tools/secrets/dpapi.ts";
import { HttpError, readJsonBody, sendJson, str } from "./http.ts";
import { cancelPending, confirmPending, oauthResult, pendingView, redirectUriFor, startOAuth } from "./oauth.ts";

// "Kết nối mạng xã hội" API. Reads return metadata only (never a secret value).
// Every change carries `expectedRev` (the connections revision the page shows)
// so two tabs cannot overwrite each other. Network checks run only when the
// user clicks (never on page load).

const PORT = Number(process.env.STUDIO_PORT ?? 5178);

type Route = { method: string; re: RegExp; handler: (req: IncomingMessage, res: ServerResponse, m: RegExpMatchArray) => Promise<void> | void };

let storeHealth: { ok: boolean; message: string; checkedAt: string } | null = null;
export const refreshStoreHealth = async () => {
  storeHealth = { ...(await secretStoreHealth()), checkedAt: new Date().toISOString() };
  return storeHealth;
};

const rev = (body: Record<string, unknown>) => {
  const v = body.expectedRev;
  if (typeof v !== "number" || !Number.isInteger(v) || v < 0) throw new HttpError(400, 'Thiếu "expectedRev" (tải lại trang).');
  return v;
};
const targetKey = (k: string) => {
  if (!readTargets()[k]) throw new HttpError(404, `Không có tài khoản đích ${k}.`);
  return k;
};
/** Optional secret field: absent/empty = keep the stored value. */
const optSecret = (v: unknown, field: string, max = 2048): string | undefined => {
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v !== "string" || v.length > max) throw new HttpError(400, `Sai "${field}".`);
  const t = v.trim();
  return t || undefined;
};

const view = () => ({
  ...connectionsView(),
  secretStore: storeHealth,
  oauth: { redirectUri: redirectUriFor(PORT), scopes: YOUTUBE_SCOPES, clientType: "Desktop app" },
  graphVersion: GRAPH_VERSION,
});

export const SOCIAL_ROUTES: Route[] = [
  { method: "GET", re: /^\/api\/connections$/, handler: (_q, res) => sendJson(res, 200, view()) },
  {
    method: "POST",
    re: /^\/api\/connections\/secret-store\/check$/,
    handler: async (_q, res) => sendJson(res, 200, await refreshStoreHealth()),
  },

  // ---- YouTube app setup (OAuth client) ----
  {
    method: "POST",
    re: /^\/api\/connections\/youtube\/client$/,
    handler: async (req, res) => {
      const body = await readJsonBody(req);
      const expectedRev = rev(body);
      let p: { clientId: string; clientSecret?: string | null; projectId?: string | null; via: "json" | "form" };
      if (typeof body.clientJson === "string") {
        // Parsed in memory; only client_id, client_secret, project_id are kept. The file itself is never stored.
        const j = parseGoogleClientJson(str(body.clientJson, "clientJson", 20_000));
        p = { clientId: j.clientId, clientSecret: j.clientSecret ?? undefined, projectId: j.projectId, via: "json" };
      } else {
        p = { clientId: str(body.clientId, "clientId", 200).trim(), clientSecret: body.removeSecret === true ? null : optSecret(body.clientSecret, "clientSecret", 256), via: "form" };
      }
      sendJson(res, 200, { ok: true, ...(await saveYoutubeClient(p, expectedRev)) });
    },
  },
  {
    method: "POST",
    re: /^\/api\/connections\/youtube\/client\/remove$/,
    handler: async (req, res) => sendJson(res, 200, { ok: true, ...removeYoutubeClient(rev(await readJsonBody(req))) }),
  },

  // ---- YouTube OAuth ----
  {
    method: "POST",
    re: /^\/api\/connections\/([a-z]+\.[a-z]+)\/oauth\/start$/,
    handler: async (req, res, m) => {
      await readJsonBody(req);
      sendJson(res, 200, await startOAuth(req, res, targetKey(m[1]), PORT));
    },
  },
  { method: "GET", re: /^\/api\/connections\/oauth-result\/([A-Za-z0-9_-]{8,40})$/, handler: (_q, res, m) => sendJson(res, 200, oauthResult(m[1])) },
  {
    method: "GET",
    re: /^\/api\/connections\/youtube\/pending\/([A-Za-z0-9_-]{8,40})$/,
    handler: (_q, res, m) => {
      const p = pendingView(m[1]);
      if (!p) throw new HttpError(410, "Kết nối chờ xác nhận đã hết hạn hoặc không còn.");
      sendJson(res, 200, p);
    },
  },
  {
    method: "POST",
    re: /^\/api\/connections\/youtube\/pending\/([A-Za-z0-9_-]{8,40})\/confirm$/,
    handler: async (req, res, m) => {
      const body = await readJsonBody(req);
      sendJson(res, 200, { ok: true, ...(await confirmPending(m[1], rev(body), body.acceptMismatch === true)) });
    },
  },
  {
    method: "POST",
    re: /^\/api\/connections\/youtube\/pending\/([A-Za-z0-9_-]{8,40})\/cancel$/,
    handler: async (req, res, m) => {
      await readJsonBody(req);
      sendJson(res, 200, cancelPending(m[1]));
    },
  },

  // ---- Facebook ----
  {
    method: "POST",
    re: /^\/api\/connections\/([a-z]+\.[a-z]+)\/facebook$/,
    handler: async (req, res, m) => {
      const body = await readJsonBody(req);
      const r = await saveFacebook(targetKey(m[1]), { pageId: str(body.pageId, "pageId", 30).trim(), token: optSecret(body.token, "token") }, rev(body));
      sendJson(res, 200, { ok: true, ...r });
    },
  },
  {
    method: "POST",
    re: /^\/api\/connections\/([a-z]+\.[a-z]+)\/draft\/discard$/,
    handler: async (req, res, m) => sendJson(res, 200, { ok: true, ...discardDraft(targetKey(m[1]), rev(await readJsonBody(req))) }),
  },

  // ---- TikTok ----
  {
    method: "POST",
    re: /^\/api\/connections\/([a-z]+\.[a-z]+)\/tiktok$/,
    handler: async (req, res, m) => {
      const body = await readJsonBody(req);
      sendJson(res, 200, { ok: true, ...saveTiktok(targetKey(m[1]), str(body.input, "input", 300), rev(body)) });
    },
  },
  {
    method: "POST",
    re: /^\/api\/connections\/([a-z]+\.[a-z]+)\/tiktok\/remove$/,
    handler: async (req, res, m) => sendJson(res, 200, { ok: true, ...removeTiktok(targetKey(m[1]), rev(await readJsonBody(req))) }),
  },

  // ---- Shared actions ----
  {
    method: "POST",
    re: /^\/api\/connections\/([a-z]+\.[a-z]+)\/check$/,
    handler: async (req, res, m) => {
      const body = await readJsonBody(req);
      sendJson(res, 200, { ok: true, ...(await checkTarget(targetKey(m[1]), { draft: body.draft === true })) });
    },
  },
  {
    method: "POST",
    re: /^\/api\/connections\/([a-z]+\.[a-z]+)\/remove$/,
    handler: async (req, res, m) => sendJson(res, 200, { ok: true, ...removeFromStudio(targetKey(m[1]), rev(await readJsonBody(req))) }),
  },
  {
    method: "POST",
    re: /^\/api\/connections\/([a-z]+\.[a-z]+)\/import-env$/,
    handler: async (req, res, m) => {
      const body = await readJsonBody(req);
      const pageId = typeof body.pageId === "string" && body.pageId.trim() ? body.pageId.trim() : undefined;
      sendJson(res, 200, { ok: true, ...(await importFromEnv(targetKey(m[1]), { pageId }, rev(body))) });
    },
  },
  {
    method: "POST",
    re: /^\/api\/connections\/([a-z]+\.[a-z]+)\/env-mode$/,
    handler: async (req, res, m) => {
      const body = await readJsonBody(req);
      if (body.mode !== "use" && body.mode !== "off") throw new HttpError(400, 'mode phải là "use" hoặc "off".');
      sendJson(res, 200, { ok: true, rev: setEnvMode(targetKey(m[1]), body.mode, rev(body)).rev });
    },
  },
  {
    // Separate, explicit action: revoke the grant AT GOOGLE, then remove locally.
    method: "POST",
    re: /^\/api\/connections\/([a-z]+\.[a-z]+)\/revoke-remote$/,
    handler: async (req, res, m) => {
      const body = await readJsonBody(req);
      const key = targetKey(m[1]);
      const expectedRev = rev(body);
      if (body.confirm !== true) throw new HttpError(400, "Cần xác nhận thu hồi quyền.");
      if (readTargets()[key].platform !== "youtube") throw new HttpError(400, "Thu hồi từ xa chỉ có cho YouTube. Facebook: gỡ quyền ứng dụng trong cài đặt Facebook/Meta Business.");
      const cr = await resolveCredentials(key);
      if (cr.source !== "studio") throw new HttpError(400, "Chỉ thu hồi được kết nối do Studio quản lý (không thu hồi token trong .env).");
      try {
        await googleRevoke(cr.bundle.refreshToken);
      } catch (e) {
        if (e instanceof PlatformError) throw new HttpError(502, `${e.message} Kết nối trong Studio vẫn giữ nguyên; bạn có thể bấm Gỡ khỏi Studio.`);
        throw e;
      }
      const r = removeFromStudio(key, expectedRev);
      sendJson(res, 200, { ok: true, revoked: true, ...r });
    },
  },

  // ---- Job ↔ account binding ----
  {
    method: "POST",
    re: /^\/api\/episodes\/(EP\d{3,})\/jobs\/([A-Za-z0-9_.-]{3,80})\/account$/,
    handler: async (req, res, m) => {
      if (!listEpisodeIds().includes(m[1])) throw new HttpError(404, `Không có tập ${m[1]}.`);
      const body = await readJsonBody(req);
      const r = await bindJobAccount(episodePaths(m[1]), m[2], {
        connectionId: str(body.connectionId, "connectionId", 80),
        platformAccountId: str(body.platformAccountId, "platformAccountId", 80),
        replace: body.replace === true,
      });
      sendJson(res, 200, { ok: true, ...r });
    },
  },
];
