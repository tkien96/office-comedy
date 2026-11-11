import React from "react";
import { get } from "./api";
import { Badge, ErrorBox, Loading, PLATFORM, TechDetails, useAsync } from "./ui";

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
    state: "manual" | "not_implemented" | "not_configured" | "configured_unverified" | "verified";
    idField: string;
    hasId: boolean;
    envPresent: { name: string; present: boolean }[];
    configComplete: boolean;
    plan: string;
    capabilities: Record<string, { api: boolean; schedule?: boolean; note?: string }>;
  }[];
  notImplemented: string[];
};

const INTEGRATION: Record<string, { label: string; tone: string }> = {
  manual: { label: "Đăng thủ công", tone: "none" },
  not_implemented: { label: "Chưa triển khai tích hợp", tone: "none" },
  not_configured: { label: "Chưa cấu hình", tone: "wait" },
  configured_unverified: { label: "Có cấu hình, chưa kiểm tra kết nối", tone: "wait" },
  verified: { label: "Đã xác minh kết nối", tone: "ok" },
};
const ROLE_NAME: Record<string, string> = { narrator: "Người kể (lời dẫn)" };

export const ConfigPage: React.FC = () => {
  const { data, error, loading, reload } = useAsync(() => get<Config>("/api/config"), []);
  return (
    <section className="stack">
      <header className="page-head">
        <h1>Cấu hình</h1>
      </header>
      <p className="muted small">Chỉ xem. Bản đầu không cho đổi giọng đã duyệt hay cấu hình. Không có token hoặc khóa API nào được gửi xuống trình duyệt.</p>
      {loading && !data ? <Loading /> : null}
      {error ? <ErrorBox message={error} onRetry={reload} /> : null}
      {data ? (
        <>
          <h2>Tích hợp nền tảng</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nền tảng</th>
                  <th>Trạng thái</th>
                  <th>Cấu hình trong dự án</th>
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
                      <Badge tone={INTEGRATION[i.state].tone}>{INTEGRATION[i.state].label}</Badge>
                    </td>
                    <td className="small">
                      <div>
                        {i.idField}: {i.hasId ? "đã điền" : "chưa điền"}
                      </div>
                      {i.envPresent.map((e) => (
                        <div key={e.name}>
                          {e.name}: {e.present ? "có trong .env" : "chưa có"}
                        </div>
                      ))}
                      {i.envPresent.length && i.envPresent.every((e) => e.present) ? <div className="muted">Có biến môi trường không có nghĩa là đã kết nối.</div> : null}
                    </td>
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
