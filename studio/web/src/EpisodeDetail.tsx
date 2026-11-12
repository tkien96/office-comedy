import React from "react";
import { get, type EpisodeDetail as Detail, type PartState } from "./api";
import { ApprovalPanel } from "./Approval";
import { PublishTab } from "./PublishTab";
import { SocialTab } from "./SocialTab";
import { ScriptWorkspace } from "./ScriptWorkspace";
import { CaptionsTab, ImagesTab, MediaTab, ReportsTab } from "./tabs";
import { ErrorBox, fmtSec, Loading, StatusBadge, TechDetails, useAsync } from "./ui";

const TABS: [string, string][] = [
  ["tong-quan", "Tổng quan"],
  ["kich-ban", "Kịch bản"],
  ["am-thanh-video", "Âm thanh và video"],
  ["phu-de", "Phụ đề"],
  ["hinh-anh", "Hình ảnh"],
  ["social", "Nội dung social"],
  ["phat-hanh", "Phát hành"],
  ["bao-cao", "Báo cáo"],
];

export const EpisodeDetail: React.FC<{ id: string; tab: string }> = ({ id, tab }) => {
  const { data, error, loading, reload } = useAsync(() => get<Detail>(`/api/episodes/${id}`), [id]);
  const current = TABS.some(([k]) => k === tab) ? tab : "tong-quan";
  const part = (k: string) => data?.parts?.find((p) => p.part === k);

  return (
    <section>
      <header className="page-head">
        <div>
          <a href="#/" className="back">
            ← Danh sách tập
          </a>
          <h1>
            {id}
            {data?.manifest ? `: ${data.manifest.title}` : ""}
          </h1>
        </div>
        <button type="button" className="btn" onClick={reload} disabled={loading}>
          {loading ? "Đang tải…" : "Tải lại"}
        </button>
      </header>
      <nav className="tabs" aria-label="Các phần của tập">
        {TABS.map(([k, label]) => (
          <a key={k} href={`#/tap/${id}/${k}`} className={k === current ? "tab active" : "tab"} aria-current={k === current ? "page" : undefined}>
            {label}
          </a>
        ))}
      </nav>
      {loading && !data ? <Loading /> : null}
      {error ? <ErrorBox message={error} onRetry={reload} /> : null}
      {data && !data.summary.ok ? <ErrorBox message={data.summary.error ?? "Không đọc được tập."} /> : null}
      {data && data.summary.ok ? (
        <div className="tab-body">
          {current === "tong-quan" ? <Overview d={data} reload={reload} /> : null}
          {current === "kich-ban" ? <ScriptWorkspace episode={id} part={part("script")} reloadEpisode={reload} /> : null}
          {current === "am-thanh-video" ? <MediaTab d={data} audio={part("audio")} video={part("video")} reload={reload} /> : null}
          {current === "phu-de" ? <CaptionsTab d={data} part={part("captions")} reload={reload} /> : null}
          {current === "hinh-anh" ? <ImagesTab d={data} thumb={part("thumbnail9x16")} teaser={part("teaser1x1")} reload={reload} /> : null}
          {current === "social" ? <SocialTab d={data} reload={reload} /> : null}
          {current === "phat-hanh" ? <PublishTab d={data} reload={reload} /> : null}
          {current === "bao-cao" ? <ReportsTab d={data} /> : null}
        </div>
      ) : null}
    </section>
  );
};

const Overview: React.FC<{ d: Detail; reload: () => void }> = ({ d, reload }) => {
  const m = d.manifest!;
  const parts = d.parts ?? [];
  const media = parts.filter((p) => !p.part.startsWith("social."));
  const social = parts.filter((p) => p.part.startsWith("social."));
  const attention = parts.filter((p) => p.status === "needs_reapproval" || p.status === "needs_recheck");
  return (
    <div className="stack">
      <div className="cards">
        <div className="card">
          <div className="muted small">Thời lượng thực tế</div>
          <div className="big">{d.summary.hasVideo && m.duration.videoSec ? fmtSec(m.duration.videoSec) : "Chưa có video"}</div>
          <div className="muted small">
            {m.duration.durationInFrames ?? "?"} khung @ {m.duration.fps} fps
          </div>
        </div>
        <div className="card">
          <div className="muted small">Phiên bản nội dung</div>
          <div className="big">{m.contentVersion}</div>
          <div className="muted small">tạo ngày {m.createdAt}</div>
        </div>
        <div className="card">
          <div className="muted small">File xuất từ nguồn</div>
          <div className="small">Phụ đề SRT: {d.freshness?.captions}</div>
          <div className="small">social.md: {d.freshness?.socialMd}</div>
        </div>
      </div>
      {d.summary.problems?.length ? (
        <div className="state state-error">
          <strong>Vấn đề dữ liệu:</strong>
          <ul>
            {d.summary.problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {attention.length ? (
        <div className="state state-warn">
          <strong>Cần chú ý:</strong> {attention.map((p) => p.label).join(", ")}.
        </div>
      ) : null}
      <h2>Duyệt sản phẩm</h2>
      <p className="muted small">Mỗi sản phẩm được duyệt riêng và gắn với đúng phiên bản đang có. Thay đổi một sản phẩm chỉ ảnh hưởng các sản phẩm thật sự phụ thuộc vào nó.</p>
      <div className="approval-grid">
        {media.map((p) => (
          <ApprovalPanel key={p.part} episode={d.summary.id} part={p} onChanged={reload} compact />
        ))}
      </div>
      <h2>Nội dung social</h2>
      <PartsTable parts={social} />
      <p className="small">
        Xem và duyệt từng bài ở tab <a href={`#/tap/${d.summary.id}/social`}>Nội dung social</a>.
      </p>
      <TechDetails>
        <div>Hash nội dung kịch bản: <code>{m.contentHash}</code></div>
        <pre>{JSON.stringify(m.versions, null, 2)}</pre>
        <pre>{JSON.stringify(m.checks, null, 2)}</pre>
      </TechDetails>
    </div>
  );
};

export const PartsTable: React.FC<{ parts: PartState[] }> = ({ parts }) => (
  <div className="table-wrap">
    <table>
      <thead>
        <tr>
          <th>Sản phẩm</th>
          <th>Sản xuất</th>
          <th>Duyệt</th>
        </tr>
      </thead>
      <tbody>
        {parts.map((p) => (
          <tr key={p.part}>
            <td>{p.label}</td>
            <td>{p.production === "done" ? "Đã làm" : p.production === "chưa có" ? "Chưa có" : p.production}</td>
            <td>
              <StatusBadge status={p.status} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
