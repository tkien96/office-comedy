import {
  AbsoluteFill,
  Easing,
  Html5Audio,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

// Technical check only: verifies 1080x1920 @ 30fps, Vietnamese text rendering,
// frame-driven animation and an AAC audio track. Not part of any episode.

const Title: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 12 } });
  return (
    <div
      style={{
        position: "absolute",
        top: 260,
        width: "100%",
        textAlign: "center",
        color: "#ffffff",
        fontFamily: "Segoe UI, Arial, sans-serif",
        fontWeight: 800,
        fontSize: 96,
        lineHeight: 1.2,
        transform: `scale(${pop})`,
      }}
    >
      Kiểm tra kỹ thuật
      <div style={{ fontSize: 52, fontWeight: 500, marginTop: 24 }}>
        Tiếng Việt: ăn ở, đường phố, nghỉ trưa
      </div>
    </div>
  );
};

const BouncingBox: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const x = interpolate(frame, [0, durationInFrames - 1], [140, 740], {
    easing: Easing.inOut(Easing.quad),
  });
  const y = 1100 - Math.abs(Math.sin((frame / fps) * Math.PI * 2)) * 260;
  const rotate = interpolate(frame, [0, durationInFrames - 1], [0, 360]);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 200,
        height: 200,
        borderRadius: 40,
        background: "#facc15",
        transform: `rotate(${rotate}deg)`,
      }}
    />
  );
};

const FrameCounter: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();
  return (
    <div
      style={{
        position: "absolute",
        bottom: 220,
        width: "100%",
        textAlign: "center",
        color: "#e2e8f0",
        fontFamily: "Consolas, monospace",
        fontSize: 48,
      }}
    >
      {width}x{height} · {fps}fps · khung {frame + 1}/{durationInFrames}
    </div>
  );
};

export const TechCheck: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#1e3a8a" }}>
      <Title />
      <BouncingBox />
      <FrameCounter />
      <Html5Audio src={staticFile("test/tone.wav")} volume={0.3} />
    </AbsoluteFill>
  );
};
