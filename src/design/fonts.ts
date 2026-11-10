import { loadFont } from "@remotion/google-fonts/BeVietnamPro";

// Be Vietnam Pro (SIL Open Font License 1.1) — designed for Vietnamese,
// full diacritic coverage. Loaded through @remotion/google-fonts, which blocks
// rendering until the font files are ready (needs internet on first render).
const font = loadFont("normal", {
  weights: ["400", "600", "700", "800"],
  subsets: ["vietnamese", "latin", "latin-ext"],
});

export const FONT_FAMILY = font.fontFamily;
export const waitForFont = font.waitUntilDone;
