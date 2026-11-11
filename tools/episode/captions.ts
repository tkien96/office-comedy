import { existsSync, readFileSync } from "node:fs";
import type { EpisodePaths } from "./paths.ts";

// SRT captions built ONLY from the measured timeline (speech window of every
// line). The text is exactly the text that was synthesized; only line breaks
// are added. Deterministic: same timeline → byte-identical SRT.

export const CAPTION_RULES = {
  maxLineChars: 42, // common limit for mobile captions
  maxLines: 2,
  /** Short cues stay up at least this long, extended into the following silence only. */
  minDisplaySec: 0.8,
  /** Never closer than this to the next cue (2 frames @30 fps). */
  minGapSec: 2 / 30,
  maxCharsPerSec: 20,
} as const;

type TlItem = { id: string; kind: string; role?: string; text?: string; speechStartSec?: number; speechEndSec?: number; startSec: number; endSec: number };
export type Timeline = { contentEndSec: number; durationInFrames: number; fps: number; items: TlItem[] };

export type Cue = { index: number; id: string; role: string; start: number; end: number; speechStart: number; speechEnd: number; text: string; lines: string[]; extended: boolean };

const len = (s: string) => [...s].length;

/**
 * Vietnamese multi-syllable words must stay on one line. Syllables are space
 * separated, so the breaker needs a word list. Shared across episodes: add
 * words here when a review finds a bad break.
 */
export const NO_BREAK = new Set([
  "công cụ", "báo cáo", "tiết kiệm", "thời gian", "số liệu", "cụ thể", "cuối tuần", "kế toán", "nhân sự",
  "biên bản", "lịch họp", "trình bày", "không phải", "một cái", "một mình", "mỗi tuần", "ba tiếng", "sai lầm",
  "yên tâm", "cả phòng", "cách làm", "đồng nghiệp", "văn phòng", "phòng họp", "thứ hai", "chứng minh", "giải thích",
]);

/** Split into ≤2 lines: prefer a break after punctuation, then the space closest to the middle. */
export const breakLines = (text: string, max: number = CAPTION_RULES.maxLineChars): string[] => {
  if (len(text) <= max) return [text];
  const spaces = [...text.matchAll(/ /g)].map((m) => m.index!);
  const fits = spaces.filter((i) => len(text.slice(0, i)) <= max && len(text.slice(i + 1)) <= max);
  if (!fits.length) return [text]; // reported by QC as too long
  const mid = len(text) / 2;
  const splitsWord = (i: number) => {
    const a = text.slice(0, i).split(" ").pop()!.toLowerCase();
    const b = text.slice(i + 1).split(" ")[0].toLowerCase().replace(/[,.?!…:;]+$/, "");
    return NO_BREAK.has(`${a} ${b}`);
  };
  const score = (i: number) => Math.abs(i - mid) - (/[,.?!…:;]$/.test(text.slice(0, i)) ? 12 : 0) + (splitsWord(i) ? 100 : 0);
  const best = fits.sort((a, b) => score(a) - score(b))[0];
  return [text.slice(0, best), text.slice(best + 1)];
};

export const buildCues = (tl: Timeline): Cue[] => {
  const lines = tl.items.filter((i) => i.kind === "line");
  const videoEnd = tl.durationInFrames / tl.fps;
  const r3 = (n: number) => Math.round(n * 1000) / 1000;
  return lines.map((l, i) => {
    const start = l.speechStartSec!;
    const speechEnd = l.speechEndSec!;
    const nextStart = lines[i + 1]?.speechStartSec ?? videoEnd;
    let end = speechEnd;
    if (end - start < CAPTION_RULES.minDisplaySec) end = Math.min(start + CAPTION_RULES.minDisplaySec, nextStart - CAPTION_RULES.minGapSec, videoEnd);
    end = Math.max(end, speechEnd);
    return { index: i + 1, id: l.id, role: l.role!, start: r3(start), end: r3(end), speechStart: start, speechEnd, text: l.text!, lines: breakLines(l.text!), extended: end > speechEnd };
  });
};

export const srtTime = (t: number) => {
  const ms = Math.round(t * 1000);
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000), f = ms % 1000;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(f).padStart(3, "0")}`;
};

export const buildSrt = (tl: Timeline) => buildCues(tl).map((c) => `${c.index}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.lines.join("\n")}\n`).join("\n");

export const parseSrt = (srt: string) =>
  srt
    .replace(/\r\n/g, "\n")
    .trim()
    .split(/\n\n+/)
    .map((block) => {
      const [idx, time, ...text] = block.split("\n");
      const [a, b] = time.split(" --> ").map((t) => {
        const [h, m, rest] = t.split(":");
        const [s, ms] = rest.split(",");
        return +h * 3600 + +m * 60 + +s + +ms / 1000;
      });
      return { index: +idx, start: a, end: b, lines: text };
    });

export const readTimeline = (P: EpisodePaths) => JSON.parse(readFileSync(P.timeline, "utf8")) as Timeline;

export const captionsFreshness = (P: EpisodePaths) => {
  if (!existsSync(P.captions)) return "chưa có";
  if (!existsSync(P.timeline)) return "thiếu timeline";
  const now = readFileSync(P.captions, "utf8").replace(/\r\n/g, "\n");
  return now === buildSrt(readTimeline(P)) ? "khớp nguồn" : "LỆCH NGUỒN: chạy lại npm run episode:captions";
};
