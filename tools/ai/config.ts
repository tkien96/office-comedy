import { existsSync, readFileSync } from "node:fs";
import type { AiUsage } from "./provider.ts";

// AI configuration (server side only). The key comes from ANTHROPIC_API_KEY
// in .env; it is never returned by any function here except getApiKey(), which
// only the Claude adapter calls.

export type Price = { input: number; output: number; cacheRead?: number; cacheWrite?: number };
export type AiConfig = {
  model: string;
  effort: "low" | "medium" | "high" | "xhigh" | "max";
  maxTokens: number;
  timeoutMs: number;
  maxRateLimitRetries: number;
  maxRepairAttempts: number;
  maxConcurrentJobs: number;
  fallbacks: "default" | "off";
  pricingAsOf: string;
  pricingUsdPerMTok: Record<string, Price>;
};

const DEFAULTS: AiConfig = {
  model: "claude-opus-5-5",
  effort: "medium",
  maxTokens: 16000,
  timeoutMs: 300_000,
  maxRateLimitRetries: 2,
  maxRepairAttempts: 1,
  maxConcurrentJobs: 1,
  fallbacks: "default",
  pricingAsOf: "",
  pricingUsdPerMTok: {},
};

export const loadAiConfig = (): AiConfig => {
  const file = "config/studio.json";
  const raw = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as { claude?: Partial<AiConfig> }).claude ?? {} : {};
  const c = { ...DEFAULTS, ...raw };
  // Hard limits so a config typo can't create unbounded work or cost.
  c.maxTokens = Math.min(Math.max(1024, c.maxTokens), 32000);
  c.timeoutMs = Math.min(Math.max(30_000, c.timeoutMs), 900_000);
  c.maxRateLimitRetries = Math.min(Math.max(0, c.maxRateLimitRetries), 3);
  c.maxRepairAttempts = Math.min(Math.max(0, c.maxRepairAttempts), 2);
  c.maxConcurrentJobs = Math.min(Math.max(1, c.maxConcurrentJobs), 2);
  return c;
};

/** Test-only mock provider: needs BOTH variables, so it can't switch on by accident. */
export const mockScenarioFile = () => (process.env.STUDIO_TEST === "1" && process.env.STUDIO_AI_MOCK ? process.env.STUDIO_AI_MOCK : null);

export const getApiKey = () => process.env.ANTHROPIC_API_KEY?.trim() || null;

export type AiStatus = {
  provider: "claude" | "mock";
  configured: boolean;
  keyPresent: boolean;
  model: string;
  modelKnown: boolean;
  effort: string;
  problems: string[];
};

/** Browser-safe status: never contains the key. */
export const aiStatus = (): AiStatus => {
  const c = loadAiConfig();
  const mock = mockScenarioFile();
  const keyPresent = Boolean(getApiKey());
  const modelKnown = c.model in c.pricingUsdPerMTok;
  const problems: string[] = [];
  if (!mock && !keyPresent) problems.push("Chưa có ANTHROPIC_API_KEY trong file .env của dự án.");
  if (!modelKnown) problems.push(`Model "${c.model}" không có trong danh sách model đã khai báo (config/studio.json).`);
  return { provider: mock ? "mock" : "claude", configured: (Boolean(mock) || keyPresent) && modelKnown, keyPresent, model: c.model, modelKnown, effort: c.effort, problems };
};

export type CostEstimate = { kind: "estimated" | "unknown"; usd: number | null; note: string };

/**
 * Cost from the token counts the API returned × the configured public prices.
 * Always an ESTIMATE (the API does not return billed amounts). Unknown when
 * usage is missing or a needed price is not configured — never reported as 0.
 */
export const estimateCost = (usage: AiUsage | null, c: AiConfig = loadAiConfig()): CostEstimate => {
  if (!usage) return { kind: "unknown", usd: null, note: "API không trả số token (lỗi hoặc huỷ trước khi có kết quả)." };
  const parts = usage.iterations?.length ? usage.iterations.map((i) => ({ ...i, cacheReadTokens: 0, cacheWriteTokens: 0 })) : [usage];
  let usd = 0;
  for (const p of parts) {
    const price = c.pricingUsdPerMTok[p.model];
    if (!price) return { kind: "unknown", usd: null, note: `Chưa khai báo giá cho model ${p.model}.` };
    usd += (p.inputTokens * price.input + p.outputTokens * price.output) / 1e6;
    if (p.cacheReadTokens) {
      if (price.cacheRead === undefined) return { kind: "unknown", usd: null, note: `Chưa khai báo giá đọc cache cho ${p.model}.` };
      usd += (p.cacheReadTokens * price.cacheRead) / 1e6;
    }
    if (p.cacheWriteTokens) {
      if (price.cacheWrite === undefined) return { kind: "unknown", usd: null, note: `Chưa khai báo giá ghi cache cho ${p.model}.` };
      usd += (p.cacheWriteTokens * price.cacheWrite) / 1e6;
    }
  }
  return { kind: "estimated", usd: Math.round(usd * 10000) / 10000, note: `Ước tính theo bảng giá công bố ${c.pricingAsOf}; hoá đơn thật xem ở Claude Console.` };
};
