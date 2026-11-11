import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { ProviderError, type TtsAudio, type TtsProvider, type TtsRequest } from "./types.ts";

// Local VieNeu-TTS adapter (v3 Turbo on ONNX/CPU). Keeps one Python process
// alive so the model loads once. No network after the first model download,
// no API key, never the paid VieNeu API. No timestamps are produced.

const DIR = join(process.cwd(), "tools", "tts", "vieneu");
const SCRIPT = join(DIR, "vieneu_synth.py");
/** Model files live on D: inside the project (gitignored), not in C:\Users. */
export const HF_HOME = join(process.cwd(), "cache", "hf");

const python = () => {
  const p =
    process.platform === "win32"
      ? join(DIR, ".venv", "Scripts", "python.exe")
      : join(DIR, ".venv", "bin", "python");
  if (!existsSync(p)) {
    throw new ProviderError("other", `Chưa có môi trường VieNeu (${p}). Xem README, mục "VieNeu-TTS".`);
  }
  return p;
};

const env = () => ({
  ...process.env,
  HF_HOME,
  HF_HUB_DISABLE_TELEMETRY: "1",
  PYTHONIOENCODING: "utf-8",
});

export type VieneuVoice = {
  voice_id: string;
  gender: string | null;
  region: string | null;
  style: string | null;
  featured: number | null;
  description: string | null;
  aliases: string[];
};

export const listVieneuVoices = (): Promise<{
  source: string;
  default_voice: string;
  count: number;
  voices: VieneuVoice[];
}> =>
  new Promise((resolve, reject) => {
    const child = spawn(python(), ["-X", "utf8", SCRIPT, "voices"], { env: env() });
    let out = "";
    child.stdout.on("data", (d) => (out += d.toString("utf8")));
    child.on("error", reject);
    child.on("close", () => {
      try {
        const r = JSON.parse(out);
        if (!r.ok) reject(new ProviderError("other", r.message));
        else resolve(r);
      } catch {
        reject(new ProviderError("other", `Helper trả về không hợp lệ: ${out.slice(0, 300)}`));
      }
    });
  });

export type VieneuInfo = {
  vieneu: string;
  onnxruntime: string;
  sea_g2p: string;
  mode: string;
  backend: string;
  precision: string;
  backbone_repo: string;
  backbone_revision: string | null;
  tokenizer_repo: string;
  tokenizer_revision: string | null;
  sample_rate: number;
  watermarker: boolean;
  preset_voice_ids: string[];
  load_sec: number;
};

type Pending = { resolve: (v: Record<string, unknown>) => void; reject: (e: Error) => void; timer: NodeJS.Timeout };

export class VieneuProvider implements TtsProvider {
  readonly id = "vieneu-local";
  private child: ChildProcessWithoutNullStreams | null = null;
  private pending = new Map<string, Pending>();
  private seq = 0;
  private stderrTail = "";
  info: VieneuInfo | null = null;
  /** "ref:<sha256>" → absolute path of a reference clip. */
  private refs = new Map<string, string>();

  /**
   * Registers a reference clip for cloning. The voice id is its content hash,
   * so the cache follows the audio itself, not the file name or location.
   */
  registerReference(file: string, expectedSha256?: string): string {
    const sha = createHash("sha256").update(readFileSync(file)).digest("hex");
    if (expectedSha256 && sha !== expectedSha256) {
      throw new Error(`Dấu vân tay file tham chiếu không khớp: ${file}`);
    }
    const id = `ref:${sha}`;
    this.refs.set(id, resolve(file));
    return id;
  }

  /** Starts Python and loads the model. Returns versions for the cache key. */
  async start(loadTimeoutMs = 15 * 60_000): Promise<VieneuInfo> {
    if (this.info) return this.info;
    const child = spawn(python(), ["-X", "utf8", SCRIPT, "serve"], { env: env() });
    this.child = child;
    child.stderr.on("data", (d) => {
      this.stderrTail = (this.stderrTail + d.toString("utf8")).slice(-2000);
    });
    const lines = createInterface({ input: child.stdout });
    const ready = new Promise<VieneuInfo>((resolve, reject) => {
      const timer = setTimeout(() => reject(new ProviderError("timeout", "Nạp model VieNeu quá lâu")), loadTimeoutMs);
      lines.on("line", (line) => {
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(line);
        } catch {
          return;
        }
        if (msg.ready) {
          clearTimeout(timer);
          resolve(msg.info as VieneuInfo);
          return;
        }
        if (msg.ok === false && msg.id === undefined) {
          clearTimeout(timer);
          reject(new ProviderError("other", String(msg.message)));
          return;
        }
        const p = this.pending.get(String(msg.id));
        if (p) {
          clearTimeout(p.timer);
          this.pending.delete(String(msg.id));
          p.resolve(msg);
        }
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        const err = new ProviderError("other", `VieNeu dừng (mã ${code}). ${this.stderrTail.slice(-500)}`);
        reject(err);
        for (const p of this.pending.values()) {
          clearTimeout(p.timer);
          p.reject(err);
        }
        this.pending.clear();
        this.child = null;
      });
    });
    this.info = await ready;
    return this.info;
  }

  /** Cache-key model id: package + backend + exact model revisions. */
  modelId(): string {
    if (!this.info) throw new Error("Gọi start() trước.");
    const i = this.info;
    return `vieneu@${i.vieneu}/${i.mode}-${i.backend}-${i.precision}/${i.backbone_repo}@${i.backbone_revision ?? "?"}/${i.tokenizer_repo}@${i.tokenizer_revision ?? "?"}`;
  }

  async synthesize(req: TtsRequest, timeoutMs: number): Promise<TtsAudio> {
    // Restart transparently after a timeout killed the process (retry path).
    if (!this.child || !this.info) await this.start();
    const dir = mkdtempSync(join(tmpdir(), "vieneu-"));
    const outWav = join(dir, "audio.wav");
    const id = String(++this.seq);
    try {
      const msg = await new Promise<Record<string, unknown>>((resolve, reject) => {
        const timer = setTimeout(() => {
          this.pending.delete(id);
          // A stuck generation leaves the model in an unknown state: restart next time.
          this.close();
          reject(new ProviderError("timeout", `VieNeu quá ${timeoutMs} ms`));
        }, timeoutMs);
        this.pending.set(id, { resolve, reject, timer });
        const ref = req.voiceId.startsWith("ref:") ? this.refs.get(req.voiceId) : undefined;
        if (req.voiceId.startsWith("ref:") && !ref) {
          reject(new ProviderError("other", `Chưa đăng ký file tham chiếu cho ${req.voiceId}`));
          return;
        }
        this.child!.stdin.write(
          JSON.stringify({ id, text: req.text, voice: ref ? null : req.voiceId, ref_audio: ref ?? null, out_wav: outWav, params: req.settings }) + "\n",
        );
      });
      if (!msg.ok) throw new ProviderError("other", `VieNeu: ${String(msg.message)}`);
      return {
        audio: readFileSync(outWav),
        extension: "wav",
        alignment: null,
        normalizedAlignment: null,
        boundaries: null,
        srt: null,
      };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  async usage() {
    return null;
  }

  close() {
    if (this.child) {
      this.child.stdin.end();
      this.child.kill();
      this.child = null;
      this.info = null;
    }
  }
}
