// npm run tts:vieneu:samples -- [--dry-run]
// Audition samples from config/casting.json: every candidate of a role reads
// the SAME text with the SAME settings. Plain reading (no emotion tags).
// Validates every candidate against the installed metadata (region/gender)
// before generating. Local only: never calls a paid service.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { entryDir } from "../cache.ts";
import { qcAudio, QC_LIMITS } from "../qc.ts";
import { synthesize } from "../synthesize.ts";
import type { VoiceSettings } from "../types.ts";
import { listVieneuVoices, VieneuProvider } from "../vieneu.ts";

type Role = {
  displayName: string;
  direction: string;
  candidatesFrom?: string;
  candidates?: { voiceId: string; status: string }[];
  sampleText: string;
};
type Casting = { roles: Record<string, Role> };

const CAMPAIGN = "vieneu-samples-01";
/** Recommended defaults from the VieNeu docs/source (temperature ~0.8 for v3 Turbo). */
const SETTINGS: VoiceSettings = {
  temperature: 0.8,
  top_k: 25,
  top_p: 0.95,
  repetition_penalty: 1.2,
  max_chars: 256,
  silence_p: 0.15,
  crossfade_p: 0.0,
  apply_watermark: false,
};
const EXPECTED_GENDER: Record<string, string> = { narrator: "male", kien: "male", trinh: "female", sep: "male" };

const dryRun = process.argv.includes("--dry-run");
const casting = JSON.parse(readFileSync("config/casting.json", "utf8")) as Casting;

const slug = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();

const main = async () => {
  const meta = await listVieneuVoices();
  const byId = new Map(meta.voices.map((v) => [v.voice_id, v]));

  const jobs: { role: string; voiceId: string; text: string }[] = [];
  for (const [roleId, role] of Object.entries(casting.roles)) {
    const cands = role.candidatesFrom ? casting.roles[role.candidatesFrom].candidates ?? [] : role.candidates ?? [];
    if (cands.length === 0 || cands.length > 2) throw new Error(`Vai ${roleId}: cần 1–2 ứng viên.`);
    for (const c of cands) {
      const v = byId.get(c.voiceId);
      if (!v) throw new Error(`Giọng "${c.voiceId}" không có trong metadata của gói đã cài.`);
      if (v.region !== "Nam") throw new Error(`Giọng "${c.voiceId}" có region=${v.region}, không phải miền Nam.`);
      if (v.gender !== EXPECTED_GENDER[roleId]) throw new Error(`Giọng "${c.voiceId}" có gender=${v.gender}, vai ${roleId} cần ${EXPECTED_GENDER[roleId]}.`);
      jobs.push({ role: roleId, voiceId: c.voiceId, text: role.sampleText });
    }
  }
  const totalChars = jobs.reduce((a, j) => a + [...j.text].length, 0);
  console.log(`${jobs.length} mẫu, ${totalChars} ký tự. Thiết lập: ${JSON.stringify(SETTINGS)}`);
  for (const j of jobs) console.log(`  ${j.role} ← ${j.voiceId}`);
  if (dryRun) return console.log("--dry-run: không tạo âm thanh.");

  const provider = new VieneuProvider();
  console.log("Đang nạp model (lần đầu sẽ tải về cache/hf)...");
  const info = await provider.start();
  console.log(`Đã nạp trong ${info.load_sec} s · vieneu ${info.vieneu} · onnxruntime ${info.onnxruntime} · ${info.backbone_repo}@${info.backbone_revision}`);
  const missing = jobs.filter((j) => !info.preset_voice_ids.includes(j.voiceId));
  if (missing.length) throw new Error(`Model đang chạy không có giọng: ${missing.map((m) => m.voiceId).join(", ")}`);

  const outDir = join("out", "tts-vieneu", CAMPAIGN);
  mkdirSync(outDir, { recursive: true });
  const results: Record<string, unknown>[] = [];
  try {
    for (const [i, j] of jobs.entries()) {
      const label = `${String(i + 1).padStart(2, "0")}_${j.role}__${slug(j.voiceId)}`;
      const started = new Date().toISOString();
      try {
        const { meta: m, fromCache } = await synthesize(
          provider,
          {
            text: j.text,
            voiceId: j.voiceId,
            modelId: provider.modelId(),
            languageCode: "vi",
            settings: SETTINGS,
            seed: null,
            outputFormat: `wav-pcm16-${info.sample_rate}`,
          },
          { campaign: CAMPAIGN, budgetChars: 5000, label, maxAttempts: 2, timeoutMs: 10 * 60_000 },
        );
        const wav = join(outDir, `${label}.wav`);
        copyFileSync(join(entryDir(m.key), m.audioFile), wav);
        const qc = qcAudio(wav, j.text);
        const row = {
          file: wav,
          role: j.role,
          roleName: casting.roles[j.role].displayName,
          voiceId: j.voiceId,
          status: "chưa duyệt",
          text: j.text,
          model: provider.modelId(),
          settings: SETTINGS,
          createdAt: fromCache ? m.createdAt : started,
          fromCache,
          cacheKey: m.key,
          qc,
        };
        results.push(row);
        console.log(`OK ${label}: ${qc.durationSec} s · ${qc.syllablesPerSec ?? "?"} âm tiết/s · ${qc.flags.length ? "CỜ: " + qc.flags.join("; ") : "không có cờ kỹ thuật"}${fromCache ? " · từ cache" : ""}`);
      } catch (err) {
        results.push({ role: j.role, voiceId: j.voiceId, error: (err as Error).message });
        console.error(`LỖI ${label}: ${(err as Error).message}`);
      }
    }
  } finally {
    provider.close();
  }

  writeFileSync(
    join(outDir, "summary.json"),
    JSON.stringify({ campaign: CAMPAIGN, engine: info, qcLimits: QC_LIMITS, results }, null, 2) + "\n",
  );
  console.log(`\nĐã ghi ${join(outDir, "summary.json")}`);
  if (results.some((r) => "error" in r)) process.exit(1);
};

main().catch((err) => {
  console.error(`Lỗi: ${(err as Error).message}`);
  process.exit(1);
});
