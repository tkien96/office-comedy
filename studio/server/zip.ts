import { createReadStream, statSync } from "node:fs";
import type { Writable } from "node:stream";
import { crc32 } from "node:zlib";

// Minimal streaming ZIP writer (STORE, no compression — the video is already
// compressed). Uses data descriptors so files are streamed once. UTF-8 names.
// Limits: < 4 GB per file and in total (no ZIP64), enough for a delivery set.

const u16 = (n: number) => {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n);
  return b;
};
const u32 = (n: number) => {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0);
  return b;
};

const dosTime = (d: Date) => {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time, date };
};

const write = (out: Writable, buf: Buffer) =>
  new Promise<void>((resolve, reject) => {
    if (out.write(buf)) resolve();
    else {
      out.once("drain", resolve);
      out.once("error", reject);
    }
  });

export const writeZip = async (out: Writable, entries: { name: string; path: string }[]) => {
  const central: Buffer[] = [];
  let offset = 0;
  const total = entries.reduce((s, e) => s + statSync(e.path).size, 0);
  if (total > 0xfffffff0) throw new Error("Bộ quá lớn cho ZIP không có ZIP64.");
  for (const e of entries) {
    const name = Buffer.from(e.name, "utf8");
    const { time, date } = dosTime(statSync(e.path).mtime);
    const flags = 0x0008 | 0x0800; // data descriptor + UTF-8 names
    const local = Buffer.concat([u32(0x04034b50), u16(20), u16(flags), u16(0), u16(time), u16(date), u32(0), u32(0), u32(0), u16(name.length), u16(0), name]);
    await write(out, local);
    let crc = 0;
    let size = 0;
    for await (const chunk of createReadStream(e.path)) {
      crc = crc32(chunk as Buffer, crc);
      size += (chunk as Buffer).length;
      await write(out, chunk as Buffer);
    }
    await write(out, Buffer.concat([u32(0x08074b50), u32(crc), u32(size), u32(size)]));
    central.push(
      Buffer.concat([u32(0x02014b50), u16(20), u16(20), u16(flags), u16(0), u16(time), u16(date), u32(crc), u32(size), u32(size), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name]),
    );
    offset += local.length + size + 16;
  }
  const cd = Buffer.concat(central);
  await write(out, cd);
  await write(out, Buffer.concat([u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length), u32(cd.length), u32(offset), u16(0)]));
};
