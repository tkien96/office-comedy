import React, { useState } from "react";
import { ApiError, send, type PartState } from "./api";
import { fmtVN, Modal, STATUS, StatusBadge, TechDetails, useToast } from "./ui";

// Approve / revoke one product. The request carries the viewToken of the
// version on screen; the backend refuses if the product or a source changed.

export const ApprovalPanel: React.FC<{ episode: string; part: PartState; onChanged: () => void; compact?: boolean }> = ({ episode, part, onChanged, compact }) => {
  const toast = useToast();
  const [confirm, setConfirm] = useState<"approve" | "revoke" | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [stale, setStale] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    try {
      if (confirm === "approve") await send("POST", `/api/episodes/${episode}/approve`, { part: part.part, viewToken: part.viewToken, note: note || undefined });
      else await send("POST", `/api/episodes/${episode}/approve`, { part: part.part, revoke: true, note: note || undefined });
      toast("ok", confirm === "approve" ? `Đã duyệt: ${part.label}.` : `Đã thu hồi duyệt: ${part.label}.`);
      setConfirm(null);
      setNote("");
      onChanged();
    } catch (e) {
      const err = e as ApiError;
      if (err.conflict) {
        setStale(err.message);
        setConfirm(null);
      } else toast("bad", err.message);
    } finally {
      setBusy(false);
    }
  };

  const canApprove = part.status !== "missing" && part.status !== "approved" && part.viewToken !== null;
  const canRevoke = part.status === "approved" || part.status === "needs_reapproval" || part.status === "needs_recheck";

  return (
    <div className={compact ? "approval approval-compact" : "approval"}>
      <div className="approval-head">
        <strong>{part.label}</strong> <StatusBadge status={part.status} />
        {part.approvedAt && part.status === "approved" ? <span className="muted"> · duyệt ngày {part.approvedAt}</span> : null}
      </div>
      {!compact || part.status !== "approved" ? <p className="muted small">{STATUS[part.status].explain}</p> : null}
      {part.status === "needs_recheck" && part.changedSources.length ? <p className="small">Nguồn đã đổi: {part.changedSources.join(", ")}.</p> : null}
      {stale ? (
        <div className="state state-error small">
          {stale}{" "}
          <button type="button" className="btn btn-small" onClick={() => (setStale(null), onChanged())}>
            Tải lại
          </button>
        </div>
      ) : null}
      <div className="approval-actions">
        {canApprove ? (
          <button type="button" className="btn btn-primary" onClick={() => setConfirm("approve")}>
            {part.status === "not_approved" ? "Duyệt bản này" : "Duyệt lại bản hiện tại"}
          </button>
        ) : null}
        {canRevoke ? (
          <button type="button" className="btn" onClick={() => setConfirm("revoke")}>
            Thu hồi duyệt
          </button>
        ) : null}
        {part.status === "missing" ? <span className="muted small">Chưa có sản phẩm nên chưa duyệt được.</span> : null}
      </div>
      {!compact ? (
        <TechDetails>
          <div>Hash hiện tại: <code>{part.hash ?? "—"}</code></div>
          <div>Phụ thuộc nguồn: {part.dependsOn.length ? part.dependsOn.join(", ") : "không có"}</div>
          <div>Mã phiên bản đang xem: <code>{part.viewToken ?? "—"}</code></div>
          <div>Chi tiết: {part.detail}</div>
        </TechDetails>
      ) : null}
      {confirm ? (
        <Modal
          title={confirm === "approve" ? "Xác nhận duyệt" : "Xác nhận thu hồi duyệt"}
          onClose={() => !busy && setConfirm(null)}
          actions={
            <>
              <button type="button" className="btn" onClick={() => setConfirm(null)} disabled={busy}>
                Huỷ
              </button>
              <button type="button" className="btn btn-primary" onClick={submit} disabled={busy}>
                {busy ? "Đang ghi…" : confirm === "approve" ? "Duyệt" : "Thu hồi"}
              </button>
            </>
          }
        >
          <p>
            {confirm === "approve" ? "Bạn đang duyệt" : "Bạn đang thu hồi duyệt"}: <strong>{part.label}</strong> của tập <strong>{episode}</strong>.
          </p>
          {confirm === "approve" ? (
            <>
              <p className="small">
                Duyệt gắn với đúng phiên bản đang hiển thị (mã <code>{part.hash?.slice(0, 12)}</code>). Nếu file hoặc nguồn ({part.dependsOn.join(", ") || "không có"}) đổi sau khi bạn mở trang, máy chủ sẽ từ chối và yêu cầu tải lại.
              </p>
              <p className="small">
                <strong>Duyệt nội dung không có nghĩa là đồng ý đăng.</strong> Đăng bài là bước riêng, hiện chưa có.
              </p>
            </>
          ) : (
            <p className="small">Sản phẩm sẽ trở về trạng thái "Chờ duyệt". File không bị thay đổi.</p>
          )}
          <label className="field">
            Ghi chú (không bắt buộc)
            <input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
          </label>
          <p className="muted small">Thời điểm: {fmtVN(new Date().toISOString())} (giờ Việt Nam)</p>
        </Modal>
      ) : null}
    </div>
  );
};
