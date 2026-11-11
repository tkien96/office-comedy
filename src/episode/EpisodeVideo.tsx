import React from "react";
import { AbsoluteFill, Html5Audio, Sequence, staticFile, useCurrentFrame } from "remotion";
import {
  DeskMug,
  MeetingRoomBackground,
  OfficeBackground,
  OfficeDeskRow,
  PantryBackground,
} from "../backgrounds/Backgrounds";
import { Character } from "../characters/Character";
import { CHARACTERS } from "../characters/designs";
import { DEFAULT_STATE, type CharacterId, type CharacterState, type Expression, type Pose } from "../characters/types";
import { lerp, resolveTrack, smooth, type Keyframe } from "../lib/timeline";
import { CalendarCard, ChecklistCard, ProgressCard, StampText } from "../ui/EpisodeCards";
import { assertClearOfSubtitles } from "../ui/Overlays";
import { Subtitle } from "../ui/Subtitle";
import type { Card, EpisodeStaging, SceneStaging } from "./types";

// Generic episode renderer: approved script (ep json) + measured timeline +
// staging data → frames. Duration comes from the timeline, never hard-coded.

export type EpBeat = {
  id: string;
  scene: string;
  kind: "line" | "action";
  role?: string;
  text?: string;
  expression?: Record<string, string>;
  pose?: Record<string, string>;
};
export type EpScript = { id: string; beats: EpBeat[] };
export type TimelineItem = {
  id: string;
  scene: string;
  kind: "line" | "action";
  role?: string;
  text?: string;
  startSec: number;
  endSec: number;
  speechStartSec?: number;
  speechEndSec?: number;
};
export type Timeline = { episode: string; fps: number; durationInFrames: number; contentEndSec: number; items: TimelineItem[] };

export type EpisodeVideoProps = {
  script: EpScript;
  timeline: Timeline;
  staging: EpisodeStaging;
  audioSrc: string;
};

const SPEAKER_COLORS: Record<string, string> = { kien: "#93c5fd", trinh: "#fdba74", sep: "#e2e8f0" };

type Times = { start: number; end: number; speechStart: number; speechEnd: number };

const buildTimes = (tl: Timeline) => {
  const f = (s: number) => Math.round(s * tl.fps);
  const map = new Map<string, Times>();
  for (const it of tl.items) {
    map.set(it.id, {
      start: f(it.startSec),
      end: f(it.endSec),
      speechStart: f(it.speechStartSec ?? it.startSec),
      speechEnd: f(it.speechEndSec ?? it.endSec),
    });
  }
  return map;
};

/** Scene frame ranges: contiguous, first from 0, last to the end of the video. */
const sceneRanges = (tl: Timeline, staging: EpisodeStaging, times: Map<string, Times>) => {
  const ranges: { scene: SceneStaging; from: number; to: number }[] = [];
  for (const sc of staging.scenes) {
    const items = tl.items.filter((i) => i.scene === sc.scene);
    if (items.length === 0) throw new Error(`Cảnh ${sc.scene} không có mục nào trong timeline.`);
    ranges.push({ scene: sc, from: times.get(items[0].id)!.start, to: times.get(items[items.length - 1].id)!.end });
  }
  for (let i = 0; i < ranges.length; i++) {
    ranges[i].from = i === 0 ? 0 : ranges[i - 1].to;
    if (i === ranges.length - 1) ranges[i].to = tl.durationInFrames;
  }
  return ranges;
};

const centerX = (c: SceneStaging["cast"][number]) => c.x + 200 * c.scale;

