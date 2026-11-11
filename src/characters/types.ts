export const EXPRESSIONS = [
  "neutral",
  "happy",
  "suspicious",
  "surprised",
  "annoyed",
  "embarrassed",
] as const;
export type Expression = (typeof EXPRESSIONS)[number];

export const POSES = ["standing", "computer", "phone", "pointing"] as const;
export type Pose = (typeof POSES)[number];

export type CharacterId = "kien" | "trinh" | "sep";

export type HairStyle = "kienShort" | "trinhLong" | "sepReceding";

/** Visual identity of a character. Same rig, different design. */
export type CharacterDesign = {
  id: CharacterId;
  displayName: string;
  skin: string;
  skinShade: string;
  hair: string;
  hairShade: string;
  hairStyle: HairStyle;
  shirt: string;
  shirtShade: string;
  collar: string;
  pants: string;
  shoes: string;
  /** Torso width multiplier (Sếp is broader). */
  bodyWidth: number;
  /** Overall scale multiplier (keeps proportions, changes height). */
  scale: number;
  glasses: boolean;
  tie: string | null;
  lanyard: string | null;
  hairClip: string | null;
};

/** Everything a scene can animate on a character. */
export type CharacterState = {
  pose: Pose;
  expression: Expression;
  /** Seated on an office chair (computer pose is always seated). */
  seated: boolean;
  /** Draw a laptop in front of the character (seated poses). */
  laptop: boolean;
  /** Gaze direction, -1..1 (x: screen left/right, y: up/down). */
  lookX: number;
  lookY: number;
  /** Mouth moves as if speaking. */
  talking: boolean;
  /** Whole-body lean in degrees (negative = toward screen left). */
  lean: number;
};

export const DEFAULT_STATE: CharacterState = {
  pose: "standing",
  expression: "neutral",
  seated: false,
  laptop: false,
  lookX: 0,
  lookY: 0,
  talking: false,
  lean: 0,
};
