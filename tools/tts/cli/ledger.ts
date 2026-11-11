// npm run tts:ledger — prints every API attempt from the local ledger (offline).
import { readLedger } from "../ledger.ts";

const rows = readLedger();
if (rows.length === 0) {
  console.log("Sổ trống: chưa có lượt gọi API nào.");
} else {
  for (const e of rows) {
    console.log(
      `${e.at} ${e.campaign} ${e.label} lần ${e.attempt}: ${e.status}${e.httpStatus ? ` (${e.httpStatus})` : ""}` +
        ` · ${e.charsSent} ký tự · credits đo được: ${e.usageDelta ?? "?"}` +
        ` · ${e.durationSeconds ? `${e.durationSeconds.toFixed(2)} s` : "-"}`,
    );
  }
  const total = rows.reduce((s, e) => s + e.charsSent, 0);
  const measured = rows.reduce((s, e) => s + (e.usageDelta ?? 0), 0);
  console.log(`\nTổng: ${rows.length} lượt, ${total} ký tự đã gửi, ${measured} credits đo được.`);
}
