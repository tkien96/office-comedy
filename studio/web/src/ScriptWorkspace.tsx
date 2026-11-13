import React, { useState } from "react";
import { ApiError, get, send, type AiStatus, type AiTask, type PartState, type ProposalMeta, type ScriptBeatDoc, type ScriptDiff, type ScriptDocT, type ScriptState, type VersionMeta } from "./api";
import { ApprovalPanel } from "./Approval";
import { AiStatusBanner, AiTaskPanel, isActive, useTask } from "./AiTaskPanel";
import { Badge, Empty, ErrorBox, fmtSec, fmtVN, Loading, Modal, TechDetails, useAsync, useToast } from "./ui";

// Script tab: current version (+ automatic checks), approval, manual edit,
// "ask Claude to revise" (whole or selected scenes), proposals with diff,
// accept/discard, and version history with restore (restore = new version).

const ROLE: Record<string, string> = { narrator: "Kiên (lời dẫn)", kien: "Kiên", trinh: "Trinh", sep: "Sếp" };
const SOURCE: Record<string, string> = { user: "bạn sửa", claude: "Claude", restore: "phục hồi", import: "bản có sẵn" };
const PSTATUS: Record<string, { label: string; tone: string }> = {
  pending: { label: "Chờ xem", tone: "wait" },
  accepted: { label: "Đã áp dụng", tone: "ok" },
  discarded: { label: "Đã bỏ", tone: "none" },
  conflict: { label: "Xung đột", tone: "bad" },
};

export const ScriptWorkspace: React.FC<{ episode: string; part?: PartState; reloadEpisode: () => void }> = ({ episode, part, reloadEpisode }) => {
  const st = useAsync(() => get<ScriptState>(`/api/episodes/${episode}/script`), [episode]);
  const ai = useAsync(() => get<AiStatus>("/api/ai/status"), []);
  const reload = () => {
    st.reload();
    reloadEpisode();
  };
  if (st.loading && !st.data) return <Loading />;
  if (st.error) return <ErrorBox message={st.error} onRetry={st.reload} />;
  const s = st.data!;
  return <Workspace key={`${s.current?.hash ?? "none"}-${s.proposals.length}-${s.activeTask?.id ?? ""}`} episode={episode} s={s} part={part} ai={ai.data} reload={reload} />;
};

