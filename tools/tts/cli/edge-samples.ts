// npm run tts:edge:samples -- [config] [--dry-run]
// One sample per voice of the configured locale, voices taken from the LIVE
// voice list (never hard-coded). Same text and settings for every voice.
// Edge TTS is free; the ledger still caps how much we send per campaign.
// On failure this script stops. It never falls back to a paid provider.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { entryDir } from "../cache.ts";
import { EdgeTtsProvider, listEdgeVoices } from "../edge.ts";
import { BudgetError, spentChars } from "../ledger.ts";
import { synthesize } from "../synthesize.ts";
import type { VoiceSettings } from "../types.ts";

type Config = {
  campaign: string;
  locale: string;
  budgetChars: number;
  maxAttemptsPerItem: number;
  timeoutMs: number;
  text: string;
  settings: VoiceSettings;
};

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const configPath = args.find((a) => !a.startsWith("--")) ?? "tools/tts/auditions/edge-samples-01.json";
const cfg = JSON.parse(readFileSync(configPath, "utf8")) as Config;

const srtCues = (srt: string) => srt.split(/\r?\n\r?\n/).filter((b) => b.includes("-->")).length;

const main = async () => {
  const chars = [...cfg.text].length;
  if (chars < 200 || chars > 250) throw new Error(`Đoạn thử dài ${chars} ký tự, cần 200–250.`);

  const { version, voices } = await listEdgeVoices();
  const picked = voices.filter((v) => v.Locale === cfg.locale);
  if (picked.length === 0) throw new Error(`Danh sách giọng hiện tại không có locale ${cfg.locale}.`);

  const planned = picked.length * chars;
  const spent = spentChars(cfg.campaign);
  console.log(`edge-tts ${version} · ${picked.length} giọng ${cfg.locale}: ${picked.map((v) => v.ShortName).join(", ")}`);
  console.log(`Đoạn thử ${chars} ký tự · kế hoạch ${planned} · đã dùng ${spent}/${cfg.budgetChars} · thiết lập ${JSON.stringify(cfg.settings)}`);
  if (spent + planned > cfg.budgetChars) throw new Error("Kế hoạch vượt giới hạn ký tự của chiến dịch.");
  if (dryRun) return console.log("--dry-run: không tạo âm thanh.");

  const provider = new EdgeTtsProvider();
  const outDir = join("out", "tts-edge", cfg.campaign);
  mkdirSync(outDir, { recursive: true });
  const results: Record<string, unknown>[] = [];

  for (const [i, v] of picked.entries()) {
    const label = `${String(i + 1).padStart(2, "0")}_${v.ShortName}`;
    try {
      const { meta, fromCache } = await synthesize(
        provider,
        {
          text: cfg.text,
          voiceId: v.ShortName,
          modelId: `edge-tts@${version}`,
          languageCode: cfg.locale,
          settings: cfg.settings,
          seed: null,
          outputFormat: "audio-24khz-48kbitrate-mono-mp3",
        },
        {
          campaign: cfg.campaign,
          budgetChars: cfg.budgetChars,
          label,
          maxAttempts: cfg.maxAttemptsPerItem,
          timeoutMs: cfg.timeoutMs,
        },
      );
      const mp3 = join(outDir, `${label}.mp3`);
      copyFileSync(join(entryDir(meta.key), meta.audioFile), mp3);
      let srt: string | null = null;
      let cues = 0;
      if (meta.srtFile) {
        srt = join(outDir, `${label}.srt`);
        copyFileSync(join(entryDir(meta.key), meta.srtFile), srt);
        cues = srtCues(readFileSync(srt, "utf8"));
      }
      const lastEnd = meta.boundaries?.at(-1)?.end ?? null;
      const row = {
        voice: v.ShortName,
        gender: v.Gender,
        mp3,
        srt,
        srtCues: cues,
        durationSeconds: meta.durationSeconds,
        lastSpeechEndSeconds: lastEnd,
        charsPerSecond: meta.durationSeconds ? +(chars / meta.durationSeconds).toFixed(1) : null,
        fromCache,
        cacheKey: meta.key,
      };
      results.push(row);
      console.log(
        `OK ${label}: ${meta.durationSeconds?.toFixed(2) ?? "?"} s (lời kết thúc ${lastEnd?.toFixed(2) ?? "?"} s) · ${cues} cue SRT${fromCache ? " · từ cache" : ""}`,
      );
    } catch (err) {
      results.push({ voice: v.ShortName, error: (err as Error).message });
      console.error(`LỖI ${label}: ${(err as Error).message}`);
      if (err instanceof BudgetError) break;
    }
  }

  writeFileSync(
    join(outDir, "summary.json"),
    JSON.stringify({ edgeTtsVersion: version, text: cfg.text, chars, settings: cfg.settings, results }, null, 2) + "\n",
  );
  console.log(`\nĐã ghi ${join(outDir, "summary.json")}`);
  if (results.some((r) => "error" in r)) process.exit(1);
};

main().catch((err) => {
  console.error(`Lỗi: ${(err as Error).message}`);
  process.exit(1);
});
