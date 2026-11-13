import React, { useEffect, useState } from "react";
import { get, send, type AiStatus, type AiTask } from "./api";
import { Badge, fmtVN, TechDetails, useToast } from "./ui";

// Status of one AI task: real states only (no fake percentage), elapsed time,
// cancel, user-initiated retry, tokens reported by the API and a cost
// ESTIMATE ("không xác định" when unknown — never 0).

export const TASK_STATE: Record<AiTask["state"], { label: string; tone: string }> = {
  queued: { label: "Đang chờ lượt", tone: "wait" },
  running: { label: "Đang chạy", tone: "wait" },
  succeeded: { label: "Xong", tone: "ok" },
  failed: { label: "Thất bại", tone: "bad" },
  interrupted: { label: "Bị gián đoạn", tone: "bad" },
  cancelled: { label: "Đã huỷ", tone: "none" },
};
export const TASK_TYPE: Record<string, string> = {
  "ai-ideas": "Claude đề xuất ý tưởng",
  "ai-draft": "Claude viết bản nháp",
  "ai-revise": "Claude sửa kịch bản",
  "delivery-build": "Tạo bộ delivery",
};
const ERROR_HINT: Record<string, string> = {
  not_configured: "Chưa cấu hình Claude trên máy này.",
  auth: "Khóa API bị từ chối.",
  rate_limit: "Vượt giới hạn tốc độ: yêu cầu chưa được xử lý, có thể thử lại sau.",
  overloaded: "Claude đang quá tải.",
  timeout_unknown: "Hết thời gian chờ: không biết yêu cầu đã được xử lý chưa.",
  network: "Lỗi mạng.",
  invalid_output: "Kết quả không đúng cấu trúc.",
  refusal: "Claude từ chối yêu cầu.",
  truncated: "Kết quả bị cắt vì quá dài.",
};

export const isActive = (t: AiTask | null | undefined) => Boolean(t && (t.state === "queued" || t.state === "running"));

const elapsed = (t: AiTask, now: number) => {
  const start = Date.parse(t.startedAt ?? t.createdAt);
  const end = t.finishedAt ? Date.parse(t.finishedAt) : now;
  const s = Math.max(0, Math.round((end - start) / 1000));
  return s >= 60 ? `${Math.floor(s / 60)} phút ${s % 60} giây` : `${s} giây`;
};

export const costText = (t: AiTask) => {
  const calls = t.aiCalls ?? [];
  if (!calls.length) return t.state === "queued" ? "chưa gọi Claude" : "không xác định (chưa có số token)";
  if (calls.some((c) => c.cost.kind !== "estimated")) {
    const known = calls.filter((c) => c.cost.kind === "estimated").reduce((s, c) => s + (c.cost.usd ?? 0), 0);
    return `không xác định${known ? ` (phần đã biết ~${known.toFixed(4)} USD)` : ""}`;
  }
  return `~${calls.reduce((s, c) => s + (c.cost.usd ?? 0), 0).toFixed(4)} USD (ước tính)`;
};

export const tokensText = (t: AiTask) => {
  const calls = (t.aiCalls ?? []).filter((c) => c.usage);
  if (!calls.length) return "—";
  const i = calls.reduce((s, c) => s + (c.usage?.inputTokens ?? 0), 0);
  const o = calls.reduce((s, c) => s + (c.usage?.outputTokens ?? 0), 0);
  return `${i.toLocaleString("vi-VN")} vào / ${o.toLocaleString("vi-VN")} ra (${calls.length} lần gọi)`;
};

/** Polls the task while it is active; calls onFinished once when it stops. */
export const useTask = (initial: AiTask | null, onFinished?: (t: AiTask) => void) => {
  const [task, setTask] = useState<AiTask | null>(initial);
  const [now, setNow] = useState(Date.now());
  useEffect(() => setTask(initial), [initial?.id, initial?.state]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!task || !isActive(task)) return;
    const t = setInterval(async () => {
      setNow(Date.now());
      try {
        const next = await get<AiTask>(`/api/tasks/${task.id}`);
        if (!isActive(next)) {
          setTask(next);
          onFinished?.(next);
        } else setTask(next);
      } catch {
        /* server down: keep showing the last state */
      }
    }, 1500);
    return () => clearInterval(t);
  }, [task?.id, task?.state]); // eslint-disable-line react-hooks/exhaustive-deps
  return { task, setTask, now };
};

