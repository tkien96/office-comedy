import React from "react";
import type { CharacterDesign } from "./types";

// Hair in head-local coordinates (head centre 0,0; radius ~92 x 100).
// "back" is drawn behind the head, "front" on top of the face.

export const HairBack: React.FC<{ design: CharacterDesign; sway: number }> = ({
  design,
  sway,
}) => {
  if (design.hairStyle !== "linhLong") return null;
  const s = sway * 6;
  return (
    <path
      d={`M-104,-20 C-112,-118 112,-118 104,-20 L${116 + s},150 Q60,${176} 0,166 Q-60,176 ${-116 + s},150 Z`}
      fill={design.hair}
    />
  );
};

export const HairFront: React.FC<{ design: CharacterDesign; sway: number }> = ({
  design,
  sway,
}) => {
  switch (design.hairStyle) {
    case "namShort":
      return (
        <g>
          <path
            d="M-96,-4 C-104,-84 -52,-122 2,-120 C58,-122 104,-84 96,-4 C92,-36 76,-56 46,-62 C24,-44 -16,-66 -48,-52 C-70,-46 -88,-30 -96,-4 Z"
            fill={design.hair}
          />
          <path
            d="M-30,-100 C-6,-110 30,-108 56,-92"
            stroke={design.hairShade}
            strokeWidth={6}
            fill="none"
            strokeLinecap="round"
          />
          <path d="M-96,-4 L-92,26 L-84,0 Z" fill={design.hair} />
          <path d="M96,-4 L92,26 L84,0 Z" fill={design.hair} />
        </g>
      );
    case "linhLong": {
      const s = sway * 4;
      return (
        <g>
          <path
            d="M-98,-2 C-104,-92 -40,-124 10,-118 C70,-116 106,-74 98,-2 C92,-36 76,-52 58,-58 C40,-32 8,-36 -8,-62 C-26,-42 -62,-30 -98,-2 Z"
            fill={design.hair}
          />
          <path
            d={`M-98,-6 C-104,40 -98,80 ${-90 + s},120 C-82,80 -82,30 -80,-10 Z`}
            fill={design.hair}
          />
          <path
            d={`M98,-6 C104,40 98,80 ${90 + s},120 C82,80 82,30 80,-10 Z`}
            fill={design.hair}
          />
          <path
            d="M-40,-96 C-10,-108 30,-104 60,-86"
            stroke={design.hairShade}
            strokeWidth={6}
            fill="none"
            strokeLinecap="round"
          />
          {design.hairClip ? (
            <rect
              x={44}
              y={-74}
              width={34}
              height={12}
              rx={6}
              transform="rotate(-24 61 -68)"
              fill={design.hairClip}
              stroke="#a16207"
              strokeWidth={2.5}
            />
          ) : null}
        </g>
      );
    }
    case "sepReceding":
      return (
        <g>
          {/* sides */}
          <path
            d="M-96,8 C-102,-40 -88,-74 -62,-90 C-58,-70 -66,-50 -78,-34 C-84,-20 -88,-6 -90,14 Z"
            fill={design.hair}
          />
          <path
            d="M96,8 C102,-40 88,-74 62,-90 C58,-70 66,-50 78,-34 C84,-20 88,-6 90,14 Z"
            fill={design.hair}
          />
          {/* grey temples */}
          <path d="M-94,4 C-96,-14 -92,-26 -86,-34 L-84,0 Z" fill={design.hairShade} />
          <path d="M94,4 C96,-14 92,-26 86,-34 L84,0 Z" fill={design.hairShade} />
          {/* thin top */}
          <path
            d="M-62,-90 C-30,-110 30,-110 62,-90 C40,-98 20,-96 0,-92 C-20,-96 -40,-98 -62,-90 Z"
            fill={design.hair}
          />
          {/* forehead lines */}
          <g stroke={design.skinShade} strokeWidth={3} fill="none" strokeLinecap="round">
            <path d="M-34,-66 Q0,-74 34,-66" />
            <path d="M-26,-54 Q0,-60 26,-54" />
          </g>
        </g>
      );
  }
};
