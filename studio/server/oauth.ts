import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { activateYoutube, readMeta, readTargets, youtubeClientCredentials } from "../../tools/publish/connections.ts";
import { authUrlBase, googleExchangeCode, PlatformError, scrub, SCOPE_READONLY, YOUTUBE_SCOPES, youtubeMyChannel, type Identity } from "../../tools/publish/platforms.ts";
import { HttpError, SECURITY_HEADERS } from "./http.ts";

// YouTube OAuth (Google "Desktop app" client, loopback redirect, PKCE S256).
//
//   1. POST /api/connections/youtube/oauth/start (Origin + X-Studio checked)
//      → random one-time `state`, PKCE verifier, browser-binding cookie.
//   2. The user signs in and consents in their own browser (Google page).
//   3. Google redirects to http://127.0.0.1:<port>/?state=…&code=…
//      This is NOT an API call (no Origin header, cross-site navigation), so it
//      is protected by OAuth itself: state must exist, be unused, unexpired and
//      match the HttpOnly cookie set at step 1; it is consumed BEFORE the code
//      exchange (no replay).
//   4. Code exchange + channels.list(mine) → a PENDING connection held in
//      memory only. Nothing replaces the active connection until the user
//      confirms the channel in Studio. Cancel/failure leaves the old one intact.
//
// Transactions and pending connections live in memory: a Studio restart
// simply means "connect again" (no half-written state on disk).

// Test-only shorter lifetime (STUDIO_TEST=1) to exercise expiry.
const TX_TTL_MS = process.env.STUDIO_TEST === "1" && Number(process.env.STUDIO_OAUTH_TTL_MS) > 0 ? Number(process.env.STUDIO_OAUTH_TTL_MS) : 10 * 60_000;
const PENDING_TTL_MS = 15 * 60_000;
const COOKIE = "oc_oauth";

type Tx = { state: string; cookieHash: string; verifier: string; target: string; clientId: string; redirectUri: string; expiresAt: number; used: boolean };
export type Pending = {
  id: string;
  target: string;
  identity: Identity;
  clientId: string;
  clientSecret: string | null;
  refreshToken: string | null;
  scopes: string[];
  verifiedAt: string;
  expiresAt: number;
};
type Result = { kind: "ok" | "denied" | "state_invalid" | "expired" | "replay" | "session_mismatch" | "error"; message: string; pendingId: string | null; at: number };

const txs = new Map<string, Tx>();
const pendings = new Map<string, Pending>();
const results = new Map<string, Result>();

const b64url = (b: Buffer) => b.toString("base64url");
const sha = (s: string) => createHash("sha256").update(s).digest();
const purge = () => {
  const t = Date.now();
  for (const [k, v] of txs) if (v.expiresAt < t - 60_000) txs.delete(k);
  for (const [k, v] of pendings) if (v.expiresAt < t) pendings.delete(k);
  for (const [k, v] of results) if (v.at < t - PENDING_TTL_MS) results.delete(k);
};

export const redirectUriFor = (port: number) => `http://127.0.0.1:${port}/`;

export const startOAuth = async (req: IncomingMessage, res: ServerResponse, targetKey: string, port: number) => {
  purge();
  // The callback lands on 127.0.0.1, so the binding cookie must be set on 127.0.0.1 too.
  if (req.headers.origin !== `http://127.0.0.1:${port}`) throw new HttpError(400, `Mở Studio bằng http://127.0.0.1:${port} (không dùng localhost) rồi bấm Kết nối lại: Google sẽ chuyển về đúng địa chỉ này.`);
  const t = readTargets()[targetKey];
  if (!t || t.platform !== "youtube") throw new HttpError(400, "Tài khoản đích không phải YouTube.");
  if ([...txs.values()].filter((x) => !x.used && x.expiresAt > Date.now()).length >= 5) throw new HttpError(429, "Có quá nhiều phiên đăng nhập đang mở. Đợi vài phút rồi thử lại.");
  const { clientId } = await youtubeClientCredentials(); // also proves the store can be read
  const state = b64url(randomBytes(32));
  const verifier = b64url(randomBytes(48)); // 64 chars from [A-Za-z0-9-_]
  const cookie = b64url(randomBytes(24));
  const redirectUri = redirectUriFor(port);
  txs.set(state, { state, cookieHash: sha(cookie).toString("hex"), verifier, target: targetKey, clientId, redirectUri, expiresAt: Date.now() + TX_TTL_MS, used: false });
  const q = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: YOUTUBE_SCOPES.join(" "),
    state,
    code_challenge: b64url(sha(verifier)),
    code_challenge_method: "S256",
    access_type: "offline",
    prompt: "consent select_account",
  });
  res.setHeader("Set-Cookie", `${COOKIE}=${cookie}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.max(1, Math.round(TX_TTL_MS / 1000))}`);
  return { authUrl: `${authUrlBase()}?${q}`, scopes: YOUTUBE_SCOPES, redirectUri, expiresAt: new Date(Date.now() + TX_TTL_MS).toISOString() };
};

