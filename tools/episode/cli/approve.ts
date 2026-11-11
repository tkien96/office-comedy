// npm run episode:approve -- EP001 <part> [--note "…"] [--revoke]
//
// FOR THE USER TO RUN after reviewing a product. Records the approval bound to
// the product's CURRENT hash plus the hashes of its sources (DEPENDS_ON), so
// any later change makes it "cần duyệt lại" / "cần kiểm tra lại".
// The assistant never runs this on the user's behalf.
//
// <part>: script | audio | video | captions | thumbnail9x16 | teaser1x1 | social.<platform>.<post>
//         (e.g. social.youtube.video, social.facebook.teaser)
import { readFileSync, writeFileSync } from "node:fs";
import { basisFor, currentHashes, currentSources, readManifest, type Approval } from "../manifest.ts";
import { resolveEpisode } from "../paths.ts";

const args = process.argv.slice(2);
const flag = (n: string) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : undefined;
};
const positional = args.filter((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--note"));
const [epArg, part] = positional;
if (!epArg || !part) {
  console.error('Cách dùng: npm run episode:approve -- EP001 <phần> [--note "ghi chú"] [--revoke]');
  process.exit(1);
}
const P = resolveEpisode(epArg);
const m = readManifest(P);
const cur = currentHashes(P);
const src = currentSources(P, m);

const isSocial = part.startsWith("social.");
const key = isSocial ? part.slice("social.".length) : part;
const hash = isSocial ? cur.social[key] : (cur as unknown as Record<string, string | null>)[part];
if (!isSocial && !["script", "audio", "video", "captions", "thumbnail9x16", "teaser1x1"].includes(part)) {
  console.error(`Phần không hợp lệ: ${part}`);
  process.exit(1);
}
if (isSocial && !(key in cur.social)) {
  console.error(`Không có bài "${key}" trong social.json. Có: ${Object.keys(cur.social).join(", ")}`);
  process.exit(1);
}

let approval: Approval;
if (args.includes("--revoke")) {
  approval = { status: "not_approved", note: flag("--note") ?? `Thu hồi duyệt ${new Date().toISOString().slice(0, 10)}` };
} else {
  if (!hash) {
    console.error(`${part}: chưa có file/nội dung, không duyệt được.`);
    process.exit(1);
  }
  approval = {
    status: "approved",
    approvedAt: new Date().toISOString().slice(0, 10),
    approvedBy: "người dùng",
    sha256: hash,
    basis: basisFor(part, src),
    ...(flag("--note") ? { note: flag("--note") } : {}),
  };
}

const raw = JSON.parse(readFileSync(P.episodeJson, "utf8"));
if (isSocial) raw.approvals.social[key] = approval;
else raw.approvals[part] = { ...(part === "audio" ? { lineCacheKeys: raw.approvals.audio?.lineCacheKeys } : {}), ...approval };
writeFileSync(P.episodeJson, JSON.stringify(raw, null, 2) + "\n");
console.log(`${m.id} · ${part}: ${approval.status}${approval.sha256 ? ` (hash ${approval.sha256.slice(0, 12)})` : ""}`);
