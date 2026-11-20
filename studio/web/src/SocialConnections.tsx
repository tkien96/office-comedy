import React, { useEffect, useRef, useState } from "react";
import { ApiError, get, send } from "./api";
import { Badge, ErrorBox, fmtVN, Loading, Modal, TechDetails, useAsync, useToast } from "./ui";

// Cấu hình → Kết nối mạng xã hội.
// - Loading this page never calls a platform: "Kiểm tra kết nối" does, on click.
// - Secret fields are always empty when the form opens. Empty = keep. The
//   server never sends a stored secret back.
// - Every change sends `expectedRev`; another tab's change → 409 → reload.

type Identity = { id: string; name: string; handle: string | null; avatarUrl: string | null; url: string | null };
type Capability = { key: string; label: string; state: "yes" | "no" | "unknown"; note: string };
type LastCheck = { at: string; outcome: string; message: string; capabilities: Capability[]; identity: Identity | null };
type Status = "not_configured" | "saved_unverified" | "verified" | "reconnect_needed" | "missing_permission" | "check_failed" | "manual";
type ConnView = {
  id: string;
  origin: "oauth" | "manual" | "env-import";
  createdAt: string;
  secretStored: boolean;
  secretUpdatedAt: string | null;
  identity: Identity | null;
  expectedId: string | null;
  oauthClientId: string | null;
  scopes: string[];
  lastCheck: LastCheck | null;
  status: Status;
  capabilities: Capability[];
};
type TargetView = {
  key: string;
  platform: "youtube" | "facebook" | "tiktok";
  label: string;
  source: "studio" | "env" | "none" | "manual";
  status: Status;
  identity: Identity | null;
  lastCheck: LastCheck | null;
  capabilities: Capability[];
  active: ConnView | null;
  draft: ConnView | null;
  tiktok: { username: string; profileUrl: string; savedAt: string } | null;
  env: { names: string[]; present: { name: string; present: boolean }[]; badEntries: number; complete: boolean; mode: "auto" | "off" | "use"; suppressed: boolean; checked: boolean };
  configuredExpectedId: string | null;
  expectedMismatch: boolean;
  clientMismatch: boolean;
  jobs: { total: number; unbound: string[]; boundElsewhere: { job: string; account: string; accountId: string }[]; boundToRemoved: string[] };
};
type View = {
  rev: number;
  youtubeClient: { clientId: string; projectId: string | null; secretStored: boolean; savedAt: string; via: string } | null;
  targets: TargetView[];
  secretStore: { ok: boolean; message: string; checkedAt: string } | null;
  oauth: { redirectUri: string; scopes: string[]; clientType: string };
  graphVersion: string;
};
type PendingView = {
  id: string;
  target: string;
  identity: Identity;
  scopes: string[];
  hasUploadScope: boolean;
  refreshTokenReturned: boolean;
  canKeepOldRefresh: boolean;
  replaces: { name: string; id: string; sameAccount: boolean } | null;
  configuredChannelId: string | null;
  channelMismatch: boolean;
  expiresAt: string;
};

export const STATUS: Record<Status, { label: string; tone: string }> = {
  not_configured: { label: "Chưa cấu hình", tone: "none" },
  saved_unverified: { label: "Đã lưu, chưa kiểm tra", tone: "wait" },
  verified: { label: "Đã xác minh", tone: "ok" },
  reconnect_needed: { label: "Cần kết nối lại", tone: "bad" },
  missing_permission: { label: "Thiếu quyền", tone: "bad" },
  check_failed: { label: "Không kiểm tra được", tone: "warn" },
  manual: { label: "Đăng thủ công", tone: "none" },
};
const SOURCE: Record<TargetView["source"], string> = {
  studio: "Kết nối do Studio quản lý (bí mật trong kho Windows)",
  env: "Cấu hình từ môi trường (.env)",
  none: "Chưa có nguồn cấu hình",
  manual: "Đăng thủ công",
};
const FIX: Record<string, string> = {
  auth_invalid: "Thông tin đăng nhập không còn hiệu lực: kết nối lại hoặc thay token.",
  no_channel: "Đăng nhập lại và chọn đúng tài khoản/kênh.",
  wrong_account: "Kiểm tra lại đúng tài khoản/Page rồi kết nối lại.",
  not_found: "Kiểm tra lại ID đã nhập.",
  missing_permission: "Cấp thêm quyền cần thiết rồi kết nối lại.",
  network: "Kiểm tra mạng rồi bấm Kiểm tra kết nối. Lỗi mạng không có nghĩa token đã hết hạn.",
  rate_limited: "Đợi một lúc rồi thử lại.",
  platform_error: "Nền tảng gặp lỗi tạm thời: thử lại sau.",
};
const CAP: Record<Capability["state"], { label: string; tone: string }> = { yes: { label: "Có", tone: "ok" }, no: { label: "Không", tone: "none" }, unknown: { label: "Chưa xác minh", tone: "wait" } };

