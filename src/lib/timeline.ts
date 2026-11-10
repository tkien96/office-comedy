// Deterministic keyframe helpers. Everything is a pure function of the frame
// number: no Math.random(), no Date, so every render is identical.

export type Keyframe<T> = { at: number } & Partial<T>;

export type ResolvedTrack<T> = {
  /** Full state after applying all keys up to the current frame. */
  current: T;
  /** Full state before the most recent key (for blending). */
  previous: T;
  /** Frame at which the most recent key started. */
  changedAt: number;
};

/**
 * Folds partial keyframes into full states. A key only needs the fields that
 * change; everything else carries over from earlier keys / the base state.
 */
export const resolveTrack = <T extends object>(
  base: T,
  keys: Keyframe<T>[],
  frame: number,
): ResolvedTrack<T> => {
  const sorted = [...keys].sort((a, b) => a.at - b.at);
  let current: T = { ...base };
  let previous: T = { ...base };
  let changedAt = 0;
  for (const key of sorted) {
    if (key.at > frame) break;
    previous = current;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { at, ...rest } = key;
    current = { ...current, ...(rest as Partial<T>) };
    changedAt = key.at;
  }
  return { current, previous, changedAt };
};

/** Active item of a list of timed segments, or null. */
export const activeSegment = <S extends { from: number; to: number }>(
  segments: S[],
  frame: number,
): S | null => segments.find((s) => frame >= s.from && frame < s.to) ?? null;

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Smoothstep easing 0..1. */
export const smooth = (t: number) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};

/** Cheap deterministic hash -> [0,1) for per-character variation. */
export const hash01 = (seed: string) => {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
};
