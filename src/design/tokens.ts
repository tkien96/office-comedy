// Shared layout + style tokens for every episode (1080x1920 vertical).

export const VIDEO = {
  width: 1080,
  height: 1920,
  fps: 30,
} as const;

// Safe areas: keep text away from frame edges and from the UI overlays that
// short-video apps draw (bottom caption/buttons, top status bar).
export const SAFE = {
  side: 80,
  top: 160,
  bottom: 230,
} as const;

// Subtitles live in a fixed band at the bottom. Faces and key actions must
// stay above SUBTITLE_ZONE.top (checked by assertClearOfSubtitles).
const SUBTITLE_BAND_HEIGHT = 250;
export const SUBTITLE_ZONE = {
  top: VIDEO.height - SAFE.bottom - SUBTITLE_BAND_HEIGHT,
  bottom: VIDEO.height - SAFE.bottom,
  left: SAFE.side,
  right: VIDEO.width - SAFE.side,
} as const;

export const SUBTITLE_STYLE = {
  fontSize: 58,
  lineHeight: 1.28,
  fontWeight: "700",
  maxLines: 2,
  paddingX: 36,
  paddingY: 18,
} as const;

export const PALETTE = {
  ink: "#1f2937",
  outline: "#2b2118",
  white: "#ffffff",
  shadow: "rgba(15, 23, 42, 0.18)",
} as const;
