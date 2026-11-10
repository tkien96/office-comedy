import { Composition } from "remotion";
import { TechCheck } from "./test/TechCheck";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="TechCheck"
        component={TechCheck}
        durationInFrames={150}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
