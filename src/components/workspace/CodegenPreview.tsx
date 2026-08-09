"use client";

import { DEVICE_HEIGHTS, DEVICE_WIDTHS, type DeviceMode } from "@/lib/build/deviceWidths";

/**
 * A generated site, shown in the workspace.
 *
 * The React preview portals Ventrio's own component tree into a same-origin
 * frame. This cannot do that and must not: the document here is markup a model
 * wrote. It goes into an opaque-origin frame as a string, with the containment
 * the compiler already built into it — `sandbox=""` denying scripts,
 * same-origin access, forms, popups and navigation, and a `<meta>` CSP inside
 * the document denying everything except inline styles and data-URI images.
 * Two independent layers, so a careless edit to either one still leaves a
 * boundary standing.
 *
 * `srcDoc` rather than a URL: the document never becomes a fetchable address,
 * so there is nothing to link to, share by accident, or reach without going
 * through the workspace that owns it.
 *
 * This nests inside `ViewportFrame`, which supplies the device width and the
 * scaling. That works — a sandboxed frame rasterises under `transform: scale()`
 * even nested one level deep — and it means the codegen preview inherits the
 * viewport behaviour that was fixed for the React one rather than reimplementing
 * it and drifting.
 *
 * The height is fixed per device instead of measured. A parent cannot read the
 * scroll height of an opaque-origin document, and the only way to learn it
 * would be script inside the generated page reporting its own size — which is
 * exactly what `script-src 'none'` exists to prevent. See DEVICE_HEIGHTS.
 */

export interface CodegenPreviewProps {
  /** The compiled document for the route being shown. */
  srcDoc: string;
  device: DeviceMode;
  title: string;
}

export function CodegenPreview({ srcDoc, device, title }: CodegenPreviewProps) {
  return (
    <iframe
      title={title}
      srcDoc={srcDoc}
      sandbox=""
      // `referrerpolicy` is belt-and-braces: the inner policy already denies
      // every network destination, so there is no request to leak a referrer
      // on. It costs nothing and survives a future loosening of that policy.
      referrerPolicy="no-referrer"
      style={{
        width: DEVICE_WIDTHS[device],
        height: DEVICE_HEIGHTS[device],
        border: 0,
        display: "block",
        background: "#fff",
      }}
    />
  );
}
