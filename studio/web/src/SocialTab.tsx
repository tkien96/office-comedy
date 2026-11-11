import React, { useState } from "react";
import { ApiError, send, type EpisodeDetail, type PartState, type SocialPost } from "./api";
import { ApprovalPanel } from "./Approval";
import { Badge, CopyButton, PLATFORM, POST_NAME, TechDetails, useToast } from "./ui";

// Social copy per platform and post. Editing changes only that post in
// social.json (atomic write, conflict check), regenerates social.md, and
// only that post's approval becomes "cần duyệt lại".

export const SocialTab: React.FC<{ d: EpisodeDetail; reload: () => void }> = ({ d, reload }) => {
  const posts = d.social?.posts ?? [];
  const guard = d.social?.guard;
  if (!posts.length) return <div className="state state-warn">Chưa có social/social.json hoặc file không có bài nào.</div>;
  const platforms = [...new Set(posts.map((p) => p.platform))];
  return (
    <div className="stack">
      {guard ? (
        <div className="state state-info small">
          <strong>Giữ bí mật câu chốt:</strong> {guard.punchline}
          {guard.keepSecret?.length ? <div>Không nhắc: {guard.keepSecret.join("; ")}.</div> : null}
          <div className="muted">Bộ lọc từ khóa chỉ là lưới lọc thô, không chứng minh bài không lộ câu chốt. Hãy đọc lại khi duyệt.</div>
        </div>
      ) : null}
      {platforms.map((pl) => (
        <section key={pl}>
          <h2>{PLATFORM[pl] ?? pl}</h2>
          <div className="post-grid">
            {posts
              .filter((p) => p.platform === pl)
              .map((p) => (
                <PostCard key={p.key} episode={d.summary.id} p={p} part={d.parts?.find((x) => x.part === `social.${p.key}`)} findings={(d.social?.findings ?? []).filter((f) => f.post === p.key)} reload={reload} />
              ))}
          </div>
        </section>
      ))}
    </div>
  );
};