const cookieValue = (req: IncomingMessage) => {
  const m = (req.headers.cookie ?? "").split(/;\s*/).find((c) => c.startsWith(`${COOKIE}=`));
  return m ? m.slice(COOKIE.length + 1) : null;
};

const finish = (res: ServerResponse, r: Omit<Result, "at">) => {
  const id = b64url(randomBytes(12));
  results.set(id, { ...r, at: Date.now() });
  res.writeHead(303, { ...SECURITY_HEADERS, Location: `/#/cau-hinh/ket-noi?r=${id}`, "Cache-Control": "no-store", "Set-Cookie": `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0` });
  res.end();
};

export const isOAuthCallback = (url: URL) => url.pathname === "/" && (url.searchParams.has("state") || url.searchParams.has("code") || url.searchParams.has("error"));

export const handleOAuthCallback = async (req: IncomingMessage, res: ServerResponse, url: URL) => {
  purge();
  const state = url.searchParams.get("state") ?? "";
  const tx = txs.get(state);
  if (!tx) return finish(res, { kind: "state_invalid", message: "Phiên đăng nhập không hợp lệ hoặc không do Studio này tạo. Bấm Kết nối YouTube để bắt đầu lại.", pendingId: null });
  if (tx.used) return finish(res, { kind: "replay", message: "Phiên đăng nhập này đã được dùng. Bấm Kết nối YouTube để bắt đầu lại.", pendingId: null });
  tx.used = true; // one-time, consumed before anything else
  if (tx.expiresAt < Date.now()) return finish(res, { kind: "expired", message: "Phiên đăng nhập đã hết hạn (10 phút). Bấm Kết nối YouTube để bắt đầu lại.", pendingId: null });
  const c = cookieValue(req);
  if (!c || !timingSafeEqual(Buffer.from(sha(c).toString("hex")), Buffer.from(tx.cookieHash)))
    return finish(res, { kind: "session_mismatch", message: "Phiên đăng nhập không khớp trình duyệt đã bấm Kết nối. Hãy bấm Kết nối YouTube trên cùng trình duyệt.", pendingId: null });
  const err = url.searchParams.get("error");
  if (err)
    return finish(res, {
      kind: err === "access_denied" ? "denied" : "error",
      message: err === "access_denied" ? "Bạn đã huỷ hoặc từ chối cấp quyền trên Google. Kết nối cũ (nếu có) vẫn giữ nguyên." : `Google báo lỗi: ${scrub(err).slice(0, 60)}. Kết nối cũ (nếu có) vẫn giữ nguyên.`,
      pendingId: null,
    });
  const code = url.searchParams.get("code");
  if (!code) return finish(res, { kind: "error", message: "Google không trả mã xác thực.", pendingId: null });
  try {
    const client = await youtubeClientCredentials();
    if (client.clientId !== tx.clientId) throw new PlatformError("platform_error", "OAuth client đã đổi trong lúc đăng nhập. Bắt đầu lại.");
    const tokens = await googleExchangeCode({ clientId: tx.clientId, clientSecret: client.clientSecret, code, verifier: tx.verifier, redirectUri: tx.redirectUri });
    if (tokens.scopes.length && !tokens.scopes.includes(SCOPE_READONLY))
      return finish(res, { kind: "error", message: "Bạn chưa cấp quyền xem kênh YouTube (youtube.readonly) nên Studio không xác minh được kênh. Kết nối lại và đánh dấu quyền này.", pendingId: null });
    const identity = await youtubeMyChannel(tokens.accessToken);
    const p: Pending = {
      id: b64url(randomBytes(12)),
      target: tx.target,
      identity,
      clientId: tx.clientId,
      clientSecret: client.clientSecret,
      refreshToken: tokens.refreshToken,
      scopes: tokens.scopes.length ? tokens.scopes : YOUTUBE_SCOPES,
      verifiedAt: new Date().toISOString(),
      expiresAt: Date.now() + PENDING_TTL_MS,
    };
    pendings.set(p.id, p);
    return finish(res, { kind: "ok", message: `Google đã cấp quyền. Xác nhận kênh ${identity.name} để dùng.`, pendingId: p.id });
  } catch (e) {
    const msg = e instanceof PlatformError ? e.message : scrub((e as Error).message);
    return finish(res, { kind: "error", message: `${msg} Kết nối cũ (nếu có) vẫn giữ nguyên.`, pendingId: null });
  }
};

