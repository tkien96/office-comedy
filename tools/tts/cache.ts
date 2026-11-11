import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Alignment, Boundary, TtsRequest } from "./types.ts";

// Content-addressed cache. The key covers everything that changes the audio:
// provider, model, voice, language, every voice setting, seed, output format
// and the exact text. Change any of them and you get a new entry.

export const TTS_DIR = join(process.cwd(), "cache", "tts");
const ENTRIES = join(TTS_DIR, "entries");

const stable = (v: unknown): unknown => {
  if (Array.isArray(v)) return v.map(stable);
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.keys(v as object)
        .sort()
        .map((k) => [k, stable((v as Record<string, unknown>)[k])]),
    );
  }
  return v;
};

export const cacheKey = (providerId: string, req: TtsRequest) =>
  createHash("sha256")
    .update(JSON.stringify(stable({ provider: providerId, ...req })))
    .digest("hex")
    .slice(0, 24);

export type CacheMeta = {
  key: string;
  provider: string;
  request: TtsRequest;
  audioFile: string;
  createdAt: string;
  /** Real duration measured with ffprobe. */
  durationSeconds: number | null;
  charsSent: number;
  /** Provider usage counter delta around the successful call (null = not measurable). */
  usageDelta: number | null;
  alignment: Alignment | null;
  normalizedAlignment: Alignment | null;
  boundaries: Boundary[] | null;
  /** Name of the SRT file next to the audio, if the provider made one. */
  srtFile: string | null;
};

export const entryDir = (key: string) => join(ENTRIES, key);

export const readCache = (key: string): CacheMeta | null => {
  const f = join(entryDir(key), "meta.json");
  return existsSync(f) ? (JSON.parse(readFileSync(f, "utf8")) as CacheMeta) : null;
};

export const writeCache = (meta: CacheMeta, audio: Buffer, srt: string | null = null) => {
  const dir = entryDir(meta.key);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, meta.audioFile), audio);
  if (srt !== null && meta.srtFile) writeFileSync(join(dir, meta.srtFile), srt, "utf8");
  writeFileSync(join(dir, "meta.json"), JSON.stringify(meta, null, 2) + "\n");
};
