// Office Comedy Studio — local backend.
//   npm run studio        (build the web UI, then start)
//   npm run studio:serve  (start only; needs studio/dist from npm run studio:build)
//
// Listens on 127.0.0.1 only. Serves the built UI from studio/dist and a JSON
// API that reuses tools/episode + tools/publish. Data stays in the episode
// folders (episode.json, social.json, publishing/jobs.json); background task
// records go to runtime/studio/ (operational data only).
import { existsSync, realpathSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { handleApiError, ROUTES } from "./api.ts";
import { insideRoot, serveFile } from "./files.ts";
import { HttpError, SECURITY_HEADERS } from "./http.ts";
import { loadTasks } from "./tasks.ts";
import { loadAiConfig } from "../../tools/ai/config.ts";
import { handleOAuthCallback, isOAuthCallback } from "./oauth.ts";
import { refreshStoreHealth } from "./socialapi.ts";
import { referencedSecrets } from "../../tools/publish/connections.ts";
import { pruneSecrets } from "../../tools/secrets/dpapi.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
process.chdir(ROOT); // tools use paths relative to the project root

const HOST = "127.0.0.1";
const PORT = Number(process.env.STUDIO_PORT ?? 5178);
const DIST = join(ROOT, "studio", "dist");
const ALLOWED_HOSTS = new Set([`127.0.0.1:${PORT}`, `localhost:${PORT}`]);
const ALLOWED_ORIGINS = new Set([`http://127.0.0.1:${PORT}`, `http://localhost:${PORT}`]);

if (!existsSync(join(DIST, "index.html"))) {
  console.error("Chưa có giao diện đã build (studio/dist). Chạy: npm run studio (hoặc npm run studio:build).");
  process.exit(1);
}
loadTasks({ aiConcurrency: loadAiConfig().maxConcurrentJobs });
// Secret entries no metadata points to (a crash between the two writes) are removed.
try {
  const n = pruneSecrets(referencedSecrets());
  if (n) console.log(`Đã dọn ${n} bí mật mồ côi trong kho (không còn kết nối nào trỏ tới).`);
} catch (e) {
  console.error(`Không dọn được kho bí mật: ${(e as Error).message}`);
}
void refreshStoreHealth();

const server = createServer(async (req, res) => {
  try {
    // DNS-rebinding guard: only our own host names.
    if (!ALLOWED_HOSTS.has(req.headers.host ?? "")) throw new HttpError(403, "Host không hợp lệ.");
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    const method = req.method ?? "GET";

    if (url.pathname.startsWith("/api/")) {
      // Changes need a same-origin browser request with our custom header (CSRF guard).
      if (!["GET", "HEAD"].includes(method)) {
        if (!ALLOWED_ORIGINS.has(req.headers.origin ?? "")) throw new HttpError(403, "Origin không hợp lệ.");
        if (req.headers["x-studio"] !== "1") throw new HttpError(403, "Thiếu header xác nhận của Studio.");
      }
      const route = ROUTES.find((r) => r.method === (method === "HEAD" ? "GET" : method) && r.re.test(url.pathname));
      if (!route) {
        const exists = ROUTES.some((r) => r.re.test(url.pathname));
        throw new HttpError(exists ? 405 : 404, exists ? "Phương thức không được hỗ trợ." : "Không có API này.");
      }
      await route.handler(req, res, url.pathname.match(route.re)!);
      return;
    }

    // Google OAuth redirect (loopback): protected by one-time state + cookie, not by Origin (it is a cross-site navigation).
    if (method === "GET" && isOAuthCallback(url)) return await handleOAuthCallback(req, res, url);

    if (!["GET", "HEAD"].includes(method)) throw new HttpError(405, "Phương thức không được hỗ trợ.");
    // Static UI: only files inside studio/dist; everything else falls back to index.html (hash routing).
    const rel = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    const candidate = rel && !rel.includes("\0") ? join(DIST, rel) : join(DIST, "index.html");
    let real: string;
    try {
      real = insideRoot(DIST, candidate);
    } catch (e) {
      if (e instanceof HttpError && e.status === 403) throw e;
      real = realpathSync(join(DIST, "index.html"));
    }
    serveFile(req, res, real);
  } catch (e) {
    if (e instanceof HttpError && !req.url?.startsWith("/api/")) {
      if (res.headersSent) return res.destroy();
      res.writeHead(e.status, { ...SECURITY_HEADERS, "Content-Type": "text/plain; charset=utf-8" });
      res.end(e.message);
      return;
    }
    handleApiError(res, e);
  }
});

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Cổng ${PORT} đang bận. Có thể Studio đã chạy (mở http://127.0.0.1:${PORT}) hoặc ứng dụng khác dùng cổng này.`);
    console.error("Đổi cổng: đặt biến STUDIO_PORT, ví dụ  $env:STUDIO_PORT=5180; npm run studio:serve");
  } else console.error(`Không khởi động được: ${err.message}`);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`Office Comedy Studio đang chạy: http://127.0.0.1:${PORT}`);
  console.log("Chỉ truy cập được từ máy này. Dừng: Ctrl+C.");
});

