import { Composition, Still } from "remotion";
import { VIDEO } from "./design/tokens";
import ep001Script from "../episodes/EP001/script/script.json";
import ep001Timeline from "../episodes/EP001/script/timeline.json";
import { EpisodeVideo, type EpScript, type Timeline } from "./episode/EpisodeVideo";
import { demoNotification } from "./episodes/demo-notification";
import { ep001Staging } from "./episodes/ep001-staging";
import { ScriptedScene } from "./scenes/ScriptedScene";
import { BackgroundSheet, BG_SHEET } from "./sheets/BackgroundSheet";
import { CharacterSheet, SHEET } from "./sheets/CharacterSheet";
import { TechCheck } from "./test/TechCheck";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="TechCheck"
        component={TechCheck}
        durationInFrames={150}
        fps={VIDEO.fps}
        width={VIDEO.width}
        height={VIDEO.height}
      />
      <Composition
        id="DemoNotification"
        component={ScriptedScene}
        durationInFrames={demoNotification.durationInFrames}
        fps={VIDEO.fps}
        width={VIDEO.width}
        height={VIDEO.height}
        defaultProps={{ script: demoNotification, debugSafeArea: false }}
      />
      <Composition
        id="EP001"
        component={EpisodeVideo}
        // Length comes from the measured timeline: ceil(contentEndSec × fps).
        durationInFrames={ep001Timeline.durationInFrames}
        fps={ep001Timeline.fps}
        width={VIDEO.width}
        height={VIDEO.height}
        defaultProps={{
          script: ep001Script as EpScript,
          timeline: ep001Timeline as Timeline,
          staging: ep001Staging,
          audioSrc: "audio/episodes/EP001/dialogue.wav",
        }}
      />
      <Still id="CharacterSheet" component={CharacterSheet} width={SHEET.width} height={SHEET.height} />
      <Still id="BackgroundSheet" component={BackgroundSheet} width={BG_SHEET.width} height={BG_SHEET.height} />
    </>
  );
};
