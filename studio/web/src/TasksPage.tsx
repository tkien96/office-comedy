import React from "react";
import { get, type AiTask } from "./api";
import { AiTaskPanel, costText, TASK_STATE, TASK_TYPE } from "./AiTaskPanel";
import { Badge, Empty, ErrorBox, fmtVN, Loading, useAsync } from "./ui";

export const TasksPage: React.FC = () => {
  const { data, error, loading, reload } = useAsync(() => get<{ tasks: AiTask[] }>("/api/tasks"), []);
  const active = (data?.tasks ?? []).filter((t) => t.state === "queued" || t.state === "running");
  return (
    <section className="stack">
      <header className="page-head">
        <h1>Công việc nền</h1>
        <button type="button" className="btn" onClick={reload}>
          Tải lại
        </button>
      </header>
      <p className="muted small">
        Công việc chạy trong máy chủ Studio, vẫn tiếp tục khi bạn đóng tab. Mặc định chỉ một công việc AI chạy cùng lúc; các việc khác chờ lượt. Nếu máy chủ dừng giữa chừng, công việc được ghi "Bị
        gián đoạn", không được coi là thành công và không tự gọi lại Claude.
      </p>
      {loading && !data ? <Loading /> : null}
      {error ? <ErrorBox message={error} onRetry={reload} /> : null}
      {active.map((t) => (
        <AiTaskPanel key={t.id} task={t} now={Date.now()} onChanged={reload} />
      ))}
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
                <th>Chi phí</th>
                <th>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {data.tasks.map((t) => (
                <tr key={t.id}>
                  <td>{TASK_TYPE[t.type] ?? t.type}</td>
                  <td>{t.episode ? <a href={`#/tap/${t.episode}/${t.type.startsWith("ai-") ? "kich-ban" : "phat-hanh"}`}>{t.episode}</a> : <span className="muted">—</span>}</td>
                  <td>
                    <Badge tone={TASK_STATE[t.state].tone}>{TASK_STATE[t.state].label}</Badge>
                  </td>
                  <td>{fmtVN(t.createdAt)}</td>
                  <td>{fmtVN(t.finishedAt)}</td>
                  <td className="small">{t.type.startsWith("ai-") ? costText(t) : "—"}</td>
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
