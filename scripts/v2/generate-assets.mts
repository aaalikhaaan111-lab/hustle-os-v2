/**
 * Generates the trusted asset bytes for the codegen registry.
 *
 *   npx tsx scripts/v2/generate-assets.mts
 *
 * Writes src/lib/v2/codegen/assetData.ts.
 *
 * Every asset in the registry has to come from somewhere auditable. Rather
 * than checking in opaque base64 blobs whose contents nobody can verify, the
 * bytes are produced here from a few lines of arithmetic: the output is
 * deterministic, the source is readable, and re-running this script proves the
 * committed data matches the code that claims to have made it.
 *
 * These are abstract procedural images — gradients, grids, scatter — not
 * photographs. They exist to prove the media path end to end. A real registry
 * would be populated from reviewed, licensed assets through the same contract.
 *
 * PNG is written by hand (IHDR/IDAT/IEND, zlib-deflated raw scanlines) so the
 * pipeline gains no image dependency for what is ultimately fixture data.
 */

import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

/** CRC-32, per the PNG specification. */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typed = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed), 0);
  return Buffer.concat([length, typed, crc]);
}

/** 8-bit RGB PNG from a pixel function. */
function png(width: number, height: number, pixel: (x: number, y: number) => [number, number, number]): Buffer {
  const raw = Buffer.alloc(height * (1 + width * 3));
  let offset = 0;
  for (let y = 0; y < height; y += 1) {
    raw[offset] = 0; // filter: none
    offset += 1;
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = pixel(x, y);
      raw[offset] = r; raw[offset + 1] = g; raw[offset + 2] = b;
      offset += 3;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 2;   // colour type: truecolour
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Deterministic value noise; no Math.random, so output is reproducible. */
function hash2(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

const W = 640;
const H = 420;

/**
 * Quantise to a coarse palette before writing.
 *
 * Per-pixel noise is incompressible: a first pass with smooth gradients and
 * fine grain produced a 364 KB asset, which alone would have exceeded the
 * bundle budget these assets are supposed to live inside. Snapping to a small
 * number of levels keeps the texture legible while letting deflate do its job.
 */
const q = (value: number, step = 12): number =>
  Math.max(0, Math.min(255, Math.round(value / step) * step));

const ASSETS: Array<{ id: string; alt: string; width: number; height: number; build: () => Buffer }> = [
  {
    id: "bench.surface",
    alt: "Abstract dark workbench surface with a warm highlight",
    width: W, height: H,
    build: () => png(W, H, (x, y) => {
      const u = x / W, v = y / H;
      const glow = Math.exp(-(((u - 0.72) ** 2) * 6 + ((v - 0.28) ** 2) * 9));
      const grain = (hash2(x >> 4, y >> 4) - 0.5) * 10;
      return [
        q(18 + glow * 190 + grain),
        q(20 + glow * 96 + grain),
        q(26 + glow * 46 + grain),
      ];
    }),
  },
  {
    id: "log.schematic",
    alt: "Schematic grid suggesting a revision log",
    width: W, height: H,
    build: () => png(W, H, (x, y) => {
      const major = x % 90 === 0 || y % 90 === 0;
      const minor = x % 18 === 0 || y % 18 === 0;
      const band = y > H * 0.62 && y < H * 0.68 && x < W * 0.55;
      if (band) return [212, 98, 46];
      if (major) return [72, 82, 96];
      if (minor) return [34, 40, 50];
      const v = q(22 + (hash2(x >> 4, y >> 4) - 0.5) * 8);
      return [v, q(v + 3), q(v + 8)];
    }),
  },
  {
    id: "parts.tray",
    alt: "Scattered component shapes on a dark tray",
    width: W, height: H,
    build: () => png(W, H, (x, y) => {
      let on = 0;
      for (let i = 0; i < 26; i += 1) {
        const cx = hash2(i, 1) * W, cy = hash2(i, 2) * H;
        const rw = 16 + hash2(i, 3) * 46, rh = 10 + hash2(i, 4) * 26;
        if (Math.abs(x - cx) < rw && Math.abs(y - cy) < rh) on = hash2(i, 5) > 0.72 ? 2 : 1;
      }
      if (on === 2) return [212, 98, 46];
      if (on === 1) return [58, 66, 80];
      const v = q(20 + (hash2(x >> 5, y >> 5) - 0.5) * 6);
      return [v, q(v + 2), q(v + 7)];
    }),
  },
];

const entries = ASSETS.map((asset) => {
  const base64 = asset.build().toString("base64");
  return `  "${asset.id}": {\n    id: "${asset.id}",\n    alt: ${JSON.stringify(asset.alt)},\n    width: ${asset.width},\n    height: ${asset.height},\n    mime: "image/png",\n    base64:\n      "${base64}",\n  },`;
});

const source = `/**
 * GENERATED FILE — do not edit by hand.
 *
 * Produced by scripts/v2/generate-assets.mts. Re-run that script to regenerate;
 * the output is deterministic, so a diff here means the generator changed.
 *
 * These are abstract procedural images, not photography. They exist so the
 * media path can be proven end to end with real bytes. Every entry is
 * validated at registry construction (see assets.ts) rather than trusted
 * because it lives in this file.
 */

export interface RawAsset {
  id: string;
  alt: string;
  width: number;
  height: number;
  mime: "image/png";
  base64: string;
}

export const RAW_ASSETS: Readonly<Record<string, RawAsset>> = {
${entries.join("\n")}
};
`;

writeFileSync(new URL("../../src/lib/v2/codegen/assetData.ts", import.meta.url), source, "utf8");
console.log(`assetData.ts written — ${ASSETS.length} assets, ${(source.length / 1024).toFixed(1)} KB`);
