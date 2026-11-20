// Entry point for the Studio server (plain JavaScript on purpose): checks the
// Node version BEFORE loading any .ts file, so an old Node gets a readable
// message instead of a TypeScript syntax error.
//
// The server and tools run TypeScript directly with Node's built-in type
// stripping (unflagged since Node 22.18 / 23.6) and use zlib.crc32
// (Node 22.2+) and --env-file-if-exists (Node 22.9+).

export const MIN_NODE = [22, 18, 0];

const cur = process.versions.node.split(".").map(Number);
const tooOld = cur[0] < MIN_NODE[0] || (cur[0] === MIN_NODE[0] && (cur[1] < MIN_NODE[1] || (cur[1] === MIN_NODE[1] && cur[2] < MIN_NODE[2])));
const typeStripping = process.features?.typescript !== undefined ? Boolean(process.features.typescript) : !tooOld;

if (tooOld || !typeStripping) {
  console.error(
    `Office Comedy Studio cần Node ${MIN_NODE.join(".")} trở lên (đang dùng ${process.versions.node}).` +
      (typeStripping ? "" : " Node này không chạy được file TypeScript trực tiếp.") +
      "\nCài Node 24 LTS (ví dụ: nvm install 24 && nvm use 24), rồi chạy lại.",
  );
  process.exit(1);
}

if (!process.argv.includes("--check-node")) await import("./server/main.ts");
