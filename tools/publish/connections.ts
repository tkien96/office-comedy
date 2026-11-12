import { createHash, randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { withFileLockSync, writeFileAtomic } from "../episode/fsutil.ts";
import { episodePaths } from "../episode/paths.ts";
import { ConflictError, listEpisodeIds, ValidationError } from "../episode/service.ts";
import { deleteSecret, getSecret, getSecretSync, hasSecret, putSecret, SECRETS_DIR, SecretStoreError, type SecretBundle } from "../secrets/dpapi.ts";
import { facebookWhoAmI, googleRefresh, PlatformError, SCOPE_READONLY, SCOPE_UPLOAD, scrub, youtubeMyChannel, type CheckOutcome, type Identity } from "./platforms.ts";
import { readJobs } from "./jobs.ts";

// Social connections: ONE shared service for Office Comedy Studio and the CLI.
//
// Two stores, kept apart:
//   A. Metadata (no secrets): runtime/connections/connections.json
//      account IDs, display names, check results, which source is active.
//   B. Secrets: runtime/connections/secrets.dpapi.json (Windows DPAPI, see
//      tools/secrets/dpapi.ts). Metadata only holds the entry id (secretRef).
//
// Effective source per target (never mixed):
//   - "studio": the target has an active Studio connection. ALL credentials
//     come from the DPAPI store (client ID/secret + refresh token as one bundle).
//   - "env":    no Studio connection, every variable named in
//     config/publishing.json → credentialEnv is set, and env use was not turned
//     off. ALL credentials come from the environment (.env). This is the
//     behaviour before Studio connections existed.
//   - "none":   neither. Removing a Studio connection while .env variables
//     exist sets env mode "off": Studio says so and never falls back silently.
//   - TikTok: "manual" (username/profile URL only, no token, no API).
//
// "Verified" means a read-only call proved WHO the credentials act as. It
// never means "allowed to post".

export type Platform = "youtube" | "facebook" | "tiktok";
export type ConnStatus = "not_configured" | "saved_unverified" | "verified" | "reconnect_needed" | "missing_permission" | "check_failed" | "manual";
export type Capability = { key: string; label: string; state: "yes" | "no" | "unknown"; note: string };
export type LastCheck = { at: string; outcome: CheckOutcome; message: string; capabilities: Capability[]; identity: Identity | null };

export type Connection = {
  id: string;
  target: string;
  platform: Platform;
  origin: "oauth" | "manual" | "env-import";
  createdAt: string;
  updatedAt: string;
  secretRef: string | null;
  secretUpdatedAt: string | null;
  /** Identity proven by the last SUCCESSFUL check. */
  identity: Identity | null;
  /** Facebook: Page ID the user entered (must match the token's Page). */
  expectedId: string | null;
  /** YouTube: OAuth client the refresh token belongs to (never mixed with another client). */
  oauthClientId: string | null;
  scopes: string[];
  lastCheck: LastCheck | null;
  removedAt: string | null;
  removedReason: string | null;
};

type EnvCheck = { fingerprint: string; lastCheck: LastCheck; identity: Identity | null };
type TargetState = {
  active: string | null;
  draft: string | null;
  env: "auto" | "off" | "use";
  envCheck: EnvCheck | null;
  tiktok: { username: string; profileUrl: string; savedAt: string } | null;
};
export type YoutubeClient = { clientId: string; secretRef: string | null; projectId: string | null; savedAt: string; via: "json" | "form" | "env-import" };
export type Meta = { version: 1; rev: number; updatedAt: string | null; youtubeClient: YoutubeClient | null; targets: Record<string, TargetState>; connections: Record<string, Connection> };

export const META_FILE = join(SECRETS_DIR, "connections.json");
const LOCK = join(SECRETS_DIR, ".connections.lock");

type PubTarget = { platform: Platform; label: string; credentialEnv: string[]; channelId?: string | null; pageId?: string | null; username?: string | null };
export const readTargets = (): Record<string, PubTarget> => (JSON.parse(readFileSync("config/publishing.json", "utf8")) as { targets: Record<string, PubTarget> }).targets;

const isEnvName = (s: string) => /^[A-Z][A-Z0-9_]{1,63}$/.test(s);
const now = () => new Date().toISOString();
const newId = (p: Platform) => `${p === "youtube" ? "yt" : p === "facebook" ? "fb" : "tt"}-${randomBytes(5).toString("hex")}`;

const emptyTarget = (): TargetState => ({ active: null, draft: null, env: "auto", envCheck: null, tiktok: null });

export const readMeta = (): Meta => {
  const m: Meta = existsSync(META_FILE) ? (JSON.parse(readFileSync(META_FILE, "utf8")) as Meta) : { version: 1, rev: 0, updatedAt: null, youtubeClient: null, targets: {}, connections: {} };
  for (const k of Object.keys(readTargets())) m.targets[k] = { ...emptyTarget(), ...(m.targets[k] ?? {}) };
  return m;
};

/**
 * Read-modify-write under the lock. `expectedRev` (from the page the user is
 * looking at) protects against two tabs overwriting each other.
 */
export const mutate = <T>(expectedRev: number | undefined, fn: (m: Meta) => T): { result: T; rev: number } =>
  withFileLockSync(LOCK, "studio", "cấu hình kết nối", () => {
    const m = readMeta();
    if (expectedRev !== undefined && m.rev !== expectedRev)
      throw new ConflictError("Cấu hình kết nối vừa được thay đổi ở nơi khác (tab hoặc cửa sổ khác). Tải lại trang để xem bản mới rồi thao tác lại.");
    const result = fn(m);
    m.rev += 1;
    m.updatedAt = now();
    writeFileAtomic(META_FILE, JSON.stringify(m, null, 2) + "\n");
    return { result, rev: m.rev };
  });

const target = (m: Meta, key: string, platform?: Platform) => {
  const t = readTargets()[key];
  if (!t) throw new ValidationError(`Không có tài khoản đích "${key}" trong config/publishing.json.`);
  if (platform && t.platform !== platform) throw new ValidationError(`"${key}" không phải tài khoản ${platform}.`);
  return { cfg: t, state: m.targets[key] };
};

// ---- Environment (.env) source ------------------------------------------------

const ENV_FIELDS: Record<Platform, string[]> = { youtube: ["clientId", "clientSecret", "refreshToken"], facebook: ["pageToken"], tiktok: [] };

/** Names only (+ presence). Values never leave this function except through envCredentials(). */
export const envInfo = (t: PubTarget) => {
  const names = t.credentialEnv ?? [];
  const bad = names.filter((n) => !isEnvName(n)).length;
  const valid = names.filter(isEnvName);
  const fields = ENV_FIELDS[t.platform];
  const usableShape = !bad && valid.length === fields.length && fields.length > 0;
  const present = valid.map((n) => ({ name: n, present: Boolean(process.env[n]) }));
  return { names: valid, badEntries: bad, present, complete: usableShape && present.every((p) => p.present), any: present.some((p) => p.present) };
};

const envCredentials = (t: PubTarget): SecretBundle => {
  const fields = ENV_FIELDS[t.platform];
  return Object.fromEntries(fields.map((f, i) => [f, process.env[t.credentialEnv[i]] ?? ""]));
};

const fingerprint = (b: SecretBundle) => createHash("sha256").update(JSON.stringify(Object.entries(b).sort())).digest("hex").slice(0, 16);

// ---- Effective source + status -------------------------------------------------

export type Source = "studio" | "env" | "none" | "manual";

export const effectiveSource = (m: Meta, key: string): Source => {
  const { cfg, state } = target(m, key);
  if (cfg.platform === "tiktok") return "manual";
  if (state.active && m.connections[state.active] && !m.connections[state.active].removedAt) return "studio";
  if (state.env !== "off" && envInfo(cfg).complete) return "env";
  return "none";
};

const statusOf = (check: LastCheck | null, changedAt: string | null): ConnStatus => {
  if (!check || (changedAt && check.at < changedAt)) return "saved_unverified";
  switch (check.outcome) {
    case "verified":
      return "verified";
    case "auth_invalid":
    case "no_channel":
    case "wrong_account":
    case "not_found":
      return "reconnect_needed";
    case "missing_permission":
      return "missing_permission";
    default:
      return "check_failed";
  }
};

const capabilities = (platform: Platform, identityOk: boolean, scopes: string[] | null): Capability[] => {
  if (platform === "youtube")
    return [
      { key: "read", label: "Đọc thông tin kênh", state: identityOk ? "yes" : "unknown", note: identityOk ? "Đã đọc được kênh bằng quyền youtube.readonly." : "Chưa xác minh." },
      {
        key: "upload",
        label: "Upload video",
        state: scopes?.includes(SCOPE_UPLOAD) ? "yes" : scopes ? "no" : "unknown",
        note: scopes?.includes(SCOPE_UPLOAD) ? "Token có quyền youtube.upload (Studio chưa có chức năng upload)." : "Chưa xin quyền upload (bản này chỉ xin youtube.readonly). Chưa đủ điều kiện đăng.",
      },
      { key: "schedule", label: "Đăng / hẹn giờ", state: "no", note: "Studio chưa triển khai upload hay hẹn giờ." },
    ];
  if (platform === "facebook")
    return [
      { key: "read", label: "Đọc thông tin Page", state: identityOk ? "yes" : "unknown", note: identityOk ? "Token đọc được Page." : "Chưa xác minh." },
      {
        key: "publish",
        label: "Đăng Reels / bài ảnh",
        state: "unknown",
        note: "Chưa xác minh quyền đăng. Kiểm tra quyền chính thức (debug_token) cần App token của ứng dụng Meta; Studio chưa có thông tin này. Đọc được tên Page không chứng minh có quyền đăng.",
      },
      { key: "schedule", label: "Đăng / hẹn giờ", state: "no", note: "Studio chưa triển khai đăng hay hẹn giờ." },
    ];
  return [
    { key: "api", label: "Đăng qua API", state: "no", note: "Không dùng API TikTok (xem docs/publishing-platforms.md)." },
    { key: "manual", label: "Đăng thủ công", state: "yes", note: "Dùng bộ delivery và app TikTok." },
  ];
};

// ---- Jobs that point at a target / connection ----------------------------------

const jobRefs = () => {
  const out: { episode: string; job: string; target: string; state: string; mode: string; account: { connectionId: string; platformAccountId: string; name: string } | null; remoteUrl: string | null }[] = [];
  for (const id of listEpisodeIds()) {
    try {
      for (const j of readJobs(episodePaths(id)).jobs)
        out.push({ episode: id, job: j.id, target: j.target, state: j.state, mode: j.mode, account: j.account ?? null, remoteUrl: j.remote.url });
    } catch {
      /* unreadable jobs file: reported elsewhere */
    }
  }
  return out;
};

// ---- Public view (browser-safe: NO secret values) -------------------------------

const connView = (c: Connection | null, platform: Platform) =>
  c
    ? {
        id: c.id,
        origin: c.origin,
        createdAt: c.createdAt,
        secretStored: hasSecret(c.secretRef),
        secretUpdatedAt: c.secretUpdatedAt,
        identity: c.identity,
        expectedId: c.expectedId,
        oauthClientId: c.oauthClientId,
        scopes: c.scopes,
        lastCheck: c.lastCheck,
        status: statusOf(c.lastCheck, c.secretUpdatedAt),
        capabilities: c.lastCheck?.capabilities ?? capabilities(platform, false, platform === "youtube" ? (c.scopes.length ? c.scopes : null) : null),
      }
    : null;

export const connectionsView = () => {
  const m = readMeta();
  const targets = readTargets();
  const jobs = jobRefs();
  return {
    rev: m.rev,
    youtubeClient: m.youtubeClient
      ? { clientId: m.youtubeClient.clientId, projectId: m.youtubeClient.projectId, secretStored: hasSecret(m.youtubeClient.secretRef), savedAt: m.youtubeClient.savedAt, via: m.youtubeClient.via }
      : null,
    targets: Object.entries(targets).map(([key, cfg]) => {
      const st = m.targets[key];
      const source = effectiveSource(m, key);
      const active = st.active ? m.connections[st.active] ?? null : null;
      const draft = st.draft ? m.connections[st.draft] ?? null : null;
      const env = envInfo(cfg);
      const envFp = env.complete ? fingerprint(envCredentials(cfg)) : null;
      const envCheck = st.envCheck && st.envCheck.fingerprint === envFp ? st.envCheck : null;
      let status: ConnStatus;
      let identity: Identity | null = null;
      let lastCheck: LastCheck | null = null;
      let caps: Capability[];
      if (cfg.platform === "tiktok") {
        status = st.tiktok ? "manual" : "not_configured";
        caps = capabilities("tiktok", false, null);
      } else if (source === "studio" && active) {
        status = statusOf(active.lastCheck, active.secretUpdatedAt);
        identity = active.identity;
        lastCheck = active.lastCheck;
        caps = connView(active, cfg.platform)!.capabilities;
      } else if (source === "env") {
        status = statusOf(envCheck?.lastCheck ?? null, null);
        identity = envCheck?.identity ?? null;
        lastCheck = envCheck?.lastCheck ?? null;
        caps = lastCheck?.capabilities ?? capabilities(cfg.platform, false, null);
      } else {
        status = "not_configured";
        caps = capabilities(cfg.platform, false, null);
      }
      const activeConnId = source === "studio" ? st.active : source === "env" ? `env:${key}` : null;
      const myJobs = jobs.filter((j) => j.target === key);
      const expected = cfg.platform === "youtube" ? cfg.channelId ?? null : cfg.platform === "facebook" ? cfg.pageId ?? null : cfg.username ?? null;
      return {
        key,
        platform: cfg.platform,
        label: cfg.label,
        source,
        status,
        identity,
        lastCheck,
        capabilities: caps,
        active: connView(active, cfg.platform),
        draft: connView(draft, cfg.platform),
        tiktok: st.tiktok,
        env: { names: env.names, present: env.present, badEntries: env.badEntries, complete: env.complete, mode: st.env, suppressed: st.env === "off" && env.complete, checked: Boolean(envCheck) },
        configuredExpectedId: expected,
        expectedMismatch: Boolean(expected && identity && cfg.platform !== "tiktok" && expected !== identity.id),
        clientMismatch: Boolean(cfg.platform === "youtube" && source === "studio" && active?.oauthClientId && m.youtubeClient && active.oauthClientId !== m.youtubeClient.clientId),
        jobs: {
          total: myJobs.length,
          unbound: myJobs.filter((j) => j.mode === "api" && !j.account && !["published", "cancelled"].includes(j.state)).map((j) => j.job),
          boundElsewhere: myJobs
            .filter((j) => j.account && activeConnId && identity && j.account.platformAccountId !== identity.id)
            .map((j) => ({ job: j.job, account: j.account!.name, accountId: j.account!.platformAccountId })),
          boundToRemoved: myJobs.filter((j) => j.account && m.connections[j.account.connectionId]?.removedAt).map((j) => j.job),
        },
      };
    }),
  };
};

// ---- Credentials for checks / future uploaders ----------------------------------

export type ResolvedCreds = { source: "studio" | "env"; connectionId: string; bundle: SecretBundle; secretRef: string | null; envFingerprint: string | null };

export const resolveCredentials = async (key: string, opts: { draft?: boolean } = {}): Promise<ResolvedCreds> => {
  const m = readMeta();
  const { cfg, state } = target(m, key);
  if (opts.draft) {
    const d = state.draft ? m.connections[state.draft] : null;
    if (!d?.secretRef) throw new ValidationError("Không có bản cấu hình mới đang chờ kiểm tra.");
    return { source: "studio", connectionId: d.id, bundle: await getSecret(d.secretRef), secretRef: d.secretRef, envFingerprint: null };
  }
  const src = effectiveSource(m, key);
  if (src === "studio") {
    const c = m.connections[state.active!];
    if (!c.secretRef) throw new SecretStoreError("Kết nối không còn bí mật đã lưu. Hãy kết nối lại.");
    return { source: "studio", connectionId: c.id, bundle: await getSecret(c.secretRef), secretRef: c.secretRef, envFingerprint: null };
  }
  if (src === "env") {
    const b = envCredentials(cfg);
    return { source: "env", connectionId: `env:${key}`, bundle: b, secretRef: null, envFingerprint: fingerprint(b) };
  }
  throw new ValidationError(state.env === "off" && envInfo(cfg).complete ? "Đã gỡ kết nối khỏi Studio; biến môi trường còn nhưng đang tắt. Bật lại hoặc kết nối mới." : "Chưa cấu hình tài khoản này.");
};

// ---- Live checks (read-only calls) ----------------------------------------------

const inflight = new Set<string>();

const runCheck = async (platform: Platform, b: SecretBundle, expectedId: string | null, knownIdentity: Identity | null): Promise<{ check: LastCheck; scopes: string[] | null }> => {
  const at = now();
  try {
    if (platform === "youtube") {
      const tok = await googleRefresh({ clientId: b.clientId, clientSecret: b.clientSecret || null, refreshToken: b.refreshToken });
      if (tok.scopes.length && !tok.scopes.includes(SCOPE_READONLY) && !tok.scopes.includes("https://www.googleapis.com/auth/youtube"))
        return {
          scopes: tok.scopes,
          check: { at, outcome: "missing_permission", message: "Token không có quyền đọc kênh (youtube.readonly). Kết nối lại và cấp đủ quyền.", capabilities: capabilities("youtube", false, tok.scopes), identity: null },
        };
      const id = await youtubeMyChannel(tok.accessToken);
      if (knownIdentity && knownIdentity.id !== id.id)
        return {
          scopes: tok.scopes,
          check: { at, outcome: "wrong_account", message: `Token hiện thuộc kênh khác (${id.name}, ${id.id}) so với kênh đã xác minh (${knownIdentity.id}). Cần kết nối lại.`, capabilities: capabilities("youtube", false, tok.scopes), identity: id },
        };
      return { scopes: tok.scopes, check: { at, outcome: "verified", message: `Đã xác minh kênh ${id.name}.`, capabilities: capabilities("youtube", true, tok.scopes.length ? tok.scopes : null), identity: id } };
    }
    const who = await facebookWhoAmI(b.pageToken);
    if (!who.isPage)
      return { scopes: null, check: { at, outcome: "wrong_account", message: `Token này thuộc tài khoản người dùng (${who.name}), không phải Page Access Token.`, capabilities: capabilities("facebook", false, null), identity: null } };
    if (expectedId && who.id !== expectedId)
      return {
        scopes: null,
        check: { at, outcome: "wrong_account", message: `Sai Page: token thuộc Page "${who.name}" (${who.id}), không phải Page ID ${expectedId} đã nhập.`, capabilities: capabilities("facebook", false, null), identity: who },
      };
    const { isPage: _p, ...identity } = who;
    return { scopes: null, check: { at, outcome: "verified", message: `Đã xác minh Page ${who.name}. Chưa xác minh quyền đăng.`, capabilities: capabilities("facebook", true, null), identity } };
  } catch (e) {
    if (e instanceof PlatformError) return { scopes: null, check: { at, outcome: e.outcome, message: e.message, capabilities: capabilities(platform, false, null), identity: null } };
    return { scopes: null, check: { at, outcome: "platform_error", message: scrub(`Lỗi khi kiểm tra: ${(e as Error).message}`), capabilities: capabilities(platform, false, null), identity: null } };
  }
};

/** "Kiểm tra kết nối": one read-only check of the effective source (or the Facebook draft). */
export const checkTarget = async (key: string, opts: { draft?: boolean } = {}) => {
  const m0 = readMeta();
  const { cfg } = target(m0, key);
  if (cfg.platform === "tiktok") throw new ValidationError("TikTok đăng thủ công: không có kết nối API để kiểm tra.");
  const flight = `${key}:${opts.draft ? "draft" : "main"}`;
  if (inflight.has(flight)) throw new ConflictError("Đang kiểm tra tài khoản này. Chờ kết quả rồi thử lại.");
  inflight.add(flight);
  try {
    const cr = await resolveCredentials(key, opts);
    const conn = cr.source === "studio" ? m0.connections[cr.connectionId] : null;
    const known = conn?.identity ?? (cr.source === "env" ? m0.targets[key].envCheck?.identity ?? null : null);
    const { check, scopes } = await runCheck(cfg.platform, cr.bundle, conn?.expectedId ?? (cfg.platform === "facebook" ? cfg.pageId ?? null : null), cfg.platform === "youtube" ? known : null);
    const r = mutate(undefined, (m) => {
      const st = m.targets[key];
      if (cr.source === "env") {
        // Applies only if .env did not change while the check ran.
        const nowFp = envInfo(cfg).complete ? fingerprint(envCredentials(cfg)) : null;
        if (nowFp !== cr.envFingerprint) throw new ConflictError("Biến môi trường đã đổi trong lúc kiểm tra. Kiểm tra lại.");
        const keepId = check.outcome === "verified" ? check.identity : st.envCheck?.fingerprint === cr.envFingerprint ? st.envCheck.identity : null;
        st.envCheck = { fingerprint: cr.envFingerprint!, lastCheck: check, identity: keepId };
        return { promoted: false };
      }
      const c = m.connections[cr.connectionId];
      if (!c || c.secretRef !== cr.secretRef || c.removedAt) throw new ConflictError("Kết nối đã được thay đổi trong lúc kiểm tra. Kiểm tra lại.");
      c.lastCheck = check;
      c.updatedAt = check.at;
      if (scopes?.length) c.scopes = scopes;
      if (check.outcome === "verified") c.identity = check.identity;
      // A Facebook draft that now verifies replaces the active connection.
      if (opts.draft && check.outcome === "verified") return { promoted: true, ...promoteFacebook(m, key, c) };
      return { promoted: false };
    });
    if (r.result.promoted && "dropSecret" in r.result) deleteSecret(r.result.dropSecret as string | null);
    return { check, rev: r.rev, promoted: r.result.promoted };
  } finally {
    inflight.delete(flight);
  }
};

// ---- YouTube OAuth client (app setup) -------------------------------------------

const CLIENT_ID_RE = /^[0-9]{6,30}-[a-z0-9]{10,64}\.apps\.googleusercontent\.com$/;
const MASK_RE = /^[*•·x.\s]+$/i;

/** Reads ONLY client_id, client_secret, project_id from the official JSON. Endpoints in the file are ignored. */
export const parseGoogleClientJson = (text: string) => {
  let j: Record<string, unknown>;
  try {
    j = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new ValidationError("File không phải JSON hợp lệ. Tải lại file JSON của OAuth client từ Google Cloud Console.");
  }
  if (j.web) throw new ValidationError('Đây là OAuth client loại "Web application". Studio cần loại "Desktop app" (ứng dụng cài trên máy, chuyển hướng về 127.0.0.1).');
  const inst = j.installed as Record<string, unknown> | undefined;
  if (!inst || typeof inst !== "object") throw new ValidationError('Không thấy mục "installed" trong file: cần file JSON của OAuth client loại "Desktop app".');
  const clientId = String(inst.client_id ?? "");
  if (!CLIENT_ID_RE.test(clientId)) throw new ValidationError("client_id trong file không đúng dạng ….apps.googleusercontent.com.");
  const secret = typeof inst.client_secret === "string" && inst.client_secret ? inst.client_secret : null;
  return { clientId, clientSecret: secret, projectId: typeof inst.project_id === "string" ? inst.project_id.slice(0, 100) : null };
};

const checkSecretText = (s: string, label: string, re: RegExp) => {
  if (MASK_RE.test(s)) throw new ValidationError(`${label}: không nhận chuỗi che (***). Để trống nếu muốn giữ giá trị đã lưu.`);
  if (!re.test(s)) throw new ValidationError(`${label} không đúng định dạng.`);
};

/**
 * clientSecret: string = replace, undefined = keep (only when the client ID is
 * unchanged), null = remove. A secret is never carried over to another client ID.
 */
export const saveYoutubeClient = async (p: { clientId: string; clientSecret?: string | null; projectId?: string | null; via: "json" | "form" }, expectedRev: number) => {
  if (!CLIENT_ID_RE.test(p.clientId)) throw new ValidationError("Client ID không đúng dạng ….apps.googleusercontent.com.");
  if (typeof p.clientSecret === "string") checkSecretText(p.clientSecret, "Client secret", /^[A-Za-z0-9_-]{8,128}$/);
  const newRef = typeof p.clientSecret === "string" ? await putSecret("youtube-client", { clientSecret: p.clientSecret }) : null;
  try {
    const r = mutate(expectedRev, (m) => {
      const old = m.youtubeClient;
      const sameClient = old?.clientId === p.clientId;
      let secretRef: string | null;
      let drop: string | null = null;
      if (newRef) {
        secretRef = newRef;
        drop = old?.secretRef ?? null;
      } else if (p.clientSecret === null || !sameClient) {
        secretRef = null;
        drop = old?.secretRef ?? null;
      } else secretRef = old?.secretRef ?? null;
      m.youtubeClient = { clientId: p.clientId, secretRef, projectId: p.projectId ?? (sameClient ? old?.projectId ?? null : null), savedAt: now(), via: p.via };
      return { drop, clientChanged: Boolean(old && !sameClient) };
    });
    deleteSecret(r.result.drop);
    return { rev: r.rev, clientChanged: r.result.clientChanged };
  } catch (e) {
    deleteSecret(newRef);
    throw e;
  }
};

export const removeYoutubeClient = (expectedRev: number) => {
  const r = mutate(expectedRev, (m) => {
    const drop = m.youtubeClient?.secretRef ?? null;
    m.youtubeClient = null;
    return drop;
  });
  deleteSecret(r.result);
  return { rev: r.rev };
};

export const youtubeClientCredentials = async () => {
  const m = readMeta();
  if (!m.youtubeClient) throw new ValidationError("Chưa thiết lập OAuth client của YouTube (bước 1).");
  const secret = m.youtubeClient.secretRef ? (await getSecret(m.youtubeClient.secretRef)).clientSecret ?? null : null;
  return { clientId: m.youtubeClient.clientId, clientSecret: secret, rev: m.rev };
};

/**
 * Activates a NEW, already-verified YouTube connection (after the user
 * confirmed the channel). Same channel + same OAuth client → same connection
 * id (token replaced). Otherwise → new connection id; the old one is marked
 * removed (history and jobs keep their record).
 */
export const activateYoutube = async (
  key: string,
  p: { identity: Identity; clientId: string; clientSecret: string | null; refreshToken: string | null; scopes: string[]; verifiedAt: string },
  expectedRev: number,
) => {
  const m0 = readMeta();
  const { state } = target(m0, key, "youtube");
  const prev = state.active ? m0.connections[state.active] : null;
  const sameAccount = Boolean(prev && !prev.removedAt && prev.identity?.id === p.identity.id && prev.oauthClientId === p.clientId);
  let refresh = p.refreshToken;
  if (!refresh) {
    // Google did not return a refresh token: keep the old one ONLY for the same client and the same channel.
    if (!sameAccount || !prev?.secretRef) throw new ValidationError("Google không trả refresh token và không có token cũ của đúng kênh và OAuth client này để giữ lại. Gỡ quyền của ứng dụng tại myaccount.google.com/permissions rồi kết nối lại.");
    refresh = (await getSecret(prev.secretRef)).refreshToken ?? null;
    if (!refresh) throw new ValidationError("Không đọc được refresh token cũ. Kết nối lại.");
  }
  const newRef = await putSecret("youtube-connection", { clientId: p.clientId, clientSecret: p.clientSecret ?? "", refreshToken: refresh });
  try {
    const r = mutate(expectedRev, (m) => {
      const st = m.targets[key];
      const cur = st.active ? m.connections[st.active] : null;
      const at = now();
      const check: LastCheck = { at: p.verifiedAt, outcome: "verified", message: `Đã xác minh kênh ${p.identity.name}.`, capabilities: capabilities("youtube", true, p.scopes), identity: p.identity };
      let drop: string | null = null;
      if (cur && sameAccount && cur.id === prev?.id) {
        drop = cur.secretRef;
        Object.assign(cur, { secretRef: newRef, secretUpdatedAt: p.verifiedAt, identity: p.identity, scopes: p.scopes, lastCheck: check, updatedAt: at, origin: "oauth" as const });
        return { drop, id: cur.id, replaced: "token" as const };
      }
      if (cur && !cur.removedAt) {
        drop = cur.secretRef;
        Object.assign(cur, { secretRef: null, removedAt: at, removedReason: `Thay bằng kết nối mới (${p.identity.name}).` });
      }
      const id = newId("youtube");
      m.connections[id] = {
        id,
        target: key,
        platform: "youtube",
        origin: "oauth",
        createdAt: at,
        updatedAt: at,
        secretRef: newRef,
        secretUpdatedAt: p.verifiedAt,
        identity: p.identity,
        expectedId: null,
        oauthClientId: p.clientId,
        scopes: p.scopes,
        lastCheck: check,
        removedAt: null,
        removedReason: null,
      };
      st.active = id;
      return { drop, id, replaced: cur ? ("account" as const) : ("new" as const) };
    });
    deleteSecret(r.result.drop);
    return { rev: r.rev, connectionId: r.result.id, replaced: r.result.replaced };
  } catch (e) {
    deleteSecret(newRef);
    throw e;
  }
};

// ---- Facebook (manual Page token) -----------------------------------------------

const PAGE_ID_RE = /^[0-9]{5,25}$/;
const FB_TOKEN_RE = /^[A-Za-z0-9_\-.|]{20,1024}$/;

/** Moves a verified draft into place. Same Page → same connection id. Returns the secret to drop. */
const promoteFacebook = (m: Meta, key: string, d: Connection) => {
  const st = m.targets[key];
  const cur = st.active ? m.connections[st.active] : null;
  const at = now();
  st.draft = null;
  if (cur && !cur.removedAt && cur.identity?.id === d.identity?.id) {
    const dropSecret = cur.secretRef;
    Object.assign(cur, { secretRef: d.secretRef, secretUpdatedAt: d.secretUpdatedAt, lastCheck: d.lastCheck, identity: d.identity, expectedId: d.expectedId, updatedAt: at });
    delete m.connections[d.id];
    return { dropSecret, connectionId: cur.id, replaced: "token" as const };
  }
  let dropSecret: string | null = null;
  if (cur && !cur.removedAt) {
    dropSecret = cur.secretRef;
    Object.assign(cur, { secretRef: null, removedAt: at, removedReason: `Thay bằng Page khác (${d.identity?.name ?? d.expectedId}).` });
  }
  st.active = d.id;
  return { dropSecret, connectionId: d.id, replaced: cur ? ("account" as const) : ("new" as const) };
};

/**
 * "Lưu và kiểm tra". token: string = new token, undefined = reuse the token
 * already stored (draft first, then active). The new config is checked BEFORE
 * it can replace anything; on failure it stays as a separate unverified draft.
 */
export const saveFacebook = async (key: string, p: { pageId: string; token?: string }, expectedRev: number) => {
  const m0 = readMeta();
  const { state } = target(m0, key, "facebook");
  if (m0.rev !== expectedRev) throw new ConflictError("Cấu hình kết nối vừa được thay đổi ở nơi khác. Tải lại trang rồi thao tác lại.");
  if (!PAGE_ID_RE.test(p.pageId)) throw new ValidationError("Page ID phải là dãy số (5–25 chữ số).");
  let token = p.token;
  if (token !== undefined) checkSecretText(token, "Page Access Token", FB_TOKEN_RE);
  else {
    const ref = (state.draft && m0.connections[state.draft]?.secretRef) || (state.active && m0.connections[state.active]?.secretRef);
    if (!ref) throw new ValidationError("Nhập Page Access Token.");
    token = (await getSecret(ref)).pageToken;
  }
  const newRef = await putSecret("facebook-page", { pageToken: token! });
  const { check } = await runCheck("facebook", { pageToken: token! }, p.pageId, null);
  try {
    const r = mutate(expectedRev, (m) => {
      const st = m.targets[key];
      const at = now();
      const drops: (string | null)[] = [];
      if (st.draft && m.connections[st.draft]) {
        drops.push(m.connections[st.draft].secretRef);
        delete m.connections[st.draft];
        st.draft = null;
      }
      const id = newId("facebook");
      const d: Connection = {
        id,
        target: key,
        platform: "facebook",
        origin: "manual",
        createdAt: at,
        updatedAt: at,
        secretRef: newRef,
        secretUpdatedAt: check.at,
        identity: check.outcome === "verified" ? check.identity : null,
        expectedId: p.pageId,
        oauthClientId: null,
        scopes: [],
        lastCheck: check,
        removedAt: null,
        removedReason: null,
      };
      m.connections[id] = d;
      st.draft = id;
      if (check.outcome === "verified") {
        const pr = promoteFacebook(m, key, d);
        drops.push(pr.dropSecret);
        return { drops, promoted: true, replaced: pr.replaced };
      }
      return { drops, promoted: false, replaced: null };
    });
    for (const d of r.result.drops) deleteSecret(d);
    return { rev: r.rev, check, promoted: r.result.promoted, replaced: r.result.replaced };
  } catch (e) {
    deleteSecret(newRef);
    throw e;
  }
};

export const discardDraft = (key: string, expectedRev: number) => {
  const r = mutate(expectedRev, (m) => {
    const st = m.targets[key];
    if (!st.draft) return null;
    const ref = m.connections[st.draft]?.secretRef ?? null;
    delete m.connections[st.draft];
    st.draft = null;
    return ref;
  });
  deleteSecret(r.result);
  return { rev: r.rev };
};

// ---- TikTok (manual) -------------------------------------------------------------

const TT_USER_RE = /^[A-Za-z0-9._]{2,24}$/;

/** "@name", "name" or https://www.tiktok.com/@name[...] → {username, profileUrl}. Never fetches the URL. */
export const normalizeTiktok = (input: string) => {
  const s = input.trim();
  let user: string | null = null;
  if (/^https?:\/\//i.test(s) || /^(www\.|m\.)?tiktok\.com\//i.test(s)) {
    let u: URL;
    try {
      u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    } catch {
      throw new ValidationError("URL không hợp lệ.");
    }
    if (u.protocol !== "https:" && u.protocol !== "http:") throw new ValidationError("Chỉ nhận URL https của tiktok.com.");
    if (!["tiktok.com", "www.tiktok.com", "m.tiktok.com"].includes(u.hostname.toLowerCase()))
      throw new ValidationError("URL phải thuộc tiktok.com (link rút gọn như vm.tiktok.com không được nhận vì Studio không tự mở link để dò).");
    const m = u.pathname.match(/^\/@([^/]+)\/?/);
    if (!m) throw new ValidationError("URL không phải trang hồ sơ (dạng https://www.tiktok.com/@ten).");
    user = decodeURIComponent(m[1]);
  } else user = s.replace(/^@/, "");
  if (!TT_USER_RE.test(user)) throw new ValidationError("Username TikTok chỉ gồm chữ, số, dấu chấm, gạch dưới (2–24 ký tự).");
  return { username: user, profileUrl: `https://www.tiktok.com/@${user}` };
};

export const saveTiktok = (key: string, input: string, expectedRev: number) => {
  const n = normalizeTiktok(input);
  const r = mutate(expectedRev, (m) => {
    target(m, key, "tiktok");
    m.targets[key].tiktok = { ...n, savedAt: now() };
    return n;
  });
  return { rev: r.rev, ...r.result };
};

export const removeTiktok = (key: string, expectedRev: number) => ({
  rev: mutate(expectedRev, (m) => {
    target(m, key, "tiktok");
    m.targets[key].tiktok = null;
  }).rev,
});

// ---- Remove / env import / env mode ----------------------------------------------

/**
 * "Gỡ khỏi Studio": deletes local secrets and unlinks. Does NOT revoke on the
 * platform. If .env variables exist they are turned OFF (not silently reused).
 */
export const removeFromStudio = (key: string, expectedRev: number) => {
  const r = mutate(expectedRev, (m) => {
    const { cfg, state } = target(m, key);
    if (cfg.platform === "tiktok") throw new ValidationError("TikTok: dùng Xoá cấu hình.");
    const drops: (string | null)[] = [];
    const at = now();
    for (const id of [state.active, state.draft]) {
      const c = id ? m.connections[id] : null;
      if (!c) continue;
      drops.push(c.secretRef);
      if (id === state.draft && id !== state.active) delete m.connections[c.id];
      else Object.assign(c, { secretRef: null, removedAt: at, removedReason: "Người dùng gỡ khỏi Studio." });
    }
    const had = Boolean(state.active || state.draft);
    state.active = null;
    state.draft = null;
    const envWasOn = envInfo(cfg).complete && state.env !== "off";
    if (envInfo(cfg).any) state.env = "off";
    return { drops, had, envTurnedOff: envWasOn };
  });
  for (const d of r.result.drops) deleteSecret(d);
  return { rev: r.rev, removed: r.result.had, envTurnedOff: r.result.envTurnedOff };
};

/** Copies the .env credentials into the DPAPI store, server-side only. Does not touch .env. */
export const importFromEnv = async (key: string, p: { pageId?: string }, expectedRev: number) => {
  const m0 = readMeta();
  const { cfg, state } = target(m0, key);
  if (m0.rev !== expectedRev) throw new ConflictError("Cấu hình kết nối vừa được thay đổi ở nơi khác. Tải lại trang.");
  if (cfg.platform === "tiktok") throw new ValidationError("TikTok không có thông tin đăng nhập.");
  if (state.active) throw new ValidationError("Đã có kết nối Studio đang dùng. Gỡ kết nối đó trước nếu muốn nhập cấu hình từ môi trường.");
  const env = envInfo(cfg);
  if (!env.complete) throw new ValidationError("Biến môi trường chưa đủ hoặc config/publishing.json → credentialEnv không chỉ chứa tên biến.");
  const b = envCredentials(cfg);
  let expectedId: string | null = null;
  if (cfg.platform === "youtube") {
    if (!CLIENT_ID_RE.test(b.clientId)) throw new ValidationError("Giá trị client ID trong môi trường không đúng dạng (không in giá trị).");
  } else {
    expectedId = p.pageId ?? cfg.pageId ?? null;
    if (!expectedId || !PAGE_ID_RE.test(expectedId)) throw new ValidationError("Cần Page ID (dãy số) để nhập cấu hình Facebook từ môi trường.");
  }
  const ref = await putSecret(`${cfg.platform}-env-import`, b);
  try {
    const r = mutate(expectedRev, (m) => {
      const st = m.targets[key];
      if (st.active) throw new ConflictError("Đã có kết nối Studio đang dùng.");
      const at = now();
      const id = newId(cfg.platform);
      m.connections[id] = {
        id,
        target: key,
        platform: cfg.platform,
        origin: "env-import",
        createdAt: at,
        updatedAt: at,
        secretRef: ref,
        secretUpdatedAt: at,
        identity: null,
        expectedId,
        oauthClientId: cfg.platform === "youtube" ? b.clientId : null,
        scopes: [],
        lastCheck: null,
        removedAt: null,
        removedReason: null,
      };
      st.active = id;
      return id;
    });
    return { rev: r.rev, connectionId: r.result };
  } catch (e) {
    deleteSecret(ref);
    throw e;
  }
};

export const setEnvMode = (key: string, mode: "use" | "off", expectedRev: number) =>
  mutate(expectedRev, (m) => {
    const { cfg, state } = target(m, key);
    if (cfg.platform === "tiktok") throw new ValidationError("TikTok không dùng biến môi trường.");
    if (mode === "use" && state.active) throw new ValidationError("Đang dùng kết nối Studio; gỡ kết nối đó trước khi chuyển sang biến môi trường.");
    state.env = mode;
  });

// ---- For dry-run / CLI (synchronous) -----------------------------------------------

export type TargetCredentialStatus = {
  source: Source;
  status: ConnStatus;
  connectionId: string | null;
  identity: Identity | null;
  capabilities: Capability[];
  problems: string[];
  notes: string[];
};

/**
 * Dry-run view of a target. With `decryptTest`, also proves the DPAPI store
 * can be opened under the current Windows user (values are discarded).
 */
export const targetCredentialStatus = (key: string, opts: { decryptTest?: boolean } = {}): TargetCredentialStatus => {
  const v = connectionsView().targets.find((t) => t.key === key);
  if (!v) return { source: "none", status: "not_configured", connectionId: null, identity: null, capabilities: [], problems: [`Không có tài khoản đích "${key}".`], notes: [] };
  const problems: string[] = [];
  const notes: string[] = [];
  const connectionId = v.source === "studio" ? v.active?.id ?? null : v.source === "env" ? `env:${key}` : null;
  if (v.source === "none") problems.push(v.env.suppressed ? "Kết nối đã bị gỡ khỏi Studio; biến môi trường vẫn còn nhưng đang tắt (không tự dùng lại)." : "Chưa cấu hình kết nối cho tài khoản này.");
  if (v.env.badEntries) problems.push(`config/publishing.json → credentialEnv có ${v.env.badEntries} mục không phải tên biến môi trường (không in ra).`);
  if (v.source === "studio" && opts.decryptTest && v.active) {
    const m = readMeta();
    const ref = m.connections[v.active.id]?.secretRef;
    try {
      if (!ref) throw new SecretStoreError("Kết nối không còn bí mật đã lưu.");
      getSecretSync(ref);
      notes.push("Kho bí mật mở được dưới tài khoản Windows hiện tại (không in giá trị).");
    } catch (e) {
      problems.push((e as Error).message);
    }
  }
  if (v.source === "env") notes.push(`Nguồn: biến môi trường (${v.env.names.join(", ")}; không in giá trị).`);
  if (v.source === "studio") notes.push(`Nguồn: kết nối Studio ${connectionId}.`);
  const statusText: Record<ConnStatus, string> = {
    not_configured: "chưa cấu hình",
    saved_unverified: "đã lưu, chưa kiểm tra kết nối",
    verified: "đã xác minh tài khoản",
    reconnect_needed: "cần kết nối lại",
    missing_permission: "thiếu quyền",
    check_failed: "lần kiểm tra gần nhất không thực hiện được (lỗi mạng hoặc nền tảng)",
    manual: "đăng thủ công",
  };
  if (v.source !== "none" && v.status !== "verified" && v.status !== "manual") problems.push(`Kết nối ${statusText[v.status]}.`);
  return { source: v.source, status: v.status, connectionId, identity: v.identity, capabilities: v.capabilities, problems, notes };
};

/** Non-secret account info for delivery files / job binding. */
export const targetAccountInfo = (key: string) => {
  const v = connectionsView().targets.find((t) => t.key === key);
  if (!v) return null;
  return { platform: v.platform, label: v.label, source: v.source, status: v.status, identity: v.identity, tiktok: v.tiktok, connectionId: v.source === "studio" ? v.active?.id ?? null : v.source === "env" ? `env:${key}` : null };
};

/** Secret entry ids referenced by metadata (for pruneSecrets at Studio start). */
export const referencedSecrets = () => {
  const m = readMeta();
  const s = new Set<string>();
  if (m.youtubeClient?.secretRef) s.add(m.youtubeClient.secretRef);
  for (const c of Object.values(m.connections)) if (c.secretRef) s.add(c.secretRef);
  return s;
};
