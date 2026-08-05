"use client";

import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  IconChat,
  IconClose,
  IconCopy,
  IconDesktop,
  IconExpand,
  IconEye,
  IconMinimize,
  IconMobile,
  IconTablet,
  IconRefresh,
} from "@/components/workspace-ui/parts";
import { VentrioButton } from "@/components/ui/VentrioButton";
import { ViewportFrame } from "@/components/workspace/ViewportFrame";
import { DEVICE_WIDTHS, type DeviceMode } from "@/lib/build/deviceWidths";

const PREVIEW_OPEN_KEY = "ventrio:preview-open";

/** Below this the preview is a view of its own, not a second column. */
const NARROW_QUERY = "(max-width: 1023px)";

function subscribeToNarrow(onChange: () => void) {
  const media = window.matchMedia(NARROW_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

export interface BuildChatContext {
  previewOpen: boolean;
  /** True when real output exists but the panel is currently closed. */
  canOpenPreview: boolean;
  openPreview: () => void;
}

export interface BuildScreenProps {
  /**
   * The conversation. It is told whether it is sharing the screen (so it can set
   * its reading measure) and how to open the preview, so the approved "first
   * version ready" card can live inside the conversation where it belongs.
   */
  chat: (context: BuildChatContext) => ReactNode;
  /** Real rendered output, or null when nothing has been generated yet. */
  preview: ReactNode | null;
  published: boolean;
  /**
   * A genuinely shareable URL for this project, or null. Only a published
   * project has one; a draft preview exists on screen but has no address, and
   * the copy control says so rather than inventing one.
   */
  shareUrl?: string | null;
}

/**
 * Build: the conversation is the product, the preview is what it produced.
 *
 * Before anything exists the chat has the room to itself at a reading measure —
 * no panel is reserved for a result that has not been made. The preview earns
 * its share of the screen only once there is something in it, opens on a
 * deliberate action, and remembers that choice. Its controls float over the
 * work rather than sitting in a toolbar above it, so the panel stays a clean
 * surface showing the thing the person actually made.
 */
export function BuildScreen({ chat, preview, published, shareUrl = null }: BuildScreenProps) {
  const t = useTranslations("workspace");
  const hasPreview = preview !== null;

  const narrow = useSyncExternalStore(
    subscribeToNarrow,
    () => window.matchMedia(NARROW_QUERY).matches,
    () => false
  );

  // The stored preference is read as a snapshot (stable on the server, real
  // after hydration); an explicit toggle this session overrides it.
  const storedOpen = useSyncExternalStore(
    () => () => {},
    () => {
      try {
        return window.localStorage.getItem(PREVIEW_OPEN_KEY) !== "0";
      } catch {
        return true;
      }
    },
    () => true
  );
  const [override, setOverride] = useState<boolean | null>(null);
  const [fullScreen, setFullScreen] = useState(false);
  const [device, setDevice] = useState<DeviceMode>("desktop");
  const [reloadKey, setReloadKey] = useState(0);
  const [copied, setCopied] = useState(false);

  const previewOpen = hasPreview && (override ?? storedOpen);

  const changePreviewOpen = useCallback((next: boolean) => {
    setOverride(next);
    if (!next) setFullScreen(false);
    try {
      window.localStorage.setItem(PREVIEW_OPEN_KEY, next ? "1" : "0");
    } catch {
      // A browser that refuses storage still gets a working toggle.
    }
  }, []);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2200);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copyLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
    } catch {
      // Clipboard refused: say nothing rather than claim a copy that failed.
    }
  }

  // On a phone the preview replaces the conversation rather than squeezing it:
  // one primary surface at a time, and Close returns you to the chat.
  const showChat = !(previewOpen && (fullScreen || narrow));

  return (
    <div className="relative flex h-full min-h-0 overflow-hidden rounded-[inherit]">
      {showChat && (
        <div
          className="flex min-h-0 min-w-0 flex-col transition-[flex-basis] duration-[var(--t-layout)] ease-[var(--ease)]"
          style={{ flex: previewOpen && !narrow ? "0 0 41%" : "1 1 100%" }}
        >
          {chat({
            previewOpen,
            canOpenPreview: hasPreview && !previewOpen,
            openPreview: () => changePreviewOpen(true),
          })}
        </div>
      )}

      {previewOpen && (
        <section
          aria-label={t("previewRegion")}
          className="rise flex min-h-0 min-w-0 flex-1 flex-col rounded-r-[inherit] border-l"
          style={{ borderColor: "var(--line)", background: "var(--raised)" }}
        >
          <div className="flex h-12 shrink-0 items-center gap-2 px-4">
            <span className="min-w-0 truncate text-[13px] font-semibold">{t("tabPreview")}</span>
            <span
              className="rounded-full px-2 py-[3px] text-[12px] font-semibold leading-none"
              style={
                published
                  ? { background: "var(--ok-soft)", color: "var(--ok)" }
                  : { background: "var(--accent-soft)", color: "var(--accent-ink)" }
              }
            >
              {published ? t("statusLive") : t("statusDraft")}
            </span>

            {/* Below the floating rail's breakpoint the same controls live here
                instead, so a phone never depends on a hover affordance. */}
            <div className="ml-auto flex shrink-0 items-center gap-1 lg:hidden">
              <BarButton label={t("reload")} onClick={() => setReloadKey((key) => key + 1)}>
                <IconRefresh className="h-[18px] w-[18px]" />
              </BarButton>
              <BarButton
                label={shareUrl ? t("copyPreviewLink") : t("previewLinkUnavailable")}
                onClick={copyLink}
                disabled={!shareUrl}
              >
                <IconCopy className="h-[18px] w-[18px]" />
              </BarButton>
              <BarButton label={t("closePreview")} onClick={() => changePreviewOpen(false)}>
                <IconClose className="h-[18px] w-[18px]" />
              </BarButton>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto px-4 pb-5 lg:pb-8 lg:pl-8 lg:pr-[92px] lg:pt-2">
            {/* Full-width centring container. The frame measures this to decide
                its scale, so its width must not depend on the frame — see
                ViewportFrame. The border therefore lives on the frame itself. */}
            <div className="flex w-full justify-center">
              <ViewportFrame
                key={`${reloadKey}-${device}`}
                width={DEVICE_WIDTHS[device]}
                title={t("previewRegion")}
                className="lift-2 rounded-[var(--r-xl)] border"
                style={{ borderColor: "var(--line)", background: "var(--surface)" }}
              >
                {preview}
              </ViewportFrame>
            </div>
          </div>
        </section>
      )}

      {/* ── The floating utility rail ────────────────────────────────────────
          Desktop only, and only once there is real output to control. Every
          button here changes something real; nothing was added to fill it. */}
      {hasPreview && (
        <div className="pointer-events-none absolute inset-y-0 right-4 z-20 hidden items-center lg:flex">
          <div
            className="lift-3 pointer-events-auto flex flex-col gap-1 rounded-[var(--r-md)] border p-1.5"
            style={{ borderColor: "var(--line)", background: "var(--surface)" }}
          >
            <RailButton
              label={t("focusChat")}
              active={!previewOpen}
              onClick={() => changePreviewOpen(false)}
              disabled={!previewOpen}
            >
              <IconChat className="h-[18px] w-[18px]" />
            </RailButton>
            <RailButton
              label={previewOpen ? t("closePreview") : t("openPreview")}
              active={previewOpen}
              onClick={() => changePreviewOpen(!previewOpen)}
            >
              <IconEye className="h-[18px] w-[18px]" />
            </RailButton>

            {previewOpen && (
              <>
                <Divider />
                <RailButton
                  label={t("viewportDesktop")}
                  active={device === "desktop"}
                  onClick={() => setDevice("desktop")}
                >
                  <IconDesktop className="h-[18px] w-[18px]" />
                </RailButton>
                <RailButton label={t("viewportTablet")} active={device === "tablet"} onClick={() => setDevice("tablet")}>
                  <IconTablet className="h-[18px] w-[18px]" />
                </RailButton>
                <RailButton label={t("viewportMobile")} active={device === "mobile"} onClick={() => setDevice("mobile")}>
                  <IconMobile className="h-[18px] w-[18px]" />
                </RailButton>
                <Divider />
                <RailButton label={t("reload")} onClick={() => setReloadKey((key) => key + 1)}>
                  <IconRefresh className="h-[18px] w-[18px]" />
                </RailButton>
                <RailButton
                  label={shareUrl ? t("copyPreviewLink") : t("previewLinkUnavailable")}
                  onClick={copyLink}
                  disabled={!shareUrl}
                >
                  <IconCopy className="h-[18px] w-[18px]" />
                </RailButton>
                <RailButton
                  label={fullScreen ? t("exitFullScreen") : t("fullScreen")}
                  active={fullScreen}
                  onClick={() => setFullScreen((value) => !value)}
                >
                  {fullScreen ? <IconMinimize className="h-[18px] w-[18px]" /> : <IconExpand className="h-[18px] w-[18px]" />}
                </RailButton>
              </>
            )}
          </div>
        </div>
      )}

      {copied && (
        <div
          className="pop lift-3 pointer-events-none absolute bottom-5 left-1/2 z-30 -translate-x-1/2 rounded-full px-3.5 py-2 text-[13px] font-medium text-white"
          role="status"
          style={{ background: "var(--ink)" }}
        >
          {t("previewLinkCopied")}
        </div>
      )}
    </div>
  );
}

