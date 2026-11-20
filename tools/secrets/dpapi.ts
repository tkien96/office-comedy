import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { withFileLockSync, writeFileAtomic } from "../episode/fsutil.ts";

// Local secret store for Office Comedy Studio and the CLI.
//
// Secrets (OAuth client secret, refresh token, Page access token) are
// encrypted with Windows DPAPI, scope CurrentUser: only the same Windows user
// on the same machine can decrypt them. There is no key file next to the data.
// The ciphertext lives in runtime/connections/secrets.dpapi.json (outside Git).
//
// Limits (documented in docs/social-connections.md):
//  - Another Windows user, another machine, or a reinstalled Windows cannot
//    decrypt → the connection must be made again. Studio never exports tokens.
//  - A process running as the same Windows user CAN decrypt (DPAPI protects
//    against other users and copied files, not against malware running as you).
//
// If DPAPI is unavailable (not Windows, PowerShell blocked…) every call throws
// SecretStoreError. There is NO plaintext fallback.
//
// PowerShell is started with a fixed script; data goes through stdin only
// (never on the command line, never in logs).

export class SecretStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecretStoreError";
  }
}

export const SECRETS_DIR = join("runtime", "connections");
export const SECRETS_FILE = join(SECRETS_DIR, "secrets.dpapi.json");
const LOCK = join(SECRETS_DIR, ".secrets.lock");

/** Optional DPAPI entropy: binds blobs to this purpose. It is NOT a key and adds no secrecy on its own. */
const ENTROPY = "office-comedy-studio/secrets/v1";

const PS_SCRIPT = [
  '$ErrorActionPreference="Stop"',
  "Add-Type -AssemblyName System.Security",
  "try {",
  "  $req = [Console]::In.ReadToEnd() | ConvertFrom-Json",
  `  $e = [Text.Encoding]::UTF8.GetBytes("${ENTROPY}")`,
  "  $out = New-Object System.Collections.ArrayList",
  "  foreach ($i in @($req.items)) {",
  "    $b = [Convert]::FromBase64String($i)",
  '    if ($req.op -eq "protect") { $r = [Security.Cryptography.ProtectedData]::Protect($b, $e, [Security.Cryptography.DataProtectionScope]::CurrentUser) }',
  "    else { $r = [Security.Cryptography.ProtectedData]::Unprotect($b, $e, [Security.Cryptography.DataProtectionScope]::CurrentUser) }",
  "    [void]$out.Add([Convert]::ToBase64String($r))",
  "  }",
  '  [Console]::Out.Write((ConvertTo-Json -Compress -InputObject @{ ok = $true; items = @($out) }))',
  "} catch {",
  '  [Console]::Out.Write((ConvertTo-Json -Compress -InputObject @{ ok = $false; kind = $_.Exception.GetType().Name }))',
  "}",
].join("\n");

const PS_ARGS = ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", PS_SCRIPT];
const PS_EXE = () => join(process.env.SystemRoot ?? "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");

type Op = "protect" | "unprotect";

const testForcedUnavailable = () => process.env.STUDIO_TEST === "1" && process.env.STUDIO_SECRET_STORE === "unavailable";

const unavailable = (why: string) =>
  new SecretStoreError(`Không mở được kho bí mật Windows (DPAPI) dưới tài khoản Windows hiện tại: ${why}. Studio không lưu bí mật dạng văn bản thường để thay thế.`);

const parse = (stdout: string, op: Op, n: number): string[] => {
  let r: { ok: boolean; items?: string[] | string; kind?: string };
  try {
    r = JSON.parse(stdout.trim());
  } catch {
    throw unavailable("PowerShell không trả kết quả hợp lệ");
  }
  if (!r.ok) {
    if (op === "unprotect") throw new SecretStoreError("Không giải mã được bí mật đã lưu: có thể dữ liệu được tạo dưới tài khoản Windows khác hoặc trên máy khác. Hãy kết nối lại trong Studio.");
    throw unavailable(r.kind ?? "lỗi không rõ");
  }
  const items = Array.isArray(r.items) ? r.items : r.items ? [r.items] : [];
  if (items.length !== n) throw unavailable("số kết quả không khớp");
  return items;
};

const payload = (op: Op, items: string[]) => JSON.stringify({ op, items });

const checkPlatform = () => {
  if (testForcedUnavailable()) throw unavailable("kho bí mật bị tắt trong chế độ kiểm thử");
  if (process.platform !== "win32") throw unavailable("chỉ hỗ trợ Windows");
};

/** Synchronous DPAPI call (CLI, dry-run). */
const dpapiSync = (op: Op, b64: string[]): string[] => {
  if (!b64.length) return [];
  checkPlatform();
  const r = spawnSync(PS_EXE(), PS_ARGS, { input: payload(op, b64), encoding: "utf8", windowsHide: true, timeout: 30_000, maxBuffer: 8 * 1024 * 1024 });
  if (r.error || r.status !== 0) throw unavailable(r.error ? r.error.message.replace(/\s+/g, " ") : `PowerShell thoát mã ${r.status}`);
  return parse(r.stdout, op, b64.length);
};

