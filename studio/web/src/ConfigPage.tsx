import React from "react";
import { get } from "./api";
import { STATUS } from "./SocialConnections";
import { Badge, ErrorBox, fmtVN, Loading, PLATFORM, TechDetails, useAsync } from "./ui";

type Config = {
  production: Record<string, string>;
  voices: {
    id: string;
    displayName: string;
    direction: string;
    voice: { voiceId: string; type: string; ref: string; model: string | null; approvedAt: string | null; settings: Record<string, unknown>; rightsConfirmed: boolean; usable: boolean } | null;
  }[];
  addressing: Record<string, string>;
  folders: { path: string; note: string }[];
  publishing: { timezone: string; utcOffset: string; missedGraceMinutes: number; maxAttempts: number } | null;
  integrations: {
    key: string;
    platform: string;
    label: string;
    source: "studio" | "env" | "none" | "manual";
    status: keyof typeof STATUS;
    identity: { id: string; name: string } | null;
    lastCheckedAt: string | null;
    plan: string;
    capabilities: Record<string, { api: boolean; schedule?: boolean; note?: string }>;
  }[];
  notImplemented: string[];
};

const SOURCE_SHORT: Record<string, string> = { studio: "Kết nối Studio", env: "Biến môi trường (.env)", none: "—", manual: "Thủ công" };
const ROLE_NAME: Record<string, string> = { narrator: "Người kể (lời dẫn)" };

export const ConfigPage: React.FC = () => {
  const { data, error, loading, reload } = useAsync(() => get<Config>("/api/config"), []);
  return (
    <section className="stack">
      <header className="page-head">
        <h1>Cấu hình</h1>
      </header>
      <p className="muted small">Giọng đã duyệt và thông số sản xuất chỉ xem. Tài khoản mạng xã hội quản lý ở trang Kết nối mạng xã hội. Không có token hoặc khóa API nào được gửi xuống trình duyệt.</p>
      {loading && !data ? <Loading /> : null}
      {error ? <ErrorBox message={error} onRetry={reload} /> : null}
      {data ? (
        <>
          <div className="row">
            <h2>Tài khoản mạng xã hội</h2>
            <a className="btn btn-primary" href="#/cau-hinh/ket-noi">
              Quản lý kết nối
            </a>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nền tảng</th>
                  <th>Trạng thái</th>
                  <th>Tài khoản</th>
                  <th>Nguồn cấu hình</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {data.integrations.map((i) => (
                  <tr key={i.key}>
                    <td>
                      {PLATFORM[i.platform] ?? i.platform}
                      <div className="muted small">{i.label}</div>
                    </td>
                    <td>
                      <Badge tone={STATUS[i.status].tone}>{STATUS[i.status].label}</Badge>
                      {i.lastCheckedAt ? <div className="muted small">kiểm tra {fmtVN(i.lastCheckedAt)}</div> : null}
                    </td>
                    <td className="small">{i.identity ? <>{i.identity.name} <code>{i.identity.id}</code></> : <span className="muted">chưa xác minh</span>}</td>
                    <td className="small">{SOURCE_SHORT[i.source]}</td>
                    <td className="small">{i.plan}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.publishing ? (
            <p className="small">
              Múi giờ đăng bài: {data.publishing.timezone} ({data.publishing.utcOffset}) · job quá giờ {data.publishing.missedGraceMinutes} phút chuyển "Lỡ giờ", không tự đăng · thử lại tối đa {data.publishing.maxAttempts} lần.
            </p>
          ) : null}

          <h2>Nhân vật và giọng đã chốt</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Vai</th>
                  <th>Định hướng</th>
                  <th>Giọng đã duyệt</th>
                </tr>
              </thead>
              <tbody>
                {data.voices.map((v) => (
                  <tr key={v.id}>
                    <td>{ROLE_NAME[v.id] ?? v.displayName}</td>
                    <td className="small">{v.direction}</td>
                    <td className="small">
                      {v.voice ? (
                        <>
                          <div>
                            Giọng clone từ tham chiếu "{v.voice.ref}" (<code>{v.voice.voiceId}</code>)
                          </div>
                          <div>
                            Duyệt ngày {v.voice.approvedAt ?? "?"} · quyền dùng giọng: {v.voice.rightsConfirmed ? "đã xác nhận" : "CHƯA xác nhận"}
                          </div>
                        </>
                      ) : (
                        "Chưa chốt"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TechDetails summary="Model và thiết lập giọng">
            <pre>{JSON.stringify(data.voices.map((v) => ({ vai: v.id, model: v.voice?.model, settings: v.voice?.settings })), null, 2)}</pre>
          </TechDetails>
          <h3>Xưng hô</h3>
          <ul className="small">
            {Object.entries(data.addressing)
              .filter(([k]) => k !== "decidedAt")
              .map(([k, v]) => (
                <li key={k}>
                  <strong>{k}:</strong> {v}
                </li>
              ))}
          </ul>

          <h2>Thông số sản xuất</h2>
          <ul className="small">
            {Object.entries(data.production).map(([k, v]) => (
              <li key={k}>{v}</li>
            ))}
          </ul>

          <h2>Thư mục lưu sản phẩm</h2>
          <ul className="small">
            {data.folders.map((f) => (
              <li key={f.path}>
                <code>{f.path}</code>: {f.note}
              </li>
            ))}
          </ul>

          <h2>Chưa có trong Studio</h2>
          <ul className="small">
            {data.notImplemented.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
};
