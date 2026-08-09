/**
 * The trusted asset registry.
 *
 * The whole media capability rests on one asymmetry: **the model names, Ventrio
 * resolves.** A bundle can say `data-ventrio-media="bench.surface"` and nothing
 * else. It cannot supply a URL, a data URI, a `srcset`, an SVG, a CSS `url()`,
 * or any other byte that ends up in a fetch — those are all refused by the
 * reject pass, and the element allowlist has no `<img>` in it at all. The only
 * way a picture reaches a page is that a name matched a key in this registry
 * and Ventrio wrote the `<img>` element itself.
 *
 * That is why validation lives here rather than at the point of use. An entry
 * is admitted only if it is a PNG (verified by decoding the base64 and checking
 * the signature bytes, not by trusting the declared MIME), within size limits,
 * and carries usable alt text and intrinsic dimensions. A registry built from a
 * future source — an upload, a CMS, a licensed library — passes through the
 * same gate, so "trusted" means "checked here", not "came from us".
 *
 * The rendered `<img>` is inert by construction: a `data:` source makes no
 * network request, the shell's CSP is `img-src data:` with `default-src 'none'`,
 * and the frame is sandboxed with an opaque origin. A PNG cannot carry script.
 * SVG is excluded precisely because it can.
 */

import { RAW_ASSETS, type RawAsset } from "./assetData";

export interface TrustedAsset {
  id: string;
  alt: string;
  width: number;
  height: number;
  /** Complete `data:` URI. Built here; never assembled from model text. */
  src: string;
  /** Intrinsic aspect ratio, for layout without a reflow. */
  ratio: string;
}

export type AssetRegistry = ReadonlyMap<string, TrustedAsset>;

/** Asset ids share the content-key grammar: lowercase, dotted, bounded. */
export const ASSET_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;

export const ASSET_LIMITS = {
  /** Per asset, base64 characters. Keeps one image from eating the document. */
  maxBase64Chars: 120_000,
  maxDimension: 4_000,
  minDimension: 16,
  maxAltChars: 300,
  maxAssets: 64,
} as const;

/** PNG signature. The only accepted format — see the module header on SVG. */
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export interface AssetIssue {
  id: string;
  code: string;
  detail: string;
}

export interface RegistryResult {
  registry: AssetRegistry;
  /** Entries refused. A rejected asset is dropped, never repaired. */
  issues: AssetIssue[];
}

/**
 * Builds a registry, admitting only entries that survive every check.
 *
 * Rejection drops the entry rather than failing the whole registry: a bad
 * asset should cost that one image, not the site. The token that referenced it
 * then fails to resolve at compile time, which is a loud, specific error.
 */
export function buildAssetRegistry(raw: Readonly<Record<string, RawAsset>> = RAW_ASSETS): RegistryResult {
  const registry = new Map<string, TrustedAsset>();
  const issues: AssetIssue[] = [];
  const entries = Object.entries(raw);

  if (entries.length > ASSET_LIMITS.maxAssets) {
    issues.push({ id: "*", code: "too_many_assets", detail: `${entries.length} exceeds ${ASSET_LIMITS.maxAssets}.` });
    return { registry, issues };
  }

  for (const [key, asset] of entries) {
    const fail = (code: string, detail: string): void => {
      issues.push({ id: key, code, detail });
    };

    if (!ASSET_ID_PATTERN.test(key)) {
      fail("bad_asset_id", "Asset ids must be lowercase dotted identifiers.");
      continue;
    }
    if (!asset || typeof asset !== "object") {
      fail("bad_asset", "Asset entry is not an object.");
      continue;
    }
    if (asset.id !== key) {
      // A mismatch means the map key and the record disagree about identity,
      // and every lookup after this point uses the key.
      fail("id_mismatch", `Entry is keyed "${key}" but declares id "${asset.id}".`);
      continue;
    }
    if (asset.mime !== "image/png") {
      fail("bad_mime", `Only image/png is accepted; got "${String(asset.mime)}".`);
      continue;
    }
    if (typeof asset.alt !== "string" || !asset.alt.trim()) {
      fail("missing_alt", "Every asset needs alt text.");
      continue;
    }
    if (asset.alt.length > ASSET_LIMITS.maxAltChars) {
      fail("alt_too_long", `${asset.alt.length} chars exceeds ${ASSET_LIMITS.maxAltChars}.`);
      continue;
    }
    for (const [name, value] of [["width", asset.width], ["height", asset.height]] as const) {
      if (!Number.isInteger(value) || value < ASSET_LIMITS.minDimension || value > ASSET_LIMITS.maxDimension) {
        fail("bad_dimension", `${name} ${String(value)} is outside ${ASSET_LIMITS.minDimension}–${ASSET_LIMITS.maxDimension}.`);
      }
    }
    if (typeof asset.base64 !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(asset.base64)) {
      fail("bad_base64", "Payload is not plain base64.");
      continue;
    }
    if (asset.base64.length > ASSET_LIMITS.maxBase64Chars) {
      fail("asset_too_large", `${asset.base64.length} base64 chars exceeds ${ASSET_LIMITS.maxBase64Chars}.`);
      continue;
    }

    // The declared MIME is a claim; the bytes are the evidence.
    const bytes = Buffer.from(asset.base64, "base64");
    if (!bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
      fail("not_a_png", "Payload does not begin with the PNG signature.");
      continue;
    }

    if (issues.some((issue) => issue.id === key)) continue;

    registry.set(key, {
      id: key,
      alt: asset.alt,
      width: asset.width,
      height: asset.height,
      src: `data:image/png;base64,${asset.base64}`,
      ratio: `${asset.width} / ${asset.height}`,
    });
  }

  return { registry, issues };
}

/** The default registry, built once from the generated data. */
export const TRUSTED_ASSETS: AssetRegistry = buildAssetRegistry().registry;

/**
 * Renders the `<img>` element for an asset.
 *
 * Every character of the output originates here or in a validated registry
 * field — no model text reaches it, so there is nothing to escape from. The
 * attributes are fixed: no `srcset`, no `sizes`, no `crossorigin`, no
 * `referrerpolicy`, nothing that could describe a second source.
 *
 * `alt` is still escaped. It comes from the registry rather than from a model,
 * but a registry populated from an upload later would carry user text, and the
 * escaping should already be there when that happens.
 */
export function renderAsset(asset: TrustedAsset): string {
  const alt = asset.alt
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
  return (
    `<img src="${asset.src}" alt="${alt}" width="${asset.width}" height="${asset.height}" ` +
    `decoding="async" loading="lazy" class="v-media-img">`
  );
}

/** Ids available to a prompt, sorted for stable output. */
export function describeAssets(registry: AssetRegistry): string {
  return [...registry.values()]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((asset) => `  ${asset.id} — ${asset.alt} (${asset.width}x${asset.height})`)
    .join("\n");
}