const Workspace: React.FC<{ episode: string; s: ScriptState; part?: PartState; ai: AiStatus | null; reload: () => void }> = ({ episode, s, part, ai, reload }) => {
  const toast = useToast();
  const latest = s.activeTask ?? s.tasks[0] ?? null;
  const { task, setTask, now } = useTask(latest, (t) => {
    toast(t.state === "succeeded" ? "ok" : "bad", t.state === "succeeded" ? "Claude đã xong. Xem kết quả bên dưới." : `Công việc AI kết thúc: ${t.message ?? t.state}`);
    reload();
  });
  const [mode, setMode] = useState<"view" | "edit" | "revise">("view");
  const [openProposal, setOpenProposal] = useState<string | null>(null);
  const [openVersion, setOpenVersion] = useState<number | null>(null);
  const cur = s.current;
  const aiReady = Boolean(ai?.configured);
  const busyAi = isActive(task);

  const startDraft = async () => {
    try {
      const r = await send<{ task: AiTask }>("POST", `/api/episodes/${episode}/script/draft`);
      setTask(r.task);
    } catch (e) {
      toast("bad", (e as Error).message);
    }
  };

  return (
    <div className="stack">
      <AiStatusBanner status={ai} />
      {task ? <AiTaskPanel task={task} now={now} onChanged={setTask} /> : null}

      {!cur ? (
        <div className="card stack">
          <h2>Chưa có kịch bản</h2>
          {s.request ? (
            <>
              <p className="small">
                Yêu cầu ban đầu: <strong>{s.request.title}</strong> — {s.request.idea}
              </p>
              <button type="button" className="btn btn-primary" onClick={startDraft} disabled={!aiReady || busyAi}>
                {busyAi ? "Claude đang viết…" : "Nhờ Claude viết bản nháp"}
              </button>
            </>
          ) : (
            <p className="muted small">Tập này không có yêu cầu ban đầu nên không viết nháp tự động được.</p>
          )}
        </div>
      ) : (
        <>
          <div className="card">
            <div className="row">
              <strong>Bản hiện hành{cur.version ? `: phiên bản ${cur.version}` : " (chưa có lịch sử phiên bản)"}</strong>
              {cur.versionMeta ? (
                <span className="muted small">
                  {SOURCE[cur.versionMeta.source]} · {fmtVN(cur.versionMeta.createdAt)}
                  {cur.versionMeta.note ? ` · ${cur.versionMeta.note}` : ""}
                </span>
              ) : null}
            </div>
            <CheckView check={cur.check} />
          </div>
          {part ? <ApprovalPanel episode={episode} part={part} onChanged={reload} /> : null}
          <div className="row">
            <button type="button" className={mode === "view" ? "btn btn-primary" : "btn"} onClick={() => setMode("view")}>
              Xem
            </button>
            <button type="button" className={mode === "edit" ? "btn btn-primary" : "btn"} onClick={() => setMode("edit")} disabled={busyAi} title={busyAi ? "Đang có công việc AI cho tập này" : ""}>
              Sửa thủ công
            </button>
            <button type="button" className={mode === "revise" ? "btn btn-primary" : "btn"} onClick={() => setMode("revise")} disabled={!aiReady || busyAi}>
              Yêu cầu Claude sửa
            </button>
            {busyAi ? <span className="muted small">Đang có công việc AI cho tập này; chờ xong hoặc huỷ.</span> : null}
          </div>
          {mode === "edit" ? <ManualEditor episode={episode} script={cur.script} baseHash={cur.hash} onDone={() => (setMode("view"), reload())} /> : null}
          {mode === "revise" ? <ReviseForm episode={episode} script={cur.script} baseHash={cur.hash} onStarted={(t) => (setTask(t), setMode("view"))} /> : null}
        </>
      )}

      <ProposalList episode={episode} proposals={s.proposals} currentHash={cur?.hash ?? null} open={openProposal} setOpen={setOpenProposal} reload={reload} />
      <VersionList episode={episode} versions={s.versions} currentHash={cur?.hash ?? null} open={openVersion} setOpen={setOpenVersion} reload={reload} />

      {cur && mode !== "edit" ? <ScriptTable script={cur.script} /> : null}
      {s.request ? (
        <TechDetails summary="Yêu cầu ban đầu">
          <pre>{JSON.stringify(s.request, null, 2)}</pre>
        </TechDetails>
      ) : null}
    </div>
  );
};

const CheckView: React.FC<{ check: { errors: string[]; warnings: string[]; estimateSec: number | null } }> = ({ check }) => (
  <div className="small">
    <p>
      {check.errors.length ? <Badge tone="bad">{check.errors.length} lỗi chặn</Badge> : <Badge tone="ok">Không có lỗi chặn</Badge>}{" "}
      {check.warnings.length ? <Badge tone="warn">{check.warnings.length} lưu ý</Badge> : null}{" "}
      {check.estimateSec !== null ? <span>Thời lượng ước tính ~{check.estimateSec} s (chỉ ước tính, chưa có âm thanh).</span> : null}
    </p>
    <p className="muted">Kiểm tra tự động chỉ xem cấu trúc, xưng hô, vùng giọng, độ dài câu, số người nói mỗi cảnh. Không đánh giá độ hài hay chất lượng nội dung.</p>
    {check.errors.length || check.warnings.length ? (
      <ul className="findings">
        {check.errors.map((e, i) => (
          <li key={`e${i}`} className="f-bad">
            {e}
          </li>
        ))}
        {check.warnings.map((w, i) => (
          <li key={`w${i}`} className="f-warn">
            {w}
          </li>
        ))}
      </ul>
    ) : null}
  </div>
);

