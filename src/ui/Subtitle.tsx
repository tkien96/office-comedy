import { measureText } from "@remotion/layout-utils";
import React, { useEffect, useState } from "react";
import {
  cancelRender,
  continueRender,
  delayRender,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { FONT_FAMILY, waitForFont } from "../design/fonts";
import { SUBTITLE_STYLE, SUBTITLE_ZONE } from "../design/tokens";

const MAX_TEXT_WIDTH =
  SUBTITLE_ZONE.right - SUBTITLE_ZONE.left - SUBTITLE_STYLE.paddingX * 2;

/** Greedy word wrap using the real font metrics. */
export const wrapSubtitle = (text: string): string[] => {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    const { width } = measureText({
      text: candidate,
      fontFamily: FONT_FAMILY,
      fontSize: SUBTITLE_STYLE.fontSize,
      fontWeight: SUBTITLE_STYLE.fontWeight,
    });
    if (width > MAX_TEXT_WIDTH && line) {
      lines.push(line);
      line = w;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
};

const useFontReady = () => {
  const [ready, setReady] = useState(false);
  const [handle] = useState(() => delayRender("Waiting for subtitle font"));
  useEffect(() => {
    waitForFont()
      .then(() => setReady(true))
      // Fail loudly instead of silently measuring a fallback font.
      .catch((err) => cancelRender(err));
  }, []);
  // Release the frame only after the subtitle has actually been rendered.
  useEffect(() => {
    if (ready) continueRender(handle);
  }, [ready, handle]);
  return ready;
};

/**
 * Subtitle in the fixed bottom band. Throws if the text needs more than
 * SUBTITLE_STYLE.maxLines lines, so overlong captions fail the render
 * instead of shipping broken.
 */
export const Subtitle: React.FC<{
  text: string;
  speaker?: string;
  speakerColor?: string;
}> = ({ text, speaker, speakerColor = "#facc15" }) => {
  const frame = useCurrentFrame();
  const ready = useFontReady();
  if (!ready) return null;

  const lines = wrapSubtitle(text);
  if (lines.length > SUBTITLE_STYLE.maxLines) {
    throw new Error(
      `Subtitle needs ${lines.length} lines (max ${SUBTITLE_STYLE.maxLines}): "${text}"`,
    );
  }

  const enter = interpolate(frame, [0, 6], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        left: SUBTITLE_ZONE.left,
        top: SUBTITLE_ZONE.top,
        width: SUBTITLE_ZONE.right - SUBTITLE_ZONE.left,
        height: SUBTITLE_ZONE.bottom - SUBTITLE_ZONE.top,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-end",
        opacity: enter,
        transform: `translateY(${(1 - enter) * 16}px)`,
      }}
    >
      {speaker ? (
        <div
          style={{
            fontFamily: FONT_FAMILY,
            fontWeight: 800,
            fontSize: 36,
            color: "#111827",
            background: speakerColor,
            borderRadius: 999,
            padding: "4px 22px",
            marginBottom: 10,
          }}
        >
          {speaker}
        </div>
      ) : null}
      <div
        style={{
          fontFamily: FONT_FAMILY,
          fontWeight: SUBTITLE_STYLE.fontWeight,
          fontSize: SUBTITLE_STYLE.fontSize,
          lineHeight: SUBTITLE_STYLE.lineHeight,
          color: "#ffffff",
          textAlign: "center",
          background: "rgba(15, 23, 42, 0.72)",
          borderRadius: 26,
          padding: `${SUBTITLE_STYLE.paddingY}px ${SUBTITLE_STYLE.paddingX}px`,
          maxWidth: SUBTITLE_ZONE.right - SUBTITLE_ZONE.left,
          whiteSpace: "nowrap",
        }}
      >
        {lines.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>
    </div>
  );
};