export const oauthResult = (id: string) => {
  purge();
  const r = results.get(id);
  if (!r) throw new HttpError(404, "Kết quả đăng nhập không còn (đã quá hạn hoặc Studio vừa khởi động lại).");
  return { kind: r.kind, message: r.message, pending: r.pendingId ? pendingView(r.pendingId) : null };
};

/** What the user confirms. No token values. */
export const pendingView = (id: string) => {
  purge();
  const p = pendings.get(id);
  if (!p) return null;
  const m = readMeta();
  const cfg = readTargets()[p.target];
  const cur = m.targets[p.target]?.active ? m.connections[m.targets[p.target].active!] : null;
  const same = Boolean(cur && !cur.removedAt && cur.identity?.id === p.identity.id && cur.oauthClientId === p.clientId);
  return {
    id: p.id,
    target: p.target,
    identity: p.identity,
    scopes: p.scopes,
    hasUploadScope: p.scopes.includes("https://www.googleapis.com/auth/youtube.upload"),
    refreshTokenReturned: Boolean(p.refreshToken),
    canKeepOldRefresh: !p.refreshToken && same,
    replaces: cur && !cur.removedAt ? { name: cur.identity?.name ?? "?", id: cur.identity?.id ?? "?", sameAccount: same } : null,
    configuredChannelId: cfg?.channelId ?? null,
    channelMismatch: Boolean(cfg?.channelId && cfg.channelId !== p.identity.id),
    expiresAt: new Date(p.expiresAt).toISOString(),
  };
};

export const confirmPending = async (id: string, expectedRev: number, acceptMismatch: boolean) => {
  purge();
  const p = pendings.get(id);
  if (!p) throw new HttpError(410, "Kết nối chờ xác nhận đã hết hạn hoặc không còn. Kết nối lại.");
  const v = pendingView(id)!;
  if (v.channelMismatch && !acceptMismatch) throw new HttpError(409, `Kênh vừa đăng nhập (${p.identity.id}) khác channelId trong config/publishing.json (${v.configuredChannelId}). Xác nhận rõ nếu vẫn muốn dùng kênh này.`);
  if (confirming.has(id)) throw new HttpError(409, "Đang xác nhận kết nối này.");
  confirming.add(id);
  try {
    const r = await activateYoutube(p.target, { identity: p.identity, clientId: p.clientId, clientSecret: p.clientSecret, refreshToken: p.refreshToken, scopes: p.scopes, verifiedAt: p.verifiedAt }, expectedRev);
    pendings.delete(id); // single use
    return r;
  } finally {
    confirming.delete(id);
  }
};
const confirming = new Set<string>();

export const cancelPending = (id: string) => ({ cancelled: pendings.delete(id) });