/** Character keyframes for one scene, derived from script beats + speech times. */
const castKeys = (sc: SceneStaging, from: number, script: EpScript, times: Map<string, Times>) => {
  const beats = script.beats.filter((b) => b.scene === sc.scene);
  const out = new Map<CharacterId, { base: CharacterState; keys: Keyframe<CharacterState>[] }>();
  for (const c of sc.cast) {
    const base: CharacterState = {
      ...DEFAULT_STATE,
      pose: c.seated && c.laptop ? "computer" : "standing",
      seated: c.seated,
      laptop: c.laptop,
      lookY: c.seated && c.laptop ? 0.35 : 0,
    };
    const keys: Keyframe<CharacterState>[] = [{ at: from }];
    const others = sc.cast.filter((o) => o.character !== c.character);
    const lookAt = (target: SceneStaging["cast"][number]) => Math.sign(centerX(target) - centerX(c)) * 0.9;
    for (const b of beats) {
      const t = times.get(b.id)!;
      const k: Keyframe<CharacterState> = { at: t.start };
      const expr = b.expression?.[c.character];
      if (expr) k.expression = expr as Expression;
      const pose = b.pose?.[c.character];
      const cue = sc.cues?.[b.id];
      const cueExpr = cue?.expression?.[c.character];
      if (cueExpr) k.expression = cueExpr as Expression;
      const cueLean = cue?.lean?.[c.character];
      if (cueLean !== undefined) k.lean = cueLean;
      const ignored = sc.ignorePoses?.some((p) => p.character === c.character && p.pose === pose);
      if (pose && !ignored) {
        if (pose === "standing") Object.assign(k, { pose: "standing" as Pose, seated: false, laptop: false });
        else k.pose = pose as Pose;
      }
      if (b.kind === "line" && b.role && b.role !== "narrator") {
        const speaker = sc.cast.find((o) => o.character === b.role);
        if (b.role === c.character) {
          // Speaker looks at the nearest other cast member.
          const near = [...others].sort((a, z) => Math.abs(centerX(a) - centerX(c)) - Math.abs(centerX(z) - centerX(c)))[0];
          keys.push({ at: t.speechStart, talking: true, ...(near ? { lookX: lookAt(near), lookY: 0 } : {}) });
          keys.push({ at: t.speechEnd, talking: false });
        } else if (speaker) {
          keys.push({ at: t.speechStart, lookX: lookAt(speaker), lookY: 0 });
        }
      }
      // A pose/expression hint ends at the next beat unless repeated (pose only).
      if (Object.keys(k).length > 1) keys.push(k);
    }
    // Reset transient poses (pointing/phone) at the end of the beat that set them.
    for (const b of beats) {
      const pose = b.pose?.[c.character];
      if (pose === "pointing") keys.push({ at: times.get(b.id)!.end, pose: base.pose });
    }
    keys.sort((a, z) => a.at - z.at);
    out.set(c.character, { base, keys });
  }
  return out;
};

const Background: React.FC<{ sc: SceneStaging; progress: number }> = ({ sc, progress }) => {
  if (sc.location === "meeting") return <MeetingRoomBackground />;
  if (sc.location === "pantry") return <PantryBackground steam={1} />;
  if (sc.clock) {
    const h = lerp(sc.clock.fromHour, sc.clock.toHour, progress);
    return <OfficeBackground clockHour={Math.floor(h) % 12} clockMinute={(h % 1) * 60} />;
  }
  return <OfficeBackground clockHour={sc.clockAt?.hour ?? 4} clockMinute={sc.clockAt?.minute ?? 50} />;
};

const SceneView: React.FC<{
  sc: SceneStaging;
  from: number;
  to: number;
  script: EpScript;
  times: Map<string, Times>;
}> = ({ sc, from, to, script, times }) => {
  const frame = useCurrentFrame();
  const keys = React.useMemo(() => castKeys(sc, from, script, times), [sc, from, script, times]);
  const progress = (frame - from) / Math.max(1, to - from);

  // Camera (world layer only; cards/subtitles stay put).
  const cam = (sc.camera ?? []).map((c) => ({ ...c, at: times.get(c.atBeat)!.start }));
  let zoom = 1;
  let fx = 540;
  let fy = 960;
  for (const c of cam) {
    if (frame < c.at) break;
    const t = smooth((frame - c.at) / Math.max(1, c.rampFrames ?? 12));
    zoom = lerp(zoom, c.zoom, t);
    fx = lerp(fx, c.focusX, t);
    fy = lerp(fy, c.focusY, t);
  }
  const world = `translate(${fx}px, ${fy}px) scale(${zoom}) translate(${-fx}px, ${-fy}px)`;

  const visibleMugs = sc.mugs ? Math.min(sc.mugs.xs.length, Math.floor(progress * (sc.mugs.xs.length + 1))) : 0;

  return (
    <AbsoluteFill style={{ transform: world, transformOrigin: "0 0" }}>
      <Background sc={sc} progress={progress} />
      {sc.cast.map((c) => {
        const k = keys.get(c.character)!;
        const tr = resolveTrack(k.base, k.keys, frame);
        let x = c.x;
        if (c.exit) {
          const at = times.get(c.exit.atBeat)!.start;
          x = lerp(c.x, c.exit.toX, smooth((frame - at) / c.exit.frames));
        }
        return (
          <div key={c.character} style={{ position: "absolute", left: x, top: c.y, width: 400 * c.scale, height: 800 * c.scale }}>
            <Character design={CHARACTERS[c.character]} state={tr.current} previous={tr.previous} changedAt={tr.changedAt} style={{ width: "100%", height: "100%" }} />
          </div>
        );
      })}
      {sc.deskTop !== null ? (
        <OfficeDeskRow top={sc.deskTop}>
          {sc.mugs?.xs.slice(0, visibleMugs).map((mx) => <DeskMug key={mx} x={mx} y={sc.deskTop as number} color={sc.mugs!.color} />)}
        </OfficeDeskRow>
      ) : null}
    </AbsoluteFill>
  );
};

