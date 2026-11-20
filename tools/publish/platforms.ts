// Read-only platform calls used to VERIFY connections (no upload, no posting,
// no schedule changes). Endpoints are fixed here; nothing is taken from a
// client JSON file or from the browser.
//
// Sources (read 2026-11-12):
//  - Google OAuth 2.0 for Desktop Apps: developers.google.com/identity/protocols/oauth2/native-app
//    (Desktop app client, loopback redirect http://127.0.0.1:port, PKCE S256,
//    token endpoint oauth2.googleapis.com/token, revoke oauth2.googleapis.com/revoke)
//  - YouTube Data API v3 channels.list (mine=true)
//  - Meta Graph API v27.0 (latest per the Graph API changelog), error codes per
//    "Handle Errors"; debug_token needs an APP token (not available here).

export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
export const YOUTUBE_API = "https://www.googleapis.com/youtube/v3";
export const GRAPH_VERSION = "v27.0";
export const GRAPH_API = `https://graph.facebook.com/${GRAPH_VERSION}`;

export const SCOPE_READONLY = "https://www.googleapis.com/auth/youtube.readonly";
export const SCOPE_UPLOAD = "https://www.googleapis.com/auth/youtube.upload";
/** Minimum for this release: read the channel to verify identity. No upload scope. */
export const YOUTUBE_SCOPES = [SCOPE_READONLY];

const TIMEOUT_MS = 20_000;

/**
 * Test-only redirect of the FIXED endpoints to a local mock server. Requires
 * STUDIO_TEST=1 and a loopback base URL; ignored otherwise.
 */
const testBase = () => {
  const b = process.env.STUDIO_SOCIAL_MOCK_BASE;
  return process.env.STUDIO_TEST === "1" && b && /^http:\/\/127\.0\.0\.1:\d+$/.test(b) ? b : null;
};
const ep = (url: string) => {
  const b = testBase();
  if (!b) return url;
  const u = new URL(url);
  return `${b}/${u.hostname}${u.pathname}`;
};
export const authUrlBase = () => ep(GOOGLE_AUTH_URL);

// ---- Error model --------------------------------------------------------------

export type CheckOutcome = "verified" | "auth_invalid" | "missing_permission" | "wrong_account" | "not_found" | "network" | "rate_limited" | "platform_error" | "no_channel";

export class PlatformError extends Error {
  outcome: CheckOutcome;
  constructor(outcome: CheckOutcome, message: string) {
    super(scrub(message));
    this.outcome = outcome;
  }
}