export const AiTaskPanel: React.FC<{ task: AiTask; now: number; onChanged: (t: AiTask) => void }> = ({ task, now, onChanged }) => {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const act = async (what: "cancel" | "retry") => {
    setBusy(true);
    try {
      if (what === "cancel") onChanged(await send<AiTask>("POST", `/api/tasks/${task.id}/cancel`));
      else {
        const r = await send<{ task: AiTask }>("POST", `/api/tasks/${task.id}/retry`);
        toast("info", "Đã tạo lượt thử lại.");
        onChanged(r.task);
      }
    } catch (e) {
      toast("bad", (e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const canRetry = task.type.startsWith("ai-") && ["failed", "interrupted", "cancelled"].includes(task.state);
  return (
    <div className={`task-panel task-${task.state}`}>
      <div className="row">
        <strong>{TASK_TYPE[task.type] ?? task.type}</strong>
        <Badge tone={TASK_STATE[task.state].tone}>{TASK_STATE[task.state].label}</Badge>
        <span className="muted small">
          {task.state === "queued" ? "chờ từ" : "bắt đầu"} {fmtVN(task.startedAt ?? task.createdAt)} · {isActive(task) ? "đã chạy" : "thời gian"} {elapsed(task, now)}
        </span>
      </div>
      {isActive(task) ? <p className="muted small">Bạn có thể đóng tab; công việc vẫn chạy trên máy chủ Studio. Studio không hiển thị phần trăm vì không đo được tiến độ thật của Claude.</p> : null}
      {task.message ? (
        <p className={task.state === "failed" || task.state === "interrupted" ? "f-bad small" : "small"}>
          {task.errorKind && ERROR_HINT[task.errorKind] && !task.message.startsWith(ERROR_HINT[task.errorKind].slice(0, 12)) ? <strong>{ERROR_HINT[task.errorKind]} </strong> : null}
          {task.message}
        </p>
      ) : null}
      {task.mayHaveBeenProcessed && task.state !== "succeeded" ? <p className="f-warn small">Yêu cầu có thể đã được Claude xử lý (và tính phí). Thử lại sẽ gửi một yêu cầu mới.</p> : null}
      <p className="small">
        Token: {tokensText(task)} · Chi phí: {costText(task)}
      </p>
      <div className="row">
        {isActive(task) ? (
          <button type="button" className="btn" onClick={() => act("cancel")} disabled={busy}>
            Huỷ
          </button>
        ) : null}
        {canRetry ? (
          <button type="button" className="btn" onClick={() => act("retry")} disabled={busy}>
            Thử lại
          </button>
        ) : null}
      </div>
      <TechDetails>
        <div>Mã công việc: <code>{task.id}</code>{task.retryOf ? <> · thử lại của <code>{task.retryOf}</code></> : null}</div>
        {(task.aiCalls ?? []).map((c, i) => (
          <div key={i}>
            {c.purpose} · {c.model ?? "?"} · {c.outcome} · {c.cost.note}
          </div>
        ))}
      </TechDetails>
    </div>
  );
};

export const AiStatusBanner: React.FC<{ status: AiStatus | null }> = ({ status }) => {
  if (!status) return null;
  if (status.provider === "mock")
    return <div className="state state-warn small"><strong>Chế độ kiểm thử (mock):</strong> kết quả AI là dữ liệu giả có nhãn [MOCK], không gọi Claude thật.</div>;
  if (!status.configured)
    return (
      <div className="state state-warn small">
        <strong>Chưa cấu hình Claude.</strong> {status.problems.join(" ")} Thiết lập trên máy này: mở file <code>.env</code> ở thư mục dự án (tạo từ <code>.env.example</code> nếu chưa có), điền{" "}
        <code>ANTHROPIC_API_KEY=</code> bằng khóa từ Claude Console, lưu file rồi khởi động lại Studio. Không dán khóa vào chat hay vào giao diện này. Gọi API tính phí theo tài khoản Claude Console, tách
        với gói Claude Code.
      </div>
    );
  return (
    <p className="muted small">
      Claude: model <code>{status.model}</code>, effort {status.effort}. Chỉ gọi Claude khi bạn bấm nút tạo hoặc sửa; mở, xem hay duyệt không gọi model.
    </p>
  );
};