/** Async DPAPI call (Studio server: does not block other requests). */
const dpapi = (op: Op, b64: string[]): Promise<string[]> =>
  new Promise((resolve, reject) => {
    if (!b64.length) return resolve([]);
    try {
      checkPlatform();
    } catch (e) {
      return reject(e);
    }
    const p = spawn(PS_EXE(), PS_ARGS, { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    const timer = setTimeout(() => p.kill(), 30_000);
    p.stdout.setEncoding("utf8").on("data", (d: string) => (out += d));
    p.stderr.resume();
    p.on("error", (e) => {
      clearTimeout(timer);
      reject(unavailable(e.message));
    });
    p.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) return reject(unavailable(`PowerShell thoát mã ${code}`));
      try {
        resolve(parse(out, op, b64.length));
      } catch (e) {
        reject(e);
      }
    });
    p.stdin.end(payload(op, b64));
  });

// ---- Store file -------------------------------------------------------------

type StoreFile = { version: 1; entries: Record<string, { blob: string; createdAt: string; label: string }> };

const readStore = (): StoreFile => (existsSync(SECRETS_FILE) ? (JSON.parse(readFileSync(SECRETS_FILE, "utf8")) as StoreFile) : { version: 1, entries: {} });
const writeStore = (s: StoreFile) => writeFileAtomic(SECRETS_FILE, JSON.stringify(s, null, 2) + "\n");

const toB64 = (s: string) => Buffer.from(s, "utf8").toString("base64");
const fromB64 = (s: string) => Buffer.from(s, "base64").toString("utf8");

export type SecretBundle = Record<string, string>;

/**
 * Encrypts a bundle (e.g. {clientId, clientSecret, refreshToken}) as ONE entry
 * under a NEW id. Entries are never overwritten in place: callers point the
 * metadata at the new id first, then delete the old id. A crash in between
 * leaves an unreferenced entry (cleaned by pruneSecrets), never a broken link.
 */
export const putSecret = async (label: string, bundle: SecretBundle): Promise<string> => {
  const [blob] = await dpapi("protect", [toB64(JSON.stringify(bundle))]);
  const id = `s-${randomBytes(8).toString("hex")}`;
  withFileLockSync(LOCK, "studio", "kho bí mật", () => {
    const s = readStore();
    s.entries[id] = { blob, createdAt: new Date().toISOString(), label };
    writeStore(s);
  });
  return id;
};

export const hasSecret = (id: string | null | undefined) => Boolean(id && readStore().entries[id]);

export const getSecret = async (id: string): Promise<SecretBundle> => {
  const e = readStore().entries[id];
  if (!e) throw new SecretStoreError("Không tìm thấy bí mật đã lưu (có thể đã bị gỡ). Hãy kết nối lại.");
  const [plain] = await dpapi("unprotect", [e.blob]);
  return JSON.parse(fromB64(plain)) as SecretBundle;
};

export const getSecretSync = (id: string): SecretBundle => {
  const e = readStore().entries[id];
  if (!e) throw new SecretStoreError("Không tìm thấy bí mật đã lưu (có thể đã bị gỡ). Hãy kết nối lại.");
  const [plain] = dpapiSync("unprotect", [e.blob]);
  return JSON.parse(fromB64(plain)) as SecretBundle;
};

export const deleteSecret = (id: string | null | undefined) => {
  if (!id) return;
  withFileLockSync(LOCK, "studio", "kho bí mật", () => {
    const s = readStore();
    if (!s.entries[id]) return;
    delete s.entries[id];
    writeStore(s);
  });
};

/** Removes entries no metadata refers to (left over by a crash between the two writes). */
export const pruneSecrets = (referenced: Set<string>) =>
  withFileLockSync(LOCK, "studio", "kho bí mật", () => {
    const s = readStore();
    const drop = Object.keys(s.entries).filter((id) => !referenced.has(id));
    if (!drop.length) return 0;
    for (const id of drop) delete s.entries[id];
    writeStore(s);
    return drop.length;
  });

/** Round-trip self test (no stored data touched). */
export const secretStoreHealth = async (): Promise<{ ok: boolean; message: string }> => {
  try {
    const probe = randomBytes(12).toString("hex");
    const [blob] = await dpapi("protect", [toB64(probe)]);
    const [back] = await dpapi("unprotect", [blob]);
    return fromB64(back) === probe ? { ok: true, message: "Kho bí mật Windows (DPAPI, theo tài khoản người dùng) hoạt động." } : { ok: false, message: "Kho bí mật trả sai dữ liệu khi tự kiểm tra." };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
};
