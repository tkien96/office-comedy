// npm run episode:approve -- EP001 <part> [--note "…"] [--revoke]
//
// FOR THE USER TO RUN after reviewing a product. Records the approval bound to
// the product's CURRENT hash plus the hashes of its sources (DEPENDS_ON), so
// any later change makes it "cần duyệt lại" / "cần kiểm tra lại".
// Same service as the Studio "Duyệt" button (tools/episode/service.ts).
// The assistant never runs this on the user's behalf.
//
// <part>: script | audio | video | captions | thumbnail9x16 | teaser1x1 | social.<platform>.<post>
import { resolveEpisode } from "../paths.ts";
import { approvePart } from "../service.ts";

const args = process.argv.slice(2);
const noteIdx = args.indexOf("--note");
const note = noteIdx >= 0 ? args[noteIdx + 1] : undefined;
const positional = args.filter((a, i) => !a.startsWith("--") && !(noteIdx >= 0 && i === noteIdx + 1));
const [epArg, part] = positional;
if (!epArg || !part) {
  console.error('Cách dùng: npm run episode:approve -- EP001 <phần> [--note "ghi chú"] [--revoke]');
  process.exit(1);
}
try {
  const r = approvePart(resolveEpisode(epArg), part, { note, revoke: args.includes("--revoke") });
  console.log(`${epArg} · ${part}: ${r.status}${r.hash ? ` (hash ${r.hash.slice(0, 12)})` : ""}`);
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}
