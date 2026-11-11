import { createReadStream, existsSync, realpathSync, statSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { extname, resolve, sep } from "node:path";
import { HttpError, SECURITY_HEADERS } from "./http.ts";

// Serving files safely: only paths that resolve (after following symlinks)
// inside an allowed root. Supports HTTP Range so the browser can seek video.

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".mp4": "video/mp4",
  ".wav": "audio/wav",
  ".srt": "text/plain; charset=utf-8",
  ".ico": "image/x-icon",
};

/** Returns the real path of `file` if it is inside `root` (also after resolving symlinks), else throws 403/404. */
export const insideRoot = (root: string, file: string): string => {
  const abs = resolve(file);
  const rootReal = realpathSync(resolve(root));
  if (!existsSync(abs)) throw new HttpError(404, "Không tìm thấy file.");
  const real = realpathSync(abs);
  if (real !== rootReal && !real.startsWith(rootReal + sep)) throw new HttpError(403, "Đường dẫn ngoài phạm vi cho phép.");
  if (!statSync(real).isFile()) throw new HttpError(404, "Không tìm thấy file.");
  return real;
};

export const serveFile = (req: IncomingMessage, res: ServerResponse, real: string, opts: { download?: string; cache?: string } = {}) => {
  const size = statSync(real).size;
  const type = TYPES[extname(real).toLowerCase()] ?? "application/octet-stream";
  const headers: Record<string, string | number> = {
    ...SECURITY_HEADERS,
    "Content-Type": type,
    "Accept-Ranges": "bytes",
    "Cache-Control": opts.cache ?? "no-cache",
  };
  if (opts.download) headers["Content-Disposition"] = `attachment; filename="${opts.download}"`;
  const range = req.headers.range;
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    let start = m && m[1] ? Number(m[1]) : NaN;
    let end = m && m[2] ? Number(m[2]) : NaN;
    if (m && !m[1] && m[2]) {
      start = Math.max(0, size - Number(m[2]));
      end = size - 1;
    } else if (m && m[1] && !m[2]) end = size - 1;
    if (!m || !Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) {
      res.writeHead(416, { ...SECURITY_HEADERS, "Content-Range": `bytes */${size}` });
      res.end();
      return;
    }
    end = Math.min(end, size - 1);
    res.writeHead(206, { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": end - start + 1 });
    if (req.method === "HEAD") return res.end();
    createReadStream(real, { start, end }).pipe(res);
    return;
  }
  res.writeHead(200, { ...headers, "Content-Length": size });
  if (req.method === "HEAD") return res.end();
  createReadStream(real).pipe(res);
};
