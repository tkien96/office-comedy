import React from "react";
import { AbsoluteFill } from "remotion";
import {
  MeetingRoomBackground,
  OfficeBackground,
  PantryBackground,
} from "../backgrounds/Backgrounds";
import { FONT_FAMILY } from "../design/fonts";
import { VIDEO } from "../design/tokens";
import { SafeAreaOverlay } from "../ui/Overlays";

const SCALE = 0.6;
export const BG_SHEET = { width: 2240, height: 1400 } as const;

const Thumb: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <div
      style={{
        width: VIDEO.width * SCALE,
        height: VIDEO.height * SCALE,
        borderRadius: 20,
        overflow: "hidden",
        border: "4px solid #1f2937",
        position: "relative",
      }}
    >
      <div
        style={{
          width: VIDEO.width,
          height: VIDEO.height,
          transform: `scale(${SCALE})`,
          transformOrigin: "0 0",
          position: "relative",
        }}
      >
        {children}
        <SafeAreaOverlay />
      </div>
    </div>
    <div style={{ fontFamily: FONT_FAMILY, fontWeight: 800, fontSize: 40, textAlign: "center", marginTop: 12, color: "#0f172a" }}>
      {title}
    </div>
  </div>
);

export const BackgroundSheet: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#ffffff", fontFamily: FONT_FAMILY }}>
    <div style={{ padding: "30px 60px 0", fontSize: 56, fontWeight: 800, color: "#0f172a" }}>
      Bối cảnh — 1080x1920
      <span style={{ fontSize: 30, fontWeight: 600, color: "#64748b", marginLeft: 24 }}>
        khung xanh: vùng an toàn · khung đỏ: dải phụ đề (không đặt mặt nhân vật vào đây)
      </span>
    </div>
    <div style={{ display: "flex", gap: 60, padding: "30px 60px" }}>
      <Thumb title="Văn phòng">
        <OfficeBackground />
      </Thumb>
      <Thumb title="Phòng họp">
        <MeetingRoomBackground />
      </Thumb>
      <Thumb title="Pantry">
        <PantryBackground steam={1} />
      </Thumb>
    </div>
  </AbsoluteFill>
);
