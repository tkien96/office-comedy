// npm run tts:voices — searches the Voice Library for Vietnamese male voices.
// Free metadata call; no audio is generated. Writes cache/tts/voice-candidates.json.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { TTS_DIR } from "../cache.ts";
import { searchLibraryVoices, type LibraryVoice } from "../elevenlabs.ts";

const AVOID_CATEGORIES = new Set(["default", "premade", "famous"]);

const main = async () => {
  const all: LibraryVoice[] = [];
  for (let page = 0; page < 3; page++) {
    const res = await searchLibraryVoices({
      language: "vi",
      gender: "male",
      page_size: 100,
      sort: "usage_character_count_1y",
      page,
    });
    all.push(...res.voices);
    if (!res.has_more) break;
  }

  const candidates = all
    .filter((v) => !AVOID_CATEGORIES.has(v.category))
    .map((v) => ({
      voice_id: v.voice_id,
      public_owner_id: v.public_owner_id,
      name: v.name,
      category: v.category,
      age: v.age,
      accent: v.accent,
      locale: v.locale ?? null,
      descriptive: v.descriptive,
      use_case: v.use_case,
      rate_multiplier: v.rate ?? 1,
      fiat_rate_usd_per_1k_credits: v.fiat_rate ?? null,
      free_users_allowed: v.free_users_allowed,
      live_moderation: v.live_moderation_enabled,
      notice_period_days: v.notice_period ?? null,
      vi_models: (v.verified_languages ?? []).filter((l) => l.language === "vi").map((l) => l.model_id),
      usage_1y: v.usage_character_count_1y,
      preview_url: v.preview_url ?? null,
      description: (v.description ?? "").slice(0, 200),
    }));

  mkdirSync(TTS_DIR, { recursive: true });
  const file = join(TTS_DIR, "voice-candidates.json");
  writeFileSync(file, JSON.stringify(candidates, null, 2) + "\n");

  console.log(`Tìm thấy ${all.length} giọng nam tiếng Việt; ${candidates.length} giọng sau khi bỏ nhóm default/premade/famous.`);
  console.log(`Đã lưu: ${file}\n`);
  for (const c of candidates.slice(0, 25)) {
    console.log(
      `${c.name} [${c.voice_id}] ${c.age}/${c.accent}${c.locale ? `/${c.locale}` : ""} ${c.use_case} · ${c.descriptive}` +
        ` · hệ số giá x${c.rate_multiplier} · model vi: ${c.vi_models.join(",") || "chưa xác minh"}` +
        ` · báo trước ${c.notice_period_days ?? "?"} ngày`,
    );
  }
};

main().catch((err) => {
  console.error(`Lỗi: ${(err as Error).message}`);
  process.exit(1);
});