const useRun = (reload: () => void) => {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const run = async <T,>(label: string, fn: () => Promise<T>, okMsg?: (r: T) => string | null) => {
    if (busy) return null;
    setBusy(label);
    try {
      const r = await fn();
      const m = okMsg?.(r);
      if (m) toast("ok", m);
      reload();
      return r;
    } catch (e) {
      const err = e as ApiError;
      toast("bad", err.message);
      if (err.status === 409) reload();
      return null;
    } finally {
      setBusy(null);
    }
  };
  return { busy, run };
};

const parseQuery = () => {
  const q = window.location.hash.split("?")[1] ?? "";
  return new URLSearchParams(q);
};

export const SocialConnections: React.FC = () => {
  const { data, error, loading, reload } = useAsync(() => get<View>("/api/connections"), []);
  const [resultId, setResultId] = useState<string | null>(() => parseQuery().get("r"));
  return (
    <section className="stack">
      <header className="page-head">
        <h1>Kết nối mạng xã hội</h1>
        <a className="btn" href="#/cau-hinh">
          ← Cấu hình
        </a>
      </header>
      <p className="muted small">
        Mở trang này không gọi tới YouTube hay Meta. Studio chỉ gọi khi bạn bấm Kiểm tra kết nối, Lưu và kiểm tra, hoặc khi hoàn tất đăng nhập Google. Bản này chỉ xác minh tài khoản: chưa upload, đặt lịch hay đăng bài.
      </p>
      {loading && !data ? <Loading /> : null}
      {error ? <ErrorBox message={error} onRetry={reload} /> : null}
      {data ? (
        <>
          <SecretStoreBanner v={data} reload={reload} />
          {resultId ? (
            <OAuthResult
              id={resultId}
              rev={data.rev}
              onDone={() => {
                setResultId(null);
                window.history.replaceState(null, "", "#/cau-hinh/ket-noi");
                reload();
              }}
            />
          ) : null}
          {data.targets.map((t) =>
            t.platform === "youtube" ? (
              <YoutubeCard key={t.key} t={t} v={data} reload={reload} />
            ) : t.platform === "facebook" ? (
              <FacebookCard key={t.key} t={t} v={data} reload={reload} />
            ) : (
              <TiktokCard key={t.key} t={t} v={data} reload={reload} />
            ),
          )}
          <MovingMachine />
        </>
      ) : null}
    </section>
  );
};

const SecretStoreBanner: React.FC<{ v: View; reload: () => void }> = ({ v, reload }) => {
  const { busy, run } = useRun(reload);
  const s = v.secretStore;
  return (
    <div className={`state ${s?.ok ? "state-info" : "state-warn"} small`}>
      <strong>Kho bí mật:</strong>{" "}
      {s ? s.message : "đang tự kiểm tra…"} Bí mật được mã hoá bằng Windows DPAPI theo tài khoản Windows hiện tại; chỉ tài khoản này trên máy này giải mã được. Không có bản văn bản thường dự phòng.
      <button type="button" className="btn btn-small" disabled={Boolean(busy)} onClick={() => run("store", () => send("POST", "/api/connections/secret-store/check"))}>
        {busy ? "Đang kiểm tra…" : "Kiểm tra lại kho"}
      </button>
    </div>
  );
};

// ---- Shared card parts -----------------------------------------------------------------

const IdentityBlock: React.FC<{ identity: Identity | null; title?: string }> = ({ identity, title }) =>
  identity ? (
    <div className="ident">
      {identity.avatarUrl ? <img src={identity.avatarUrl} alt="" width={48} height={48} referrerPolicy="no-referrer" /> : <div className="ident-ph" aria-hidden="true" />}
      <div>
        {title ? <div className="muted small">{title}</div> : null}
        <div>
          <strong>{identity.name}</strong> {identity.handle ? <span className="muted">{identity.handle}</span> : null}
        </div>
        <div className="small">
          ID: <code>{identity.id}</code>
          {identity.url ? (
            <>
              {" "}
              ·{" "}
              <a href={identity.url} target="_blank" rel="noopener noreferrer">
                Mở trang
              </a>
            </>
          ) : null}
        </div>
      </div>
    </div>
  ) : null;

const Caps: React.FC<{ caps: Capability[] }> = ({ caps }) => (
  <ul className="caps small">
    {caps.map((c) => (
      <li key={c.key}>
        <Badge tone={CAP[c.state].tone}>{CAP[c.state].label}</Badge> <strong>{c.label}</strong>: <span className="muted">{c.note}</span>
      </li>
    ))}
  </ul>
);

