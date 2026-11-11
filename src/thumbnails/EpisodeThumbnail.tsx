import React from "react";
import { AbsoluteFill, Freeze } from "remotion";
import { MeetingRoomBackground, OfficeBackground, OfficeDeskRow, PantryBackground } from "../backgrounds/Backgrounds";
import { Character } from "../characters/Character";
import { CHARACTERS } from "../characters/designs";
import { DEFAULT_STATE, type CharacterId, type CharacterState } from "../characters/types";
import { FONT_FAMILY } from "../design/fonts";

// Still image (thumbnail / teaser) built from the SAME rig, backgrounds and
// fonts as the episode video. Layout is data (src/episodes/<id>-thumbnails.ts):
// each aspect ratio gets its own camera, cast placement and text block,
// not a mechanical crop of the other.

export type ThumbCast = {
  character: CharacterId;
  /** Position in world (1080x1920 scene) units, same as episode staging. */
  x: number;
  y: number;
  scale: number;
  state: Partial<CharacterState>;
};

export type ThumbText = {
  /** Big lines, top to bottom. Keep short: read on a phone at thumbnail size. */
  headline: string[];
  /** Highlighted line under the headline (tag style). */
  kicker?: string;
  top: number;
  left: number;
  width: number;
  fontSize: number;
  align?: "left" | "center";
  rotate?: number;
};

export type ThumbnailSpec = {
  width: number;
  height: number;
  location: "office" | "meeting" | "pantry";
  /** World → image camera: world point (focusX, focusY) lands at image center. */
  camera: { zoom: number; focusX: number; focusY: number };
  deskTop?: number;
  clock?: { hour: number; minute: number };
  cast: ThumbCast[];
  text: ThumbText;
  /** Rig frame to freeze (idle motion, blinks). Pick one with eyes open. */
  freezeFrame: number;
};

const WORLD = { width: 1080, height: 1920 };

const Background: React.FC<{ spec: ThumbnailSpec }> = ({ spec }) => {
  if (spec.location === "meeting") return <MeetingRoomBackground />;
  if (spec.location === "pantry") return <PantryBackground />;
  return <OfficeBackground clockHour={spec.clock?.hour} clockMinute={spec.clock?.minute} />;
};

export const EpisodeThumbnail: React.FC<{ spec: ThumbnailSpec }> = ({ spec }) => {
  const { zoom, focusX, focusY } = spec.camera;
  const tx = spec.width / 2 - focusX * zoom;
  const ty = spec.height / 2 - focusY * zoom;
  const t = spec.text;
  return (
    <AbsoluteFill style={{ backgroundColor: "#e6edf5", overflow: "hidden" }}>
      <Freeze frame={spec.freezeFrame}>
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: WORLD.width,
            height: WORLD.height,
            transformOrigin: "0 0",
            transform: `translate(${tx}px, ${ty}px) scale(${zoom})`,
          }}
        >
          <Background spec={spec} />
          {spec.cast.map((c) => (
            <div key={c.character} style={{ position: "absolute", left: c.x, top: c.y, width: 400 * c.scale, height: 800 * c.scale }}>
              <Character
                design={CHARACTERS[c.character]}
                state={{ ...DEFAULT_STATE, ...c.state }}
                changedAt={-60}
                style={{ width: "100%", height: "100%" }}
              />
            </div>
          ))}
          {spec.deskTop !== undefined ? <OfficeDeskRow top={spec.deskTop} /> : null}
        </div>
      </Freeze>

      {/* Text block (image space). */}
      <div
        style={{
          position: "absolute",
          left: t.left,
          top: t.top,
          width: t.width,
          fontFamily: FONT_FAMILY,
          textAlign: t.align ?? "left",
          transform: t.rotate ? `rotate(${t.rotate}deg)` : undefined,
          transformOrigin: "0 0",
        }}
      >
        {t.headline.map((line) => (
          <div key={line} style={{ marginBottom: t.fontSize * 0.14 }}>
            <span
              style={{
                display: "inline-block",
                background: "#fde047",
                color: "#111827",
                fontWeight: 800,
                fontSize: t.fontSize,
                lineHeight: 1.08,
                padding: `${t.fontSize * 0.06}px ${t.fontSize * 0.2}px ${t.fontSize * 0.1}px`,
                border: "7px solid #2b2118",
                borderRadius: 18,
                boxShadow: "0 10px 0 rgba(15,23,42,0.28)",
                whiteSpace: "nowrap",
              }}
            >
              {line}
            </span>
          </div>
        ))}
        {t.kicker ? (
          <div style={{ marginTop: t.fontSize * 0.1 }}>
            <span
              style={{
                display: "inline-block",
                background: "#dc2626",
                color: "#ffffff",
                fontWeight: 800,
                fontSize: t.fontSize * 0.62,
                lineHeight: 1.1,
                padding: `${t.fontSize * 0.06}px ${t.fontSize * 0.22}px ${t.fontSize * 0.09}px`,
                border: "6px solid #2b2118",
                borderRadius: 16,
                boxShadow: "0 8px 0 rgba(15,23,42,0.28)",
                whiteSpace: "nowrap",
              }}
            >
              {t.kicker}
            </span>
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
