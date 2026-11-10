import type { CharacterId, CharacterState } from "../characters/types";
import type { Keyframe } from "../lib/timeline";

// Pure data describing a scene. No React, no rendering logic here.

export type BackgroundId = "office" | "meeting" | "pantry";

export type CastMember = {
  character: CharacterId;
  /** Top-left of the 400x800 rig box, in px. */
  x: number;
  y: number;
  /** Px per rig unit (before the character's own design scale). */
  scale: number;
  base: Partial<CharacterState>;
  keys: Keyframe<CharacterState>[];
};

export type SubtitleCue = {
  from: number;
  to: number;
  text: string;
  /** Omit for the narrator. */
  speaker?: CharacterId;
};

export type CameraKey = {
  at: number;
  zoom: number;
  /** Focus point in px that stays fixed while zooming. */
  focusX: number;
  focusY: number;
};

export type Overlay =
  | {
      kind: "deskPhone";
      from: number;
      to: number;
      x: number;
      y: number;
      buzzFrom: number;
      buzzTo: number;
    }
  | {
      kind: "notification";
      from: number;
      to: number;
      sender: string;
      /** Text parts appended at given frames (typewriter). */
      parts: { at: number; text: string }[];
      charsPerFrame: number;
      x: number;
      y: number;
      width: number;
      tailX: number;
      tailY: number;
    }
  | { kind: "shock"; from: number; to: number; text: string; x: number; y: number }
  | { kind: "shake"; from: number; to: number; amplitude: number };

export type DeskItem =
  | { kind: "mug"; x: number; color: string }
  | { kind: "papers"; x: number };

export type SceneScript = {
  id: string;
  durationInFrames: number;
  background: BackgroundId;
  /** Desk surface y in px (office scenes), or null for no desk row. */
  deskTop: number | null;
  deskItems: DeskItem[];
  cast: CastMember[];
  camera: CameraKey[];
  overlays: Overlay[];
  subtitles: SubtitleCue[];
};
