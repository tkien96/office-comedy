import { Composition, Still } from "remotion";
import { VIDEO } from "./design/tokens";
import { demoNotification } from "./episodes/demo-notification";
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
      <Still id="CharacterSheet" component={CharacterSheet} width={SHEET.width} height={SHEET.height} />
      <Still id="BackgroundSheet" component={BackgroundSheet} width={BG_SHEET.width} height={BG_SHEET.height} />
    </>
  );
};
