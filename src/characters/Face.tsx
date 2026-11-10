import React from "react";
import { PALETTE } from "../design/tokens";
import type { CharacterDesign, Expression } from "./types";

// Face parts are drawn in head-local coordinates: head centre is (0,0),
// head radius ~92 x 100. Eyes, brows and mouth are separate, swappable parts.

type MouthKind =
  | "flat"
  | "smile"
  | "skew"
  | "o"
  | "frown"
  | "wavy";

type FaceSpec = {
  eyeScale: number;
  pupilScale: number;
  /** Upper eyelid cover 0 (open) .. 1 (closed). */
  lid: number;
  /** Closed "^" eyes. */
  happyEyes: boolean;
  /** Brow vertical offset [left, right] (negative = higher). */
  browDy: [number, number];
  /** Brow angle [left, right]; positive raises the inner end. */
  browAngle: [number, number];
  mouth: MouthKind;
  blush: number;
  sweat: boolean;
  vein: boolean;
};

export const FACE_SPECS: Record<Expression, FaceSpec> = {
  neutral: {
    eyeScale: 1,
    pupilScale: 1,
    lid: 0.12,
    happyEyes: false,
    browDy: [0, 0],
    browAngle: [0, 0],
    mouth: "flat",
    blush: 0,
    sweat: false,
    vein: false,
  },
  happy: {
    eyeScale: 1,
    pupilScale: 1,
    lid: 0,
    happyEyes: true,
    browDy: [-9, -9],
    browAngle: [-4, -4],
    mouth: "smile",
    blush: 0.45,
    sweat: false,
    vein: false,
  },
  suspicious: {
    eyeScale: 0.95,
    pupilScale: 0.95,
    lid: 0.48,
    happyEyes: false,
    browDy: [5, -13],
    browAngle: [-16, 6],
    mouth: "skew",
    blush: 0,
    sweat: false,
    vein: false,
  },
  surprised: {
    eyeScale: 1.28,
    pupilScale: 0.62,
    lid: 0,
    happyEyes: false,
    browDy: [-20, -20],
    browAngle: [4, 4],
    mouth: "o",
    blush: 0,
    sweat: true,
    vein: false,
  },
  annoyed: {
    eyeScale: 0.95,
    pupilScale: 0.9,
    lid: 0.38,
    happyEyes: false,
    browDy: [6, 6],
    browAngle: [-22, -22],
    mouth: "frown",
    blush: 0,
    sweat: false,
    vein: true,
  },
  embarrassed: {
    eyeScale: 0.95,
    pupilScale: 0.9,
    lid: 0.2,
    happyEyes: false,
    browDy: [-5, -5],
    browAngle: [18, 18],
    mouth: "wavy",
    blush: 0.9,
    sweat: true,
    vein: false,
  },
};

const EYE_X = 34;
const EYE_Y = 6;
const EYE_RX = 14;
const EYE_RY = 17;

const Eye: React.FC<{
  side: -1 | 1;
  spec: FaceSpec;
  blink: number;
  lookX: number;
  lookY: number;
  design: CharacterDesign;
}> = ({ side, spec, blink, lookX, lookY, design }) => {
  const cx = side * EYE_X;
  if (spec.happyEyes) {
    return (
      <path
        d={`M${cx - 15},${EYE_Y + 6} Q${cx},${EYE_Y - 14} ${cx + 15},${EYE_Y + 6}`}
        stroke={PALETTE.outline}
        strokeWidth={6}
        strokeLinecap="round"
        fill="none"
      />
    );
  }
  const rx = EYE_RX * spec.eyeScale;
  const ry = EYE_RY * spec.eyeScale;
  const lid = Math.max(spec.lid, blink);
  const pupilR = 8.5 * spec.pupilScale;
  const px = cx + lookX * (rx - pupilR - 1);
  const py = EYE_Y + lookY * (ry - pupilR - 2) + 1;
  const lidBottom = EYE_Y - ry + lid * ry * 2;
  return (
    <g>
      <ellipse cx={cx} cy={EYE_Y} rx={rx} ry={ry} fill={PALETTE.white} />
      <circle cx={px} cy={py} r={pupilR} fill={PALETTE.outline} />
      <circle cx={px + 3} cy={py - 3} r={pupilR * 0.32} fill={PALETTE.white} />
      {lid > 0.02 ? (
        <>
          <rect
            x={cx - rx - 2}
            y={EYE_Y - ry - 3}
            width={rx * 2 + 4}
            height={lidBottom - (EYE_Y - ry - 3)}
            fill={design.skin}
          />
          <line
            x1={cx - rx}
            x2={cx + rx}
            y1={lidBottom}
            y2={lidBottom}
            stroke={PALETTE.outline}
            strokeWidth={4}
            strokeLinecap="round"
          />
        </>
      ) : (
        <ellipse
          cx={cx}
          cy={EYE_Y}
          rx={rx}
          ry={ry}
          fill="none"
          stroke={PALETTE.outline}
          strokeWidth={3}
        />
      )}
    </g>
  );
};

