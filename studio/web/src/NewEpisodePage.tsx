import React, { useEffect, useState } from "react";
import { ApiError, get, send, type AiStatus, type AiTask, type Idea } from "./api";
import { AiStatusBanner, AiTaskPanel, isActive, useTask } from "./AiTaskPanel";
import { ErrorBox, Modal, useAsync, useToast } from "./ui";

// Create an episode: type an idea or ask Claude for 3 ideas (no EP code yet),
// then confirm → the server allocates the code, stores the request and queues
// the first draft. The request token makes a double submit return the same EP.

const NAME: Record<string, string> = { kien: "Kiên", trinh: "Trinh", sep: "Sếp" };
const PLACE: Record<string, string> = { office: "Văn phòng", meeting: "Phòng họp", pantry: "Pantry" };
const TOKEN_KEY = "oc-create-token";

const newToken = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
const loadToken = () => {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || newToken();
  } catch {
    return newToken();
  }
};
const saveToken = (t: string | null) => {
  try {
    if (t) sessionStorage.setItem(TOKEN_KEY, t);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable: server-side token check still applies within this page */
  }
};

export const NewEpisodePage: React.FC = () => {
  const toast = useToast();
  const status = useAsync(() => get<AiStatus>("/api/ai/status"), []);
  const tasks = useAsync(() => get<{ tasks: AiTask[] }>("/api/tasks"), []);
  const lastIdeas = (tasks.data?.tasks ?? []).find((t) => t.type === "ai-ideas") ?? null;
  const { task: ideasTask, setTask: setIdeasTask, now } = useTask(lastIdeas);
  const ideas = (ideasTask?.state === "succeeded" ? ((ideasTask.result as { ideas?: Idea[] })?.ideas ?? []) : []) as Idea[];

  const [hint, setHint] = useState("");
  const [title, setTitle] = useState("");
  const [idea, setIdea] = useState("");
  const [premise, setPremise] = useState("");
  const [punch, setPunch] = useState("");
  const [source, setSource] = useState<"user" | "claude">("user");
  const [cast, setCast] = useState<string[]>(["kien", "trinh", "sep"]);
  const [setting, setSetting] = useState("office");
  const [notes, setNotes] = useState("");
  const [minSec, setMinSec] = useState(60);
  const [tMin, setTMin] = useState(60);
  const [tMax, setTMax] = useState(90);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [token] = useState(loadToken);

  useEffect(() => saveToken(token), [token]);
  const ready = Boolean(status.data?.configured);

  const askIdeas = async () => {
    try {
      const r = await send<{ task: AiTask; deduped: boolean }>("POST", "/api/ideas", { hint, characters: cast });
      setIdeasTask(r.task);
      if (r.deduped) toast("info", "Đang có một lượt đề xuất chạy; không tạo thêm.");
    } catch (e) {
      toast("bad", (e as Error).message);
    }
  };
  const useIdea = (i: Idea) => {
    setTitle(i.title.replace(/^\[MOCK\]\s*/, "[MOCK] "));
    setIdea(`${i.premise}\nMâu thuẫn: ${i.conflict}`);
    setPremise(i.premise);
    setPunch(i.punchlineDirection);
    if (i.characters?.length) setCast(i.characters);
    if (i.setting) setSetting(i.setting);
    setSource("claude");
    toast("info", "Đã điền ý tưởng vào form. Xem lại rồi bấm Tạo tập.");
  };
  const toggle = (c: string) => setCast((x) => (x.includes(c) ? x.filter((y) => y !== c) : [...x, c]));

  const formError = !title.trim()
    ? "Nhập tiêu đề dự kiến."
    : !idea.trim()
      ? "Nhập ý tưởng."
      : !cast.length
        ? "Chọn ít nhất một nhân vật."
        : minSec < 60
          ? "Thời lượng tối thiểu không dưới 60 giây."
          : tMin < minSec || tMax < tMin
            ? "Khoảng mục tiêu không hợp lệ."
            : null;

  const create = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await send<{ episode: string; created: boolean }>("POST", "/api/episodes/create", {
        requestToken: token,
        ideaSource: source,
        title,
        idea,
        premise,
        punchlineDirection: punch,
        characters: cast,
        setting,
        notes,
        minSec,
        targetMinSec: tMin,
        targetMaxSec: tMax,
      });
      saveToken(null); // next form gets a new token
      toast("ok", r.created ? `Đã tạo ${r.episode}. Claude đang viết bản nháp.` : `Yêu cầu này đã tạo ${r.episode} trước đó; không tạo thêm.`);
      window.location.hash = `#/tap/${r.episode}/kich-ban`;
    } catch (e) {
      setErr((e as ApiError).message);
      setConfirm(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="stack">
      <header className="page-head">
        <h1>Tạo tập mới</h1>
      </header>
      {status.error ? <ErrorBox message={status.error} /> : <AiStatusBanner status={status.data} />}

      <div className="two-col">
        <div className="card stack">
          <h2>1. Ý tưởng</h2>
          <p className="muted small">Nhập ý tưởng có sẵn bên phải, hoặc nhờ Claude đề xuất 3 ý tưởng. Xem ý tưởng chưa cấp mã tập.</p>
          <label className="field">
            Gợi ý cho Claude (không bắt buộc)
            <input value={hint} onChange={(e) => setHint(e.target.value)} placeholder="Ví dụ: chuyện máy in, họp online, deadline cuối tháng…" />
          </label>
          <button type="button" className="btn" onClick={askIdeas} disabled={!ready || isActive(ideasTask)}>
            {isActive(ideasTask) ? "Claude đang nghĩ…" : "Claude đề xuất 3 ý tưởng"}
          </button>
          {ideasTask ? <AiTaskPanel task={ideasTask} now={now} onChanged={setIdeasTask} /> : null}
          {ideas.map((i, n) => (
            <div key={n} className="idea">
              <strong>{i.title}</strong>
              <div className="small">
                <b>Tiền đề:</b> {i.premise}
              </div>
              <div className="small">
                <b>Mâu thuẫn:</b> {i.conflict}
              </div>
              <div className="small">
                <b>Hướng câu chốt:</b> {i.punchlineDirection}
              </div>
              <div className="muted small">
                {i.characters.map((c) => NAME[c] ?? c).join(", ")} · {PLACE[i.setting] ?? i.setting}
              </div>
              <button type="button" className="btn btn-small" onClick={() => useIdea(i)}>
                Dùng ý tưởng này
              </button>
            </div>
          ))}
        </div>

        <div className="card stack">
          <h2>2. Thông tin tập</h2>
          <label className="field">
            Tiêu đề dự kiến
            <input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="field">
            Ý tưởng
            <textarea rows={4} value={idea} maxLength={2000} onChange={(e) => setIdea(e.target.value)} />
          </label>
          <label className="field">
            Hướng câu chốt (không bắt buộc)
            <input value={punch} maxLength={1000} onChange={(e) => setPunch(e.target.value)} />
          </label>
          <fieldset className="field">
            <legend>Nhân vật (từ cấu hình hiện có; lời dẫn là giọng Kiên)</legend>
            <div className="row">
              {["kien", "trinh", "sep"].map((c) => (
                <label key={c} className="check">
                  <input type="checkbox" checked={cast.includes(c)} onChange={() => toggle(c)} /> {NAME[c]}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="field">
            Bối cảnh chính
            <select value={setting} onChange={(e) => setSetting(e.target.value)}>
              {Object.entries(PLACE).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Ghi chú sáng tạo (không bắt buộc)
            <textarea rows={3} value={notes} maxLength={2000} onChange={(e) => setNotes(e.target.value)} />
          </label>
          <div className="row">
            <label className="field narrow-field">
              Tối thiểu (giây)
              <input type="number" min={60} value={minSec} onChange={(e) => setMinSec(Number(e.target.value))} />
            </label>
            <label className="field narrow-field">
              Mục tiêu từ
              <input type="number" min={60} value={tMin} onChange={(e) => setTMin(Number(e.target.value))} />
            </label>
            <label className="field narrow-field">
              đến
              <input type="number" min={60} value={tMax} onChange={(e) => setTMax(Number(e.target.value))} />
            </label>
          </div>
          <p className="muted small">Thời lượng của kịch bản chỉ là ước tính từ số âm tiết. Thời lượng thật đo sau khi tạo giọng (chưa nối trong Studio).</p>
          {err ? <ErrorBox message={err} /> : null}
          <button type="button" className="btn btn-primary" disabled={!ready || Boolean(formError)} onClick={() => setConfirm(true)} title={formError ?? ""}>
            Tạo tập
          </button>
          {formError ? <span className="muted small">{formError}</span> : null}
        </div>
      </div>

      {confirm ? (
        <Modal
          title="Xác nhận tạo tập"
          onClose={() => !busy && setConfirm(false)}
          actions={
            <>
              <button type="button" className="btn" onClick={() => setConfirm(false)} disabled={busy}>
                Huỷ
              </button>
              <button type="button" className="btn btn-primary" onClick={create} disabled={busy}>
                {busy ? "Đang tạo…" : "Tạo tập và nhờ Claude viết nháp"}
              </button>
            </>
          }
        >
          <p>
            Studio sẽ cấp <strong>mã tập mới</strong> (EP kế tiếp), lưu yêu cầu này, rồi xếp một lượt Claude viết bản nháp. Bản nháp chưa được duyệt.
          </p>
          <p className="small">
            <strong>{title}</strong> · {cast.map((c) => NAME[c]).join(", ")} · {PLACE[setting]} · tối thiểu {minSec} s, mục tiêu {tMin}–{tMax} s
          </p>
          <p className="muted small">Gọi Claude tính phí theo tài khoản API. Nếu lượt viết lỗi, tập vẫn giữ nguyên mã để thử lại; mã không bị cấp lại hay xoá.</p>
        </Modal>
      ) : null}
    </section>
  );
};