const PostCard: React.FC<{ episode: string; p: SocialPost; part?: PartState; findings: { level: string; msg: string }[]; reload: () => void }> = ({ episode, p, part, findings, reload }) => {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(p.post.title ?? "");
  const [body, setBody] = useState(p.post.body ?? "");
  const [tags, setTags] = useState((p.post.hashtags ?? []).join(" "));
  const [cover, setCover] = useState(p.post.coverTimestampMs !== undefined ? String(p.post.coverTimestampMs / 1000) : "");
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState<string | null>(null);

  const start = () => {
    setTitle(p.post.title ?? "");
    setBody(p.post.body ?? "");
    setTags((p.post.hashtags ?? []).join(" "));
    setCover(p.post.coverTimestampMs !== undefined ? String(p.post.coverTimestampMs / 1000) : "");
    setConflict(null);
    setEditing(true);
  };
  const patch = () => {
    const out: Record<string, unknown> = {};
    if (p.editable.includes("title") && title !== (p.post.title ?? "")) out.title = title;
    if (p.editable.includes("body") && body !== (p.post.body ?? "")) out.body = body;
    const tagList = tags.split(/\s+/).filter(Boolean);
    if (p.editable.includes("hashtags") && tagList.join(" ") !== (p.post.hashtags ?? []).join(" ")) out.hashtags = tagList;
    if (p.editable.includes("coverTimestampMs")) {
      const ms = Math.round(Number(cover.replace(",", ".")) * 1000);
      if (ms !== p.post.coverTimestampMs) out.coverTimestampMs = Number.isFinite(ms) ? ms : -1;
    }
    return out;
  };
  const dirty = editing && Object.keys(patch()).length > 0;
  const approvedLike = part && (part.status === "approved" || part.status === "needs_recheck");

  const save = async () => {
    setSaving(true);
    try {
      const r = await send<{ changed: boolean; findings: { level: string; msg: string }[] }>("PUT", `/api/episodes/${episode}/social/${p.key}`, { baseToken: p.token, patch: patch() });
      toast("ok", r.changed ? "Đã lưu. social.md đã cập nhật." : "Không có thay đổi.");
      const errs = r.findings.filter((f) => f.level === "LỖI");
      if (errs.length) toast("bad", `Đã lưu nhưng còn vấn đề: ${errs.map((f) => f.msg).join(" ")}`);
      setEditing(false);
      reload();
    } catch (e) {
      const err = e as ApiError;
      if (err.conflict) setConflict(err.message);
      else toast("bad", err.message);
    } finally {
      setSaving(false);
    }
  };

  const post = p.post;
  return (
    <article className="post-card">
      <header className="post-head">
        <strong>{POST_NAME[p.name] ?? p.name}</strong>
        {post.optional ? <Badge tone="none">tùy chọn</Badge> : null}
        <Badge tone={post.postingMode === "manual" ? "none" : "wait"}>{post.postingMode === "manual" ? "đăng thủ công" : "API (chưa tích hợp)"}</Badge>
      </header>
      {!editing ? (
        <>
          {post.title !== undefined ? (
            <div className="field-view">
              <div className="field-label">
                Tiêu đề <CopyButton text={post.title} />
              </div>
              <div className="field-text">{post.title}</div>
            </div>
          ) : null}
          <div className="field-view">
            <div className="field-label">
              {post.title !== undefined ? "Mô tả" : "Nội dung / caption"} <CopyButton text={post.body ?? ""} />
            </div>
            <div className="field-text pre">{post.body}</div>
          </div>
          <div className="field-view">
            <div className="field-label">
              Hashtag <CopyButton text={(post.hashtags ?? []).join(" ")} />
            </div>
            <div className="field-text">{(post.hashtags ?? []).join(" ") || <span className="muted">(không có)</span>}</div>
          </div>
          <div className="row">
            <CopyButton text={p.paste} label="Sao chép bản dán đầy đủ" />
            <button type="button" className="btn btn-small" onClick={start}>
              Sửa
            </button>
          </div>
          {post.coverTimestampMs !== undefined ? <p className="small">Khung bìa gợi ý: {(post.coverTimestampMs / 1000).toFixed(1)} s</p> : null}
          {[post.thumbnail, post.coverImage, post.image].filter(Boolean).length ? <p className="muted small">Ảnh: {[post.thumbnail, post.coverImage, post.image].filter(Boolean).join(", ")}</p> : null}
          {post.note ? <p className="muted small">{post.note}</p> : null}
        </>
      ) : (
        <div className="edit">
          {approvedLike ? <div className="state state-warn small">Bài này đã duyệt. Lưu thay đổi sẽ làm bài này "Cần duyệt lại". Các bài khác không bị ảnh hưởng.</div> : null}
          {conflict ? (
            <div className="state state-error small">
              {conflict}{" "}
              <button type="button" className="btn btn-small" onClick={() => (setEditing(false), reload())}>
                Tải lại
              </button>
            </div>
          ) : null}
          {p.editable.includes("title") ? (
            <label className="field">
              Tiêu đề <span className="muted small">({[...title].length} ký tự)</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
          ) : null}
          {p.editable.includes("body") ? (
            <label className="field">
              {post.title !== undefined ? "Mô tả" : "Nội dung / caption"} <span className="muted small">({[...body].length} ký tự)</span>
              <textarea rows={7} value={body} onChange={(e) => setBody(e.target.value)} />
            </label>
          ) : null}
          {p.editable.includes("hashtags") ? (
            <label className="field">
              Hashtag (cách nhau bằng dấu cách)
              <input value={tags} onChange={(e) => setTags(e.target.value)} />
            </label>
          ) : null}
          {p.editable.includes("coverTimestampMs") ? (
            <label className="field">
              Khung bìa gợi ý (giây)
              <input inputMode="decimal" value={cover} onChange={(e) => setCover(e.target.value)} />
            </label>
          ) : null}
          <div className="row">
            <button type="button" className="btn btn-primary" onClick={save} disabled={saving || !dirty}>
              {saving ? "Đang lưu…" : "Lưu"}
            </button>
            <button type="button" className="btn" onClick={() => setEditing(false)} disabled={saving}>
              Huỷ thay đổi
            </button>
            {!dirty ? <span className="muted small">Chưa có thay đổi.</span> : null}
          </div>
        </div>
      )}
      {findings.length ? (
        <ul className="findings">
          {findings.map((f, i) => (
            <li key={i} className={f.level === "LỖI" ? "f-bad" : "f-warn"}>
              {f.level}: {f.msg}
            </li>
          ))}
        </ul>
      ) : null}
      {part ? <ApprovalPanel episode={episode} part={part} onChanged={reload} compact /> : null}
      <TechDetails>
        <div>Mã bài: <code>{p.key}</code> · phiên bản <code>{p.token}</code></div>
      </TechDetails>
    </article>
  );
};
