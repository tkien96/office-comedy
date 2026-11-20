import React from "react";
import { get, type EpisodeDetail as Detail, type PartState } from "./api";
import { DeliveryTab } from "./DeliveryTab";
import { SocialTab } from "./SocialTab";
import { ScriptWorkspace } from "./ScriptWorkspace";
import { CaptionsTab, ImagesTab, MediaTab, ReportsTab } from "./tabs";
import { ErrorBox, fmtSec, Loading, PartBadge, TechDetails, useAsync } from "./ui";

const TABS: [string, string][] = [
  ["tong-quan", "Tổng quan"],
  ["kich-ban", "Kịch bản"],
  ["am-thanh-video", "Âm thanh và video"],
  ["phu-de", "Phụ đề"],
  ["hinh-anh", "Hình ảnh"],
  ["social", "Nội dung social"],
  ["dang-thu-cong", "Bộ đăng thủ công"],
  ["bao-cao", "Báo cáo"],
];

export const EpisodeDetail: React.FC<{ id: string; tab: string }> = ({ id, tab }) => {
  const { data, error, loading, reload } = useAsync(() => get<Detail>(`/api/episodes/${id}`), [id]);
  const current = TABS.some(([k]) => k === tab) ? tab : "tong-quan";

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
          {current === "tong-quan" ? <Overview d={data} /> : null}
          {current === "kich-ban" ? <ScriptWorkspace episode={id} reloadEpisode={reload} /> : null}
          {current === "am-thanh-video" ? <MediaTab d={data} /> : null}
          {current === "phu-de" ? <CaptionsTab d={data} /> : null}
          {current === "hinh-anh" ? <ImagesTab d={data} /> : null}
          {current === "social" ? <SocialTab d={data} reload={reload} /> : null}
          {current === "dang-thu-cong" ? <DeliveryTab d={data} reload={reload} /> : null}
          {current === "bao-cao" ? <ReportsTab d={data} /> : null}
        </div>
      ) : null}
    </section>
  );
};

const Overview: React.FC<{ d: Detail }> = ({ d }) => {
  const m = d.manifest!;
  const parts = d.parts ?? [];
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
          <div className="small">Bộ đăng thủ công: {d.delivery?.exists ? (d.delivery.ok ? "khớp nguồn" : "cần tạo lại") : "chưa có"}</div>
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
      <h2>Các phần của tập</h2>
      <PartsTable parts={parts} />
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
          <th>Phần</th>
          <th>Trạng thái</th>
        </tr>
      </thead>
      <tbody>
        {parts.map((p) => (
          <tr key={p.part}>
            <td>{p.label}</td>
            <td>
              <PartBadge exists={p.exists} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