export const ScriptTable: React.FC<{ script: ScriptDocT; highlight?: Map<string, string> }> = ({ script, highlight }) => (
  <div className="stack">
    <p>
      <strong>{script.title}</strong> — {script.logline}
    </p>
    {script.creative?.premise ? <p className="small">Tiền đề: {script.creative.premise}</p> : null}
    {script.creative?.punchline ? <p className="small">Câu chốt: {script.creative.punchline}</p> : null}
    {script.scenes.map((sc) => (
      <div key={sc.id}>
        <h3>
          {sc.id}. {sc.title} <span className="muted small">· {sc.location}</span>
        </h3>
        <div className="table-wrap">
          <table>
            <tbody>
              {script.beats
                .filter((b) => b.scene === sc.id)
                .map((b) => (
                  <tr key={b.id} className={highlight?.get(b.id) ? `diff-${highlight.get(b.id)}` : b.kind === "action" ? "row-action" : undefined}>
                    <td className="nowrap small">{b.id}</td>
                    <td className="nowrap">{b.kind === "line" ? ROLE[b.role ?? ""] ?? b.role : <em>hành động {b.sec ? `${b.sec}s` : ""}</em>}</td>
                    <td>{b.kind === "line" ? b.text : <em>{b.desc}</em>}</td>
                    <td className="small muted">{b.visual ?? ""}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    ))}
  </div>
);

// ---- Revise ------------------------------------------------------------------------

const ReviseForm: React.FC<{ episode: string; script: ScriptDocT; baseHash: string; onStarted: (t: AiTask) => void }> = ({ episode, script, baseHash, onStarted }) => {
  const toast = useToast();
  const [instruction, setInstruction] = useState("");
  const [scope, setScope] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      const r = await send<{ task: AiTask }>("POST", `/api/episodes/${episode}/script/revise`, { instruction, scope, baseHash });
      toast("info", "Đã gửi yêu cầu sửa. Kết quả sẽ là bản đề xuất, không tự thay bản hiện hành.");
      onStarted(r.task);
    } catch (e) {
      toast("bad", (e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="card stack">
      <h3>Yêu cầu Claude sửa</h3>
      <label className="field">
        Cần sửa gì?
        <textarea rows={3} value={instruction} maxLength={2000} onChange={(e) => setInstruction(e.target.value)} placeholder="Ví dụ: làm câu chốt bất ngờ hơn; cho Trinh phản ứng nhanh hơn ở cảnh 2…" />
      </label>
      <fieldset className="field">
        <legend>Phạm vi (không chọn = toàn bộ kịch bản; chọn cảnh thì các cảnh khác giữ nguyên tuyệt đối)</legend>
        <div className="row">
          {script.scenes.map((sc) => (
            <label key={sc.id} className="check">
              <input type="checkbox" checked={scope.includes(sc.id)} onChange={() => setScope((x) => (x.includes(sc.id) ? x.filter((y) => y !== sc.id) : [...x, sc.id]))} /> {sc.id} {sc.title}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="row">
        <button type="button" className="btn btn-primary" onClick={submit} disabled={busy || !instruction.trim()}>
          {busy ? "Đang gửi…" : "Gửi cho Claude"}
        </button>
        <span className="muted small">Gọi Claude tính phí. Kết quả là bản đề xuất để bạn xem khác biệt rồi chấp nhận hoặc bỏ.</span>
      </div>
    </div>
  );
};

// ---- Manual editor ---------------------------------------------------------------------

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

const ManualEditor: React.FC<{ episode: string; script: ScriptDocT; baseHash: string; onDone: () => void }> = ({ episode, script, baseHash, onDone }) => {
  const toast = useToast();
  const [doc, setDoc] = useState<ScriptDocT>(() => clone(script));
  const [json, setJson] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [conflict, setConflict] = useState<string | null>(null);
  const setBeat = (i: number, patch: Partial<ScriptBeatDoc>) => setDoc((d) => ({ ...d, beats: d.beats.map((b, j) => (j === i ? { ...b, ...patch } : b)) }));
  const nextId = (prefix: string) => {
    let n = 1;
    while (doc.beats.some((b) => b.id === `${prefix}${String(n).padStart(2, "0")}`)) n++;
    return `${prefix}${String(n).padStart(2, "0")}`;
  };
  const addAfter = (i: number, kind: "line" | "action") =>
    setDoc((d) => {
      const at = d.beats[i];
      const beat: ScriptBeatDoc = kind === "line" ? { id: nextId("x"), scene: at.scene, kind, role: at.role ?? "kien", text: "" } : { id: nextId("a"), scene: at.scene, kind, desc: "", sec: 1 };
      const beats = [...d.beats];
      beats.splice(i + 1, 0, beat);
      return { ...d, beats };
    });
  const remove = (i: number) => setDoc((d) => ({ ...d, beats: d.beats.filter((_, j) => j !== i) }));

  const save = async () => {
    let body: ScriptDocT = doc;
    if (json !== null) {
      try {
        body = JSON.parse(json) as ScriptDocT;
      } catch {
        setErrors(["JSON không hợp lệ."]);
        return;
      }
    }
    setBusy(true);
    setErrors([]);
    try {
      await send("PUT", `/api/episodes/${episode}/script`, { script: body, baseHash, note: note || "Sửa thủ công" });
      toast("ok", "Đã lưu thành phiên bản mới. Duyệt kịch bản (nếu có) chuyển thành cần duyệt lại.");
      onDone();
    } catch (e) {
      const err = e as ApiError;
      if (err.conflict) setConflict(err.message);
      else setErrors([err.message]);
      // 422 carries check details in the message only; refetch is not needed.
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card stack">
      <h3>Sửa thủ công</h3>
      <p className="muted small">Lưu sẽ tạo phiên bản mới (nguồn: bạn sửa). Máy chủ kiểm tra lại; lỗi chặn thì không lưu. Bản đang có duyệt sẽ chuyển thành cần duyệt lại.</p>
      {conflict ? (
        <div className="state state-error small">
          {conflict}{" "}
          <button type="button" className="btn btn-small" onClick={onDone}>
            Tải lại
          </button>
        </div>
      ) : null}
      {json === null ? (
        <>
          <label className="field">
            Tiêu đề
            <input value={doc.title} onChange={(e) => setDoc({ ...doc, title: e.target.value })} />
          </label>
          <label className="field">
            Tóm tắt
            <textarea rows={2} value={doc.logline} onChange={(e) => setDoc({ ...doc, logline: e.target.value })} />
          </label>
          {doc.scenes.map((sc, si) => (
            <div key={sc.id} className="stack">
              <div className="row">
                <strong>{sc.id}</strong>
                <input value={sc.title} onChange={(e) => setDoc({ ...doc, scenes: doc.scenes.map((x, j) => (j === si ? { ...x, title: e.target.value } : x)) })} />
                <select value={sc.location} onChange={(e) => setDoc({ ...doc, scenes: doc.scenes.map((x, j) => (j === si ? { ...x, location: e.target.value } : x)) })}>
                  <option value="office">Văn phòng</option>
                  <option value="meeting">Phòng họp</option>
                  <option value="pantry">Pantry</option>
                </select>
              </div>
              <div className="table-wrap">
                <table>
                  <tbody>
                    {doc.beats.map((b, i) =>
                      b.scene !== sc.id ? null : (
                        <tr key={b.id}>
                          <td className="small nowrap">{b.id}</td>
                          <td>
                            {b.kind === "line" ? (
                              <select value={b.role} onChange={(e) => setBeat(i, { role: e.target.value })}>
                                {Object.entries(ROLE).map(([k, v]) => (
                                  <option key={k} value={k}>
                                    {v}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input className="sec-input" type="number" step="0.1" min="0.3" max="6" value={b.sec ?? ""} onChange={(e) => setBeat(i, { sec: Number(e.target.value) })} title="giây" />
                            )}
                          </td>
                          <td className="grow">
                            {b.kind === "line" ? (
                              <input value={b.text ?? ""} onChange={(e) => setBeat(i, { text: e.target.value })} />
                            ) : (
                              <input value={b.desc ?? ""} onChange={(e) => setBeat(i, { desc: e.target.value })} placeholder="mô tả hành động" />
                            )}
                            <input className="visual-input" value={b.visual ?? ""} onChange={(e) => setBeat(i, { visual: e.target.value })} placeholder="hình ảnh (không bắt buộc)" />
                          </td>
                          <td className="nowrap">
                            <button type="button" className="btn btn-small" onClick={() => addAfter(i, "line")} title="Thêm lượt thoại phía sau">
                              +thoại
                            </button>
                            <button type="button" className="btn btn-small" onClick={() => addAfter(i, "action")} title="Thêm hành động phía sau">
                              +h.động
                            </button>
                            <button type="button" className="btn btn-small" onClick={() => remove(i)} title="Xoá lượt này">
                              ×
                            </button>
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          <button type="button" className="linkbtn" onClick={() => setJson(JSON.stringify(doc, null, 2))}>
            Sửa JSON nâng cao
          </button>
        </>
      ) : (
        <label className="field">
          JSON kịch bản (giữ đúng cấu trúc; máy chủ sẽ kiểm tra)
          <textarea rows={24} className="mono" value={json} onChange={(e) => setJson(e.target.value)} />
        </label>
      )}
      <label className="field">
        Ghi chú phiên bản (không bắt buộc)
        <input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
      </label>
      {errors.length ? (
        <ul className="findings">
          {errors.map((e, i) => (
            <li key={i} className="f-bad">
              {e}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="row">
        <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>
          {busy ? "Đang lưu…" : "Lưu phiên bản mới"}
        </button>
        <button type="button" className="btn" onClick={onDone} disabled={busy}>
          Huỷ thay đổi
        </button>
      </div>
    </div>
  );
};

// ---- Diff -------------------------------------------------------------------------------

const DiffView: React.FC<{ diff: ScriptDiff }> = ({ diff }) => {
  const changed = diff.beats.filter((b) => b.status !== "same");
  return (
    <div className="stack">
      <p className="small">
        <Badge tone="ok">{diff.summary.added} thêm</Badge> <Badge tone="warn">{diff.summary.changed} sửa</Badge> <Badge tone="bad">{diff.summary.removed} bỏ</Badge>
      </p>
      {diff.meta.map((m) => (
        <div key={m.field} className="small">
          <strong>{m.field}:</strong> <del>{m.from}</del> → <ins>{m.to}</ins>
        </div>
      ))}
      {diff.scenes.filter((s) => s.status !== "same").map((s) => (
        <div key={s.id} className="small">
          Cảnh {s.id}: {s.status === "added" ? "thêm mới" : s.status === "removed" ? "bị bỏ" : `đổi ${s.fields.join(", ")}`}
        </div>
      ))}
      {!changed.length && !diff.meta.length ? <p className="muted">Không có khác biệt nội dung.</p> : null}
      {changed.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Lượt</th>
                <th>Thay đổi</th>
                <th>Bản hiện hành</th>
                <th>Bản mới</th>
              </tr>
            </thead>
            <tbody>
              {changed.map((b) => (
                <tr key={b.id} className={`diff-${b.status}`}>
                  <td className="nowrap small">
                    {b.scene}/{b.id}
                  </td>
                  <td className="small">{b.status === "added" ? "thêm" : b.status === "removed" ? "bỏ" : b.fields.join(", ")}</td>
                  <td className="small">{b.from ? beatText(b.from) : ""}</td>
                  <td className="small">{b.to ? beatText(b.to) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
};
const beatText = (b: ScriptBeatDoc) => (b.kind === "line" ? `${ROLE[b.role ?? ""] ?? b.role}: ${b.text}` : `[${b.sec ?? "?"}s] ${b.desc}`);

// ---- Proposals --------------------------------------------------------------------------

const ProposalList: React.FC<{ episode: string; proposals: ProposalMeta[]; currentHash: string | null; open: string | null; setOpen: (id: string | null) => void; reload: () => void }> = ({
  episode,
  proposals,
  currentHash,
  open,
  setOpen,
  reload,
}) => {
  if (!proposals.length) return null;
  return (
    <div className="card stack">
      <h2>Bản đề xuất của Claude</h2>
      <p className="muted small">Bản đề xuất không tự thay bản hiện hành. Xem khác biệt rồi chấp nhận (tạo phiên bản mới) hoặc bỏ.</p>
      <div className="table-wrap">
        <table>
          <tbody>
            {proposals.map((p) => (
              <tr key={p.id}>
                <td className="nowrap small">{fmtVN(p.createdAt)}</td>
                <td>
                  <Badge tone={PSTATUS[p.status].tone}>{PSTATUS[p.status].label}</Badge>
                </td>
                <td className="small">
                  {p.kind === "draft" ? "Bản nháp mới" : p.instruction}
                  {p.scope.length ? <span className="muted"> · cảnh {p.scope.join(", ")}</span> : null}
                  {p.statusNote ? <div className="muted">{p.statusNote}</div> : null}
                </td>
                <td className="nowrap">
                  <button type="button" className="btn btn-small" onClick={() => setOpen(open === p.id ? null : p.id)}>
                    {open === p.id ? "Đóng" : "Xem khác biệt"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open ? <ProposalView episode={episode} id={open} currentHash={currentHash} onDone={() => (setOpen(null), reload())} /> : null}
    </div>
  );
};

const ProposalView: React.FC<{ episode: string; id: string; currentHash: string | null; onDone: () => void }> = ({ episode, id, currentHash, onDone }) => {
  const toast = useToast();
  const d = useAsync(() => get<{ proposal: ProposalMeta & { script: ScriptDocT }; currentHash: string | null; diff: ScriptDiff }>(`/api/episodes/${episode}/script/proposals/${id}`), [id]);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  if (d.loading) return <Loading />;
  if (d.error) return <ErrorBox message={d.error} />;
  const { proposal, diff } = d.data!;
  const stale = proposal.baseHash !== currentHash;
  const accept = async () => {
    setBusy(true);
    try {
      await send("POST", `/api/episodes/${episode}/script/proposals/${id}/accept`, { viewedHash: currentHash });
      toast("ok", "Đã áp dụng thành phiên bản mới. Kịch bản chưa được duyệt.");
      onDone();
    } catch (e) {
      toast("bad", (e as Error).message);
      setConfirm(false);
      onDone();
    } finally {
      setBusy(false);
    }
  };
  const discard = async () => {
    try {
      await send("POST", `/api/episodes/${episode}/script/proposals/${id}/discard`);
      toast("info", "Đã bỏ bản đề xuất (vẫn lưu trong lịch sử đề xuất).");
      onDone();
    } catch (e) {
      toast("bad", (e as Error).message);
    }
  };
  return (
    <div className="stack proposal-view">
      <CheckView check={proposal.check} />
      {stale && proposal.status !== "accepted" ? (
        <div className="state state-warn small">
          Bản hiện hành đã khác bản Claude dùng để sửa. Không áp dụng được để tránh ghi đè thay đổi của bạn. Bạn có thể xem, bỏ, hoặc yêu cầu Claude sửa lại trên bản mới nhất.
        </div>
      ) : null}
      <DiffView diff={diff} />
      <div className="row">
        {proposal.status === "pending" && !stale ? (
          <button type="button" className="btn btn-primary" onClick={() => setConfirm(true)} disabled={proposal.check.errors.length > 0}>
            Chấp nhận bản này
          </button>
        ) : null}
        {proposal.status === "pending" || proposal.status === "conflict" ? (
          <button type="button" className="btn" onClick={discard}>
            Bỏ bản đề xuất
          </button>
        ) : null}
      </div>
      <TechDetails summary="Toàn bộ bản đề xuất">
        <ScriptTable script={proposal.script} />
      </TechDetails>
      {confirm ? (
        <Modal
          title="Chấp nhận bản đề xuất"
          onClose={() => !busy && setConfirm(false)}
          actions={
            <>
              <button type="button" className="btn" onClick={() => setConfirm(false)} disabled={busy}>
                Huỷ
              </button>
              <button type="button" className="btn btn-primary" onClick={accept} disabled={busy}>
                {busy ? "Đang áp dụng…" : "Áp dụng"}
              </button>
            </>
          }
        >
          <p>Bản đề xuất sẽ thành phiên bản mới của kịch bản (nguồn: Claude). Bản cũ vẫn trong lịch sử, phục hồi được.</p>
          <p className="small">Chấp nhận không phải là duyệt. Duyệt kịch bản là bước riêng; duyệt cũ (nếu có) sẽ chuyển thành cần duyệt lại.</p>
        </Modal>
      ) : null}
    </div>
  );
};

// ---- Versions -----------------------------------------------------------------------------

const VersionList: React.FC<{ episode: string; versions: VersionMeta[]; currentHash: string | null; open: number | null; setOpen: (n: number | null) => void; reload: () => void }> = ({
  episode,
  versions,
  currentHash,
  open,
  setOpen,
  reload,
}) => {
  if (!versions.length) return null;
  return (
    <div className="card stack">
      <h2>Lịch sử phiên bản</h2>
      <div className="table-wrap">
        <table>
          <tbody>
            {versions.map((v) => (
              <tr key={v.version}>
                <td className="nowrap">
                  <strong>v{v.version}</strong> {v.hash === currentHash ? <Badge tone="ok">hiện hành</Badge> : null}
                </td>
                <td className="small nowrap">{fmtVN(v.createdAt)}</td>
                <td className="small">
                  {SOURCE[v.source]} · {v.note}
                </td>
                <td className="nowrap">
                  {v.hash !== currentHash ? (
                    <button type="button" className="btn btn-small" onClick={() => setOpen(open === v.version ? null : v.version)}>
                      {open === v.version ? "Đóng" : "Xem / phục hồi"}
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open ? <VersionView episode={episode} n={open} currentHash={currentHash} onDone={() => (setOpen(null), reload())} /> : null}
    </div>
  );
};

const VersionView: React.FC<{ episode: string; n: number; currentHash: string | null; onDone: () => void }> = ({ episode, n, currentHash, onDone }) => {
  const toast = useToast();
  const d = useAsync(() => get<{ version: VersionMeta & { script: ScriptDocT }; diffFromCurrent: ScriptDiff }>(`/api/episodes/${episode}/script/versions/${n}`), [n]);
  const [busy, setBusy] = useState(false);
  if (d.loading) return <Loading />;
  if (d.error) return <ErrorBox message={d.error} />;
  const restore = async () => {
    setBusy(true);
    try {
      await send("POST", `/api/episodes/${episode}/script/restore`, { version: n, baseHash: currentHash });
      toast("ok", `Đã phục hồi nội dung v${n} thành phiên bản mới. Lịch sử giữ nguyên.`);
      onDone();
    } catch (e) {
      toast("bad", (e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="stack proposal-view">
      <p className="small">Khác biệt nếu phục hồi v{n} (so với bản hiện hành):</p>
      <DiffView diff={d.data!.diffFromCurrent} />
      <div className="row">
        <button type="button" className="btn btn-primary" onClick={restore} disabled={busy}>
          {busy ? "Đang phục hồi…" : `Phục hồi v${n} (tạo phiên bản mới)`}
        </button>
      </div>
    </div>
  );
};

export const EmptyScript = Empty;
export { fmtSec };
