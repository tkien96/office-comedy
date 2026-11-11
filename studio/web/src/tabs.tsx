import React, { useRef, useState } from "react";
import { get, type EpisodeDetail, type PartState } from "./api";
import { ApprovalPanel } from "./Approval";
import { Markdown } from "./Markdown";
import { Empty, ErrorBox, fmtBytes, fmtSec, Loading, TechDetails, useAsync } from "./ui";

type TabProps = { d: EpisodeDetail; reload: () => void };
const ROLE: Record<string, string> = { narrator: "Kiên (lời dẫn)", kien: "Kiên", trinh: "Trinh", sep: "Sếp" };
const media = (d: EpisodeDetail, k: string) => d.media?.[k];
const src = (d: EpisodeDetail, k: string) => `/api/episodes/${d.summary.id}/media/${k}`;

const Missing: React.FC<{ what: string; path?: string }> = ({ what, path }) => (
  <div className="state state-warn">
    {what} chưa có{path ? ` (${path})` : ""}. Studio không tạo file thay thế; tạo bằng lệnh tương ứng trong README.
  </div>
);

// ---- Kịch bản ------------------------------------------------------------------

export const ScriptTab: React.FC<TabProps & { part?: PartState }> = ({ d, part, reload }) => {
  const s = d.script;
  if (!s) return <Missing what="Kịch bản (script/script.json)" />;
  return (
    <div className="stack">
      {part ? <ApprovalPanel episode={d.summary.id} part={part} onChanged={reload} /> : null}
      <p>
        <strong>Ý tưởng:</strong> {s.logline}
      </p>
      {s.scenes.map((sc) => (
        <div key={sc.id} className="scene">
          <h3>
            {sc.id}. {sc.title} <span className="muted small">· {sc.location}</span>
          </h3>
          {sc.note ? <p className="muted small">{sc.note}</p> : null}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Ai</th>
                  <th>Lời / hành động</th>
                  <th>Hình ảnh</th>
                </tr>
              </thead>
              <tbody>
                {s.beats
                  .filter((b) => b.scene === sc.id)
                  .map((b) => (
                    <tr key={b.id} className={b.kind === "action" ? "row-action" : undefined}>
                      <td className="nowrap">{b.time ? `${fmtSec(b.time.speechStartSec ?? b.time.startSec)}–${fmtSec(b.time.speechEndSec ?? b.time.endSec)}` : "—"}</td>
                      <td>{b.kind === "line" ? ROLE[b.role ?? ""] ?? b.role : <em>hành động</em>}</td>
                      <td>{b.kind === "line" ? `"${b.text}"` : <em>{b.desc}</em>}</td>
                      <td className="small">{b.visual ?? ""}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
};

// ---- Âm thanh và video --------------------------------------------------------------

export const MediaTab: React.FC<TabProps & { audio?: PartState; video?: PartState }> = ({ d, audio, video, reload }) => {
  const v = media(d, "video");
  const a = media(d, "audio");
  return (
    <div className="stack">
      <div className="media-row">
        <div className="media-col">
          <h2>Video</h2>
          {v?.exists ? (
            <>
              <video className="video" controls preload="metadata" src={src(d, "video")} />
              <p className="muted small">
                {fmtBytes(v.size)} · tua bằng thanh thời gian (máy chủ hỗ trợ tải từng đoạn)
              </p>
            </>
          ) : (
            <Missing what="Video" path={v?.path} />
          )}
          {video ? <ApprovalPanel episode={d.summary.id} part={video} onChanged={reload} /> : null}
        </div>
        <div className="media-col">
          <h2>Âm thanh</h2>
          {a?.exists ? (
            <>
              <audio controls preload="metadata" src={src(d, "audio")} />
              <p className="muted small">{fmtBytes(a.size)} · bản âm thanh đã ghép của tập</p>
            </>
          ) : (
            <Missing what="Âm thanh" path={a?.path} />
          )}
          {audio ? <ApprovalPanel episode={d.summary.id} part={audio} onChanged={reload} /> : null}
          <p className="muted small">Tạo lại giọng và render video chưa có trong Studio: dùng lệnh npm hiện có. Mở trang không tạo lại hay thay đổi gì.</p>
        </div>
      </div>
    </div>
  );
};

// ---- Phụ đề ----------------------------------------------------------------------------

export const CaptionsTab: React.FC<TabProps & { part?: PartState }> = ({ d, part, reload }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const cues = d.captions;
  const v = media(d, "video");
  const seek = (t: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = t;
      void videoRef.current.play().catch(() => undefined);
    }
  };
  return (
    <div className="stack">
      {part ? <ApprovalPanel episode={d.summary.id} part={part} onChanged={reload} /> : null}
      <p className="small">
        So với timeline: <strong>{d.freshness?.captions}</strong>. Báo cáo kiểm tra tự động: tab <a href={`#/tap/${d.summary.id}/bao-cao`}>Báo cáo</a> → "Kiểm tra phụ đề".
      </p>
      {!cues ? (
        <Missing what="Phụ đề SRT" path={media(d, "srt")?.path} />
      ) : (
        <div className="media-row">
          {v?.exists ? (
            <div className="media-col narrow">
              <video ref={videoRef} className="video" controls preload="metadata" src={src(d, "video")} />
              <p className="muted small">Bấm một dòng phụ đề để tua video tới đó.</p>
            </div>
          ) : null}
          <div className="media-col">
            <div className="table-wrap">
              <table className="cues">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Bắt đầu</th>
                    <th>Kết thúc</th>
                    <th>Chữ</th>
                  </tr>
                </thead>
                <tbody>
                  {cues.map((c) => (
                    <tr key={c.index} onClick={() => seek(c.start)} className="clickable" title="Tua video tới đây">
                      <td>{c.index}</td>
                      <td className="nowrap">{fmtSec(c.start)}</td>
                      <td className="nowrap">{fmtSec(c.end)}</td>
                      <td>
                        {c.lines.map((l, i) => (
                          <div key={i}>{l}</div>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ---- Hình ảnh --------------------------------------------------------------------------

export const ImagesTab: React.FC<TabProps & { thumb?: PartState; teaser?: PartState }> = ({ d, thumb, teaser, reload }) => {
  const t = media(d, "thumb9x16");
  const s = media(d, "teaser1x1");
  return (
    <div className="media-row">
      <div className="media-col">
        <h2>Thumbnail 9:16</h2>
        {t?.exists ? (
          <a href={src(d, "thumb9x16")} target="_blank" rel="noreferrer">
            <img className="img-916" src={src(d, "thumb9x16")} alt="Thumbnail 9:16" />
          </a>
        ) : (
          <Missing what="Thumbnail 9:16" path={t?.path} />
        )}
        {t?.exists ? <p className="muted small">{fmtBytes(t.size)} · dùng cho YouTube Shorts (Studio trên máy tính), ảnh bìa Reel</p> : null}
        {thumb ? <ApprovalPanel episode={d.summary.id} part={thumb} onChanged={reload} /> : null}
      </div>
      <div className="media-col">
        <h2>Ảnh nhá hàng 1:1</h2>
        {s?.exists ? (
          <a href={src(d, "teaser1x1")} target="_blank" rel="noreferrer">
            <img className="img-11" src={src(d, "teaser1x1")} alt="Ảnh nhá hàng 1:1" />
          </a>
        ) : (
          <Missing what="Ảnh nhá hàng 1:1" path={s?.path} />
        )}
        {s?.exists ? <p className="muted small">{fmtBytes(s.size)} · bài ảnh nhá hàng Facebook / TikTok</p> : null}
        {teaser ? <ApprovalPanel episode={d.summary.id} part={teaser} onChanged={reload} /> : null}
      </div>
    </div>
  );
};

// ---- Báo cáo -----------------------------------------------------------------------------

export const ReportsTab: React.FC<{ d: EpisodeDetail }> = ({ d }) => {
  const reports = d.reports ?? [];
  const first = reports.find((r) => r.exists)?.key ?? null;
  const [sel, setSel] = useState<string | null>(first);
  if (!reports.some((r) => r.exists)) return <Empty>Chưa có báo cáo nào.</Empty>;
  return (
    <div className="reports">
      <ul className="report-list">
        {reports.map((r) => (
          <li key={r.key}>
            <button type="button" className={sel === r.key ? "linkbtn active" : "linkbtn"} disabled={!r.exists} onClick={() => setSel(r.key)}>
              {r.label}
              {!r.exists ? " (chưa có)" : ""}
            </button>
          </li>
        ))}
      </ul>
      <div className="report-view">{sel ? <ReportView episode={d.summary.id} name={sel} /> : null}</div>
    </div>
  );
};

const ReportView: React.FC<{ episode: string; name: string }> = ({ episode, name }) => {
  const { data, error, loading } = useAsync(() => get<{ kind: "md" | "json"; text: string; label: string }>(`/api/episodes/${episode}/reports/${name}`), [episode, name]);
  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} />;
  if (!data) return null;
  if (data.kind === "json")
    return (
      <TechDetails summary={`${data.label} (JSON)`}>
        <pre>{data.text}</pre>
      </TechDetails>
    );
  return <Markdown text={data.text} />;
};
