import React, { useMemo, useState } from "react";
import { get, type EpisodeSummary } from "./api";
import { Badge, Empty, ErrorBox, fmtSec, fmtVN, JOB_STATE, Loading, PLATFORM, StatusBadge, useAsync } from "./ui";

type Filter = "all" | "pending" | "changed" | "complete" | "error";
const FILTERS: Record<Filter, string> = {
  all: "Tất cả",
  pending: "Còn sản phẩm chờ duyệt",
  changed: "Có sản phẩm cần duyệt lại / kiểm tra lại",
  complete: "Đã duyệt đủ (trừ phần chưa có)",
  error: "Có lỗi dữ liệu",
};

const matches = (e: EpisodeSummary, f: Filter) => {
  if (f === "all") return true;
  if (f === "error") return !e.ok || (e.problems?.length ?? 0) > 0;
  const parts = e.parts ?? [];
  if (f === "pending") return parts.some((p) => p.status === "not_approved");
  if (f === "changed") return parts.some((p) => p.status === "needs_reapproval" || p.status === "needs_recheck");
  return e.ok && parts.length > 0 && parts.every((p) => p.status === "approved" || p.status === "missing");
};

export const EpisodeList: React.FC = () => {
  const { data, error, loading, reload } = useAsync(() => get<{ episodes: EpisodeSummary[] }>("/api/episodes"), []);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data?.episodes ?? []).filter((e) => (!term || e.id.toLowerCase().includes(term) || (e.title ?? "").toLowerCase().includes(term)) && matches(e, filter));
  }, [data, q, filter]);

  return (
    <section>
      <header className="page-head">
        <h1>Danh sách tập</h1>
        <button type="button" className="btn" onClick={reload}>
          Tải lại
        </button>
      </header>
      <div className="toolbar">
        <input type="search" placeholder="Tìm theo mã hoặc tên tập…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Tìm tập" />
        <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)} aria-label="Lọc theo trạng thái">
          {Object.entries(FILTERS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      {loading && !data ? <Loading /> : null}
      {error ? <ErrorBox message={error} onRetry={reload} /> : null}
      {data && !data.episodes.length ? <Empty>Chưa có tập nào trong thư mục episodes/. Tạo tập bằng lệnh npm run episode:new -- "Tiêu đề".</Empty> : null}
      {data && data.episodes.length > 0 && !list.length ? <Empty>Không có tập khớp bộ lọc.</Empty> : null}
      <div className="ep-grid">
        {list.map((e) => (
          <EpisodeCard key={e.id} e={e} />
        ))}
      </div>
    </section>
  );
};

const EpisodeCard: React.FC<{ e: EpisodeSummary }> = ({ e }) => {
  if (!e.ok)
    return (
      <article className="ep-card ep-card-error">
        <div className="ep-body">
          <h2>{e.id}</h2>
          <ErrorBox message={e.error ?? "Không đọc được tập."} />
          <p className="muted">Studio không tự sửa dữ liệu. Sửa file rồi tải lại.</p>
        </div>
      </article>
    );
  const parts = e.parts ?? [];
  const count = (s: string) => parts.filter((p) => p.status === s).length;
  const done = parts.filter((p) => p.production === "done").length;
  return (
    <a className="ep-card" href={`#/tap/${e.id}/tong-quan`}>
      <div className="ep-thumb">{e.hasThumbnail ? <img src={`/api/episodes/${e.id}/media/thumb9x16`} alt={`Thumbnail ${e.id}`} loading="lazy" /> : <span className="muted">Chưa có thumbnail</span>}</div>
      <div className="ep-body">
        <div className="ep-id">{e.id}</div>
        <h2>{e.title}</h2>
        <div className="ep-meta">
          {e.hasVideo && e.durationSec ? `${fmtSec(e.durationSec)} · ${e.durationInFrames} khung` : "Chưa có video"}
          {e.updatedAt ? <span className="muted"> · episode.json sửa lần cuối {fmtVN(e.updatedAt)}</span> : null}
        </div>
        <div className="ep-line">
          <span className="muted">Sản xuất:</span> {done}/{parts.length} phần đã làm
        </div>
        <div className="ep-line badges">
          {count("approved") ? <Badge tone="ok">{count("approved")} đã duyệt</Badge> : null}
          {count("not_approved") ? <Badge tone="wait">{count("not_approved")} chờ duyệt</Badge> : null}
          {count("needs_reapproval") ? <StatusBadge status="needs_reapproval" /> : null}
          {count("needs_recheck") ? <StatusBadge status="needs_recheck" /> : null}
          {count("missing") ? <Badge tone="none">{count("missing")} chưa có</Badge> : null}
        </div>
        <div className="ep-line platforms">
          {Object.entries(e.publishing ?? {}).map(([pl, info]) => (
            <span key={pl} className="platform">
              <strong>{PLATFORM[pl] ?? pl}:</strong> <Badge tone={JOB_STATE[info.state]?.tone ?? "none"}>{JOB_STATE[info.state]?.label ?? info.state}</Badge>
            </span>
          ))}
        </div>
        {e.problems?.length ? (
          <ul className="problems">
            {e.problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </a>
  );
};