const CardHead: React.FC<{ t: TargetView; name: string }> = ({ t, name }) => (
  <div className="conn-head">
    <h2>{name}</h2>
    <Badge tone={STATUS[t.status].tone}>{STATUS[t.status].label}</Badge>
    <span className="muted small">{t.label}</span>
  </div>
);

const CheckLine: React.FC<{ check: LastCheck | null }> = ({ check }) =>
  check ? (
    <div className={check.outcome === "verified" ? "small" : "small f-bad"}>
      Kiểm tra gần nhất: {fmtVN(check.at)} (giờ VN) · {check.message}
      {check.outcome !== "verified" && FIX[check.outcome] ? <div className="f-warn">Cách xử lý: {FIX[check.outcome]}</div> : null}
    </div>
  ) : (
    <div className="small muted">Chưa kiểm tra lần nào với cấu hình hiện tại.</div>
  );

const JobsNote: React.FC<{ t: TargetView }> = ({ t }) =>
  t.jobs.total ? (
    <div className="small">
      {t.jobs.total} job dùng tài khoản đích này.
      {t.jobs.unbound.length ? <div className="f-warn">{t.jobs.unbound.length} job API chưa gắn tài khoản đã xác minh (gắn trong tab Phát hành của từng tập).</div> : null}
      {t.jobs.boundElsewhere.map((b) => (
        <div key={b.job} className="f-warn">
          Job <code>{b.job}</code> vẫn gắn với {b.account} ({b.accountId}), khác tài khoản đang kết nối: Studio không tự chuyển.
        </div>
      ))}
      {t.jobs.boundToRemoved.length ? <div className="f-bad">Job gắn với kết nối đã gỡ: {t.jobs.boundToRemoved.join(", ")}. Không thể tiếp tục cho tới khi gắn lại.</div> : null}
    </div>
  ) : null;

const EnvBlock: React.FC<{ t: TargetView; v: View; reload: () => void }> = ({ t, v, reload }) => {
  const { busy, run } = useRun(reload);
  const [pageId, setPageId] = useState(t.configuredExpectedId ?? "");
  if (!t.env.names.length && !t.env.badEntries) return null;
  const present = t.env.present.filter((p) => p.present).length;
  return (
    <div className="env-block small">
      <strong>Biến môi trường:</strong>{" "}
      {t.env.present.map((p) => (
        <span key={p.name} className="env-name">
          <code>{p.name}</code> {p.present ? "có" : "chưa có"}
        </span>
      ))}
      {t.env.badEntries ? <div className="f-bad">config/publishing.json → credentialEnv có {t.env.badEntries} mục không phải tên biến (không hiển thị).</div> : null}
      {t.env.complete && t.source === "env" ? <div>Có cấu hình từ môi trường và đang được dùng (cách cũ). Có thể nhập vào kho của Studio để quản lý tại đây.</div> : null}
      {t.env.complete && t.source === "studio" ? <div className="muted">Biến môi trường vẫn còn nhưng không được dùng: Studio đang dùng kết nối của Studio (không trộn hai nguồn).</div> : null}
      {t.env.suppressed ? <div className="f-warn">Có cấu hình từ môi trường nhưng đang TẮT (sau khi bạn gỡ kết nối khỏi Studio). Studio không tự dùng lại.</div> : null}
      {!t.env.complete && present ? <div className="f-warn">Biến môi trường chưa đủ: không dùng được.</div> : null}
      <div className="row">
        {t.env.complete && t.source !== "studio" ? (
          <>
            {t.platform === "facebook" ? (
              <label className="small">
                Page ID{" "}
                <input value={pageId} onChange={(e) => setPageId(e.target.value)} inputMode="numeric" size={18} />
              </label>
            ) : null}
            <button
              type="button"
              className="btn btn-small"
              disabled={Boolean(busy)}
              onClick={() =>
                run("import", () => send("POST", `/api/connections/${t.key}/import-env`, { expectedRev: v.rev, pageId: pageId || undefined }), () => "Đã nhập cấu hình từ môi trường vào kho Studio (trên máy chủ). Bấm Kiểm tra kết nối để xác minh. File .env không bị sửa.")
              }
            >
              Nhập vào kho Studio
            </button>
          </>
        ) : null}
        {t.env.complete && t.source === "none" && t.env.suppressed ? (
          <button type="button" className="btn btn-small" disabled={Boolean(busy)} onClick={() => run("env-on", () => send("POST", `/api/connections/${t.key}/env-mode`, { expectedRev: v.rev, mode: "use" }), () => "Đã bật lại cấu hình từ môi trường.")}>
            Dùng lại cấu hình môi trường
          </button>
        ) : null}
        {t.env.complete && t.source === "env" ? (
          <button type="button" className="btn btn-small" disabled={Boolean(busy)} onClick={() => run("env-off", () => send("POST", `/api/connections/${t.key}/env-mode`, { expectedRev: v.rev, mode: "off" }), () => "Đã tắt cấu hình từ môi trường cho tài khoản này.")}>
            Tắt cấu hình môi trường
          </button>
        ) : null}
      </div>
    </div>
  );
};

