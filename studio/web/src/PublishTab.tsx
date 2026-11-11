import React, { useCallback, useEffect, useState } from "react";
import { ApiError, get, send, type DeliveryCheck, type DryRunReport, type EpisodeDetail, type Task } from "./api";
import { Badge, ErrorBox, fmtVN, JOB_STATE, PLATFORM, TechDetails, Unavailable, useToast } from "./ui";

// Jobs, dry-run and the manual-posting delivery set. Nothing here uploads,
// schedules or posts: those controls are shown disabled with the reason.

const TYPE: Record<string, string> = { video: "Video", teaser_photo: "Bài ảnh nhá hàng", teaser_text: "Bài chữ nhá hàng" };
const LEVEL: Record<string, string> = { BLOCK: "Chặn", WARN: "Lưu ý", INFO: "Thông tin" };

export const PublishTab: React.FC<{ d: EpisodeDetail; reload: () => void }> = ({ d, reload }) => {
  const id = d.summary.id;
  const toast = useToast();
  const [report, setReport] = useState<DryRunReport | null>(d.lastDryRun ?? null);
  const [running, setRunning] = useState(false);

  const dryRun = async () => {
    setRunning(true);
    try {
      setReport(await send<DryRunReport>("POST", `/api/episodes/${id}/dry-run`));
      toast("info", "Đã chạy dry-run (không upload, không đặt lịch, không sửa job).");
    } catch (e) {
      toast("bad", (e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  const jobs = d.jobs ?? [];
  return (
    <div className="stack">
      <h2>Job phát hành</h2>
      <p className="muted small">Giờ hiển thị theo giờ Việt Nam (Asia/Ho_Chi_Minh, UTC+7). Lịch trong dự án chỉ là kế hoạch, không phải lịch nền tảng đã xác nhận.</p>
      {!jobs.length ? <p className="muted">Chưa có job nào (publishing/jobs.json).</p> : null}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nền tảng</th>
              <th>Loại bài</th>
              <th>Cách đăng</th>
              <th>Trạng thái</th>
              <th>Lịch (giờ Việt Nam)</th>
              <th>Liên kết</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id}>
                <td>{PLATFORM[j.platform] ?? j.platform}</td>
                <td>{TYPE[j.type] ?? j.type}</td>
                <td>{j.mode === "manual" ? "Thủ công" : "API"}</td>
                <td>
                  <Badge tone={JOB_STATE[j.state]?.tone ?? "none"}>{JOB_STATE[j.state]?.label ?? j.state}</Badge>
                </td>
                <td>
                  {j.scheduleLocal ? (
                    <>
                      {j.scheduleLocal} <span className="muted small">(giờ VN{j.state === "planned" ? ", chỉ trong dự án" : ""})</span>
                    </>
                  ) : (
                    <span className="muted">Chưa có lịch xác nhận</span>
                  )}
                </td>
                <td>{j.remote.url ? <span className="small">{j.remote.url}</span> : <span className="muted">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Kiểm tra điều kiện phát hành (dry-run)</h2>
      <div className="row">
        <button type="button" className="btn btn-primary" onClick={dryRun} disabled={running}>
          {running ? "Đang kiểm tra…" : "Chạy dry-run"}
        </button>
        <span className="muted small">Mỗi job chỉ bị chặn bởi sản phẩm và nội dung mà job đó dùng.</span>
      </div>
      {report ? <DryRunView report={report} /> : <p className="muted">Chưa chạy dry-run.</p>}

      <h2>Đăng và đặt lịch</h2>
      <Unavailable label="Kết nối tài khoản" reason="Chưa triển khai OAuth. Kế hoạch YouTube: docs/youtube-integration-plan.md." />
      <Unavailable label="Đặt lịch trên nền tảng" reason="Chưa có code gọi API nền tảng. Không có lịch nào được gửi đi." />
      <Unavailable label="Đăng ngay" reason="Chưa triển khai upload/đăng thật. Dùng bộ delivery để đăng thủ công." />

      <DeliverySection d={d} reload={reload} />
    </div>
  );
};

const DryRunView: React.FC<{ report: DryRunReport }> = ({ report }) => (
  <div className="stack">
    <p>
      <strong>
        {report.readyCount}/{report.total} job đủ điều kiện
      </strong>{" "}
      <span className="muted small">· kiểm tra lúc {fmtVN(report.checkedAt)} (giờ VN) · {report.note}</span>
    </p>
    {report.results.map((r) => (
      <div key={r.job} className={r.ready ? "dry dry-ok" : "dry dry-block"}>
        <div className="dry-head">
          <Badge tone={r.ready ? "ok" : "bad"}>{r.ready ? "Đạt" : "Chưa đạt"}</Badge> <strong>{PLATFORM[r.platform] ?? r.platform}</strong> · {TYPE[r.type] ?? r.type} · {r.mode === "manual" ? "thủ công" : "API"}
        </div>
        <ul>
          {r.findings.map((f, i) => (
            <li key={i} className={f.level === "BLOCK" ? "f-bad" : f.level === "WARN" ? "f-warn" : "f-info"}>
              <strong>{LEVEL[f.level]}:</strong> {f.msg}
            </li>
          ))}
        </ul>
        <TechDetails>
          <div>Job: <code>{r.job}</code></div>
          <div>Khóa chống trùng: <code>{r.idempotencyKey ?? "—"}</code></div>
          <div>UTC: {r.scheduleUtc ?? "—"}</div>
        </TechDetails>
      </div>
    ))}
  </div>
);

// ---- Delivery -------------------------------------------------------------------------

const TASK_STATE: Record<Task["state"], { label: string; tone: string }> = {
  queued: { label: "Đang chờ", tone: "wait" },
  running: { label: "Đang chạy", tone: "wait" },
  succeeded: { label: "Xong", tone: "ok" },
  failed: { label: "Thất bại", tone: "bad" },
  interrupted: { label: "Bị gián đoạn", tone: "bad" },
};

const DeliverySection: React.FC<{ d: EpisodeDetail; reload: () => void }> = ({ d, reload }) => {
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

  const allApproved = (d.parts ?? []).filter((p) => ["video", "captions", "thumbnail9x16", "teaser1x1"].includes(p.part) || p.part.startsWith("social.")).every((p) => p.status === "approved");

  return (
    <section className="stack">
      <h2>Bộ đăng thủ công (delivery)</h2>
      <p className="muted small">
        Tạo lại toàn bộ từ nguồn hiện tại vào thư mục tạm, kiểm tra xong mới thay bộ cũ. Xuất bộ không thay đổi trạng thái duyệt.
      </p>
      {!allApproved ? <div className="state state-warn small">Bộ còn sản phẩm chưa duyệt: dùng để xem thử, chưa đủ điều kiện phát hành.</div> : null}
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
