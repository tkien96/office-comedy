// npm run tts:check — free metadata only (no audio, no credits).
// Shows plan/tier, usage, Vietnamese-capable models and local budget status.
import { getSubscription, listModels } from "../elevenlabs.ts";
import { readLedger } from "../ledger.ts";

const main = async () => {
  const sub = await getSubscription();
  console.log("== Tài khoản ElevenLabs");
  console.log(`Gói: ${sub.tier} (trạng thái: ${sub.status})`);
  console.log(`Đã dùng: ${sub.character_count} / ${sub.character_limit} credits trong kỳ`);
  if (sub.next_character_count_reset_unix) {
    console.log(`Làm mới: ${new Date(sub.next_character_count_reset_unix * 1000).toISOString().slice(0, 10)}`);
  }
  if (sub.tier === "free") {
    console.log(
      "CẢNH BÁO: theo tài liệu ElevenLabs, gói Free không dùng được giọng Voice Library qua API và không có quyền thương mại.",
    );
  }

  const models = await listModels();
  const vi = models.filter((m) => m.can_do_text_to_speech && m.languages?.some((l) => l.language_id === "vi"));
  console.log("\n== Model TTS hỗ trợ tiếng Việt (theo /v1/models của tài khoản)");
  for (const m of vi) {
    console.log(
      [
        m.model_id.padEnd(26),
        `hệ số credit/ký tự=${m.model_rates?.character_cost_multiplier ?? "?"}`,
        `giảm giá=${m.model_rates?.cost_discount_multiplier ?? 1}`,
        `style=${m.can_use_style ? "có" : "không"}`,
        `speaker_boost=${m.can_use_speaker_boost ? "có" : "không"}`,
        `tối đa ${m.maximum_text_length_per_request ?? "?"} ký tự/request`,
        m.requires_alpha_access ? "CẦN QUYỀN ALPHA" : "",
      ].join(" | "),
    );
  }
  const noVi = models.filter((m) => m.can_do_text_to_speech && !vi.includes(m)).map((m) => m.model_id);
  console.log(`(Không có tiếng Việt: ${noVi.join(", ") || "—"})`);

  const byCampaign = new Map<string, { chars: number; attempts: number; ok: number }>();
  for (const e of readLedger()) {
    const c = byCampaign.get(e.campaign) ?? { chars: 0, attempts: 0, ok: 0 };
    c.chars += e.charsSent;
    c.attempts += 1;
    if (e.status === "ok") c.ok += 1;
    byCampaign.set(e.campaign, c);
  }
  console.log("\n== Sổ ngân sách cục bộ (cache/tts/ledger.jsonl)");
  if (byCampaign.size === 0) console.log("Chưa có lượt gọi nào.");
  for (const [k, v] of byCampaign) {
    console.log(`${k}: ${v.chars} ký tự đã gửi, ${v.attempts} lượt (${v.ok} thành công)`);
  }
};

main().catch((err) => {
  console.error(`Lỗi: ${(err as Error).message}`);
  process.exit(1);
});