const Brow: React.FC<{
  side: -1 | 1;
  dy: number;
  angle: number;
  color: string;
}> = ({ side, dy, angle, color }) => {
  const cx = side * EYE_X;
  const cy = -24 + dy;
  return (
    <g transform={`translate(${cx},${cy}) rotate(${side * angle})`}>
      <path
        d="M-17,2 Q0,-5 17,2"
        stroke={color}
        strokeWidth={8}
        strokeLinecap="round"
        fill="none"
      />
    </g>
  );
};

const Mouth: React.FC<{ kind: MouthKind; open: number }> = ({ kind, open }) => {
  const stroke = {
    stroke: PALETTE.outline,
    strokeWidth: 5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  // While talking, closed mouths become a small moving oval.
  if (open > 0.05 && (kind === "flat" || kind === "skew" || kind === "frown" || kind === "wavy")) {
    return (
      <g>
        <ellipse cx={0} cy={2} rx={13} ry={3 + open * 10} fill="#7f1d1d" {...stroke} strokeWidth={4} />
      </g>
    );
  }
  switch (kind) {
    case "flat":
      return <path d="M-16,0 Q0,6 16,0" fill="none" {...stroke} />;
    case "skew":
      return <path d="M-16,5 Q2,4 16,-3" fill="none" {...stroke} />;
    case "frown":
      return <path d="M-17,7 Q0,-6 17,7" fill="none" {...stroke} />;
    case "wavy":
      return (
        <path
          d="M-20,2 q5,-6 10,0 t10,0 t10,0 t10,0"
          fill="none"
          {...stroke}
          strokeWidth={4.5}
        />
      );
    case "o": {
      const ry = 15 + open * 4;
      return <ellipse cx={0} cy={4} rx={11} ry={ry} fill="#7f1d1d" {...stroke} strokeWidth={4} />;
    }
    case "smile": {
      const depth = 24 + open * 8;
      return (
        <g>
          <path d={`M-24,-3 Q0,${depth} 24,-3 Z`} fill="#7f1d1d" {...stroke} strokeWidth={4} />
          <path d={`M-11,${depth * 0.38} Q0,${depth * 0.62} 11,${depth * 0.38}`} fill="#f87171" />
        </g>
      );
    }
  }
};

export const Face: React.FC<{
  design: CharacterDesign;
  expression: Expression;
  blink: number;
  lookX: number;
  lookY: number;
  mouthOpen: number;
  /** 0..1 progress used to animate sweat drop / vein pulse. */
  pulse: number;
}> = ({ design, expression, blink, lookX, lookY, mouthOpen, pulse }) => {
  const spec = FACE_SPECS[expression];
  // Features slide with gaze to suggest head turn.
  const fx = lookX * 10;
  const fy = lookY * 6;
  return (
    <g>
      {spec.blush > 0 ? (
        <g opacity={spec.blush}>
          <ellipse cx={-52} cy={34} rx={17} ry={9} fill="#f87171" opacity={0.55} />
          <ellipse cx={52} cy={34} rx={17} ry={9} fill="#f87171" opacity={0.55} />
        </g>
      ) : null}
      <g transform={`translate(${fx},${fy})`}>
        <Eye side={-1} spec={spec} blink={blink} lookX={lookX} lookY={lookY} design={design} />
        <Eye side={1} spec={spec} blink={blink} lookX={lookX} lookY={lookY} design={design} />
        {design.glasses ? (
          <g fill="rgba(255,255,255,0.12)" stroke="#111827" strokeWidth={4.5}>
            <rect x={-EYE_X - 24} y={EYE_Y - 20} width={48} height={40} rx={10} />
            <rect x={EYE_X - 24} y={EYE_Y - 20} width={48} height={40} rx={10} />
            <path d={`M${-EYE_X + 24},${EYE_Y - 6} Q0,${EYE_Y - 14} ${EYE_X - 24},${EYE_Y - 6}`} fill="none" />
          </g>
        ) : null}
        <Brow side={-1} dy={spec.browDy[0]} angle={spec.browAngle[0]} color={design.hair} />
        <Brow side={1} dy={spec.browDy[1]} angle={spec.browAngle[1]} color={design.hair} />
        {/* nose */}
        <path
          d="M-2,22 Q6,32 -4,36"
          stroke={design.skinShade}
          strokeWidth={4}
          fill="none"
          strokeLinecap="round"
        />
        <g transform="translate(0,56)">
          <Mouth kind={spec.mouth} open={mouthOpen} />
        </g>
      </g>
      {spec.sweat ? (
        <path
          transform={`translate(${70 + fx * 0.3},${-38 + pulse * 14})`}
          d="M0,-14 C7,-2 10,4 10,8 A10,10 0 0 1 -10,8 C-10,4 -7,-2 0,-14 Z"
          fill="#93c5fd"
          stroke="#2563eb"
          strokeWidth={2.5}
        />
      ) : null}
      {spec.vein ? (
        <g
          transform={`translate(${-58},${-58}) scale(${0.9 + pulse * 0.25})`}
          stroke="#dc2626"
          strokeWidth={5}
          strokeLinecap="round"
          fill="none"
        >
          <path d="M-12,-4 Q-4,-4 -4,-12" />
          <path d="M12,-4 Q4,-4 4,-12" />
          <path d="M-12,4 Q-4,4 -4,12" />
          <path d="M12,4 Q4,4 4,12" />
        </g>
      ) : null}
    </g>
  );
};
