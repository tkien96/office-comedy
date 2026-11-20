import React from "react";
import { get } from "./api";
import { ErrorBox, Loading, TechDetails, useAsync } from "./ui";

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
  notImplemented: string[];
};

const ROLE_NAME: Record<string, string> = { narrator: "Người kể (lời dẫn)" };

export const ConfigPage: React.FC = () => {
  const { data, error, loading, reload } = useAsync(() => get<Config>("/api/config"), []);
  return (
    <section className="stack">
      <header className="page-head">
        <h1>Cấu hình</h1>
      </header>
      <p className="muted small">Giọng đã chốt và thông số sản xuất chỉ xem. Đăng social làm thủ công bằng bộ đăng thủ công của từng tập.</p>
      {loading && !data ? <Loading /> : null}
      {error ? <ErrorBox message={error} onRetry={reload} /> : null}
      {data ? (
        <>
          <h2>Nhân vật và giọng đã chốt</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Vai</th>
                  <th>Định hướng</th>
                  <th>Giọng đã chốt</th>
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
                            Chốt ngày {v.voice.approvedAt ?? "?"} · quyền dùng giọng: {v.voice.rightsConfirmed ? "đã xác nhận" : "CHƯA xác nhận"}
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
