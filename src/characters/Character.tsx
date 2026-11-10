import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { PALETTE } from "../design/tokens";
import { clamp01, hash01, lerp, smooth } from "../lib/timeline";
import { Face } from "./Face";
import { HairBack, HairFront } from "./Hair";
import type { CharacterDesign, CharacterState, Pose } from "./types";

// ---------------------------------------------------------------------------
// Rig geometry (rig units). The character lives in a 400 x 800 box, feet on
// y = 780. Every character uses the same skeleton, so proportions match.
// ---------------------------------------------------------------------------
export const RIG = {
  width: 400,
  height: 800,
  centerX: 200,
  headY: 175,
  shoulderY: 300,
  waistY: 515,
  groundY: 780,
  /** How far the upper body drops when seated. */
  sitDrop: 120,
  upperArm: 120,
  forearm: 110,
  /** Desk / laptop surface (rig units, seated). */
  deskTopY: 690,
} as const;

const OUTLINE = { stroke: PALETTE.outline, strokeWidth: 4, strokeLinejoin: "round" as const };

type ArmAngles = { raise: number; bend: number };
type ArmPair = { left: ArmAngles; right: ArmAngles };

const REST: ArmAngles = { raise: 10, bend: 8 };
const KEYBOARD: ArmAngles = { raise: -6, bend: 22 };

const armsFor = (pose: Pose, laptop: boolean): ArmPair => {
  const idle = laptop ? KEYBOARD : REST;
  switch (pose) {
    case "standing":
      return { left: REST, right: REST };
    case "computer":
      return { left: KEYBOARD, right: KEYBOARD };
    case "phone":
      return { left: idle, right: { raise: 26, bend: 128 } };
    case "pointing":
      return { left: idle, right: { raise: 84, bend: 4 } };
  }
};

const mixArm = (a: ArmAngles, b: ArmAngles, t: number): ArmAngles => ({
  raise: lerp(a.raise, b.raise, t),
  bend: lerp(a.bend, b.bend, t),
});

const isSeated = (s: CharacterState) => s.seated || s.pose === "computer";

// ---------------------------------------------------------------------------

const Arm: React.FC<{
  side: -1 | 1;
  angles: ArmAngles;
  design: CharacterDesign;
  shoulderX: number;
  shoulderY: number;
  hand: "open" | "phone" | "point";
}> = ({ side, angles, design, shoulderX, shoulderY, hand }) => {
  const a1 = -side * angles.raise;
  const a2 = side * angles.bend;
  return (
    <g transform={`translate(${shoulderX},${shoulderY}) rotate(${a1})`}>
      <rect x={-20} y={-14} width={40} height={RIG.upperArm + 22} rx={20} fill={design.shirt} {...OUTLINE} />
      <g transform={`translate(0,${RIG.upperArm}) rotate(${a2})`}>
        <rect x={-18} y={-12} width={36} height={RIG.forearm + 12} rx={18} fill={design.shirt} {...OUTLINE} />
        <rect x={-18} y={RIG.forearm - 18} width={36} height={12} fill={design.shirtShade} />
        <g transform={`translate(0,${RIG.forearm + 12})`}>
          {hand === "point" ? (
            <rect x={-7} y={6} width={14} height={40} rx={7} fill={design.skin} {...OUTLINE} strokeWidth={3.5} />
          ) : null}
          <circle r={21} fill={design.skin} {...OUTLINE} />
          {hand === "phone" ? (
            // Counter-rotate so the phone stays upright whatever the arm does.
            <g transform={`rotate(${-(a1 + a2)}) translate(${-side * 4},-34)`}>
              <rect x={-25} y={-44} width={50} height={88} rx={9} fill="#111827" stroke="#0b0f19" strokeWidth={3} />
              <circle cx={-12} cy={-32} r={4.5} fill="#374151" />
              <rect x={-25} y={-44} width={50} height={88} rx={9} fill="none" stroke="#4b5563" strokeWidth={1.5} />
            </g>
          ) : null}
          {hand === "phone" ? (
            // thumb over the phone edge
            <g transform={`rotate(${-(a1 + a2)})`}>
              <ellipse cx={-side * 16} cy={-14} rx={8} ry={12} fill={design.skin} {...OUTLINE} strokeWidth={3} />
            </g>
          ) : null}
        </g>
      </g>
    </g>
  );
};

