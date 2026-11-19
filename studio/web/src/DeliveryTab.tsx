import React, { useCallback, useEffect, useState } from "react";
import { ApiError, get, send, type DeliveryCheck, type EpisodeDetail, type Task } from "./api";
import { Badge, ErrorBox, fmtVN, useToast } from "./ui";

// Manual-posting package (delivery/): build it from the current sources, check
// it still matches them, download it as a ZIP. Posting itself is done by hand.

const TASK_STATE: Record<Task["state"], { label: string; tone: string }> = {
  queued: { label: "Đang chờ", tone: "wait" },
  running: { label: "Đang chạy", tone: "wait" },
  succeeded: { label: "Xong", tone: "ok" },
  failed: { label: "Thất bại", tone: "bad" },
  interrupted: { label: "Bị gián đoạn", tone: "bad" },
  cancelled: { label: "Đã huỷ", tone: "none" },
};

export const DeliveryTab: React.FC<{ d: EpisodeDetail; reload: () => void }> = ({ d, reload }) => {
  const id = d.summary.id;
  const toast = useToast();
  const [check, setCheck] = useState<DeliveryCheck | null>(d.delivery ?? null);
  const [task, setTask] = useState<Task | null>((d.tasks ?? []).find((t) => t.type === "delivery-build") ?? null);
  const [checking, setChecking] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const active = task && (task.state === "queued" || task.state === "running");

  const refreshCheck = useCallback(async () => {
    setChecking(true);
    try {
      setCheck(await get<DeliveryCheck>(`/api/episodes/${id}/delivery/check`));
      setErr(null);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setChecking(false);
    }
  }, [id]);

  // Poll a running task (also after reopening the tab: the task comes from the server).
  useEffect(() => {
    if (!active || !task) return;
    const t = setInterval(async () => {
      try {
        const next = await get<Task>(`/api/tasks/${task.id}`);
        setTask(next);
        if (next.state !== "queued" && next.state !== "running") {
          toast(next.state === "succeeded" ? "ok" : "bad", next.state === "succeeded" ? "Đã tạo bộ delivery." : `Tạo bộ delivery thất bại: ${next.message}`);
          void refreshCheck();
          reload();
        }
      } catch (e) {
        setErr((e as ApiError).message);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [active, task, toast, refreshCheck, reload]);

  const build = async () => {
    try {
      const r = await send<{ task: Task; deduped: boolean }>("POST", `/api/episodes/${id}/delivery/build`);
      setTask(r.task);
      if (r.deduped) toast("info", "Đang có một lần tạo bộ delivery chạy; không tạo thêm.");
    } catch (e) {
      toast("bad", (e as Error).message);
    }
  };

  return (
    <section className="stack">
      <h2>Bộ đăng thủ công (delivery)</h2>
      <p className="muted small">
        Gồm video, phụ đề SRT, ảnh bìa, ảnh nhá hàng và bản dán + các bước đăng cho YouTube, Facebook, TikTok. Tạo lại toàn bộ từ nguồn hiện tại vào thư mục tạm, kiểm tra xong mới thay bộ cũ.
        Bạn tự đăng trên từng nền tảng.
      </p>
      <div className="row">
        <button type="button" className="btn btn-primary" onClick={build} disabled={Boolean(active)}>
          {active ? "Đang tạo bộ…" : check?.exists ? "Cập nhật bộ delivery" : "Tạo bộ delivery"}
        </button>
        <button type="button" className="btn" onClick={refreshCheck} disabled={checking}>
          {checking ? "Đang kiểm tra…" : "Kiểm tra bộ còn khớp nguồn"}
        </button>
        {check?.exists ? (
          <a className="btn" href={`/api/episodes/${id}/delivery.zip`} download>
            Tải ZIP
          </a>
        ) : (
          <button type="button" className="btn" disabled title="Chưa có bộ delivery">
            Tải ZIP
          </button>
        )}
      </div>
      {task ? (
        <p className="small">
          Lần gần nhất: <Badge tone={TASK_STATE[task.state].tone}>{TASK_STATE[task.state].label}</Badge> <span className="muted">bắt đầu {fmtVN(task.createdAt)}</span>
          {task.message ? <span> · {task.message}</span> : null}
        </p>
      ) : null}
      {err ? <ErrorBox message={err} /> : null}
      {check ? (
        !check.exists ? (
          <p className="muted">Chưa có bộ delivery.</p>
        ) : (
          <>
            <p>
              {check.ok ? <Badge tone="ok">Khớp nguồn hiện tại</Badge> : <Badge tone="bad">Bộ cũ hoặc bị sửa: tạo lại</Badge>}{" "}
              {check.builtAt ? <span className="muted small">tạo lúc {fmtVN(check.builtAt)}</span> : null}
            </p>
            {check.error ? <ErrorBox message={check.error} /> : null}
            <div className="table-wrap">
              <table>
                <tbody>
                  {check.rows.map((r) => (
                    <tr key={r.file}>
                      <td>{r.file}</td>
                      <td>{r.ok ? <span className="muted">khớp nguồn</span> : <span className="f-bad">{r.problem}</span>}</td>
                    </tr>
                  ))}
                  {check.extras.map((f) => (
                    <tr key={f}>
                      <td>{f}</td>
                      <td className="f-warn">File không do lệnh tạo ra (sẽ không bị xoá; cần chuyển ra chỗ khác trước khi tạo lại)</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )
      ) : null}
    </section>
  );
};
