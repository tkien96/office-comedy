// npm run tts:edge:voices — fetches the live Edge voice list and filters a locale.
// Saves the full list to cache/tts/edge-voices.json (nothing is hard-coded).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { TTS_DIR } from "../cache.ts";
import { listEdgeVoices } from "../edge.ts";

const locale = process.argv[2] ?? "vi-VN";

const main = async () => {
  const { version, voices } = await listEdgeVoices();
  mkdirSync(TTS_DIR, { recursive: true });
  const file = join(TTS_DIR, "edge-voices.json");
  writeFileSync(
    file,
    JSON.stringify({ fetchedAt: new Date().toISOString(), edgeTtsVersion: version, voices }, null, 2) + "\n",
  );
  const matches = voices.filter((v) => v.Locale === locale);
  console.log(`edge-tts ${version}: ${voices.length} giọng, ${matches.length} giọng ${locale}. Đã lưu ${file}`);
  for (const v of matches) {
    console.log(
      `${v.ShortName} · ${v.Gender} · ${v.FriendlyName ?? ""} · ` +
        `${(v.VoiceTag?.VoicePersonalities ?? []).join(", ")}`,
    );
  }
};

main().catch((err) => {
  console.error(`Lỗi: ${(err as Error).message}`);
  process.exit(1);
});