/** Removes anything that looks like a token or secret from a message. */
export const scrub = (s: string) =>
  s
    .replace(/ya29\.[\w.-]+/g, "<token>")
    .replace(/1\/\/[\w.-]+/g, "<token>")
    .replace(/GOCSPX-[\w-]+/g, "<secret>")
    .replace(/EAA[A-Za-z0-9]{20,}/g, "<token>")
    .replace(/(access_token|refresh_token|client_secret|code|token)=([^&\s"]+)/gi, "$1=<redacted>")
    .replace(/[A-Za-z0-9_\-.~+/]{60,}/g, "<redacted>");

type Http = { status: number; json: Record<string, unknown> | null };

const request = async (url: string, init: RequestInit): Promise<Http> => {
  let r: Response;
  try {
    r = await fetch(ep(url), { ...init, redirect: "error", signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (e) {
    const name = (e as Error).name;
    throw new PlatformError("network", name === "TimeoutError" ? "Hết thời gian chờ nền tảng phản hồi." : "Không kết nối được tới nền tảng (lỗi mạng).");
  }
  const text = await r.text().catch(() => "");
  let json: Record<string, unknown> | null = null;
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : null;
  } catch {
    json = null;
  }
  return { status: r.status, json };
};

const form = (o: Record<string, string>) => ({
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
  body: new URLSearchParams(o).toString(),
});

// ---- Google / YouTube ---------------------------------------------------------

export type GoogleTokens = { accessToken: string; refreshToken: string | null; scopes: string[]; refreshTokenExpiresIn: number | null };

const googleTokenError = (h: Http): PlatformError => {
  const err = String(h.json?.error ?? "");
  if (h.status === 429) return new PlatformError("rate_limited", "Google đang giới hạn tốc độ. Thử lại sau.");
  if (h.status >= 500) return new PlatformError("platform_error", `Google trả lỗi ${h.status}. Thử lại sau.`);
  if (err === "invalid_grant") return new PlatformError("auth_invalid", "Google từ chối quyền đã cấp (invalid_grant): token bị thu hồi, hết hạn (ví dụ app ở chế độ Testing hết 7 ngày) hoặc đổi mật khẩu. Cần kết nối lại.");
  if (err === "invalid_client" || err === "unauthorized_client") return new PlatformError("auth_invalid", "Google không nhận OAuth client (client ID/secret sai, client đã bị xoá hoặc không phải loại Desktop app).");
  return new PlatformError("platform_error", `Google từ chối yêu cầu token (${err || h.status}).`);
};

const parseTokens = (h: Http): GoogleTokens => {
  const j = h.json ?? {};
  if (typeof j.access_token !== "string") throw new PlatformError("platform_error", "Google không trả access token.");
  return {
    accessToken: j.access_token,
    refreshToken: typeof j.refresh_token === "string" && j.refresh_token ? j.refresh_token : null,
    scopes: typeof j.scope === "string" ? j.scope.split(/\s+/).filter(Boolean) : [],
    refreshTokenExpiresIn: typeof j.refresh_token_expires_in === "number" ? j.refresh_token_expires_in : null,
  };
};

export const googleExchangeCode = async (p: { clientId: string; clientSecret: string | null; code: string; verifier: string; redirectUri: string }) => {
  const body: Record<string, string> = { client_id: p.clientId, code: p.code, code_verifier: p.verifier, grant_type: "authorization_code", redirect_uri: p.redirectUri };
  if (p.clientSecret) body.client_secret = p.clientSecret;
  const h = await request(GOOGLE_TOKEN_URL, form(body));
  if (h.status !== 200) throw googleTokenError(h);
  return parseTokens(h);
};

export const googleRefresh = async (p: { clientId: string; clientSecret: string | null; refreshToken: string }) => {
  const body: Record<string, string> = { client_id: p.clientId, refresh_token: p.refreshToken, grant_type: "refresh_token" };
  if (p.clientSecret) body.client_secret = p.clientSecret;
  const h = await request(GOOGLE_TOKEN_URL, form(body));
  if (h.status !== 200) throw googleTokenError(h);
  return parseTokens(h);
};

/** Token goes in the POST body (never in a URL). */
export const googleRevoke = async (token: string) => {
  const h = await request(GOOGLE_REVOKE_URL, form({ token }));
  if (h.status === 200) return;
  if (h.status === 400) throw new PlatformError("auth_invalid", "Google báo token không còn hiệu lực (có thể đã bị thu hồi trước đó).");
  throw new PlatformError(h.status >= 500 ? "platform_error" : "platform_error", `Google trả lỗi ${h.status} khi thu hồi.`);
};

export type Identity = { id: string; name: string; handle: string | null; avatarUrl: string | null; url: string | null };

export const youtubeMyChannel = async (accessToken: string): Promise<Identity> => {
  const h = await request(`${YOUTUBE_API}/channels?part=id,snippet&mine=true&maxResults=5`, { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } });
  if (h.status === 401) throw new PlatformError("auth_invalid", "Google từ chối access token. Cần kết nối lại.");
  if (h.status === 403) {
    const reason = String(((h.json?.error as { errors?: { reason?: string }[] })?.errors ?? [])[0]?.reason ?? "");
    if (/quota/i.test(reason)) throw new PlatformError("rate_limited", "Hết hạn mức YouTube Data API hôm nay. Thử lại sau khi hạn mức đặt lại.");
    if (reason === "accessNotConfigured") throw new PlatformError("missing_permission", "Project Google Cloud chưa bật YouTube Data API v3.");
    throw new PlatformError("missing_permission", `YouTube từ chối đọc kênh (${reason || "403"}): thiếu quyền youtube.readonly?`);
  }
  if (h.status === 429) throw new PlatformError("rate_limited", "YouTube đang giới hạn tốc độ. Thử lại sau.");
  if (h.status !== 200) throw new PlatformError("platform_error", `YouTube trả lỗi ${h.status}.`);
  const items = (h.json?.items as { id: string; snippet?: { title?: string; customUrl?: string; thumbnails?: Record<string, { url?: string }> } }[]) ?? [];
  if (!items.length) throw new PlatformError("no_channel", "Tài khoản Google đã cấp quyền nhưng không có kênh YouTube (hoặc chưa chọn đúng kênh/Brand Account khi đăng nhập).");
  if (items.length > 1) throw new PlatformError("platform_error", "Google trả về nhiều kênh: Studio không tự chọn. Đăng nhập lại và chọn đúng một kênh.");
  const c = items[0];
  const th = c.snippet?.thumbnails ?? {};
  const avatar = th.default?.url ?? th.medium?.url ?? null;
  return {
    id: c.id,
    name: c.snippet?.title ?? "(không tên)",
    handle: c.snippet?.customUrl ?? null,
    avatarUrl: avatar && /^https:\/\//.test(avatar) ? avatar : null,
    url: `https://www.youtube.com/channel/${encodeURIComponent(c.id)}`,
  };
};

// ---- Meta Graph (Facebook Page) -----------------------------------------------

const graphError = (h: Http): PlatformError => {
  const e = (h.json?.error ?? {}) as { code?: number; error_subcode?: number; message?: string; type?: string };
  const code = Number(e.code ?? 0);
  const sub = Number(e.error_subcode ?? 0);
  if (h.status === 429 || [4, 17, 32, 341, 613].includes(code)) return new PlatformError("rate_limited", "Meta đang giới hạn số lần gọi API. Thử lại sau.");
  if (code === 190 || code === 102 || [458, 460, 463, 467].includes(sub)) {
    const why = sub === 463 ? "token đã hết hạn" : sub === 460 ? "mật khẩu tài khoản đã đổi" : sub === 467 || sub === 0 ? "token không hợp lệ, bị thu hồi hoặc hết hạn" : "phiên không còn hiệu lực";
    return new PlatformError("auth_invalid", `Meta từ chối Page Access Token: ${why}. Tạo token mới rồi thay thế.`);
  }
  if (sub === 492) return new PlatformError("missing_permission", "Người tạo token không còn vai trò phù hợp trên Page.");
  if (code === 10 || (code >= 200 && code <= 299) || code === 3) return new PlatformError("missing_permission", "Token thiếu quyền cho thao tác đọc này.");
  if (code === 100) return new PlatformError("not_found", "Meta báo không tìm thấy đối tượng hoặc trường không hợp lệ.");
  if (h.status >= 500 || code === 1 || code === 2) return new PlatformError("platform_error", "Meta đang gặp lỗi tạm thời. Thử lại sau.");
  return new PlatformError("platform_error", `Meta trả lỗi (mã ${code || h.status}).`);
};

/**
 * Who does this token act as? With a Page access token, /me is the Page.
 * Token goes in the Authorization header, never in the URL.
 */
export const facebookWhoAmI = async (token: string): Promise<Identity & { isPage: boolean }> => {
  const h = await request(`${GRAPH_API}/me?fields=id,name,link,picture%7Burl%7D,category`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
  if (h.status !== 200) throw graphError(h);
  const j = h.json ?? {};
  const pic = ((j.picture as { data?: { url?: string } })?.data?.url ?? null) as string | null;
  const id = String(j.id ?? "");
  if (!id) throw new PlatformError("platform_error", "Meta không trả ID.");
  return {
    id,
    name: String(j.name ?? "(không tên)"),
    handle: null,
    avatarUrl: pic && /^https:\/\//.test(pic) ? pic : null,
    url: `https://www.facebook.com/${encodeURIComponent(id)}`,
    // Pages have a category; user profiles do not.
    isPage: typeof j.category === "string",
  };
};
