// npm run tts:vieneu:voices — lists the preset voices shipped in the INSTALLED
// vieneu package (official metadata: gender/region/style). Offline.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { TTS_DIR } from "../cache.ts";
import { listVieneuVoices } from "../vieneu.ts";

const region = process.argv[2] ?? "Nam";

const main = async () => {
  const r = await listVieneuVoices();
  mkdirSync(TTS_DIR, { recursive: true });
  const file = join(TTS_DIR, "vieneu-voices.json");
  writeFileSync(file, JSON.stringify({ fetchedAt: new Date().toISOString(), ...r }, null, 2) + "\n");
  const match = r.voices.filter((v) => v.region === region);
  console.log(`Metadata: ${r.source}`);
  console.log(`${r.count} giọng; ${match.length} giọng region="${region}". Đã lưu ${file}`);
  for (const v of match) {
    console.log(`${v.voice_id} · ${v.gender} · style=${v.style} · ${v.description}${v.aliases.length ? ` · alias ${v.aliases.join(", ")}` : ""}`);
  }
};

main().catch((err) => {
  console.error(`Lỗi: ${(err as Error).message}`);
  process.exit(1);
});
