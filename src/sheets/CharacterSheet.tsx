import React from "react";
import { AbsoluteFill } from "remotion";
import { Character } from "../characters/Character";
import { CHARACTER_BIOS, CHARACTERS } from "../characters/designs";
import {
  DEFAULT_STATE,
  EXPRESSIONS,
  POSES,
  type CharacterDesign,
  type CharacterState,
  type Expression,
  type Pose,
} from "../characters/types";
import { FONT_FAMILY } from "../design/fonts";

export const SHEET = { width: 2800, height: 2860 } as const;

const EXPRESSION_LABEL: Record<Expression, string> = {
  neutral: "Bình thường",
  happy: "Vui",
  suspicious: "Nghi ngờ",
  surprised: "Bất ngờ",
  annoyed: "Bực",
  embarrassed: "Ngượng",
};

const POSE_LABEL: Record<Pose, string> = {
  standing: "Đứng",
  computer: "Ngồi máy tính",
  phone: "Cầm điện thoại",
  pointing: "Chỉ tay",
};

const POSE_STATE: Record<Pose, Partial<CharacterState>> = {
  standing: { pose: "standing" },
  computer: { pose: "computer", seated: true, laptop: true, lookY: 0.35 },
  phone: { pose: "phone", lookX: 0.35, lookY: 0.75 },
  pointing: { pose: "pointing", lookX: 0.8, expression: "suspicious" },
};

const label: React.CSSProperties = {
  fontFamily: FONT_FAMILY,
  fontWeight: 700,
  fontSize: 30,
  color: "#334155",
  textAlign: "center",
};

const Row: React.FC<{ design: CharacterDesign }> = ({ design }) => {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 40,
        height: 880,
        padding: "0 60px",
        borderBottom: "3px dashed #cbd5e1",
      }}
    >
      <div style={{ width: 300, fontFamily: FONT_FAMILY }}>
        <div style={{ fontSize: 76, fontWeight: 800, color: design.shirtShade === "#cfd8e3" ? "#1e3a8a" : design.shirtShade }}>
          {design.displayName}
        </div>
        <div style={{ fontSize: 28, lineHeight: 1.35, color: "#475569", marginTop: 12 }}>
          {CHARACTER_BIOS[design.id]}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
          {[design.shirt, design.hair, design.skin, design.pants].map((c) => (
            <div key={c} style={{ width: 44, height: 44, borderRadius: 10, background: c, border: "3px solid #1f2937" }} />
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 230px)", gap: "18px 22px" }}>
        {EXPRESSIONS.map((e) => (
          <div key={e}>
            <div style={{ width: 230, height: 250, background: "#f1f5f9", borderRadius: 24 }}>
              <Character design={design} state={{ ...DEFAULT_STATE, expression: e }} crop="head" style={{ width: 230, height: 250 }} />
            </div>
            <div style={{ ...label, marginTop: 6 }}>{EXPRESSION_LABEL[e]}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 16 }}>
        {POSES.map((p) => {
          const wide = p === "pointing";
          return (
          <div key={p}>
            <div style={{ width: wide ? 480 : 340, height: 720, background: "#f8fafc", borderRadius: 24, overflow: "hidden" }}>
              <Character
                design={design}
                state={{ ...DEFAULT_STATE, ...POSE_STATE[p] }}
                desk
                viewBox={wide ? "0 0 565 800" : undefined}
                style={{ width: wide ? 480 : 340, height: 680, marginTop: 20 }}
              />
            </div>
            <div style={{ ...label, marginTop: 8 }}>{POSE_LABEL[p]}</div>
          </div>
          );
        })}
      </div>
    </div>
  );
};

export const CharacterSheet: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#ffffff" }}>
      <div
        style={{
          height: 220,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 60px",
          fontFamily: FONT_FAMILY,
          borderBottom: "4px solid #1f2937",
        }}
      >
        <div>
          <div style={{ fontSize: 84, fontWeight: 800, color: "#0f172a" }}>Bộ nhân vật — Hài công sở</div>
          <div style={{ fontSize: 34, color: "#475569" }}>
            Cùng một khung xương SVG · 6 biểu cảm · 4 tư thế · dùng lại cho mọi tập
          </div>
        </div>
      </div>
      {Object.values(CHARACTERS).map((d) => (
        <Row key={d.id} design={d} />
      ))}
    </AbsoluteFill>
  );
};
