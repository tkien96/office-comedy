// Provider-neutral TTS types. Swap providers by implementing TtsProvider.

export type VoiceSettings = Record<string, number | boolean | string>;

export type TtsRequest = {
  text: string;
  voiceId: string;
  modelId: string;
  /** ISO 639-1, e.g. "vi". */
  languageCode: string;
  /** Every setting that changes the audio. Part of the cache key. */
  settings: VoiceSettings;
  seed: number | null;
  outputFormat: string;
};

/** Character-level timing, as returned by the provider. */
export type Alignment = {
  characters: string[];
  startSeconds: number[];
  endSeconds: number[];
};

export type TtsAudio = {
  audio: Buffer;
  /** File extension for `audio`, e.g. "mp3". */
  extension: string;
  alignment: Alignment | null;
  normalizedAlignment: Alignment | null;
  /** Word/sentence timing for providers that report boundaries instead of characters. */
  boundaries: Boundary[] | null;
  /** SRT produced by the provider, if any. */
  srt: string | null;
};

export type Boundary = {
  type: "WordBoundary" | "SentenceBoundary";
  text: string;
  start: number;
  end: number;
};

/** "other" = not worth retrying (bad input, missing tool, unknown failure). */
export type ProviderErrorKind = "timeout" | "network" | "http" | "other";

export class ProviderError extends Error {
  readonly kind: ProviderErrorKind;
  readonly status: number | null;
  readonly retryable: boolean;
  constructor(kind: ProviderErrorKind, message: string, status: number | null = null) {
    super(message);
    this.kind = kind;
    this.status = status;
    this.retryable =
      kind === "timeout" ||
      kind === "network" ||
      (kind === "http" &&
        (status === 408 || status === 409 || status === 429 || (status !== null && status >= 500)));
  }
}

export type UsageSnapshot = {
  /** Provider counter of characters/credits used this period. */
  used: number;
  limit: number;
  tier: string;
};

export interface TtsProvider {
  readonly id: string;
  synthesize(req: TtsRequest, timeoutMs: number): Promise<TtsAudio>;
  /** Free metadata call used to measure real consumption. */
  usage(): Promise<UsageSnapshot | null>;
}