const Torso: React.FC<{ design: CharacterDesign; top: number }> = ({ design, top }) => {
  const cx = RIG.centerX;
  const S = 90 * design.bodyWidth;
  const W = 70 * design.bodyWidth;
  const bottom = top + (RIG.waistY - RIG.shoulderY) + 10;
  const y0 = top - 15;
  const d = `M${cx - S + 22},${y0} Q${cx},${y0 - 12} ${cx + S - 22},${y0}
    Q${cx + S + 6},${y0 + 4} ${cx + S},${y0 + 40}
    L${cx + W + 6},${bottom} Q${cx},${bottom + 10} ${cx - W - 6},${bottom}
    L${cx - S},${y0 + 40} Q${cx - S - 6},${y0 + 4} ${cx - S + 22},${y0} Z`;
  return (
    <g>
      <path d={d} fill={design.shirt} {...OUTLINE} />
      {/* side shading */}
      <path
        d={`M${cx + S - 6},${y0 + 46} L${cx + W},${bottom - 4} L${cx + W - 18},${bottom - 4} L${cx + S - 26},${y0 + 50} Z`}
        fill={design.shirtShade}
        opacity={0.7}
      />
      {/* collar */}
      <path d={`M${cx - 34},${y0 - 4} L${cx},${y0 + 34} L${cx - 6},${y0 + 4} Z`} fill={design.collar} {...OUTLINE} strokeWidth={3} />
      <path d={`M${cx + 34},${y0 - 4} L${cx},${y0 + 34} L${cx + 6},${y0 + 4} Z`} fill={design.collar} {...OUTLINE} strokeWidth={3} />
      {design.tie ? (
        <path
          d={`M${cx - 9},${y0 + 30} L${cx + 9},${y0 + 30} L${cx + 14},${y0 + 150} L${cx},${y0 + 170} L${cx - 14},${y0 + 150} Z`}
          fill={design.tie}
          {...OUTLINE}
          strokeWidth={3}
        />
      ) : null}
      {design.lanyard ? (
        <g>
          <path d={`M${cx - 30},${y0 + 2} L${cx - 4},${y0 + 110} M${cx + 30},${y0 + 2} L${cx + 4},${y0 + 110}`} stroke={design.lanyard} strokeWidth={6} />
          <rect x={cx - 22} y={y0 + 108} width={44} height={56} rx={6} fill="#ffffff" {...OUTLINE} strokeWidth={3} />
          <rect x={cx - 14} y={y0 + 118} width={28} height={18} rx={3} fill="#93c5fd" />
          <rect x={cx - 14} y={y0 + 142} width={28} height={5} rx={2} fill="#cbd5e1" />
          <rect x={cx - 14} y={y0 + 151} width={18} height={5} rx={2} fill="#cbd5e1" />
        </g>
      ) : null}
      {/* belt line */}
      <path d={`M${cx - W - 4},${bottom - 6} Q${cx},${bottom + 4} ${cx + W + 4},${bottom - 6}`} stroke={design.shirtShade} strokeWidth={5} fill="none" />
    </g>
  );
};

const LegsStanding: React.FC<{ design: CharacterDesign }> = ({ design }) => {
  const cx = RIG.centerX;
  const w = 58 * design.bodyWidth;
  return (
    <g>
      <rect x={cx - w - 2} y={RIG.waistY} width={w - 4} height={250} rx={18} fill={design.pants} {...OUTLINE} />
      <rect x={cx + 6} y={RIG.waistY} width={w - 4} height={250} rx={18} fill={design.pants} {...OUTLINE} />
      <ellipse cx={cx - w / 2 - 6} cy={RIG.groundY - 8} rx={38} ry={15} fill={design.shoes} {...OUTLINE} />
      <ellipse cx={cx + w / 2 + 6} cy={RIG.groundY - 8} rx={38} ry={15} fill={design.shoes} {...OUTLINE} />
    </g>
  );
};

const Chair: React.FC = () => {
  const cx = RIG.centerX;
  return (
    <g>
      <rect x={cx - 108} y={318} width={216} height={250} rx={34} fill="#374151" {...OUTLINE} />
      <rect x={cx - 90} y={336} width={180} height={200} rx={26} fill="#4b5563" />
      <rect x={cx - 9} y={668} width={18} height={70} fill="#6b7280" {...OUTLINE} strokeWidth={3} />
      <path d={`M${cx - 90},${752} L${cx + 90},${752}`} stroke="#4b5563" strokeWidth={12} strokeLinecap="round" />
      <circle cx={cx - 90} cy={762} r={11} fill="#1f2937" />
      <circle cx={cx + 90} cy={762} r={11} fill="#1f2937" />
      <circle cx={cx} cy={764} r={11} fill="#1f2937" />
    </g>
  );
};

