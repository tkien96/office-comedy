import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { cacheKey, entryDir, readCache, writeCache, type CacheMeta } from "./cache.ts";
import { appendLedger, assertBudget } from "./ledger.ts";
import { ProviderError, type TtsProvider, type TtsRequest } from "./types.ts";

export type SynthOptions = {
  campaign: string;
  /** Max characters sent to the API for this campaign, retries included. */
  budgetChars: number;
  label: string;
  /** Total attempts per item (1 = no retry). */
  maxAttempts: number;
  timeoutMs: number;
};

export type SynthResult = { meta: CacheMeta; fromCache: boolean };

export const probeDuration = (file: string): number | null => {
  try {
    const out = execFileSync(
      "ffprobe",
      ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file],
      { encoding: "utf8" },
    );
    const d = parseFloat(out.trim());
    return Number.isFinite(d) ? d : null;
  } catch {
    return null;
  }
};

const safeUsage = async (p: TtsProvider) => {
  try {
    return (await p.usage())?.used ?? null;
  } catch {
    return null;
  }
};

export const synthesize = async (
  provider: TtsProvider,
  req: TtsRequest,
  opt: SynthOptions,
): Promise<SynthResult> => {
  const key = cacheKey(provider.id, req);
  const cached = readCache(key);
  if (cached) return { meta: cached, fromCache: true };

  const chars = [...req.text].length;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= opt.maxAttempts; attempt++) {
    // Budget is checked before EVERY attempt, retries included.
    assertBudget(opt.campaign, opt.budgetChars, chars);
    const before = await safeUsage(provider);
    const base = {
      at: new Date().toISOString(),
      campaign: opt.campaign,
      provider: provider.id,
      modelId: req.modelId,
      voiceId: req.voiceId,
      cacheKey: key,
      label: opt.label,
      attempt,
      charsSent: chars,
      usageBefore: before,
    };
    try {
      const out = await provider.synthesize(req, opt.timeoutMs);
      const after = await safeUsage(provider);
      const audioFile = `audio.${out.extension}`;
      const meta: CacheMeta = {
        key,
        provider: provider.id,
        request: req,
        audioFile,
        createdAt: base.at,
        durationSeconds: null,
        charsSent: chars,
        usageDelta: before !== null && after !== null ? after - before : null,
        alignment: out.alignment,
        normalizedAlignment: out.normalizedAlignment,
        boundaries: out.boundaries,
        srtFile: out.srt !== null ? "subtitles.srt" : null,
      };
      writeCache(meta, out.audio, out.srt);
      meta.durationSeconds = probeDuration(join(entryDir(key), audioFile));
      writeCache(meta, out.audio, out.srt);
      appendLedger({
        ...base,
        status: "ok",
        httpStatus: 200,
        error: null,
        usageAfter: after,
        usageDelta: meta.usageDelta,
        durationSeconds: meta.durationSeconds,
      });
      return { meta, fromCache: false };
    } catch (err) {
      lastError = err;
      const after = await safeUsage(provider);
      const pe = err instanceof ProviderError ? err : null;
      appendLedger({
        ...base,
        status: pe && (pe.kind === "timeout" || pe.kind === "network") ? pe.kind : "error",
        httpStatus: pe?.status ?? null,
        error: (err as Error).message.slice(0, 300),
        usageAfter: after,
        usageDelta: before !== null && after !== null ? after - before : null,
        durationSeconds: null,
      });
      if (!pe || !pe.retryable) break;
      // Short linear backoff before the next (budget-checked) attempt.
      if (attempt < opt.maxAttempts) await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  throw lastError;
};
