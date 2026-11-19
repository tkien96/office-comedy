import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

// Shared UI pieces: badges, toasts, modal, copy button, loading/error states.

export const PLATFORM: Record<string, string> = { youtube: "YouTube", facebook: "Facebook", tiktok: "TikTok" };
export const POST_NAME: Record<string, string> = { video: "Video", teaser: "Bài nhá hàng" };

export const Badge: React.FC<{ tone: string; children: React.ReactNode; title?: string }> = ({ tone, children, title }) => (
  <span className={`badge badge-${tone}`} title={title}>
    {children}
  </span>
);

/** Whether a product of the episode exists right now. */
export const PartBadge: React.FC<{ exists: boolean }> = ({ exists }) => <Badge tone={exists ? "ok" : "none"}>{exists ? "Có" : "Chưa có"}</Badge>;

export const Loading: React.FC<{ text?: string }> = ({ text = "Đang tải…" }) => <div className="state state-loading">{text}</div>;
export const Empty: React.FC<{ children: React.ReactNode }> = ({ children }) => <div className="state state-empty">{children}</div>;
export const ErrorBox: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => (
  <div className="state state-error" role="alert">
    <strong>Lỗi:</strong> {message}
    {onRetry ? (
      <button type="button" className="btn btn-small" onClick={onRetry}>
        Thử lại
      </button>
    ) : null}
  </div>
);

/** A control that exists in the design but has no backend yet: always disabled, always explained. */
export const Unavailable: React.FC<{ label: string; reason: string }> = ({ label, reason }) => (
  <div className="unavailable">
    <button type="button" className="btn" disabled aria-disabled="true">
      {label}
    </button>
    <span className="muted">{reason}</span>
  </div>
);

export const TechDetails: React.FC<{ children: React.ReactNode; summary?: string }> = ({ children, summary = "Chi tiết kỹ thuật" }) => (
  <details className="tech">
    <summary>{summary}</summary>
    <div className="tech-body">{children}</div>
  </details>
);

// ---- Toasts -------------------------------------------------------------------

type Toast = { id: number; tone: "ok" | "bad" | "info"; text: string };
const ToastCtx = createContext<(tone: Toast["tone"], text: string) => void>(() => undefined);
export const useToast = () => useContext(ToastCtx);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((tone: Toast["tone"], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, tone, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "bad" ? 9000 : 4500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`} role={t.tone === "bad" ? "alert" : "status"}>
            {t.text}
            <button type="button" className="toast-x" aria-label="Đóng" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}>
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
};

// ---- Modal ---------------------------------------------------------------------

export const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode; actions: React.ReactNode }> = ({ title, onClose, children, actions }) => {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <div className="modal-body">{children}</div>
        <div className="modal-actions">{actions}</div>
      </div>
    </div>
  );
};

// ---- Copy ------------------------------------------------------------------------

export const CopyButton: React.FC<{ text: string; label?: string }> = ({ text, label = "Sao chép" }) => {
  const toast = useToast();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast("ok", "Đã sao chép.");
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      toast(ok ? "ok" : "bad", ok ? "Đã sao chép." : "Không sao chép được, hãy chọn chữ và nhấn Ctrl+C.");
    }
  };
  return (
    <button type="button" className="btn btn-small" onClick={copy} disabled={!text}>
      {label}
    </button>
  );
};

// ---- Formatting -------------------------------------------------------------------

export const fmtSec = (s: number) => {
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${r.toFixed(2).padStart(5, "0")}`;
};
export const fmtBytes = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

const VN = new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" });
/** ISO time → giờ Việt Nam (Asia/Ho_Chi_Minh). */
export const fmtVN = (iso: string | null | undefined) => (iso ? VN.format(new Date(iso)) : "—");

export const useAsync = <T,>(fn: () => Promise<T>, deps: unknown[]) => {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: true });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fn().then(
      (data) => alive && setState({ data, error: null, loading: false }),
      (e: Error) => alive && setState({ data: null, error: e.message, loading: false }),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { ...state, reload: () => setTick((t) => t + 1) };
};
