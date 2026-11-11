import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { TTS_DIR } from "./cache.ts";

// Append-only ledger of every attempt sent to a paid API.
// Budget rule: every attempt that leaves this machine counts in full,
// including failures and timeouts (we cannot prove they were free).
// Cache hits are never sent and never counted.

const LEDGER = join(TTS_DIR, "ledger.jsonl");

export type LedgerEntry = {
  at: string;
  campaign: string;
  provider: string;
  modelId: string;
  voiceId: string;
  cacheKey: string;
  label: string;
  attempt: number;
  charsSent: number;
  status: "ok" | "error" | "timeout" | "network";
  httpStatus: number | null;
  error: string | null;
  usageBefore: number | null;
  usageAfter: number | null;
  /** usageAfter - usageBefore, measured from the provider (null = unknown). */
  usageDelta: number | null;
  durationSeconds: number | null;
};

export const readLedger = (): LedgerEntry[] =>
  existsSync(LEDGER)
    ? readFileSync(LEDGER, "utf8")
        .split("\n")
        .filter(Boolean)
        .map((l) => JSON.parse(l) as LedgerEntry)
    : [];

export const appendLedger = (e: LedgerEntry) => {
  mkdirSync(TTS_DIR, { recursive: true });
  appendFileSync(LEDGER, JSON.stringify(e) + "\n");
};

export const spentChars = (campaign: string) =>
  readLedger()
    .filter((e) => e.campaign === campaign)
    .reduce((s, e) => s + e.charsSent, 0);

export class BudgetError extends Error {}

/** Throws BEFORE a request if it could push the campaign over budget. */
export const assertBudget = (campaign: string, budget: number, chars: number) => {
  const spent = spentChars(campaign);
  if (spent + chars > budget) {
    throw new BudgetError(
      `Dừng trước khi gọi API: chiến dịch "${campaign}" đã dùng ${spent}/${budget} ký tự, request này cần ${chars}.`,
    );
  }
  return spent;
};
