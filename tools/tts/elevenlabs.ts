import {
  ProviderError,
  type Alignment,
  type TtsAudio,
  type TtsProvider,
  type TtsRequest,
  type UsageSnapshot,
} from "./types.ts";

// ElevenLabs adapter (plain fetch, no SDK).
// Docs: https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps
// The API key is read from the environment and only ever sent in the
// `xi-api-key` header. It is never logged or written to disk.

const BASE = "https://api.elevenlabs.io";

export const requireApiKey = (): string => {
  const key = process.env.ELEVENLABS_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "ELEVENLABS_API_KEY chưa có. Tạo file .env từ .env.example và điền key (xem README, mục TTS).",
    );
  }
  return key;
};

/** Removes anything that looks like the API key from an error message. */
const redact = (s: string, key: string) => (key ? s.split(key).join("<redacted>") : s);

const call = async (path: string, init: RequestInit, timeoutMs: number): Promise<Response> => {
  const key = requireApiKey();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: { ...(init.headers ?? {}), "xi-api-key": key, accept: "application/json" },
    });
    if (!res.ok) {
      const body = redact(await res.text().catch(() => ""), key).slice(0, 500);
      throw new ProviderError("http", `HTTP ${res.status} ${path}: ${body}`, res.status);
    }
    return res;
  } catch (err) {
    if (err instanceof ProviderError) throw err;
    if ((err as Error).name === "AbortError") {
      throw new ProviderError("timeout", `Timeout sau ${timeoutMs} ms: ${path}`);
    }
    throw new ProviderError("network", redact(`Lỗi mạng ${path}: ${(err as Error).message}`, key));
  } finally {
    clearTimeout(timer);
  }
};

const getJson = async <T>(path: string, timeoutMs = 30_000): Promise<T> =>
  (await (await call(path, { method: "GET" }, timeoutMs)).json()) as T;

type RawAlignment = {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
} | null;

const toAlignment = (a: RawAlignment | undefined): Alignment | null =>
  a
    ? {
        characters: a.characters,
        startSeconds: a.character_start_times_seconds,
        endSeconds: a.character_end_times_seconds,
      }
    : null;

const extensionFor = (fmt: string) =>
  fmt.startsWith("mp3") ? "mp3" : fmt.startsWith("wav") ? "wav" : fmt.startsWith("opus") ? "opus" : "pcm";

export class ElevenLabsProvider implements TtsProvider {
  readonly id = "elevenlabs";

  async synthesize(req: TtsRequest, timeoutMs: number): Promise<TtsAudio> {
    const body: Record<string, unknown> = {
      text: req.text,
      model_id: req.modelId,
      language_code: req.languageCode,
      voice_settings: req.settings,
    };
    if (req.seed !== null) body.seed = req.seed;
    const res = await call(
      `/v1/text-to-speech/${encodeURIComponent(req.voiceId)}/with-timestamps?output_format=${encodeURIComponent(req.outputFormat)}`,
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) },
      timeoutMs,
    );
    const json = (await res.json()) as {
      audio_base64: string;
      alignment?: RawAlignment;
      normalized_alignment?: RawAlignment;
    };
    return {
      audio: Buffer.from(json.audio_base64, "base64"),
      extension: extensionFor(req.outputFormat),
      alignment: toAlignment(json.alignment),
      normalizedAlignment: toAlignment(json.normalized_alignment),
      boundaries: null,
      srt: null,
    };
  }

  async usage(): Promise<UsageSnapshot | null> {
    const s = await getJson<{ character_count: number; character_limit: number; tier: string }>(
      "/v1/user/subscription",
    );
    return { used: s.character_count, limit: s.character_limit, tier: s.tier };
  }
}

// --- Free metadata endpoints (no credits) ----------------------------------

export type ModelInfo = {
  model_id: string;
  name?: string;
  can_do_text_to_speech?: boolean;
  can_use_style?: boolean;
  can_use_speaker_boost?: boolean;
  requires_alpha_access?: boolean;
  maximum_text_length_per_request?: number;
  languages?: { language_id: string; name: string }[];
  model_rates?: { character_cost_multiplier: number; cost_discount_multiplier?: number };
};

export const listModels = () => getJson<ModelInfo[]>("/v1/models");

export type Subscription = {
  tier: string;
  status: string;
  character_count: number;
  character_limit: number;
  next_character_count_reset_unix?: number;
  voice_slots_used: number;
  voice_limit: number;
};

export const getSubscription = () => getJson<Subscription>("/v1/user/subscription");

export type LibraryVoice = {
  public_owner_id: string;
  voice_id: string;
  name: string;
  accent: string;
  gender: string;
  age: string;
  descriptive: string;
  use_case: string;
  category: string;
  language?: string;
  locale?: string;
  description?: string;
  preview_url?: string;
  usage_character_count_1y: number;
  cloned_by_count: number;
  rate?: number;
  fiat_rate?: number;
  free_users_allowed: boolean;
  live_moderation_enabled: boolean;
  verified_languages?: { language: string; model_id: string; accent?: string; locale?: string; preview_url?: string }[];
  notice_period?: number;
};

export const searchLibraryVoices = (params: Record<string, string | number | boolean>) => {
  const q = new URLSearchParams(
    Object.entries(params).map(([k, v]): [string, string] => [k, String(v)]),
  );
  return getJson<{ voices: LibraryVoice[]; has_more: boolean; total_count?: number }>(
    `/v1/shared-voices?${q.toString()}`,
  );
};

/** Voice usable by this account (own voices / saved library voices). */
export const getVoice = (voiceId: string) =>
  getJson<{ voice_id: string; name: string; category?: string }>(`/v1/voices/${encodeURIComponent(voiceId)}`);
