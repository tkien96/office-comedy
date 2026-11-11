import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_FAMILY } from "../design/fonts";

// On-screen story cards (UI layer, top half of the frame). Each card is
// rendered inside a <Sequence>, so frame 0 = when the card appears.

const CARD: React.CSSProperties = {
  position: "absolute",
  left: 90,
  top: 180,
  width: 900,
  background: "#ffffff",
  border: "5px solid #2b2118",
  borderRadius: 34,
  padding: "28px 36px",
  fontFamily: FONT_FAMILY,
  boxShadow: "0 12px 0 rgba(15,23,42,0.15)",
};

const usePop = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 13, stiffness: 170 } });
  return { opacity: s, transform: `scale(${0.7 + 0.3 * s})`, transformOrigin: "50% 0%" };
};

export const ProgressCard: React.FC<{ title: string; doneLabel: string }> = ({ title, doneLabel }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const pop = usePop();
  // Bar fills in the first ~40% of the card's time (min 10 frames), then "done".
  const fillEnd = Math.max(10, Math.min(36, Math.round(durationInFrames * 0.4)));
  const p = interpolate(frame, [4, fillEnd], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const done = p >= 1;
  return (
    <div style={{ ...CARD, ...pop }}>
      <div style={{ fontSize: 44, fontWeight: 800, color: "#0f172a" }}>{title}</div>
      <div style={{ marginTop: 22, height: 44, borderRadius: 22, background: "#e2e8f0", border: "4px solid #2b2118", overflow: "hidden" }}>
        <div style={{ width: `${p * 100}%`, height: "100%", background: done ? "#22c55e" : "#3b82f6" }} />
      </div>
      <div style={{ marginTop: 16, fontSize: 38, fontWeight: 700, color: done ? "#15803d" : "#475569" }}>
        {done ? `✓ ${doneLabel}` : `${Math.round(p * 100)}%`}
      </div>
    </div>
  );
};

export const ChecklistCard: React.FC<{ title: string; items: string[] }> = ({ title, items }) => {
  const frame = useCurrentFrame();
  const pop = usePop();
  return (
    <div style={{ ...CARD, ...pop }}>
      <div style={{ fontSize: 44, fontWeight: 800, color: "#0f172a" }}>{title}</div>
      {items.map((it, i) => {
        const o = interpolate(frame, [8 + i * 10, 14 + i * 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return (
          <div key={it} style={{ marginTop: 14, fontSize: 40, fontWeight: 600, color: "#1f2937", opacity: o, transform: `translateX(${(1 - o) * 30}px)` }}>
            <span style={{ display: "inline-block", width: 30, height: 30, border: "4px solid #2b2118", borderRadius: 6, marginRight: 14, verticalAlign: "-4px" }} />{it}
          </div>
        );
      })}
    </div>
  );
};

export const CalendarCard: React.FC<{ title: string; items: string[] }> = ({ title, items }) => {
  const frame = useCurrentFrame();
  const pop = usePop();
  return (
    <div style={{ ...CARD, top: 150, padding: "22px 32px", ...pop }}>
      <div style={{ fontSize: 40, fontWeight: 800, color: "#0f172a" }}>
        {title}: <span style={{ color: "#dc2626" }}>{Math.min(items.length, Math.floor(Math.max(0, frame - 6) / 4) + 1)} buổi</span>
      </div>
      {items.map((it, i) => {
        const o = interpolate(frame, [6 + i * 4, 10 + i * 4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return (
          <div key={it} style={{ marginTop: 6, fontSize: 31, fontWeight: 600, color: "#1f2937", opacity: o, background: i % 2 ? "#f1f5f9" : "#fef3c7", borderRadius: 10, padding: "3px 14px" }}>
            {it}
          </div>
        );
      })}
    </div>
  );
};

export const StampText: React.FC<{ text: string; color: string; x: number; y: number; fontSize?: number }> = ({ text, color, x, y, fontSize = 92 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 9, stiffness: 200 } });
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `translate(-50%,-50%) scale(${s}) rotate(-6deg)`,
        fontFamily: FONT_FAMILY,
        fontWeight: 800,
        fontSize,
        color,
        WebkitTextStroke: "5px #2b2118",
        paintOrder: "stroke fill",
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </div>
  );
};
