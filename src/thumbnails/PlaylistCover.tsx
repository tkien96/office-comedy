import React from "react";
import { AbsoluteFill } from "remotion";
import { FONT_FAMILY } from "../design/fonts";
import { EpisodeThumbnail, type ThumbnailSpec } from "./EpisodeThumbnail";

// Series / playlist cover: a title panel next to a square scene panel. The
// scene is rendered by EpisodeThumbnail (same rig, backgrounds and fonts as the
// episodes), so the cover never redraws the characters. Decorative icons are
// simple original SVG drawings in the same flat style (thick dark outline), no
// external assets. Layout data lives in src/episodes/playlist-cover.ts.

export type CoverIconKind = "laugh" | "haha" | "coffee" | "sparkle" | "star" | "mail" | "clock";
export type CoverIcon = { kind: CoverIconKind; x: number; y: number; size: number; rotate?: number };

export type PlaylistCoverSpec = {
  width: number;
  height: number;
  /** Scene rendering (its own camera and cast); its width/height = the scene box size. */
  scene: ThumbnailSpec;
  /** Where the scene sits. Omitted: full-height square panel on the right with a divider (16:9). Given: a framed card. */
  sceneBox?: { x: number; y: number };
  title: string[];
  kicker: string;
  /** Title block position (px) and size (font size of the title lines). */
  titleTop: number;
  titleLeft?: number;
  titleSize?: number;
  icons: CoverIcon[];
};

const INK = "#2b2118";
const SW = 7; // outline width (icon units, 100x100 box)

const Icon: React.FC<{ kind: CoverIconKind }> = ({ kind }) => {
  switch (kind) {
    case "laugh": // laughing face with tears of joy
      return (
        <>
          <circle cx={50} cy={50} r={42} fill="#fde047" stroke={INK} strokeWidth={SW} />
          <path d="M26 40 q8 -10 16 0 M58 40 q8 -10 16 0" fill="none" stroke={INK} strokeWidth={SW} strokeLinecap="round" />
          <path d="M28 56 h44 q0 24 -22 24 q-22 0 -22 -24 z" fill="#b91c1c" stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
          <path d="M36 66 h28" stroke="#fca5a5" strokeWidth={6} strokeLinecap="round" />
          <path d="M14 46 q-8 10 -2 18 q8 -4 6 -18 z" fill="#7dd3fc" stroke={INK} strokeWidth={5} strokeLinejoin="round" />
          <path d="M86 46 q8 10 2 18 q-8 -4 -6 -18 z" fill="#7dd3fc" stroke={INK} strokeWidth={5} strokeLinejoin="round" />
        </>
      );
    case "haha": // speech bubble
      return (
        <>
          <path d="M8 18 q0 -10 10 -10 h64 q10 0 10 10 v40 q0 10 -10 10 h-40 l-18 18 l2 -18 h-8 q-10 0 -10 -10 z" fill="#ffffff" stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
          <text x={50} y={46} textAnchor="middle" fontFamily={FONT_FAMILY} fontWeight={800} fontSize={21} fill="#dc2626">
            HAHA
          </text>
        </>
      );
    case "coffee": // office mug with steam
      return (
        <>
          <path d="M38 22 q-6 -8 0 -16 M52 22 q-6 -8 0 -16" fill="none" stroke="#e0e7ff" strokeWidth={6} strokeLinecap="round" />
          <path d="M70 44 h8 q12 0 12 12 q0 12 -12 12 h-8" fill="none" stroke={INK} strokeWidth={SW} />
          <path d="M18 30 h56 v46 q0 16 -16 16 h-24 q-16 0 -16 -16 z" fill="#f97316" stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
          <path d="M30 52 h32" stroke="#fed7aa" strokeWidth={6} strokeLinecap="round" />
        </>
      );
    case "sparkle": // four-point sparkle
      return <path d="M50 4 q6 40 46 46 q-40 6 -46 46 q-6 -40 -46 -46 q40 -6 46 -46 z" fill="#fde047" stroke={INK} strokeWidth={SW} strokeLinejoin="round" />;
    case "star":
      return (
        <path
          d="M50 6 l12 28 l30 3 l-23 20 l7 30 l-26 -16 l-26 16 l7 -30 l-23 -20 l30 -3 z"
          fill="#f472b6"
          stroke={INK}
          strokeWidth={SW}
          strokeLinejoin="round"
        />
      );
    case "mail": // envelope (the "send to everyone" running gag)
      return (
        <>
          <rect x={8} y={22} width={84} height={58} rx={8} fill="#ffffff" stroke={INK} strokeWidth={SW} />
          <path d="M12 28 l38 28 l38 -28" fill="none" stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
          <circle cx={84} cy={24} r={13} fill="#dc2626" stroke={INK} strokeWidth={5} />
          <text x={84} y={30} textAnchor="middle" fontFamily={FONT_FAMILY} fontWeight={800} fontSize={17} fill="#ffffff">
            12
          </text>
        </>
      );
    case "clock": // wall clock, meetings that run long
      return (
        <>
          <circle cx={50} cy={50} r={42} fill="#ffffff" stroke={INK} strokeWidth={SW} />
          <path d="M50 50 v-26 M50 50 l18 10" stroke={INK} strokeWidth={SW} strokeLinecap="round" />
          <circle cx={50} cy={50} r={5} fill="#dc2626" />
        </>
      );
  }
};

