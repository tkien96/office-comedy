// npm run episode:thumbnails -- EP001
//
// Renders the 9:16 thumbnail and 1:1 teaser from the Remotion stills
// "<ID>-thumb-9x16" / "<ID>-teaser-1x1" (layout data in
// src/episodes/<id>-thumbnails.ts, same rig/backgrounds/fonts as the video),
// then checks size, aspect, file limits and the text against the spoiler list.
// Never approves anything.
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { currentSources, readManifest, readSocial, thumbnailDesignFile } from "../manifest.ts";
import { rel, resolveEpisode } from "../paths.ts";

const P = resolveEpisode(process.argv[2] ?? "EP001");
const designFile = thumbnailDesignFile(P.id);

// Targets (official docs, checked 2026-11-11):
// - YouTube Shorts custom thumbnail: 9:16, recommended 2160x3840, min height 640, JPG/PNG, ≤ 50 MB (Studio desktop / thumbnails.set), ≤ 2 MB on mobile.
// - Facebook video thumbnail (/{video-id}/thumbnails): ≤ 10 MB, same aspect as the video.
const OUTPUTS = [
  { still: `${P.id}-thumb-9x16`, file: P.thumbnail9x16, scale: 2, expect: { w: 2160, h: 3840 }, maxBytes: 10 * 1024 * 1024 },
  { still: `${P.id}-teaser-1x1`, file: P.teaser1x1, scale: 1, expect: { w: 1080, h: 1080 }, maxBytes: 10 * 1024 * 1024 },
];

const problems: string[] = [];
mkdirSync(P.thumbnailsDir, { recursive: true });
for (const o of OUTPUTS) {
  console.log(`Render ${o.still} → ${rel(o.file)} (scale ${o.scale})`);
  const r = spawnSync(`npx remotion still ${o.still} "${o.file}" --scale=${o.scale} --log=error`, { stdio: "inherit", shell: true });
  if (r.status !== 0) {
    console.error(`Render lỗi: ${o.still}`);
    process.exit(1);
  }
  const probe = spawnSync("ffprobe", ["-v", "error", "-show_entries", "stream=width,height", "-of", "csv=p=0", o.file], { encoding: "utf8" });
  const [w, h] = probe.stdout.trim().split(",").map(Number);
  const bytes = statSync(o.file).size;
  if (w !== o.expect.w || h !== o.expect.h) problems.push(`${rel(o.file)}: ${w}x${h}, cần ${o.expect.w}x${o.expect.h}.`);
  if (bytes > o.maxBytes) problems.push(`${rel(o.file)}: ${(bytes / 1048576).toFixed(1)} MB > ${o.maxBytes / 1048576} MB.`);
  console.log(`  ${w}x${h} · ${(bytes / 1024).toFixed(0)} KB`);
}

// Text on the images vs. spoiler list (keyword net only; a human still reviews).
const mod = (await import(pathToFileURL(designFile).href)) as Record<string, { text: { headline: string[]; kicker?: string } }>;
const texts = Object.values(mod).flatMap((s) => [...s.text.headline, s.text.kicker ?? ""]);
const guard = ((readSocial(P)?.spoilerGuard as { punchlineMustNotAppear?: string[] })?.punchlineMustNotAppear ?? []).map((g) => g.toLowerCase());
for (const t of texts) for (const g of guard) if (t.toLowerCase().includes(g)) problems.push(`Chữ trên ảnh lộ câu chốt: "${t}" chứa "${g}".`);

// Production state only (never approval).
const raw = JSON.parse(readFileSync(P.episodeJson, "utf8"));
raw.production.thumbnail9x16 = "done";
raw.production.teaser1x1 = "done";
raw.versions.thumbnailDesignHash = currentSources(P, readManifest(P)).thumbnailDesign;
writeFileSync(P.episodeJson, JSON.stringify(raw, null, 2) + "\n");

console.log(`Chữ trên ảnh: ${texts.filter(Boolean).map((t) => `"${t}"`).join(", ")}`);
for (const p of problems) console.log(`LỖI: ${p}`);
console.log("Cần người xem: bố cục, mặt nhân vật, chữ đọc được ở cỡ nhỏ, không lộ câu chốt. Duyệt: npm run episode:approve -- " + P.id + " thumbnail9x16 / teaser1x1");
if (problems.length) process.exit(1);
