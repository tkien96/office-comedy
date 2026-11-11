// npm run episode:docs -- EP001
// Writes script.md from the episode data + timeline.json (real measured times).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { checkApproval, currentHashes, readManifest } from "../../episode/manifest.ts";
import { resolveEpisode } from "../../episode/paths.ts";

type Beat = {
  id: string;
  scene: string;
  kind: "line" | "action";
  role?: string;
  text?: string;
  visual?: string;
  desc?: string;
  expression?: Record<string, string>;
  pose?: Record<string, string>;
};
type Ep = {
  id: string;
  title: string;
  logline: string;
  duration: { minSec: number; targetRangeSec: [number, number] };
  scenes: { id: string; title: string; location: string; speakers: string[]; note?: string }[];
  beats: Beat[];
};
type Item = { id: string; startSec: number; endSec: number; speechStartSec?: number; speechEndSec?: number; durationSec?: number };

const P = resolveEpisode(process.argv[2] ?? "EP001");
const file = P.script;
const ep = JSON.parse(readFileSync(file, "utf8")) as Ep;

const tlFile = P.timeline;
const tl = existsSync(tlFile)
  ? (JSON.parse(readFileSync(tlFile, "utf8")) as { items: Item[]; contentEndSec: number; durationInFrames: number; durationStatus: string })
  : null;
const at = new Map((tl?.items ?? []).map((i) => [i.id, i]));

const NAMES: Record<string, string> = { narrator: "KIÊN (lời dẫn)", kien: "KIÊN", trinh: "TRINH", sep: "SẾP" };
const LOC: Record<string, string> = { office: "Văn phòng", meeting: "Phòng họp", pantry: "Pantry" };
const EXPR: Record<string, string> = { neutral: "bình thường", happy: "vui", suspicious: "nghi ngờ", surprised: "bất ngờ", annoyed: "bực", embarrassed: "ngượng" };
const POSE: Record<string, string> = { standing: "đứng", computer: "ngồi máy tính", phone: "cầm điện thoại", pointing: "chỉ tay" };
const t = (s?: number) => (s === undefined ? "—" : s.toFixed(2).padStart(5, "0"));

const out: string[] = [];
out.push(`# ${ep.id} — ${ep.title}`, "");
const durText = tl
  ? `${tl.contentEndSec.toFixed(2)} s thực tế (${tl.durationInFrames} khung hình @30 fps), ${tl.durationStatus}`
  : `chưa đo (tối thiểu ${ep.duration.minSec} s, mục tiêu ${ep.duration.targetRangeSec.join("–")} s)`;
// Approval state lives in episode.json (bound to hashes), never in script.json.
const statusText = existsSync(P.episodeJson)
  ? (() => {
      const m = readManifest(P);
      const cur = currentHashes(P);
      const s = (k: "script" | "audio" | "video") => `${k} ${checkApproval(m.approvals[k], cur[k]).status === "approved" ? "đã duyệt" : "chưa duyệt/cần duyệt lại"}`;
      return [s("script"), s("audio"), s("video")].join(", ");
    })()
  : "chưa có episode.json";
out.push(`**Trạng thái:** ${statusText} (xem \`npm run episode:status -- ${ep.id}\`) · **Thời lượng:** ${durText} · **Dữ liệu nguồn:** \`${file.replace(/\\/g, "/")}\``, "");
out.push(`**Ý tưởng:** ${ep.logline}`, "");
out.push("**Vai:** Kiên (miền Nam, kiêm lời dẫn ngôi thứ nhất), Trinh (miền Nam), Sếp (miền Bắc, trên 50). Xưng hô: Kiên/Trinh gọi \"sếp\", xưng \"em\"; Sếp xưng \"anh\"; Kiên–Trinh anh–em.", "");
out.push(tl ? "Mốc thời gian lấy từ `timeline.json` (đo trên âm thanh thật)." : "Chưa có `timeline.json`: chưa có mốc thời gian.", "");

for (const s of ep.scenes) {
  out.push(`## ${s.id}. ${s.title} — ${LOC[s.location] ?? s.location}`, "");
  out.push(`Người nói: ${s.speakers.map((x) => NAMES[x] ?? x).join(", ")}${s.note ? `. ${s.note}` : ""}`, "");
  out.push("| Thời gian (s) | Ai | Lời / hành động | Hình ảnh, biểu cảm |", "|---|---|---|---|");
  for (const b of ep.beats.filter((x) => x.scene === s.id)) {
    const i = at.get(b.id);
    const extras = [
      b.visual,
      b.expression ? "Biểu cảm: " + Object.entries(b.expression).map(([k, v]) => `${NAMES[k] ?? k} ${EXPR[v] ?? v}`).join(", ") : "",
      b.pose ? "Tư thế: " + Object.entries(b.pose).map(([k, v]) => `${NAMES[k] ?? k} ${POSE[v] ?? v}`).join(", ") : "",
    ]
      .filter(Boolean)
      .map((x) => x!.replace(/\.+$/, ""))
      .join(". ");
    if (b.kind === "line") {
      out.push(`| ${t(i?.speechStartSec)}–${t(i?.speechEndSec)} | ${NAMES[b.role!] ?? b.role} | "${b.text}" | ${extras} |`);
    } else {
      out.push(`| ${t(i?.startSec)}–${t(i?.endSec)} | (hành động) | *${b.desc}* | Không thoại${i?.durationSec ? `, ${i.durationSec.toFixed(2)} s` : ""} |`);
    }
  }
  out.push("");
}
writeFileSync(P.scriptMd, out.join("\n"), "utf8");
console.log(`Đã ghi ${P.scriptMd}`);