export const PlaylistCover: React.FC<{ spec: PlaylistCoverSpec }> = ({ spec }) => {
  const T = spec.titleSize ?? 128;
  const box = spec.sceneBox;
  const sceneLeft = box ? box.x : spec.width - spec.scene.width;
  return (
    <AbsoluteFill style={{ backgroundColor: "#1e3a8a", fontFamily: FONT_FAMILY }}>
      {/* Scene: right-hand panel (16:9) or framed card */}
      <div
        style={{
          position: "absolute",
          left: sceneLeft,
          top: box ? box.y : 0,
          width: spec.scene.width,
          height: spec.scene.height,
          overflow: "hidden",
          ...(box ? { border: `10px solid ${INK}`, borderRadius: 34, boxShadow: "0 16px 0 rgba(15,23,42,0.45)", boxSizing: "content-box" as const } : {}),
        }}
      >
        <EpisodeThumbnail spec={spec.scene} />
      </div>
      {box ? null : <div style={{ position: "absolute", left: sceneLeft - 6, top: 0, width: 12, height: spec.height, background: INK }} />}

      {/* Icons (behind the title) */}
      {spec.icons.map((ic, i) => (
        <svg
          key={i}
          viewBox="0 0 100 100"
          width={ic.size}
          height={ic.size}
          style={{ position: "absolute", left: ic.x, top: ic.y, transform: `rotate(${ic.rotate ?? 0}deg)`, overflow: "visible", filter: "drop-shadow(0 8px 0 rgba(15,23,42,0.35))" }}
        >
          <Icon kind={ic.kind} />
        </svg>
      ))}

      {/* Title */}
      <div style={{ position: "absolute", left: spec.titleLeft ?? 64, top: spec.titleTop }}>
        {spec.title.map((line) => (
          <div key={line} style={{ marginBottom: T * 0.14 }}>
            <span
              style={{
                display: "inline-block",
                background: "#fde047",
                color: "#111827",
                fontWeight: 800,
                fontSize: T,
                lineHeight: 1.04,
                padding: `${T * 0.05}px ${T * 0.23}px ${T * 0.09}px`,
                border: `8px solid ${INK}`,
                borderRadius: 22,
                boxShadow: "0 12px 0 rgba(15,23,42,0.45)",
                whiteSpace: "nowrap",
              }}
            >
              {line}
            </span>
          </div>
        ))}
        <div style={{ marginTop: T * 0.14 }}>
          <span
            style={{
              display: "inline-block",
              background: "#dc2626",
              color: "#ffffff",
              fontWeight: 800,
              fontSize: T * 0.56,
              lineHeight: 1.1,
              padding: `${T * 0.05}px ${T * 0.2}px ${T * 0.08}px`,
              border: `7px solid ${INK}`,
              borderRadius: 18,
              boxShadow: "0 10px 0 rgba(15,23,42,0.45)",
              whiteSpace: "nowrap",
            }}
          >
            {spec.kicker}
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
