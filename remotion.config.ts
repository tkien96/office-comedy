/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setDefaultPremountInSeconds(2);

// Output spec for every episode: MP4 H.264 (limited-range yuv420p) + AAC.
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setAudioCodec("aac");
// bt709 -> tagged limited-range yuv420p (default gives untagged full-range yuvj420p).
Config.setColorSpace("bt709");
// Always write an AAC track, even for silent drafts (no TTS yet).
Config.setEnforceAudioTrack(true);
