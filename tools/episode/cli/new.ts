// npm run episode:new -- "Tiêu đề tập"
// Allocates the next free episode ID atomically and creates the standard
// layout (logic in tools/episode/create.ts, shared with the Studio).
import { createEpisode } from "../create.ts";
import { rel } from "../paths.ts";

const title = process.argv.slice(2).join(" ").trim();
if (!title) {
  console.error('Thiếu tiêu đề: npm run episode:new -- "Tiêu đề tập"');
  process.exit(1);
}
const P = createEpisode(title);
console.log(`Đã tạo ${P.id}: ${rel(P.root)}`);
