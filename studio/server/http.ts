import type { IncomingMessage, ServerResponse } from "node:http";

// Small HTTP helpers for the Studio backend (no framework).

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; media-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
};

export const sendJson = (res: ServerResponse, status: number, body: unknown) => {
  const data = JSON.stringify(body);
  res.writeHead(status, { ...SECURITY_HEADERS, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Content-Length": Buffer.byteLength(data) });
  res.end(data);
};

export const sendError = (res: ServerResponse, status: number, message: string, extra: Record<string, unknown> = {}) =>
  sendJson(res, status, { error: message, ...extra });

const MAX_BODY = 256 * 1024;

export const readJsonBody = async (req: IncomingMessage): Promise<Record<string, unknown>> => {
  const ct = req.headers["content-type"] ?? "";
  if (!ct.startsWith("application/json")) throw new HttpError(415, "Yêu cầu phải là JSON.");
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > MAX_BODY) throw new HttpError(413, "Dữ liệu gửi lên quá lớn.");
    chunks.push(c as Buffer);
  }
  if (!size) return {};
  try {
    const v = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error();
    return v as Record<string, unknown>;
  } catch {
    throw new HttpError(400, "JSON không hợp lệ.");
  }
};

export const str = (v: unknown, field: string, max = 200): string => {
  if (typeof v !== "string" || !v || v.length > max) throw new HttpError(400, `Thiếu hoặc sai "${field}".`);
  return v;
};
