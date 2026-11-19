import React, { useEffect, useState } from "react";
import { ApiError, send } from "./api";
import { ErrorBox, Modal, useToast } from "./ui";

// Create an episode from a brief: the server allocates the next code (shared
// allocator) and stores the brief in script/request.json. No model is called.
// The script is then written in a Claude Code session and comes back as a
// proposal (npm run script:propose). The request token makes a double submit
// return the same EP.

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
  const [title, setTitle] = useState("");
  const [idea, setIdea] = useState("");
  const [punch, setPunch] = useState("");
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
        title,
        idea,
        punchlineDirection: punch,
        characters: cast,
        setting,
        notes,
        minSec,
        targetMinSec: tMin,
        targetMaxSec: tMax,
      });
      saveToken(null); // next form gets a new token
      toast("ok", r.created ? `Đã tạo ${r.episode}. Nhờ Claude Code viết kịch bản theo hướng dẫn trong tab Kịch bản.` : `Yêu cầu này đã tạo ${r.episode} trước đó; không tạo thêm.`);
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
      <p className="muted small">
        Studio cấp mã tập và lưu yêu cầu (script/request.json). Kịch bản viết trong phiên Claude Code rồi đưa về Studio thành bản đề xuất để bạn xem và chấp nhận. Studio không gọi Claude. Cần ý
        tưởng thì nhờ Claude Code đề xuất trước, rồi điền vào đây.
      </p>

      <div className="card stack">
        <h2>Thông tin tập</h2>
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
        <div className="row">
          <button type="button" className="btn btn-primary" disabled={Boolean(formError)} onClick={() => setConfirm(true)} title={formError ?? ""}>
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
                {busy ? "Đang tạo…" : "Tạo tập"}
              </button>
            </>
          }
        >
          <p>
            Studio sẽ cấp <strong>mã tập mới</strong> (EP kế tiếp) và lưu yêu cầu này. Mã tập không bị cấp lại hay xoá.
          </p>
          <p className="small">
            <strong>{title}</strong> · {cast.map((c) => NAME[c]).join(", ")} · {PLACE[setting]} · tối thiểu {minSec} s, mục tiêu {tMin}–{tMax} s
          </p>
          <p className="muted small">Sau đó nhờ Claude Code viết kịch bản; tab Kịch bản của tập có hướng dẫn và câu yêu cầu để chép.</p>
        </Modal>
      ) : null}
    </section>
  );
};
