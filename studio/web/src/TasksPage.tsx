import React from "react";
import { get, type Task } from "./api";
import { Badge, Empty, ErrorBox, fmtVN, Loading, useAsync } from "./ui";

const TASK_STATE: Record<Task["state"], { label: string; tone: string }> = {
  queued: { label: "Đang chờ", tone: "wait" },
  running: { label: "Đang chạy", tone: "wait" },
  succeeded: { label: "Xong", tone: "ok" },
  failed: { label: "Thất bại", tone: "bad" },
  interrupted: { label: "Bị gián đoạn", tone: "warn" },
  cancelled: { label: "Đã huỷ", tone: "none" },
};
const TASK_TYPE: Record<string, string> = {
  "delivery-build": "Tạo bộ đăng thủ công",
  // Records from the removed Claude API flow (display only).
  "ai-ideas": "Claude API: đề xuất ý tưởng (đã gỡ)",
  "ai-draft": "Claude API: viết nháp (đã gỡ)",
  "ai-revise": "Claude API: sửa kịch bản (đã gỡ)",
};

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
        Công việc chạy trong máy chủ Studio, vẫn tiếp tục khi bạn đóng tab. Nếu máy chủ dừng giữa chừng, công việc được ghi "Bị gián đoạn", không được coi là thành công và không tự chạy lại.
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
                  <td>{TASK_TYPE[t.type] ?? t.type}</td>
                  <td>{t.episode ? <a href={`#/tap/${t.episode}/${t.type.startsWith("ai-") ? "kich-ban" : "phat-hanh"}`}>{t.episode}</a> : <span className="muted">—</span>}</td>
                  <td>
                    <Badge tone={TASK_STATE[t.state]?.tone ?? "none"}>{TASK_STATE[t.state]?.label ?? t.state}</Badge>
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