const CardView: React.FC<{ card: Card }> = ({ card }) => {
  switch (card.kind) {
    case "progress":
      return <ProgressCard title={card.title} doneLabel={card.doneLabel} />;
    case "checklist":
      return <ChecklistCard title={card.title} items={card.items} />;
    case "calendar":
      return <CalendarCard title={card.title} items={card.items} />;
    case "stamp":
      return <StampText text={card.text} color={card.color} x={card.x} y={card.y} fontSize={card.fontSize} />;
  }
};

export const EpisodeVideo: React.FC<EpisodeVideoProps> = ({ script, timeline, staging, audioSrc }) => {
  const times = React.useMemo(() => buildTimes(timeline), [timeline]);
  const ranges = React.useMemo(() => sceneRanges(timeline, staging, times), [timeline, staging, times]);
  React.useMemo(() => {
    for (const r of ranges) {
      assertClearOfSubtitles(r.scene.cast.map((c) => ({ id: `${r.scene.scene}/${c.character}`, x: c.x, y: c.y, scale: c.scale, seated: c.seated })));
    }
  }, [ranges]);
  const sceneEnd = (scene: string) => ranges.find((r) => r.scene.scene === scene)!.to;

  return (
    <AbsoluteFill style={{ backgroundColor: "#0f172a", overflow: "hidden" }}>
      {ranges.map((r) => (
        <Sequence key={r.scene.scene} from={r.from} durationInFrames={r.to - r.from} layout="none">
          <AbsoluteFill style={{ overflow: "hidden" }}>
            <SceneFrame r={r} script={script} times={times} />
          </AbsoluteFill>
        </Sequence>
      ))}

      {ranges.flatMap((r) =>
        (r.scene.cards ?? []).map((card, i) => {
          const a = times.get(card.fromBeat)!.start;
          const b = card.toBeat ? times.get(card.toBeat)!.end : times.get(card.fromBeat)!.end;
          const end = Math.min(card.kind === "stamp" ? sceneEnd(r.scene.scene) : b, sceneEnd(r.scene.scene));
          return (
            <Sequence key={`${r.scene.scene}-card-${i}`} from={a} durationInFrames={Math.max(1, end - a)} layout="none">
              <CardView card={card} />
            </Sequence>
          );
        }),
      )}

      {timeline.items
        .filter((i) => i.kind === "line")
        .map((i) => {
          const t = times.get(i.id)!;
          const speaker = i.role && i.role !== "narrator" ? i.role : undefined;
          return (
            <Sequence key={`sub-${i.id}`} from={t.speechStart} durationInFrames={Math.max(1, t.speechEnd - t.speechStart)} layout="none">
              <Subtitle
                text={i.text!}
                speaker={speaker ? CHARACTERS[speaker as CharacterId].displayName : undefined}
                speakerColor={speaker ? SPEAKER_COLORS[speaker] : undefined}
              />
            </Sequence>
          );
        })}

      <Html5Audio src={staticFile(audioSrc)} />
    </AbsoluteFill>
  );
};

// SceneView uses absolute frames for keyframes; inside a Sequence the frame is
// local, so re-base it here.
const SceneFrame: React.FC<{ r: { scene: SceneStaging; from: number; to: number }; script: EpScript; times: Map<string, Times> }> = ({ r, script, times }) => {
  return (
    <Sequence from={-r.from} layout="none">
      <SceneView sc={r.scene} from={r.from} to={r.to} script={script} times={times} />
    </Sequence>
  );
};