const ConfirmRemove: React.FC<{ t: TargetView; v: View; onClose: () => void; reload: () => void; remote?: boolean }> = ({ t, v, onClose, reload, remote }) => {
  const { busy, run } = useRun(reload);
  return (
    <Modal
      title={remote ? "Thu hồi quyền trên Google" : "Gỡ khỏi Studio"}
      onClose={onClose}
      actions={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Huỷ
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={Boolean(busy)}
            onClick={async () => {
              const r = await run(
                "rm",
                () => send<{ envTurnedOff: boolean }>("POST", `/api/connections/${t.key}/${remote ? "revoke-remote" : "remove"}`, { expectedRev: v.rev, confirm: true }),
                (x) => (remote ? "Google đã nhận yêu cầu thu hồi; đã gỡ khỏi Studio." : "Đã gỡ khỏi Studio.") + (x.envTurnedOff ? " Cấu hình môi trường cũng đã tắt (không tự dùng lại)." : ""),
              );
              if (r) onClose();
            }}
          >
            {busy ? "Đang xử lý…" : remote ? "Thu hồi và gỡ" : "Gỡ khỏi Studio"}
          </button>
        </>
      }
    >
      {remote ? (
        <p>
          Studio gửi yêu cầu thu hồi tới Google rồi xoá bí mật trên máy. Theo tài liệu Google, thu hồi xoá <strong>mọi quyền đã cấp cho project Google Cloud này</strong>, kể cả token của client khác cùng project. Có thể mất một lúc mới có hiệu lực hoàn toàn.
        </p>
      ) : (
        <p>
          Xoá bí mật của kết nối này khỏi kho trên máy và ngắt liên kết. <strong>Không thu hồi quyền trên nền tảng.</strong> Lịch sử job và đường dẫn bài đã đăng được giữ nguyên; job đang gắn kết nối này sẽ bị chặn cho tới khi gắn lại.
          {t.env.complete ? " Biến môi trường vẫn còn nhưng sẽ bị TẮT, không tự dùng lại." : ""}
        </p>
      )}
    </Modal>
  );
};

// ---- YouTube ------------------------------------------------------------------------------

const YoutubeCard: React.FC<{ t: TargetView; v: View; reload: () => void }> = ({ t, v, reload }) => {
  const { busy, run } = useRun(reload);
  const toast = useToast();
  const [modal, setModal] = useState<null | "remove" | "revoke">(null);
  const [setup, setSetup] = useState(!v.youtubeClient);
  const connect = async () => {
    const r = await run("oauth", () => send<{ authUrl: string }>("POST", `/api/connections/${t.key}/oauth/start`, { expectedRev: v.rev }));
    if (r) {
      toast("info", "Đang mở trang đăng nhập Google. Sau khi cấp quyền, Google sẽ đưa bạn về Studio để xác nhận kênh.");
      window.location.assign(r.authUrl);
    }
  };
  return (
    <article className="card conn-card">
      <CardHead t={t} name="YouTube" />
      <div className="small muted">{SOURCE[t.source]}</div>
      <IdentityBlock identity={t.identity} title={t.status === "verified" ? "Kênh đã xác minh" : "Kênh xác minh lần trước"} />
      {t.expectedMismatch ? <div className="f-warn small">channelId trong config/publishing.json ({t.configuredExpectedId}) khác kênh đã xác minh.</div> : null}
      {t.clientMismatch ? <div className="f-warn small">Kết nối này được cấp qua OAuth client cũ; client đang thiết lập đã đổi. Kết nối lại để dùng client mới.</div> : null}
      <CheckLine check={t.lastCheck} />
      <Caps caps={t.capabilities} />
      <JobsNote t={t} />
      <div className="row">
        <button type="button" className="btn btn-primary" disabled={Boolean(busy) || !v.youtubeClient} onClick={connect} title={v.youtubeClient ? "" : "Thiết lập OAuth client trước"}>
          {busy === "oauth" ? "Đang mở…" : t.source === "studio" ? "Kết nối lại / đổi kênh" : "Kết nối YouTube"}
        </button>
        {t.source === "studio" || t.source === "env" ? (
          <button type="button" className="btn" disabled={Boolean(busy)} onClick={() => run("check", () => send<{ check: LastCheck }>("POST", `/api/connections/${t.key}/check`, {}), (r) => r.check.message)}>
            {busy === "check" ? "Đang kiểm tra…" : "Kiểm tra kết nối"}
          </button>
        ) : null}
        {t.source === "studio" ? (
          <>
            <button type="button" className="btn" disabled={Boolean(busy)} onClick={() => setModal("remove")}>
              Gỡ khỏi Studio
            </button>
            <button type="button" className="btn" disabled={Boolean(busy)} onClick={() => setModal("revoke")}>
              Thu hồi quyền trên Google…
            </button>
          </>
        ) : null}
      </div>
      <p className="small muted">
        Quyền Studio xin: <code>youtube.readonly</code> (chỉ đọc kênh để xác minh). Chưa xin quyền upload, nên kết nối này <strong>chưa đủ điều kiện đăng</strong>.
      </p>
      <EnvBlock t={t} v={v} reload={reload} />
      <details className="setup" open={setup} onToggle={(e) => setSetup((e.target as HTMLDetailsElement).open)}>
        <summary>
          Thiết lập ứng dụng Google (OAuth client) {v.youtubeClient ? <Badge tone="ok">Đã lưu</Badge> : <Badge tone="wait">Chưa có</Badge>}
        </summary>
        <YoutubeClientSetup v={v} reload={reload} />
      </details>
      {modal ? <ConfirmRemove t={t} v={v} remote={modal === "revoke"} onClose={() => setModal(null)} reload={reload} /> : null}
    </article>
  );
};

