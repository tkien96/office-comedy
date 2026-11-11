import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import {
  DeskMug,
  DeskPapers,
  MeetingRoomBackground,
  OfficeBackground,
  OfficeDeskRow,
  PantryBackground,
} from "../backgrounds/Backgrounds";
import { Character } from "../characters/Character";
import { CHARACTERS } from "../characters/designs";
import { DEFAULT_STATE, type CharacterState } from "../characters/types";
import type { CastMember, Overlay, SceneScript } from "../episodes/types";
import { lerp, resolveTrack, smooth } from "../lib/timeline";
import {
  assertClearOfSubtitles,
  BuzzMarks,
  NotificationCard,
  SafeAreaOverlay,
  ShockText,
} from "../ui/Overlays";
import { Subtitle } from "../ui/Subtitle";

const SPEAKER_COLORS: Record<string, string> = {
  kien: "#93c5fd",
  trinh: "#fdba74",
  sep: "#e2e8f0",
};

const Background: React.FC<{ id: SceneScript["background"] }> = ({ id }) => {
  switch (id) {
    case "office":
      return <OfficeBackground />;
    case "meeting":
      return <MeetingRoomBackground />;
    case "pantry":
      return <PantryBackground />;
  }
};

const CastMemberView: React.FC<{ member: CastMember }> = ({ member }) => {
  const frame = useCurrentFrame();
  const base: CharacterState = { ...DEFAULT_STATE, ...member.base };
  const track = resolveTrack(base, member.keys, frame);
  const design = CHARACTERS[member.character];
  return (
    <div
      style={{
        position: "absolute",
        left: member.x,
        top: member.y,
        width: 400 * member.scale,
        height: 800 * member.scale,
      }}
    >
      <Character
        design={design}
        state={track.current}
        previous={track.previous}
        changedAt={track.changedAt}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
};

const useCamera = (script: SceneScript) => {
  const frame = useCurrentFrame();
  const keys = script.camera;
  if (keys.length === 0) return { zoom: 1, fx: 540, fy: 960 };
  let i = 0;
  while (i < keys.length - 1 && keys[i + 1].at <= frame) i++;
  const a = keys[i];
  const b = keys[Math.min(i + 1, keys.length - 1)];
  const t = b.at === a.at ? 0 : smooth((frame - a.at) / (b.at - a.at));
  return {
    zoom: lerp(a.zoom, b.zoom, t),
    fx: lerp(a.focusX, b.focusX, t),
    fy: lerp(a.focusY, b.focusY, t),
  };
};

const useShake = (overlays: Overlay[]) => {
  const frame = useCurrentFrame();
  let x = 0;
  let y = 0;
  for (const o of overlays) {
    if (o.kind !== "shake" || frame < o.from || frame >= o.to) continue;
    const decay = 1 - (frame - o.from) / (o.to - o.from);
    // Deterministic shake from incommensurate sines (no randomness).
    x += Math.sin(frame * 2.3) * o.amplitude * decay;
    y += Math.cos(frame * 3.1) * o.amplitude * 0.6 * decay;
  }
  return { x, y };
};

const DeskPhone: React.FC<{ o: Extract<Overlay, { kind: "deskPhone" }> }> = ({ o }) => {
  const frame = useCurrentFrame();
  const buzzing = frame >= o.buzzFrom && frame < o.buzzTo;
  const dx = buzzing ? Math.sin(frame * 2.8) * 5 : 0;
  return (
    <>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <g transform={`translate(${o.x + dx},${o.y})`}>
          <rect x={-48} y={-20} width={96} height={20} rx={6} fill="#111827" stroke="#2b2118" strokeWidth={4} />
          {buzzing ? <rect x={-38} y={-17} width={76} height={6} rx={3} fill="#60a5fa" /> : null}
        </g>
      </svg>
      {buzzing ? <BuzzMarks x={o.x} y={o.y - 30} strength={0.5 + 0.5 * Math.abs(Math.sin(frame * 0.6))} /> : null}
    </>
  );
};

const NotificationView: React.FC<{ o: Extract<Overlay, { kind: "notification" }> }> = ({ o }) => {
  // Sequence-local frame -> absolute frame for the typewriter.
  const local = useCurrentFrame();
  const frame = local + o.from;
  let body = "";
  let revealed = 0;
  for (const p of o.parts) {
    if (frame < p.at) break;
    revealed = body.length + (frame - p.at) * o.charsPerFrame;
    body += p.text;
  }
  return (
    <NotificationCard
      sender={o.sender}
      body={body}
      revealed={Math.min(revealed, body.length)}
      x={o.x}
      y={o.y}
      width={o.width}
      tailX={o.tailX}
      tailY={o.tailY}
    />
  );
};

export const ScriptedScene: React.FC<{ script: SceneScript; debugSafeArea?: boolean }> = ({
  script,
  debugSafeArea = false,
}) => {
  assertClearOfSubtitles(
    script.cast.map((c) => ({
      id: c.character,
      x: c.x,
      y: c.y,
      scale: c.scale,
      seated: Boolean(c.base.seated || c.base.pose === "computer"),
    })),
  );
  const cam = useCamera(script);
  const shake = useShake(script.overlays);

  const world = `translate(${shake.x}px, ${shake.y}px) translate(${cam.fx}px, ${cam.fy}px) scale(${cam.zoom}) translate(${-cam.fx}px, ${-cam.fy}px)`;

  return (
    <AbsoluteFill style={{ backgroundColor: "#0f172a", overflow: "hidden" }}>
      {/* World layer: moves with the camera */}
      <AbsoluteFill style={{ transform: world, transformOrigin: "0 0" }}>
        <Background id={script.background} />
        {script.cast.map((m) => (
          <CastMemberView key={m.character} member={m} />
        ))}
        {script.deskTop !== null ? (
          <OfficeDeskRow top={script.deskTop}>
            {script.deskItems.map((d, i) =>
              d.kind === "mug" ? (
                <DeskMug key={i} x={d.x} y={script.deskTop as number} color={d.color} />
              ) : (
                <DeskPapers key={i} x={d.x} y={script.deskTop as number} />
              ),
            )}
          </OfficeDeskRow>
        ) : null}
        {script.overlays.map((o, i) =>
          o.kind === "deskPhone" ? (
            <Sequence key={i} from={o.from} durationInFrames={o.to - o.from} layout="none">
              <DeskPhone o={o} />
            </Sequence>
          ) : null,
        )}
      </AbsoluteFill>

      {/* Screen layer: UI that should not zoom */}
      {script.overlays.map((o, i) => {
        if (o.kind === "notification") {
          return (
            <Sequence key={i} from={o.from} durationInFrames={o.to - o.from} layout="none">
              <NotificationView o={o} />
            </Sequence>
          );
        }
        if (o.kind === "shock") {
          return (
            <Sequence key={i} from={o.from} durationInFrames={o.to - o.from} layout="none">
              <ShockText text={o.text} x={o.x} y={o.y} />
            </Sequence>
          );
        }
        return null;
      })}

      {script.subtitles.map((s, i) => (
        <Sequence key={i} from={s.from} durationInFrames={s.to - s.from} layout="none">
          <Subtitle
            text={s.text}
            speaker={s.speaker ? CHARACTERS[s.speaker].displayName : undefined}
            speakerColor={s.speaker ? SPEAKER_COLORS[s.speaker] : undefined}
          />
        </Sequence>
      ))}

      {debugSafeArea ? <SafeAreaOverlay /> : null}
    </AbsoluteFill>
  );
};
