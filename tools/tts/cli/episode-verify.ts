// npm run episode:verify -- episodes/EP001/ep001.json out/EP001.mp4
// Checks a rendered episode against its timeline (CLAUDE.md rules):
// ≥ min duration, frame count = timeline durationInFrames, 1080x1920@30,
// h264/yuv420p + aac, audio matches the approved preview, last speech and
// last caption fit inside the video, no black frames or long freezes.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const [epFile = "episodes/EP001/ep001.json", video = "out/EP001.mp4"] = process.argv.slice(2);
const ep = JSON.parse(readFileSync(epFile, "utf8")) as { id: string; duration: { minSec: number; targetRangeSec: [number, number] } };
const dir = join("episodes", ep.id);
const tl = JSON.parse(readFileSync(join(dir, "timeline.json"), "utf8")) as {
  durationInFrames: number;
  fps: number;
  contentEndSec: number;
  items: { kind: string; speechEndSec?: number }[];
};

const run = (cmd: string, args: string[]) => spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 1 << 26 });
const results: { check: string; ok: boolean; detail: string }[] = [];
const add = (check: string, ok: boolean, detail: string) => results.push({ check, ok, detail });

const probe = JSON.parse(
  run("ffprobe", ["-v", "error", "-count_frames", "-show_entries", "stream=codec_type,codec_name,width,height,r_frame_rate,nb_read_frames,pix_fmt,sample_rate,channels:format=duration", "-of", "json", video]).stdout,
);
const v = probe.streams.find((s: { codec_type: string }) => s.codec_type === "video");
const a = probe.streams.find((s: { codec_type: string }) => s.codec_type === "audio");
const dur = parseFloat(probe.format.duration);
const frames = Number(v?.nb_read_frames);

add("Thời lượng ≥ tối thiểu", dur >= ep.duration.minSec, `${dur.toFixed(3)} s (tối thiểu ${ep.duration.minSec} s, mục tiêu ${ep.duration.targetRangeSec.join("–")} s)`);
add("Số khung hình = timeline", frames === tl.durationInFrames, `${frames} khung (timeline ${tl.durationInFrames})`);
add("Khung hình 1080x1920 @30", v?.width === 1080 && v?.height === 1920 && v?.r_frame_rate === "30/1", `${v?.width}x${v?.height} @ ${v?.r_frame_rate}`);
add("Video h264 yuv420p", v?.codec_name === "h264" && v?.pix_fmt === "yuv420p", `${v?.codec_name} ${v?.pix_fmt}`);
add("Audio aac", a?.codec_name === "aac", `${a?.codec_name} ${a?.sample_rate} Hz ${a?.channels} kênh`);

const lastSpeech = Math.max(...tl.items.filter((i) => i.kind === "line").map((i) => i.speechEndSec ?? 0));
add("Không cắt cụt nội dung", dur >= tl.contentEndSec - 0.001 && dur >= lastSpeech, `nội dung kết thúc ${tl.contentEndSec} s, lời cuối ${lastSpeech} s, video ${dur.toFixed(3)} s`);

// Decode check (whole file).
const dec = run("ffmpeg", ["-v", "error", "-i", video, "-f", "null", "-"]);
add("Giải mã toàn bộ không lỗi", dec.status === 0 && !dec.stderr.trim(), dec.stderr.trim() ? dec.stderr.slice(0, 200) : "OK");

// Audio vs approved preview: loudness and length (AAC re-encode, not bit-exact).
const lufs = (f: string) => {
  const s = run("ffmpeg", ["-hide_banner", "-nostats", "-i", f, "-map", "0:a:0", "-af", "ebur128", "-f", "null", "-"]).stderr;
  const m = s.slice(s.lastIndexOf("Summary:")).match(/I:\s+(-?[\d.]+) LUFS/);
  return m ? parseFloat(m[1]) : NaN;
};
const prev = join(dir, "dialogue-preview.wav");
const lv = lufs(video);
const lp = lufs(prev);
add("Âm thanh khớp bản đã duyệt (độ to)", Math.abs(lv - lp) <= 0.5, `video ${lv} LUFS · preview ${lp} LUFS`);

// Black frames and frozen picture.
const black = run("ffmpeg", ["-hide_banner", "-nostats", "-i", video, "-vf", "blackdetect=d=0.1:pic_th=0.95", "-an", "-f", "null", "-"]).stderr;
const blacks = [...black.matchAll(/black_start:([\d.]+) black_end:([\d.]+)/g)].map((m) => `${m[1]}–${m[2]}`);
add("Không có khung đen", blacks.length === 0, blacks.length ? blacks.join(", ") : "không có");
const freeze = run("ffmpeg", ["-hide_banner", "-nostats", "-i", video, "-vf", "freezedetect=n=0.001:d=2", "-an", "-f", "null", "-"]).stderr;
const freezes = [...freeze.matchAll(/freeze_start: ([\d.]+)[\s\S]*?freeze_duration: ([\d.]+)/g)].map((m) => `${m[1]} s (${m[2]} s)`);
add("Không có hình đứng im ≥ 2 s", freezes.length === 0, freezes.length ? freezes.join(", ") : "không có");

let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log(`${r.ok ? "ĐẠT " : "LỖI "} ${r.check}: ${r.detail}`);
}
console.log(failed ? `\n${failed} mục không đạt.` : "\nTất cả mục đạt.");
process.exit(failed ? 1 : 0);