const YoutubeClientSetup: React.FC<{ v: View; reload: () => void }> = ({ v, reload }) => {
  const { busy, run } = useRun(reload);
  const toast = useToast();
  const c = v.youtubeClient;
  const [editing, setEditing] = useState(!c);
  const [clientId, setClientId] = useState(c?.clientId ?? "");
  const [secret, setSecret] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setClientId(c?.clientId ?? "");
    setSecret("");
    setEditing(!c);
  }, [c?.clientId, c?.savedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 20_000) return toast("bad", "File quá lớn: không phải file JSON của OAuth client.");
    const text = await f.text();
    if (fileRef.current) fileRef.current.value = "";
    await run("json", () => send("POST", "/api/connections/youtube/client", { expectedRev: v.rev, clientJson: text }), () => "Đã đọc file và lưu OAuth client. Studio không giữ lại file JSON.");
  };
  return (
    <div className="stack small">
      <ol className="guide">
        <li>
          Vào <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer">Google Cloud Console</a>, tạo (hoặc chọn) một project.
        </li>
        <li>
          APIs &amp; Services → Library → bật <strong>YouTube Data API v3</strong>.
        </li>
        <li>
          Google Auth Platform (OAuth consent screen): đối tượng <strong>External</strong>, điền tên ứng dụng và email. Ở chế độ <strong>Testing</strong>, thêm tài khoản Google của bạn vào Test users; lưu ý refresh token của app ở chế độ Testing
          hết hạn sau 7 ngày (khi đó Studio báo "Cần kết nối lại").
        </li>
        <li>
          Clients → Create client → loại <strong>Desktop app</strong> → Create → <strong>Download JSON</strong>.
        </li>
        <li>Chọn file JSON đó ở dưới (hoặc nhập Client ID và Client secret).</li>
      </ol>
      <p>
        Redirect URI: client loại Desktop app <strong>không cần đăng ký redirect URI</strong> trên Google Cloud. Studio dùng địa chỉ loopback <code>{v.oauth.redirectUri}</code> (Google cho phép mặc định với loại Desktop app). Mở Studio bằng{" "}
        <code>{v.oauth.redirectUri}</code> khi bấm Kết nối.
      </p>
      {c && !editing ? (
        <div>
          <div>
            Client ID: <code>{c.clientId}</code>
            {c.projectId ? (
              <>
                {" "}
                · project <code>{c.projectId}</code>
              </>
            ) : null}
          </div>
          <div>Client secret: {c.secretStored ? "đã lưu trong kho bí mật (không hiển thị)" : "không có"}</div>
          <div className="muted">Lưu lúc {fmtVN(c.savedAt)}</div>
          <div className="row">
            <button type="button" className="btn btn-small" onClick={() => setEditing(true)}>
              Thay thế thông tin
            </button>
            <button type="button" className="btn btn-small" disabled={Boolean(busy)} onClick={() => run("rmclient", () => send("POST", "/api/connections/youtube/client/remove", { expectedRev: v.rev }), () => "Đã xoá OAuth client khỏi Studio. Kết nối kênh hiện có vẫn giữ nguyên.")}>
              Xoá OAuth client
            </button>
          </div>
        </div>
      ) : (
        <div className="stack">
          <label className="field">
            Chọn file JSON của OAuth client (Desktop app)
            <input ref={fileRef} type="file" accept="application/json,.json" onChange={(e) => onFile(e.target.files?.[0])} disabled={Boolean(busy)} />
          </label>
          <div className="muted">Hoặc nhập tay:</div>
          <label className="field">
            Client ID
            <input value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="1234…-abc….apps.googleusercontent.com" autoComplete="off" spellCheck={false} />
          </label>
          <label className="field">
            Client secret {c?.secretStored ? <span className="muted">(để trống = giữ giá trị đã lưu, nếu Client ID không đổi)</span> : null}
            <input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} autoComplete="new-password" spellCheck={false} />
          </label>
          <div className="row">
            <button
              type="button"
              className="btn btn-primary"
              disabled={Boolean(busy) || !clientId.trim()}
              onClick={async () => {
                const r = await run("client", () => send("POST", "/api/connections/youtube/client", { expectedRev: v.rev, clientId: clientId.trim(), clientSecret: secret || undefined }), () => "Đã lưu OAuth client.");
                if (r) setSecret("");
              }}
            >
              Lưu
            </button>
            {c ? (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setEditing(false);
                  setSecret("");
                  setClientId(c.clientId);
                }}
              >
                Huỷ
              </button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

const OAuthResult: React.FC<{ id: string; rev: number; onDone: () => void }> = ({ id, rev, onDone }) => {
  const { data, error } = useAsync(() => get<{ kind: string; message: string; pending: PendingView | null }>(`/api/connections/oauth-result/${id}`), [id]);
  const toast = useToast();
  const [accept, setAccept] = useState(false);
  const [busy, setBusy] = useState(false);
  if (error) return <ErrorBox message={error} onRetry={onDone} />;
  if (!data) return <Loading text="Đang đọc kết quả đăng nhập…" />;
  const p = data.pending;
  if (data.kind !== "ok" || !p)
    return (
      <div className="state state-warn">
        {data.message}{" "}
        <button type="button" className="btn btn-small" onClick={onDone}>
          Đóng
        </button>
      </div>
    );
  const act = async (confirm: boolean) => {
    setBusy(true);
    try {
      if (confirm) {
        await send("POST", `/api/connections/youtube/pending/${p.id}/confirm`, { expectedRev: rev, acceptMismatch: accept });
        toast("ok", `Đã dùng kênh ${p.identity.name}.`);
      } else {
        await send("POST", `/api/connections/youtube/pending/${p.id}/cancel`, {});
        toast("info", "Đã huỷ. Kết nối cũ (nếu có) giữ nguyên.");
      }
      onDone();
    } catch (e) {
      toast("bad", (e as Error).message);
      if ((e as ApiError).status === 409 && !(e as Error).message.includes("channelId")) onDone();
    } finally {
      setBusy(false);
    }
  };
  return (
    <article className="card conn-card pending">
      <h2>Xác nhận kênh YouTube</h2>
      <p className="small">{data.message} Kênh chưa được dùng cho tới khi bạn xác nhận.</p>
      <IdentityBlock identity={p.identity} title="Kênh của tài khoản vừa cấp quyền" />
      <div className="small">
        Quyền được cấp: {p.scopes.map((s) => <code key={s}>{s.replace("https://www.googleapis.com/auth/", "")} </code>)}
        {!p.hasUploadScope ? <span className="muted"> (chưa có quyền upload)</span> : null}
      </div>
      {p.replaces ? (
        <div className="small f-warn">
          {p.replaces.sameAccount ? `Cùng kênh với kết nối hiện tại (${p.replaces.name}): chỉ thay token, job giữ nguyên.` : `Sẽ thay kết nối hiện tại (${p.replaces.name}, ${p.replaces.id}) bằng kênh khác. Job đã gắn kênh cũ KHÔNG tự chuyển sang kênh mới.`}
        </div>
      ) : null}
      {!p.refreshTokenReturned ? (
        <div className="small f-warn">
          Google không trả refresh token.{" "}
          {p.canKeepOldRefresh ? "Studio sẽ giữ refresh token cũ (cùng kênh, cùng OAuth client)." : "Không thể dùng kết nối này: gỡ quyền của ứng dụng tại myaccount.google.com/permissions rồi kết nối lại."}
        </div>
      ) : null}
      {p.channelMismatch ? (
        <label className="small f-warn">
          <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} /> Kênh này ({p.identity.id}) khác channelId trong config/publishing.json ({p.configuredChannelId}). Tôi xác nhận vẫn dùng kênh này.
        </label>
      ) : null}
      <div className="row">
        <button type="button" className="btn btn-primary" disabled={busy || (p.channelMismatch && !accept) || (!p.refreshTokenReturned && !p.canKeepOldRefresh)} onClick={() => act(true)}>
          Dùng kênh này
        </button>
        <button type="button" className="btn" disabled={busy} onClick={() => act(false)}>
          Huỷ
        </button>
        <span className="muted small">Hết hạn lúc {fmtVN(p.expiresAt)}</span>
      </div>
    </article>
  );
};

// ---- Facebook -----------------------------------------------------------------------------

const FacebookCard: React.FC<{ t: TargetView; v: View; reload: () => void }> = ({ t, v, reload }) => {
  const { busy, run } = useRun(reload);
  const [modal, setModal] = useState(false);
  const stored = t.draft ?? t.active;
  const [editing, setEditing] = useState(false);
  const [pageId, setPageId] = useState(stored?.expectedId ?? t.configuredExpectedId ?? "");
  const [token, setToken] = useState("");
  const hasStoredToken = Boolean(stored?.secretStored);
  const reset = () => {
    setEditing(false);
    setToken("");
    setPageId(stored?.expectedId ?? t.configuredExpectedId ?? "");
  };
  const save = async () => {
    const r = await run(
      "save",
      () => send<{ check: LastCheck; promoted: boolean; replaced: string | null }>("POST", `/api/connections/${t.key}/facebook`, { expectedRev: v.rev, pageId: pageId.trim(), token: token || undefined }),
      (x) => (x.promoted ? (x.replaced === "account" ? "Đã xác minh và thay bằng Page mới. Job gắn Page cũ không tự chuyển." : "Đã lưu và xác minh Page.") : `Chưa xác minh: ${x.check.message} Kết nối cũ (nếu có) giữ nguyên.`),
    );
    if (r) reset();
  };
  return (
    <article className="card conn-card">
      <CardHead t={t} name="Facebook Page" />
      <div className="small muted">{SOURCE[t.source]}</div>
      <IdentityBlock identity={t.identity} title={t.status === "verified" ? "Page đã xác minh" : "Page xác minh lần trước"} />
      {t.expectedMismatch ? <div className="f-warn small">pageId trong config/publishing.json ({t.configuredExpectedId}) khác Page đã xác minh.</div> : null}
      <CheckLine check={t.lastCheck} />
      <Caps caps={t.capabilities} />
      <JobsNote t={t} />
      {t.draft ? (
        <div className="draft small">
          <strong>Cấu hình mới chưa xác minh</strong> (Page ID {t.draft.expectedId}, lưu {fmtVN(t.draft.createdAt)}). Kết nối đang dùng không đổi.
          <CheckLine check={t.draft.lastCheck} />
          <div className="row">
            <button type="button" className="btn btn-small" disabled={Boolean(busy)} onClick={() => run("checkdraft", () => send<{ check: LastCheck; promoted: boolean }>("POST", `/api/connections/${t.key}/check`, { draft: true }), (r) => (r.promoted ? "Đã xác minh, cấu hình mới được dùng." : r.check.message))}>
              Kiểm tra lại cấu hình mới
            </button>
            <button type="button" className="btn btn-small" disabled={Boolean(busy)} onClick={() => run("discard", () => send("POST", `/api/connections/${t.key}/draft/discard`, { expectedRev: v.rev }), () => "Đã bỏ cấu hình mới.")}>
              Bỏ cấu hình mới
            </button>
          </div>
        </div>
      ) : null}
      <div className="row">
        {t.source !== "none" ? (
          <button type="button" className="btn" disabled={Boolean(busy)} onClick={() => run("check", () => send<{ check: LastCheck }>("POST", `/api/connections/${t.key}/check`, {}), (r) => r.check.message)}>
            {busy === "check" ? "Đang kiểm tra…" : "Kiểm tra kết nối"}
          </button>
        ) : null}
        {!editing ? (
          <button type="button" className="btn btn-primary" onClick={() => setEditing(true)}>
            {t.active ? "Thay thế thông tin" : "Nhập Page ID và token"}
          </button>
        ) : null}
        {t.source === "studio" ? (
          <button type="button" className="btn" disabled={Boolean(busy)} onClick={() => setModal(true)}>
            Gỡ khỏi Studio
          </button>
        ) : null}
      </div>
      {editing ? (
        <div className="stack small">
          <label className="field">
            Page ID
            <input value={pageId} onChange={(e) => setPageId(e.target.value)} inputMode="numeric" autoComplete="off" />
          </label>
          <label className="field">
            Page Access Token {hasStoredToken ? <span className="muted">(để trống = giữ token đã lưu)</span> : null}
            <input type="password" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="new-password" spellCheck={false} />
          </label>
          <div className="row">
            <button type="button" className="btn btn-primary" disabled={Boolean(busy) || !pageId.trim() || (!token && !hasStoredToken)} onClick={save}>
              {busy === "save" ? "Đang lưu và kiểm tra…" : "Lưu và kiểm tra"}
            </button>
            <button type="button" className="btn" onClick={reset}>
              Huỷ
            </button>
          </div>
          <p className="muted">
            Studio gọi <code>GET /{v.graphVersion}/me</code> (chỉ đọc) để xác định Page của token và đối chiếu Page ID. Không tạo bài, không upload. Cấu hình mới chỉ thay kết nối cũ khi xác minh đúng Page; nếu lỗi, bản mới được giữ
            riêng để sửa.
          </p>
        </div>
      ) : null}
      <EnvBlock t={t} v={v} reload={reload} />
      <details className="setup">
        <summary>Cách lấy Page Access Token và giới hạn</summary>
        <ul className="small">
          <li>Cần một ứng dụng Meta (loại Business) mà bạn là admin/developer, và bạn có vai trò quản lý trên Page.</li>
          <li>
            Lấy User token có quyền <code>pages_show_list</code>, <code>pages_read_engagement</code>, <code>pages_manage_posts</code> (ví dụ qua Graph API Explorer), rồi gọi <code>/me/accounts</code> để lấy Page token. Đổi sang token dài
            hạn theo hướng dẫn của Meta nếu cần.
          </li>
          <li>Page token có thể mất hiệu lực khi đổi mật khẩu, mất vai trò trên Page, gỡ ứng dụng hoặc hết hạn; Studio không hứa token tồn tại vĩnh viễn.</li>
          <li>Quyền đăng chưa được xác minh trong bản này (cần App token cho debug_token).</li>
          <li>Thu hồi quyền trên Meta: Cài đặt Facebook → Ứng dụng và trang web (hoặc Meta Business Suite → Tích hợp) → gỡ ứng dụng. Studio không tự thu hồi từ xa.</li>
        </ul>
      </details>
      {modal ? <ConfirmRemove t={t} v={v} onClose={() => setModal(false)} reload={reload} /> : null}
    </article>
  );
};

// ---- TikTok -------------------------------------------------------------------------------

const TiktokCard: React.FC<{ t: TargetView; v: View; reload: () => void }> = ({ t, v, reload }) => {
  const { busy, run } = useRun(reload);
  const [editing, setEditing] = useState(!t.tiktok);
  const [input, setInput] = useState(t.tiktok ? `@${t.tiktok.username}` : "");
  useEffect(() => {
    setEditing(!t.tiktok);
    setInput(t.tiktok ? `@${t.tiktok.username}` : "");
  }, [t.tiktok?.savedAt]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <article className="card conn-card">
      <CardHead t={t} name="TikTok" />
      {t.tiktok ? (
        <div className="small">
          <div>
            <strong>Đã lưu tài khoản — Đăng thủ công:</strong> @{t.tiktok.username} ·{" "}
            <a href={t.tiktok.profileUrl} target="_blank" rel="noopener noreferrer">
              Mở hồ sơ
            </a>
          </div>
          <div className="f-warn">Danh tính chưa được xác minh bằng API. Studio không mở hay dò trang này; hãy tự kiểm tra đúng tài khoản trước khi đăng.</div>
          <div className="muted">Lưu lúc {fmtVN(t.tiktok.savedAt)}</div>
        </div>
      ) : (
        <p className="small muted">Chưa lưu tài khoản TikTok đích.</p>
      )}
      <Caps caps={t.capabilities} />
      {editing ? (
        <div className="row">
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="@ten hoặc https://www.tiktok.com/@ten" size={40} autoComplete="off" />
          <button type="button" className="btn btn-primary" disabled={Boolean(busy) || !input.trim()} onClick={() => run("save", () => send<{ username: string }>("POST", `/api/connections/${t.key}/tiktok`, { expectedRev: v.rev, input }), (r) => `Đã lưu @${r.username} (đăng thủ công).`)}>
            Lưu
          </button>
          {t.tiktok ? (
            <button type="button" className="btn" onClick={() => setEditing(false)}>
              Huỷ
            </button>
          ) : null}
        </div>
      ) : (
        <div className="row">
          <button type="button" className="btn" onClick={() => setEditing(true)}>
            Sửa
          </button>
          <button type="button" className="btn" disabled={Boolean(busy)} onClick={() => run("rm", () => send("POST", `/api/connections/${t.key}/tiktok/remove`, { expectedRev: v.rev }), () => "Đã xoá cấu hình TikTok.")}>
            Xoá cấu hình
          </button>
        </div>
      )}
      <p className="small muted">Không có token, không đăng qua API. Tài khoản này được ghi vào tiktok.md trong bộ delivery.</p>
    </article>
  );
};

const MovingMachine: React.FC = () => (
  <TechDetails summary="Chuyển sang máy khác hoặc tài khoản Windows khác">
    <ul className="small">
      <li>Bí mật mã hoá bằng DPAPI chỉ giải mã được dưới đúng tài khoản Windows trên đúng máy này. Studio không xuất token dạng văn bản thường.</li>
      <li>Trên máy mới: thiết lập lại OAuth client (file JSON từ Google Cloud), bấm Kết nối YouTube; nhập lại Page ID và Page Access Token; nhập lại username TikTok.</li>
      <li>Nếu chép cả thư mục runtime/connections sang máy mới, metadata vẫn đọc được nhưng bí mật không giải mã được: Studio báo "Cần kết nối lại".</li>
    </ul>
  </TechDetails>
);