/** The opener the chat shows once real output exists but the panel is closed. */
export function OpenPreviewButton({ onOpen, label, icon }: { onOpen: () => void; label: string; icon: ReactNode }) {
  return (
    <VentrioButton variant="secondary" size="sm" onClick={onOpen}>
      {icon}
      {label}
    </VentrioButton>
  );
}

function Divider() {
  return <span className="mx-1 my-0.5 block h-px" style={{ background: "var(--line)" }} />;
}

/** A control in the floating rail: square, quiet until it matters. */
function RailButton({
  label,
  onClick,
  active,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <VentrioButton
      variant="icon"
      size="md"
      label={label}
      tipSide="left"
      on={active}
      // `on` only paints the button. Without aria-pressed the selected device
      // and the fullscreen state are conveyed by colour alone, so a screen
      // reader hears three identical "Mobile / Tablet / Desktop" buttons with
      // no way to tell which one is in effect. Only the toggles get it: the
      // buttons that just act, like reload, take no `active` and must stay
      // plain buttons rather than claiming a pressed state they do not have.
      {...(active === undefined ? {} : { "aria-pressed": active })}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </VentrioButton>
  );
}

/** The same controls, in the panel header, where the rail is not available. */
function BarButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <VentrioButton variant="icon" size="md" shape="circle" label={label} disabled={disabled} onClick={onClick}>
      {children}
    </VentrioButton>
  );
}
