import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProviderError, type Boundary, type TtsAudio, type TtsProvider, type TtsRequest } from "./types.ts";

// Edge TTS adapter. Runs tools/tts/edge/edge_synth.py inside the project's
// own virtualenv (tools/tts/edge/.venv). Free service, no API key, no usage
// counter. Settings: rate / volume / pitch only (no emotion control).

const EDGE_DIR = join(process.cwd(), "tools", "tts", "edge");
const SCRIPT = join(EDGE_DIR, "edge_synth.py");

export const venvPython = () => {
  const win = join(EDGE_DIR, ".venv", "Scripts", "python.exe");
  const posix = join(EDGE_DIR, ".venv", "bin", "python");
  const p = process.platform === "win32" ? win : posix;
  if (!existsSync(p)) {
    throw new ProviderError(
      "other",
      `Chưa có môi trường Python cho Edge TTS (${p}). Xem README, mục "Edge TTS".`,
    );
  }
  return p;
};

type HelperResult = { ok: boolean; kind?: string; status?: number; message?: string; [k: string]: unknown };

const runHelper = (args: string[], stdin: string | null, timeoutMs: number): Promise<HelperResult> =>
  new Promise((resolve, reject) => {
    const child = spawn(venvPython(), [SCRIPT, ...args], {
      env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" },
    });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new ProviderError("timeout", `Edge TTS quá ${timeoutMs} ms`));
    }, timeoutMs);
    child.stdout.on("data", (d) => (out += d.toString("utf8")));
    child.stderr.on("data", (d) => (err += d.toString("utf8")));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(new ProviderError("other", `Không chạy được Python: ${e.message}`));
    });
    child.on("close", () => {
      clearTimeout(timer);
      try {
        resolve(JSON.parse(out) as HelperResult);
      } catch {
        reject(new ProviderError("other", `Helper trả về không hợp lệ: ${(out || err).slice(0, 400)}`));
      }
    });
    if (stdin !== null) child.stdin.end(stdin, "utf8");
    else child.stdin.end();
  });

const toError = (r: HelperResult) => {
  const kind = r.kind === "timeout" || r.kind === "network" || r.kind === "http" ? r.kind : "other";
  return new ProviderError(kind, `Edge TTS: ${r.message ?? "lỗi không rõ"}`, typeof r.status === "number" ? r.status : null);
};

export type EdgeVoice = {
  Name?: string;
  ShortName: string;
  Gender: string;
  Locale: string;
  FriendlyName?: string;
  VoiceTag?: { ContentCategories?: string[]; VoicePersonalities?: string[] };
  [k: string]: unknown;
};

export const listEdgeVoices = async (timeoutMs = 60_000) => {
  const r = await runHelper(["voices"], null, timeoutMs);
  if (!r.ok) throw toError(r);
  return { version: String(r.edge_tts_version), voices: r.voices as EdgeVoice[] };
};

export class EdgeTtsProvider implements TtsProvider {
  readonly id = "edge-tts";

  async synthesize(req: TtsRequest, timeoutMs: number): Promise<TtsAudio> {
    const dir = mkdtempSync(join(tmpdir(), "edge-tts-"));
    try {
      const files = {
        out_audio: join(dir, "audio.mp3"),
        out_srt: join(dir, "subtitles.srt"),
        out_boundaries: join(dir, "boundaries.json"),
      };
      const s = req.settings;
      const r = await runHelper(
        ["synth"],
        JSON.stringify({
          text: req.text,
          voice: req.voiceId,
          rate: s.rate ?? "+0%",
          volume: s.volume ?? "+0%",
          pitch: s.pitch ?? "+0Hz",
          boundary: s.boundary ?? "SentenceBoundary",
          connect_timeout: 10,
          receive_timeout: Math.max(10, Math.floor(timeoutMs / 1000) - 5),
          ...files,
        }),
        timeoutMs,
      );
      if (!r.ok) throw toError(r);
      return {
        audio: readFileSync(files.out_audio),
        extension: "mp3",
        alignment: null,
        normalizedAlignment: null,
        boundaries: JSON.parse(readFileSync(files.out_boundaries, "utf8")) as Boundary[],
        srt: readFileSync(files.out_srt, "utf8"),
      };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  async usage() {
    return null;
  }
}