const LegsSeated: React.FC<{ design: CharacterDesign }> = ({ design }) => {
  const cx = RIG.centerX;
  return (
    <g>
      <rect x={cx - 132} y={632} width={264} height={40} rx={16} fill="#1f2937" {...OUTLINE} />
      {/* thighs (foreshortened) + shins */}
      <rect x={cx - 66} y={612} width={60} height={70} rx={22} fill={design.pants} {...OUTLINE} />
      <rect x={cx + 6} y={612} width={60} height={70} rx={22} fill={design.pants} {...OUTLINE} />
      <rect x={cx - 62} y={662} width={50} height={102} rx={18} fill={design.pants} {...OUTLINE} />
      <rect x={cx + 12} y={662} width={50} height={102} rx={18} fill={design.pants} {...OUTLINE} />
      <ellipse cx={cx - 40} cy={RIG.groundY - 8} rx={36} ry={14} fill={design.shoes} {...OUTLINE} />
      <ellipse cx={cx + 40} cy={RIG.groundY - 8} rx={36} ry={14} fill={design.shoes} {...OUTLINE} />
    </g>
  );
};

const Laptop: React.FC<{ desk: boolean; glow: number }> = ({ desk, glow }) => {
  const cx = RIG.centerX;
  return (
    <g>
      {desk ? (
        <g>
          <rect x={-40} y={RIG.deskTopY} width={480} height={22} fill="#d6b48c" {...OUTLINE} />
          <rect x={-30} y={RIG.deskTopY + 22} width={460} height={110} fill="#b98d5f" {...OUTLINE} />
        </g>
      ) : null}
      <rect x={cx - 116} y={556} width={232} height={136} rx={12} fill="#cbd5e1" {...OUTLINE} />
      <rect x={cx - 104} y={566} width={208} height={116} rx={8} fill="#e2e8f0" />
      <circle cx={cx} cy={622} r={13} fill="#f8fafc" stroke="#94a3b8" strokeWidth={3} />
      {/* screen light spilling over the top edge */}
      <rect x={cx - 100} y={548} width={200} height={10} rx={5} fill="#bfdbfe" opacity={0.35 + glow * 0.4} />
      <rect x={cx - 128} y={RIG.deskTopY - 4} width={256} height={10} rx={4} fill="#94a3b8" {...OUTLINE} strokeWidth={3} />
    </g>
  );
};

// ---------------------------------------------------------------------------

export type CharacterProps = {
  design: CharacterDesign;
  state: CharacterState;
  /** State before the latest keyframe, for smooth pose blending. */
  previous?: CharacterState;
  /** Frame at which `state` became active (drives pops/blends). */
  changedAt?: number;
  /** Draw a desk under the laptop (character sheets). Scenes draw their own. */
  desk?: boolean;
  crop?: "full" | "head";
  /** Custom SVG viewBox in rig units (e.g. to leave room for a pointing arm). */
  viewBox?: string;
  style?: React.CSSProperties;
};

