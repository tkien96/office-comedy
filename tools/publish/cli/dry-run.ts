// npm run publish:dry-run -- EP001 [--now "YYYY-MM-DD HH:mm"]
// Checks every publishing job of an episode WITHOUT uploading, scheduling or
// changing any job (logic in tools/publish/dryrun.ts, shared with the Studio).
// Writes reports/publish-dry-run.json. Exit 0 = report written (not "ready").
import { rel, resolveEpisode } from "../../episode/paths.ts";
import { runDryRun, writeDryRunReport } from "../dryrun.ts";
import { localToUtc } from "../jobs.ts";

const args = process.argv.slice(2);
const P = resolveEpisode(args.find((a) => !a.startsWith("--")));
const nowArg = args.includes("--now") ? args[args.indexOf("--now") + 1] : null;
const now = nowArg ? new Date(localToUtc(nowArg)) : new Date();

const report = runDryRun(P, now);
const file = writeDryRunReport(P, report);
console.log(`DRY-RUN ${P.id} (không upload): ${report.readyCount}/${report.total} job sẵn sàng · giờ kiểm tra ${now.toISOString()}`);
for (const r of report.results) {
  console.log(`\n${r.ready ? "SẴN SÀNG" : "CHƯA    "} ${r.job} [${r.mode}, ${r.state}]${r.scheduleUtc ? ` UTC ${r.scheduleUtc}` : ""}`);
  for (const x of r.findings) console.log(`   ${x.level.padEnd(5)} ${x.msg}`);
}
console.log(`\nBáo cáo: ${rel(file)}`);
