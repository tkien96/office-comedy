// Provider-neutral contract for the text-generation step. The episode/script
// logic only talks to this interface; tools/ai/claude.ts implements it with
// the official Anthropic SDK, tools/ai/mock.ts only exists for tests.
// The model gets text in and JSON out: no tools, no shell, no file access.

export type AiUsage = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  /** Per-model breakdown when a refusal fallback ran on another model. */
  iterations?: { model: string; inputTokens: number; outputTokens: number }[];
};

export type AiRequest = {
  /** Kind of call, for logging only. */
  purpose: "ideas" | "draft" | "revise" | "repair";
  system: string;
  user: string;
  schema: Record<string, unknown>;
  signal: AbortSignal;
};

export type AiResult = { json: unknown; usage: AiUsage | null; model: string; fallbackUsed: boolean; rateLimitRetries: number };

export type AiErrorKind =
  | "not_configured" // no key / unknown model
  | "auth" // key rejected (401/403)
  | "rate_limit" // 429 after the allowed retries — request was NOT processed
  | "overloaded" // 529/5xx after retries
  | "timeout_unknown" // no answer in time: the request MAY have been processed (and billed)
  | "network" // connection failed: may or may not have reached the API
  | "bad_request" // 400: our request was wrong
  | "refusal" // model declined (stop_reason refusal), fallbacks included
  | "truncated" // hit max_tokens: output incomplete
  | "invalid_output" // JSON could not be parsed
  | "cancelled"; // user cancelled

export class AiError extends Error {
  kind: AiErrorKind;
  /** True when the request may have been processed (so a retry may be billed twice). */
  mayHaveBeenProcessed: boolean;
  usage: AiUsage | null;
  constructor(kind: AiErrorKind, message: string, opts: { mayHaveBeenProcessed?: boolean; usage?: AiUsage | null } = {}) {
    super(message);
    this.kind = kind;
    this.mayHaveBeenProcessed = opts.mayHaveBeenProcessed ?? false;
    this.usage = opts.usage ?? null;
  }
}

export interface AiProvider {
  readonly name: "claude" | "mock";
  generate(req: AiRequest): Promise<AiResult>;
}

/** Abortable sleep (used for rate-limit backoff). */
export const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(new AiError("cancelled", "Đã huỷ."));
    const t = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new AiError("cancelled", "Đã huỷ."));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
