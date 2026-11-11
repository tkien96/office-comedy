import React from "react";
import { get, type Task } from "./api";
import { Badge, Empty, ErrorBox, fmtVN, Loading, useAsync } from "./ui";

const STATE: Record<Task["state"], { label: string; tone: string }> = {
  queued: { label: "Đang chờ", tone: "wait" },
  running: { label: "Đang chạy", tone: "wait" },
  succeeded: { label: "Xong", tone: "ok" },
  failed: { label: "Thất bại", tone: "bad" },
  interrupted: { label: "Bị gián đoạn", tone: "bad" },
};
const TYPE: Record<string, string> = { "delivery-build": "Tạo bộ delivery" };

export const TasksPage: React.FC = () => {
  const { data, error, loading, reload } = useAsync(() => get<{ tasks: Task[] }>("/api/tasks"), []);
  return (
    <section className="stack">
      <header className="page-head">
        <h1>Công việc nền</h1>
        <button type="button" className="btn" onClick={reload}>
          Tải lại
        </button>
      </header>
      <p className="muted small">
        Công việc chạy trong máy chủ Studio, vẫn tiếp tục khi bạn đóng tab. Nếu máy chủ dừng giữa chừng, công việc được ghi "Bị gián đoạn" và kết quả không được coi là thành công.
      </p>
      {loading && !data ? <Loading /> : null}
      {error ? <ErrorBox message={error} onRetry={reload} /> : null}
      {data && !data.tasks.length ? <Empty>Chưa có công việc nào.</Empty> : null}
      {data && data.tasks.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Công việc</th>
                <th>Tập</th>
                <th>Trạng thái</th>
                <th>Bắt đầu (giờ VN)</th>
                <th>Kết thúc</th>
                <th>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {data.tasks.map((t) => (
                <tr key={t.id}>
                  <td>{TYPE[t.type] ?? t.type}</td>
                  <td>
                    <a href={`#/tap/${t.episode}/phat-hanh`}>{t.episode}</a>
                  </td>
                  <td>
                    <Badge tone={STATE[t.state].tone}>{STATE[t.state].label}</Badge>
                  </td>
                  <td>{fmtVN(t.createdAt)}</td>
                  <td>{fmtVN(t.finishedAt)}</td>
                  <td className="small">{t.message ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
};
