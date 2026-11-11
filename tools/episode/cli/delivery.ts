// npm run episode:delivery -- EP001          build episodes/EP001/delivery/
// npm run episode:delivery -- EP001 --check  only verify the package against current sources
// Logic in tools/episode/delivery.ts (shared with the Studio). Never changes approvals.
import { buildDelivery, checkDelivery, STATUS_VI } from "../delivery.ts";
import { rel, resolveEpisode } from "../paths.ts";

const args = process.argv.slice(2);
const P = resolveEpisode(args.find((a) => !a.startsWith("--")) ?? "EP001");

if (args.includes("--check")) {
  const c = checkDelivery(P);
  if (!c.exists) {
    console.log("Chưa có bộ delivery.");
    process.exit(1);
  }
  if (c.error) console.log(`Không lập được bộ mới để so: ${c.error}`);
  for (const r of c.rows) console.log(`  ${r.file.padEnd(18)} ${r.problem ?? "khớp nguồn"}`);
  for (const f of c.extras) console.log(`  ${f.padEnd(18)} thừa (không do lệnh tạo ra)`);
  console.log(c.ok ? "Bộ delivery khớp nguồn hiện tại." : `Bộ delivery CŨ: chạy lại npm run episode:delivery -- ${P.id}`);
  process.exit(c.ok ? 0 : 1);
}

try {
  const r = buildDelivery(P);
  console.log(`Đã tạo ${rel(P.deliveryDir)}/ (${r.files} file):`);
  for (const e of r.entries) console.log(`  ${e.file.padEnd(18)} ${STATUS_VI[e.approval].padEnd(16)} ← ${e.source}`);
  console.log("Không thay đổi trạng thái duyệt nào.");
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}
