import Anthropic from "@anthropic-ai/sdk";
import { getApiKey, loadAiConfig, type AiConfig } from "./config.ts";
import { AiError, sleep, type AiProvider, type AiRequest, type AiResult, type AiUsage } from "./provider.ts";

// Claude adapter (official @anthropic-ai/sdk). One Messages API call returns
// JSON constrained by a schema (output_config.format). No tools, no shell.
//
// Retries are OURS, not the SDK's (maxRetries: 0), so billing risk is explicit:
//  - 429 rate limit / 529 overloaded: the request was not processed → retry
//    with backoff, at most maxRateLimitRetries times.
//  - timeout: the request MAY have been processed (and billed) → never retried
//    automatically; the user decides.
// Refusals: server-side fallbacks ("default") let the API re-run a declined
// request on a fallback model inside the same call.

const FALLBACK_BETA = "server-side-fallback-2026-07-01";

const toUsage = (msg: Anthropic.Beta.BetaMessage): AiUsage => {
  const u = msg.usage;
  const iterations = (u.iterations ?? [])
    .filter((i): i is Anthropic.Beta.BetaMessageIterationUsage | Anthropic.Beta.BetaFallbackMessageIterationUsage => "model" in i && typeof i.model === "string")
    .map((i) => ({ model: i.model as string, inputTokens: i.input_tokens, outputTokens: i.output_tokens }));
  return {
    model: msg.model,
    inputTokens: u.input_tokens,
    outputTokens: u.output_tokens,
    cacheReadTokens: u.cache_read_input_tokens ?? 0,
    cacheWriteTokens: u.cache_creation_input_tokens ?? 0,
    ...(iterations.length > 1 ? { iterations } : {}),
  };
};

export class ClaudeProvider implements AiProvider {
  readonly name = "claude" as const;
  private client: Anthropic;
  private cfg: AiConfig;

  constructor(cfg: AiConfig = loadAiConfig()) {
    const apiKey = getApiKey();
    if (!apiKey) throw new AiError("not_configured", "Chưa cấu hình Claude: thiếu ANTHROPIC_API_KEY trong file .env.");
    if (!(cfg.model in cfg.pricingUsdPerMTok)) throw new AiError("not_configured", `Model "${cfg.model}" không có trong config/studio.json.`);
    this.cfg = cfg;
    // Explicit key: only the project's .env key is used (no other credential source).
    this.client = new Anthropic({ apiKey, maxRetries: 0, timeout: cfg.timeoutMs });
  }

  async generate(req: AiRequest): Promise<AiResult> {
    let rateLimitRetries = 0;
    for (;;) {
      try {
        const stream = this.client.beta.messages.stream(
          {
            model: this.cfg.model,
            max_tokens: this.cfg.maxTokens,
            system: req.system,
            messages: [{ role: "user", content: req.user }],
            output_config: { effort: this.cfg.effort, format: { type: "json_schema", schema: req.schema } },
            ...(this.cfg.fallbacks === "default" ? { betas: [FALLBACK_BETA], fallbacks: "default" as const } : {}),
          },
          { signal: req.signal },
        );
        const msg = await stream.finalMessage();
        const usage = toUsage(msg);
        const fallbackUsed = msg.content.some((b) => b.type === "fallback");
        if (msg.stop_reason === "refusal")
          throw new AiError("refusal", `Claude từ chối yêu cầu này${msg.stop_details?.category ? ` (nhóm: ${msg.stop_details.category})` : ""}. Thử diễn đạt lại ý tưởng.`, {
            mayHaveBeenProcessed: true,
            usage,
          });
        if (msg.stop_reason === "max_tokens") throw new AiError("truncated", "Kết quả bị cắt vì chạm giới hạn độ dài (maxTokens). Thử lại hoặc tăng maxTokens trong config/studio.json.", { mayHaveBeenProcessed: true, usage });
        const text = msg.content
          .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
          .map((b) => b.text)
          .join("");
        let json: unknown;
        try {
          json = JSON.parse(text);
        } catch {
          throw new AiError("invalid_output", "Claude trả về dữ liệu không phải JSON hợp lệ.", { mayHaveBeenProcessed: true, usage });
        }
        return { json, usage, model: msg.model, fallbackUsed, rateLimitRetries };
      } catch (e) {
        if (e instanceof AiError) throw e;
        // Most specific first (APIConnectionTimeoutError ⊂ APIConnectionError ⊂ APIError).
        if (e instanceof Anthropic.APIUserAbortError || req.signal.aborted) throw new AiError("cancelled", "Đã huỷ.", { mayHaveBeenProcessed: true });
        if (e instanceof Anthropic.APIConnectionTimeoutError)
          throw new AiError(
            "timeout_unknown",
            `Hết ${Math.round(this.cfg.timeoutMs / 1000)} giây chờ mà chưa có kết quả. Không biết Claude đã xử lý yêu cầu hay chưa (có thể đã tính phí), nên Studio không tự gửi lại.`,
            { mayHaveBeenProcessed: true },
          );
        if (e instanceof Anthropic.APIConnectionError)
          throw new AiError("network", "Lỗi kết nối tới Claude API (mạng). Yêu cầu có thể chưa tới máy chủ hoặc đã tới; Studio không tự gửi lại.", { mayHaveBeenProcessed: true });
        if (e instanceof Anthropic.AuthenticationError) throw new AiError("auth", "Khóa API bị từ chối (401). Kiểm tra ANTHROPIC_API_KEY trong .env.");
        if (e instanceof Anthropic.PermissionDeniedError) throw new AiError("auth", "Khóa API không có quyền dùng model hoặc tính năng này (403).");
        if (e instanceof Anthropic.BadRequestError) throw new AiError("bad_request", `Yêu cầu không hợp lệ (400): ${e.message.slice(0, 300)}`);
        const retryable = e instanceof Anthropic.RateLimitError || (e instanceof Anthropic.APIError && (e.status === 529 || e.status === 503));
        if (retryable && rateLimitRetries < this.cfg.maxRateLimitRetries) {
          rateLimitRetries++;
          const ra = Number((e as InstanceType<typeof Anthropic.APIError>).headers?.get?.("retry-after"));
          await sleep(Number.isFinite(ra) && ra > 0 ? Math.min(ra, 60) * 1000 : 2000 * 2 ** rateLimitRetries, req.signal);
          continue;
        }
        if (e instanceof Anthropic.RateLimitError) throw new AiError("rate_limit", `Claude API báo vượt giới hạn tốc độ (429) sau ${rateLimitRetries} lần thử lại. Yêu cầu chưa được xử lý; thử lại sau.`);
        if (e instanceof Anthropic.APIError) {
          const busy = e.status === 529 || e.status === 503;
          throw new AiError(busy ? "overloaded" : "network", busy ? "Claude API đang quá tải. Thử lại sau." : `Claude API lỗi ${e.status ?? ""}: ${e.message.slice(0, 200)}`, { mayHaveBeenProcessed: !busy });
        }
        throw new AiError("network", `Lỗi không xác định khi gọi Claude: ${(e as Error).message}`, { mayHaveBeenProcessed: true });
      }
    }
  }
}
