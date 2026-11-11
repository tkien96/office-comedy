// npm run tts:audition -- [config] [--dry-run]
// 3 voices x 2 presets on the same text. Every safety check that is free
// (budget, model, voices, account credits) runs BEFORE the first paid call.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { entryDir } from "../cache.ts";
import { ElevenLabsProvider, getSubscription, getVoice, listModels } from "../elevenlabs.ts";
import { BudgetError, spentChars } from "../ledger.ts";
import { synthesize } from "../synthesize.ts";
import type { TtsRequest, VoiceSettings } from "../types.ts";

type AuditionConfig = {
  campaign: string;
  budgetChars: number;
  maxAttemptsPerItem: number;
  timeoutMs: number;
  modelId: string;
  languageCode: string;
  outputFormat: string;
  seed: number | null;
  text: string;
  voices: { label: string; voiceId: string; name: string; note: string }[];
  presets: { label: string; note: string; settings: VoiceSettings }[];
};

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const configPath = args.find((a) => !a.startsWith("--")) ?? "tools/tts/auditions/audition-01.json";
const cfg = JSON.parse(readFileSync(configPath, "utf8")) as AuditionConfig;

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

const fail = (msg: string): never => {
  console.error(`DỪNG (chưa gọi API trả phí): ${msg}`);
  process.exit(1);
};

const main = async () => {
  const chars = [...cfg.text].length;
  if (chars < 200 || chars > 250) fail(`Đoạn thử dài ${chars} ký tự, cần 200–250.`);
  if (cfg.voices.length !== 3 || cfg.presets.length !== 2) fail("Cần đúng 3 giọng và 2 thiết lập.");

  const items = cfg.voices.flatMap((v, vi) =>
    cfg.presets.map((p, pi) => ({
      voice: v,
      preset: p,
      label: `${String(vi * 2 + pi + 1).padStart(2, "0")}_${v.label}-${slug(v.name || "chua-chon")}_${p.label}`,
    })),
  );
  const planned = items.length * chars;
  const spent = spentChars(cfg.campaign);
  const worstCase = items.length * chars * cfg.maxAttemptsPerItem;

  console.log(`Chiến dịch: ${cfg.campaign} · model ${cfg.modelId} · ${chars} ký tự/bản · ${items.length} bản`);
  console.log(`Ngân sách: ${cfg.budgetChars} ký tự · đã dùng ${spent} · kế hoạch ${planned} · tệ nhất nếu mọi bản retry ${worstCase}`);
  for (const it of items) console.log(`  ${it.label}  ${JSON.stringify(it.preset.settings)}`);
  if (spent + planned > cfg.budgetChars) fail(`Kế hoạch ${planned} + đã dùng ${spent} vượt ngân sách ${cfg.budgetChars}.`);
  if (worstCase + spent > cfg.budgetChars) {
    console.log("Lưu ý: không đủ ngân sách để mọi bản đều retry; sổ ngân sách sẽ chặn trước request vượt mức.");
  }
  if (dryRun) {
    console.log("\n--dry-run: không gọi mạng.");
    return;
  }

  const missing = cfg.voices.filter((v) => !v.voiceId);
  if (missing.length) fail(`Chưa điền voiceId cho: ${missing.map((v) => v.label).join(", ")}.`);

  // Free checks: model, voices, account credits.
  const model = (await listModels()).find((m) => m.model_id === cfg.modelId);
  if (!model) fail(`Tài khoản không có model ${cfg.modelId}.`);
  if (!model!.languages?.some((l) => l.language_id === cfg.languageCode)) {
    fail(`Model ${cfg.modelId} không liệt kê ngôn ngữ "${cfg.languageCode}".`);
  }
  if ((model!.maximum_text_length_per_request ?? Infinity) < chars) fail("Đoạn thử dài hơn giới hạn của model.");
  const usesStyle = cfg.presets.some((p) => "style" in p.settings);
  if (usesStyle && !model!.can_use_style) fail(`Model ${cfg.modelId} không hỗ trợ "style".`);

  for (const v of cfg.voices) {
    try {
      await getVoice(v.voiceId);
    } catch (err) {
      fail(`Giọng ${v.label} (${v.voiceId}) chưa dùng được với tài khoản này: ${(err as Error).message}`);
    }
  }

  const sub = await getSubscription();
  const multiplier = model!.model_rates?.character_cost_multiplier ?? 1;
  const remaining = sub.character_limit - sub.character_count;
  console.log(`Tài khoản: gói ${sub.tier}, còn ${remaining} credits; hệ số model x${multiplier}.`);
  if (remaining < planned * multiplier) fail(`Credits còn lại (${remaining}) có thể không đủ cho ${planned} ký tự x${multiplier}.`);

  const provider = new ElevenLabsProvider();
  const outDir = join("out", "tts-audition", cfg.campaign);
  mkdirSync(outDir, { recursive: true });
  const summary: Record<string, unknown>[] = [];

  for (const it of items) {
    const req: TtsRequest = {
      text: cfg.text,
      voiceId: it.voice.voiceId,
      modelId: cfg.modelId,
      languageCode: cfg.languageCode,
      settings: it.preset.settings,
      seed: cfg.seed,
      outputFormat: cfg.outputFormat,
    };
    try {
      const { meta, fromCache } = await synthesize(provider, req, {
        campaign: cfg.campaign,
        budgetChars: cfg.budgetChars,
        label: it.label,
        maxAttempts: cfg.maxAttemptsPerItem,
        timeoutMs: cfg.timeoutMs,
      });
      const ext = meta.audioFile.split(".").pop();
      const dest = join(outDir, `${it.label}.${ext}`);
      copyFileSync(join(entryDir(meta.key), meta.audioFile), dest);
      const row = {
        file: dest,
        voice: `${it.voice.name} (${it.voice.voiceId})`,
        preset: it.preset.label,
        settings: it.preset.settings,
        durationSeconds: meta.durationSeconds,
        charsPerSecond: meta.durationSeconds ? +(chars / meta.durationSeconds).toFixed(1) : null,
        creditsMeasured: meta.usageDelta,
        fromCache,
        cacheKey: meta.key,
      };
      summary.push(row);
      console.log(`OK ${it.label}: ${meta.durationSeconds?.toFixed(2) ?? "?"} s · credits đo được ${meta.usageDelta ?? "?"}${fromCache ? " · từ cache" : ""}`);
    } catch (err) {
      const msg = (err as Error).message;
      summary.push({ label: it.label, error: msg });
      console.error(`LỖI ${it.label}: ${msg}`);
      if (err instanceof BudgetError) break;
    }
  }

  writeFileSync(join(outDir, "summary.json"), JSON.stringify({ config: configPath, text: cfg.text, chars, results: summary }, null, 2) + "\n");
  console.log(`\nĐã ghi ${join(outDir, "summary.json")}. Tổng đã gửi trong chiến dịch: ${spentChars(cfg.campaign)}/${cfg.budgetChars} ký tự.`);
};

main().catch((err) => {
  console.error(`Lỗi: ${(err as Error).message}`);
  process.exit(1);
});
