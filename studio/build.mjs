// Builds the Studio web UI into studio/dist (React + TypeScript via esbuild,
// which the project already has through Remotion). No dev server, no CDN.
//   node studio/build.mjs
import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, "dist");

let esbuild;
try {
  esbuild = await import("esbuild");
} catch {
  console.error("Thiếu esbuild trong node_modules. Chạy một lần: npm install");
  process.exit(1);
}

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
await esbuild.build({
  entryPoints: [join(here, "web", "src", "main.tsx")],
  bundle: true,
  minify: true,
  sourcemap: false,
  format: "iife",
  target: ["chrome110", "edge110", "firefox110"],
  jsx: "automatic",
  outfile: join(dist, "app.js"),
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "warning",
});
copyFileSync(join(here, "web", "styles.css"), join(dist, "app.css"));
copyFileSync(join(here, "web", "index.html"), join(dist, "index.html"));
console.log("Đã build giao diện Studio → studio/dist");
