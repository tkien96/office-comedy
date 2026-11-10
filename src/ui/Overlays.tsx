import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { RIG } from "../characters/Character";
import { FONT_FAMILY } from "../design/fonts";
import { SAFE, SUBTITLE_ZONE, VIDEO } from "../design/tokens";

/**
 * Chat-style notification card. `revealed` = number of characters of `body`
 * visible (typewriter), computed by the scene from the frame.
 */
export const NotificationCard: React.FC<{
  sender: string;
  body: string;
  revealed: number;
  x: number;
  y: number;
  width: number;
  /** Tail tip (absolute px) pointing at the phone. */
  tailX: number;
  tailY: number;
}> = ({ sender, body, revealed, x, y, width, tailX, tailY }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 12, stiffness: 160 } });
  const shown = body.slice(0, Math.max(0, Math.floor(revealed)));
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <svg width={VIDEO.width} height={VIDEO.height} style={{ position: "absolute", inset: 0 }}>
        <path
          d={`M${tailX - 40},${y + 150} L${tailX + 40},${y + 150} L${tailX},${tailY} Z`}
          fill="#ffffff"
          stroke="#2b2118"
          strokeWidth={5}
          strokeLinejoin="round"
          opacity={pop}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          left: x,
          top: y,
          width,
          transform: `scale(${0.6 + pop * 0.4})`,
          transformOrigin: `${tailX - x}px 100%`,
          opacity: pop,
          background: "#ffffff",
          border: "5px solid #2b2118",
          borderRadius: 34,
          padding: "26px 32px",
          fontFamily: FONT_FAMILY,
          boxShadow: "0 12px 0 rgba(15,23,42,0.15)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 18,
              background: "#1e3a8a",
              color: "#ffffff",
              fontWeight: 800,
              fontSize: 30,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            S
          </div>
          <div style={{ fontWeight: 800, fontSize: 40, color: "#0f172a" }}>{sender}</div>
          <div style={{ marginLeft: "auto", fontSize: 28, color: "#64748b", fontWeight: 600 }}>vừa xong</div>
        </div>
        <div
          style={{
            marginTop: 16,
            fontSize: 44,
            lineHeight: 1.3,
            fontWeight: 600,
            color: "#1f2937",
            minHeight: 116,
            whiteSpace: "pre-wrap",
          }}
        >
          {shown}
        </div>
      </div>
    </div>
  );
};

/** Vibration marks around a buzzing phone. */
export const BuzzMarks: React.FC<{ x: number; y: number; strength: number }> = ({ x, y, strength }) => {
  if (strength <= 0) return null;
  return (
    <svg width={VIDEO.width} height={VIDEO.height} style={{ position: "absolute", inset: 0 }}>
      <g transform={`translate(${x},${y})`} stroke="#ef4444" strokeWidth={7} strokeLinecap="round" fill="none" opacity={strength}>
        <path d="M-70,-30 q-16,30 0,60" />
        <path d="M-96,-46 q-26,46 0,92" />
        <path d="M70,-30 q16,30 0,60" />
        <path d="M96,-46 q26,46 0,92" />
      </g>
    </svg>
  );
};

/** Big comic shock text, e.g. "HẢ?!" */
export const ShockText: React.FC<{ text: string; x: number; y: number; color?: string }> = ({
  text,
  x,
  y,
  color = "#ef4444",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 7, stiffness: 220 } });
  const wobble = Math.sin(frame * 0.8) * 4;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `translate(-50%,-50%) scale(${s}) rotate(${-8 + wobble}deg)`,
        fontFamily: FONT_FAMILY,
        fontWeight: 800,
        fontSize: 110,
        color,
        WebkitTextStroke: "6px #2b2118",
        paintOrder: "stroke fill",
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </div>
  );
};

/** Debug overlay: subtitle band + safe margins. */
export const SafeAreaOverlay: React.FC = () => {
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: SAFE.side,
          top: SAFE.top,
          right: SAFE.side,
          bottom: SAFE.bottom,
          border: "4px dashed rgba(34,197,94,0.9)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: SUBTITLE_ZONE.left,
          top: SUBTITLE_ZONE.top,
          width: SUBTITLE_ZONE.right - SUBTITLE_ZONE.left,
          height: SUBTITLE_ZONE.bottom - SUBTITLE_ZONE.top,
          background: "rgba(239,68,68,0.18)",
          border: "4px solid rgba(239,68,68,0.9)",
        }}
      />
    </div>
  );
};

// ---------------------------------------------------------------------------

export type Placement = { id: string; x: number; y: number; scale: number; seated: boolean };

/** Screen-space bottom of a character's face (chin) for a placement. */
export const faceBottom = (p: Placement) =>
  p.y + (RIG.headY + 100 + (p.seated ? RIG.sitDrop : 0)) * p.scale;

/** Fails the render if any face would sit inside the subtitle band. */
export const assertClearOfSubtitles = (placements: Placement[], margin = 40) => {
  for (const p of placements) {
    const chin = faceBottom(p);
    if (chin > SUBTITLE_ZONE.top - margin) {
      throw new Error(
        `Face of "${p.id}" (chin y=${Math.round(chin)}) overlaps subtitle zone (top y=${SUBTITLE_ZONE.top}).`,
      );
    }
  }
};
