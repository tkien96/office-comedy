import { Composition, Still } from "remotion";
import { VIDEO } from "./design/tokens";
import ep001Script from "../episodes/EP001/script/script.json";
import ep001Timeline from "../episodes/EP001/script/timeline.json";
import ep002Script from "../episodes/EP002/script/script.json";
import ep002Timeline from "../episodes/EP002/script/timeline.json";
import ep003Script from "../episodes/EP003/script/script.json";
import ep003Timeline from "../episodes/EP003/script/timeline.json";
import ep004Script from "../episodes/EP004/script/script.json";
import ep004Timeline from "../episodes/EP004/script/timeline.json";
import ep005Script from "../episodes/EP005/script/script.json";
import ep005Timeline from "../episodes/EP005/script/timeline.json";
import { EpisodeVideo, type EpScript, type Timeline } from "./episode/EpisodeVideo";
import { demoNotification } from "./episodes/demo-notification";
import { ep001Staging } from "./episodes/ep001-staging";
import { ep001Teaser1x1, ep001Thumb9x16 } from "./episodes/ep001-thumbnails";
import { ep002Staging } from "./episodes/ep002-staging";
import { ep002Teaser1x1, ep002Thumb9x16 } from "./episodes/ep002-thumbnails";
import { ep003Staging } from "./episodes/ep003-staging";
import { ep003Teaser1x1, ep003Thumb9x16 } from "./episodes/ep003-thumbnails";
import { ep004Staging } from "./episodes/ep004-staging";
import { ep004Teaser1x1, ep004Thumb9x16 } from "./episodes/ep004-thumbnails";
import { ep005Staging } from "./episodes/ep005-staging";
import { ep005Teaser1x1, ep005Thumb9x16 } from "./episodes/ep005-thumbnails";
import { EpisodeThumbnail } from "./thumbnails/EpisodeThumbnail";
import { PlaylistCover } from "./thumbnails/PlaylistCover";
import { playlistCover1x1, playlistCover16x9 } from "./episodes/playlist-cover";
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
      {/* EP001 thumbnail (9:16) and teaser (1:1): npm run episode:thumbnails -- EP001 */}
      <Still id="EP001-thumb-9x16" component={EpisodeThumbnail} width={ep001Thumb9x16.width} height={ep001Thumb9x16.height} defaultProps={{ spec: ep001Thumb9x16 }} />
      <Still id="EP001-teaser-1x1" component={EpisodeThumbnail} width={ep001Teaser1x1.width} height={ep001Teaser1x1.height} defaultProps={{ spec: ep001Teaser1x1 }} />
      <Composition
        id="EP002"
        component={EpisodeVideo}
        // Length comes from the measured timeline: ceil(contentEndSec × fps).
        durationInFrames={ep002Timeline.durationInFrames}
        fps={ep002Timeline.fps}
        width={VIDEO.width}
        height={VIDEO.height}
        defaultProps={{
          script: ep002Script as EpScript,
          timeline: ep002Timeline as Timeline,
          staging: ep002Staging,
          audioSrc: "audio/episodes/EP002/dialogue.wav",
        }}
      />
      {/* EP002 thumbnail (9:16) and teaser (1:1): npm run episode:thumbnails -- EP002 */}
      <Still id="EP002-thumb-9x16" component={EpisodeThumbnail} width={ep002Thumb9x16.width} height={ep002Thumb9x16.height} defaultProps={{ spec: ep002Thumb9x16 }} />
      <Still id="EP002-teaser-1x1" component={EpisodeThumbnail} width={ep002Teaser1x1.width} height={ep002Teaser1x1.height} defaultProps={{ spec: ep002Teaser1x1 }} />
      <Composition
        id="EP003"
        component={EpisodeVideo}
        // Length comes from the measured timeline: ceil(contentEndSec × fps).
        durationInFrames={ep003Timeline.durationInFrames}
        fps={ep003Timeline.fps}
        width={VIDEO.width}
        height={VIDEO.height}
        defaultProps={{
          script: ep003Script as EpScript,
          timeline: ep003Timeline as Timeline,
          staging: ep003Staging,
          audioSrc: "audio/episodes/EP003/dialogue.wav",
        }}
      />
      {/* EP003 thumbnail (9:16) and teaser (1:1): npm run episode:thumbnails -- EP003 */}
      <Still id="EP003-thumb-9x16" component={EpisodeThumbnail} width={ep003Thumb9x16.width} height={ep003Thumb9x16.height} defaultProps={{ spec: ep003Thumb9x16 }} />
      <Still id="EP003-teaser-1x1" component={EpisodeThumbnail} width={ep003Teaser1x1.width} height={ep003Teaser1x1.height} defaultProps={{ spec: ep003Teaser1x1 }} />
      <Composition
        id="EP004"
        component={EpisodeVideo}
        // Length comes from the measured timeline: ceil(contentEndSec × fps).
        durationInFrames={ep004Timeline.durationInFrames}
        fps={ep004Timeline.fps}
        width={VIDEO.width}
        height={VIDEO.height}
        defaultProps={{
          script: ep004Script as EpScript,
          timeline: ep004Timeline as Timeline,
          staging: ep004Staging,
          audioSrc: "audio/episodes/EP004/dialogue.wav",
        }}
      />
      {/* EP004 thumbnail (9:16) and teaser (1:1): npm run episode:thumbnails -- EP004 */}
      <Still id="EP004-thumb-9x16" component={EpisodeThumbnail} width={ep004Thumb9x16.width} height={ep004Thumb9x16.height} defaultProps={{ spec: ep004Thumb9x16 }} />
      <Still id="EP004-teaser-1x1" component={EpisodeThumbnail} width={ep004Teaser1x1.width} height={ep004Teaser1x1.height} defaultProps={{ spec: ep004Teaser1x1 }} />
      <Composition
        id="EP005"
        component={EpisodeVideo}
        // Length comes from the measured timeline: ceil(contentEndSec × fps).
        durationInFrames={ep005Timeline.durationInFrames}
        fps={ep005Timeline.fps}
        width={VIDEO.width}
        height={VIDEO.height}
        defaultProps={{
          script: ep005Script as EpScript,
          timeline: ep005Timeline as Timeline,
          staging: ep005Staging,
          audioSrc: "audio/episodes/EP005/dialogue.wav",
        }}
      />
      {/* EP005 thumbnail (9:16) and teaser (1:1): npm run episode:thumbnails -- EP005 */}
      <Still id="EP005-thumb-9x16" component={EpisodeThumbnail} width={ep005Thumb9x16.width} height={ep005Thumb9x16.height} defaultProps={{ spec: ep005Thumb9x16 }} />
      <Still id="EP005-teaser-1x1" component={EpisodeThumbnail} width={ep005Teaser1x1.width} height={ep005Teaser1x1.height} defaultProps={{ spec: ep005Teaser1x1 }} />
      {/* Playlist / series cover (16:9): npx remotion still Playlist-cover-16x9 out/playlist/office-comedy-cover-16x9.png */}
      <Still id="Playlist-cover-16x9" component={PlaylistCover} width={playlistCover16x9.width} height={playlistCover16x9.height} defaultProps={{ spec: playlistCover16x9 }} />
      <Still id="Playlist-cover-1x1" component={PlaylistCover} width={playlistCover1x1.width} height={playlistCover1x1.height} defaultProps={{ spec: playlistCover1x1 }} />
      <Still id="CharacterSheet" component={CharacterSheet} width={SHEET.width} height={SHEET.height} />
      <Still id="BackgroundSheet" component={BackgroundSheet} width={BG_SHEET.width} height={BG_SHEET.height} />
    </>
  );
};