export const Character: React.FC<CharacterProps> = ({
  design,
  state,
  previous,
  changedAt = 0,
  desk = false,
  crop = "full",
  viewBox: viewBoxOverride,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const seed = hash01(design.id);
  const since = Math.max(0, frame - changedAt);
  const prev = previous ?? state;

  // Pose blend (8 frames).
  const poseT = smooth(since / 8);
  const armsNow = armsFor(state.pose, state.laptop);
  const armsPrev = armsFor(prev.pose, prev.laptop);
  const left = mixArm(armsPrev.left, armsNow.left, poseT);
  const right = mixArm(armsPrev.right, armsNow.right, poseT);
  if (state.pose === "computer") {
    left.bend += 7 * Math.sin(frame * 0.9 + seed * 6);
    right.bend += 7 * Math.sin(frame * 0.9 + seed * 6 + Math.PI);
  }

  // Gaze / lean blend (6 frames).
  const gazeT = smooth(since / 6);
  const lookX = lerp(prev.lookX, state.lookX, gazeT);
  const lookY = lerp(prev.lookY, state.lookY, gazeT);
  const lean = lerp(prev.lean, state.lean, smooth(since / 10));

  // Expression pop + surprise jump.
  const exprChanged = prev.expression !== state.expression;
  const pop = exprChanged
    ? spring({ frame: since, fps, config: { damping: 9, stiffness: 180 } })
    : 1;
  const headScale = 1 + (1 - pop) * 0.12;
  const jump =
    exprChanged && state.expression === "surprised"
      ? -34 * Math.sin(Math.PI * clamp01(since / 9))
      : 0;

  // Idle motion: breathing + head bob, phase-shifted per character.
  const t = frame / fps;
  const breath = Math.sin(t * Math.PI * 0.8 + seed * 10);
  const bob = breath * 2.5 + (state.talking ? Math.sin(frame * 0.55) * 2 : 0);
  const tilt =
    lookX * 5 +
    (state.expression === "embarrassed" ? 7 : 0) +
    (state.expression === "suspicious" ? -6 : 0) +
    Math.sin(t * 1.3 + seed * 4) * 1.2;

  // Deterministic blink schedule.
  const period = 84 + Math.floor(seed * 50);
  const phase = (frame + Math.floor(seed * 70)) % period;
  const blink = phase === 0 || phase === 3 ? 0.55 : phase === 1 || phase === 2 ? 1 : 0;

  const mouthOpen = state.talking
    ? clamp01(0.35 + 0.45 * Math.sin(frame * 1.05 + seed) + 0.25 * Math.sin(frame * 0.37))
    : 0;

  const seated = isSeated(state);
  const drop = seated ? RIG.sitDrop : 0;
  const shoulderY = RIG.shoulderY + drop + breath * 1.2;
  const shoulderOffset = 92 * design.bodyWidth;
  const headX = RIG.centerX + lookX * 5;
  const headY = RIG.headY + drop + bob;
  const sway = Math.sin(t * 2 + seed * 3) * 0.6 + lookX * 0.5;

  const rightHand = state.pose === "phone" ? "phone" : state.pose === "pointing" ? "point" : "open";

  const viewBox =
    viewBoxOverride ?? (crop === "head" ? "62 28 276 300" : `0 0 ${RIG.width} ${RIG.height}`);
  const overflow = crop === "head" ? "hidden" : "visible";
  const hipY = RIG.waistY + drop;
  const upper = `translate(0,${jump}) rotate(${lean} ${RIG.centerX} ${hipY})`;

  return (
    <svg viewBox={viewBox} overflow={overflow} style={{ overflow, ...style }}>
      <g
        transform={`translate(${RIG.centerX},${RIG.groundY}) scale(${design.scale}) translate(${-RIG.centerX},${-RIG.groundY})`}
      >
        {seated ? <Chair /> : null}
        {seated ? <LegsSeated design={design} /> : <LegsStanding design={design} />}
        {/* Upper body leans/jumps around the hips; legs, chair and laptop stay put. */}
        <g transform={upper}>
          {/* hair behind head */}
          <g transform={`translate(${headX},${headY}) rotate(${tilt}) scale(${headScale})`}>
            <HairBack design={design} sway={sway} />
          </g>

          <g transform={`translate(0,${drop + breath * 1.2})`}>
            <Torso design={design} top={RIG.shoulderY} />
          </g>
          {/* neck */}
          <rect x={RIG.centerX - 19} y={RIG.headY + drop + 78} width={38} height={46} rx={10} fill={design.skinShade} />

          {/* head */}
          <g transform={`translate(${headX},${headY}) rotate(${tilt}) scale(${headScale})`}>
            <ellipse cx={-90} cy={14} rx={15} ry={21} fill={design.skin} {...OUTLINE} />
            <ellipse cx={90} cy={14} rx={15} ry={21} fill={design.skin} {...OUTLINE} />
            <ellipse cx={0} cy={0} rx={92} ry={100} fill={design.skin} {...OUTLINE} />
            <Face
              design={design}
              expression={state.expression}
              blink={blink}
              lookX={lookX}
              lookY={lookY}
              mouthOpen={mouthOpen}
              pulse={(Math.sin(frame * 0.35) + 1) / 2}
            />
            <HairFront design={design} sway={sway} />
          </g>

          <Arm side={-1} angles={left} design={design} shoulderX={RIG.centerX - shoulderOffset} shoulderY={shoulderY} hand="open" />
          {/* Resting/typing hands go behind the laptop; phone/pointing hands in front. */}
          {rightHand === "open" ? (
            <Arm side={1} angles={right} design={design} shoulderX={RIG.centerX + shoulderOffset} shoulderY={shoulderY} hand="open" />
          ) : null}
        </g>
        {state.laptop && seated ? <Laptop desk={desk} glow={(Math.sin(t * 2) + 1) / 2} /> : null}
        {rightHand !== "open" ? (
          <g transform={upper}>
            <Arm side={1} angles={right} design={design} shoulderX={RIG.centerX + shoulderOffset} shoulderY={shoulderY} hand={rightHand} />
          </g>
        ) : null}
      </g>
    </svg>
  );
};
