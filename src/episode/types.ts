import type { CharacterId } from "../characters/types";

// Staging = how an approved script is put on screen (positions, cards,
// camera). Pure data; the renderer (EpisodeVideo) turns it into frames.

export type Location = "office" | "meeting" | "pantry";

export type CastPlacement = {
  character: CharacterId;
  /** Top-left of the 400x800 rig box (px) and px per rig unit. */
  x: number;
  y: number;
  scale: number;
  seated: boolean;
  laptop: boolean;
  /** Slide out of frame starting at this beat (e.g. a character leaves). */
  exit?: { atBeat: string; toX: number; frames: number };
};

export type CameraKey = { atBeat: string; zoom: number; focusX: number; focusY: number; rampFrames?: number };

export type Card =
  | { kind: "progress"; fromBeat: string; toBeat?: string; title: string; doneLabel: string }
  | { kind: "checklist"; fromBeat: string; toBeat?: string; title: string; items: string[] }
  | { kind: "calendar"; fromBeat: string; toBeat?: string; title: string; items: string[] }
  | { kind: "stamp"; fromBeat: string; toBeat?: string; text: string; color: string; x: number; y: number; fontSize?: number };

export type SceneStaging = {
  scene: string;
  location: Location;
  /** Office desk row surface (px), or null for no desk row. */
  deskTop: number | null;
  cast: CastPlacement[];
  camera?: CameraKey[];
  cards?: Card[];
  /** Office wall clock: hours advance from..to over the scene (montage). */
  clock?: { fromHour: number; toHour: number };
  /** Static clock time when no montage. */
  clockAt?: { hour: number; minute: number };
  /** Coffee mugs on the desk, appearing one by one over the scene. */
  mugs?: { xs: number[]; color: string };
  /** Visual cues for action beats (their script text is a description only). */
  cues?: Record<string, { expression?: Partial<Record<CharacterId, string>>; lean?: Partial<Record<CharacterId, number>> }>;
  /** Characters whose `pose` hints are ignored in this scene (e.g. stays at the laptop). */
  ignorePoses?: { character: CharacterId; pose: string }[];
};

export type EpisodeStaging = { episode: string; scenes: SceneStaging[] };
