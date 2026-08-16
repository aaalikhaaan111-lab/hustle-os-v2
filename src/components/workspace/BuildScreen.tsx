"use client";

import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  chooseWorkspaceMode,
  chosenWorkspaceMode,
  subscribeWorkspaceMode,
} from "@/lib/workspace/workspaceMode";
import { useTranslations } from "next-intl";
import {
  IconChat,
  IconClose,
  IconCopy,
  IconDesktop,
  IconExpand,
  IconEye,
  IconMinimize,
  IconExternal,
  IconMobile,
  IconTablet,
  IconRefresh,
} from "@/components/workspace-ui/parts";
import { VentrioButton, VentrioLinkButton } from "@/components/ui/VentrioButton";
import { cn } from "@/lib/utils";
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

/**
 * The four things the preview panel can be, kept apart.
 *
 * They were one word before: `"empty"` covered a job row that had not been read
 * yet, a generation that had just succeeded but whose app had not arrived, and
 * a stored version that failed to rebuild — all reported as "your preview will
 * appear here", which was a claim about the project rather than about what this
 * screen knew.
 */
export type PreviewStatus = "loading" | "generating" | "failed" | "unavailable" | "empty";

export interface BuildChatContext {
  previewOpen: boolean;
  /** True when real output exists but the panel is currently closed. */
  canOpenPreview: boolean;
  openPreview: () => void;
}

export interface BuildScreenProps {
  /**
   * Which project this screen is showing.
   *
   * Used only to consume the "a generation just arrived" marker, which is
   * per-project so a finished generation cannot open the preview on a different
   * project the person opened in the meantime.
   */
  projectId: string;
  /**
   * The conversation. It is told whether it is sharing the screen (so it can set
   * its reading measure) and how to open the preview, so the approved "first
   * version ready" card can live inside the conversation where it belongs.
   */
  chat: (context: BuildChatContext) => ReactNode;
  /**
   * Real rendered output, or null when nothing has been generated yet.
   *
   * A function form is accepted for previews that need the selected device.
   * The React preview does not — it is portalled into a frame that already has
   * the right viewport — but the sandboxed codegen preview renders a document
   * it cannot measure, so it has to be told the viewport it is being given.
   */
  preview: ReactNode | ((device: DeviceMode) => ReactNode) | null;
  /**
   * What the preview panel should say when there is no output to show.
   *
   * The panel used to not exist at all before the first generation — the whole
   * rail was hidden — so there was no way to look at the surface the product is
   * about, and nothing to explain that it was coming. The panel is now always
   * reachable and answers for itself in each phase.
   */
  /**
   * What the panel should say when there is nothing to render.
   *
   * Required, and `"empty"` is no longer the default. It used to be both
   * optional and defaulted, so a caller that forgot it asserted "nothing has
   * been built yet" — which `WorkspaceView` did for every project whose stored
   * version would not recompile. `"loading"` is the state for "not known yet";
   * `"empty"` now means only that there is genuinely nothing.
   */
  previewStatus: PreviewStatus;
  /** Offered in the failed state; omit when a retry is not possible. */
  onPreviewRetry?: (() => void) | null;
  published: boolean;
  /**
   * A genuinely shareable URL for this project, or null. Only a published
   * project has one; a draft preview exists on screen but has no address, and
   * the copy control says so rather than inventing one.
   */
  shareUrl?: string | null;
  /**
   * The publish control, rendered in the preview toolbar.
   *
   * Handed in rather than built here: publishing needs the project id, the
   * publication state and its own server actions, all of which belong to the
   * screen above. What this owns is the decision that the control belongs over
   * the preview rather than inside the conversation.
   */
  publishControl?: ReactNode;
  /**
   * What the generated app reported after it mounted, or failed to.
   *
   * A crashed application still renders an iframe, so the panel cannot tell a
   * blank app from a broken one by looking. These are the app's own words, and
   * showing them is the difference between "nothing happened" and a stated
   * failure someone can act on.
   */
  runtimeErrors?: readonly string[];
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
export function BuildScreen({
  chat,
  preview,
  previewStatus,
  onPreviewRetry = null,
  published,
  shareUrl = null,
  publishControl = null,
  runtimeErrors = [],
  projectId,
}: BuildScreenProps) {
  const t = useTranslations("workspace");
  // Whether real output exists — which decides only whether the panel opens by
  // itself, never whether it can be opened at all.
  const hasOutput = preview !== null;

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
  const [fullScreen, setFullScreen] = useState(false);
  const [device, setDevice] = useState<DeviceMode>("desktop");
  const [reloadKey, setReloadKey] = useState(0);
  const [copied, setCopied] = useState<"done" | "failed" | null>(null);

  /**
   * The explicit choice, shared across the component swap.
   *
   * `PreOutputWorkspace` and `BuildScreen` are different components and the
   * generation's arrival unmounts the first, so this cannot be local state. It
   * is a store that actually notifies — see `workspaceMode.ts` for why the
   * previous cached-snapshot version silently never fired.
   */
  const chosen = useSyncExternalStore(
    subscribeWorkspaceMode,
    () => chosenWorkspaceMode(projectId),
    () => null,
  );

  /**
   * With no explicit choice: on a phone the result takes the screen as soon as
   * there is one, because that is what the person came for and Chat is one tap
   * away. On desktop the two sit side by side, so the remembered preference
   * still decides.
   */
  const previewOpen = chosen !== null
    ? chosen === "preview"
    : hasOutput && (narrow || storedOpen);

  const changePreviewOpen = useCallback((next: boolean) => {
    chooseWorkspaceMode(projectId, next ? "preview" : "chat");
    if (!next) setFullScreen(false);
    try {
      window.localStorage.setItem(PREVIEW_OPEN_KEY, next ? "1" : "0");
    } catch {
      // A browser that refuses storage still gets a working toggle.
    }
  }, [projectId]);

  useEffect(() => {
    if (!copied) return;
    // A failure is a longer read than "copied", and it asks the person to go and
    // do something, so it stays up long enough to finish reading.
    const timer = setTimeout(() => setCopied(null), copied === "failed" ? 6000 : 2200);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copyLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied("done");
    } catch {
      // A refused clipboard used to be swallowed entirely, on the reasoning
      // that silence beats claiming a copy that did not happen. But silence
      // makes the button look broken and leaves nothing to paste, so say what
      // went wrong and where the link still is. The publish dock already
      // answers this way; this is the same answer in the rail.
      setCopied("failed");
    }
  }

  // On a phone the preview replaces the conversation rather than squeezing it:
  // one primary surface at a time, and Close returns you to the chat.
  const showChat = !(previewOpen && (fullScreen || narrow));

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-[inherit]">
      {/* One bar, above both surfaces, so the mode is legible from either one.
          Only on a phone: on desktop the conversation and the preview are both
          on screen and there is no mode to be in. It renders only once there is
          something to switch to. */}
      {narrow && hasOutput && (
        <div
          className="flex shrink-0 items-center justify-center border-b px-3 py-2"
          style={{ borderColor: "var(--line)", background: "var(--surface)" }}
        >
          <ModeSwitch
            mode={previewOpen ? "preview" : "chat"}
            onChange={(next) => changePreviewOpen(next === "preview")}
            chatLabel={t("modeChat")}
            previewLabel={t("modePreview")}
          />
        </div>
      )}

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
      {showChat && (
        <div
          className="flex min-h-0 min-w-0 flex-col transition-[flex-basis] duration-[var(--t-layout)] ease-[var(--ease)]"
          style={{ flex: previewOpen && !narrow ? "0 0 41%" : "1 1 100%" }}
        >
          {chat({
            previewOpen,
            canOpenPreview: !previewOpen,
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
          {/* ── The preview toolbar ──────────────────────────────────────
              Everything that acts on the generated product lives here, above
              the thing it acts on. These controls used to float in a rail down
              the right edge and, for publishing, sit inside the conversation —
              so the chat carried product controls and the preview carried none.
              The split is now the one the product means: the chat is for
              talking to Ventrio, this bar is for the thing Ventrio made.

              It scrolls rather than wraps on a narrow screen: a toolbar that
              reflows to two rows pushes the preview down the page every time
              the viewport changes. */}
          <div className="flex h-12 shrink-0 items-center px-4">
            {/* The part that may scroll: the title, the status, and the
                controls you can do without for a moment. The outer row has no
                gap of its own, so on a wide toolbar this sits flush against the
                pinned group below and the desktop row is the one it always
                was. */}
            <div className={cn("flex min-w-0 flex-1 items-center gap-2", narrow ? "overflow-hidden" : "overflow-x-auto")}>
            <span className="min-w-0 shrink-0 truncate text-[13px] font-semibold">{t("tabPreview")}</span>
            <span
              className="shrink-0 rounded-full px-2 py-[3px] text-[12px] font-semibold leading-none"
              style={
                published
                  ? { background: "var(--ok-soft)", color: "var(--ok)" }
                  : { background: "var(--accent-soft)", color: "var(--accent-ink)" }
              }
            >
              {published ? t("statusLive") : t("statusDraft")}
            </span>

            <div className="ml-auto flex shrink-0 items-center gap-1">
              {/* Viewport. Only meaningful with something to look at. */}
              {hasOutput && !narrow && (
                <>
                  <BarButton label={t("viewportDesktop")} active={device === "desktop"} onClick={() => setDevice("desktop")}>
                    <IconDesktop className="h-[18px] w-[18px]" />
                  </BarButton>
                  <BarButton label={t("viewportTablet")} active={device === "tablet"} onClick={() => setDevice("tablet")}>
                    <IconTablet className="h-[18px] w-[18px]" />
                  </BarButton>
                  <BarButton label={t("viewportMobile")} active={device === "mobile"} onClick={() => setDevice("mobile")}>
                    <IconMobile className="h-[18px] w-[18px]" />
                  </BarButton>
                  <ToolbarDivider />
                  <BarButton label={t("reload")} onClick={() => setReloadKey((key) => key + 1)}>
                    <IconRefresh className="h-[18px] w-[18px]" />
                  </BarButton>
                  <BarButton
                    label={fullScreen ? t("exitFullScreen") : t("fullScreen")}
                    active={fullScreen}
                    onClick={() => setFullScreen((value) => !value)}
                  >
                    {fullScreen ? <IconMinimize className="h-[18px] w-[18px]" /> : <IconExpand className="h-[18px] w-[18px]" />}
                  </BarButton>
                </>
              )}

              {/* Share, and only once there is something to share. A draft
                  preview is real but has no address, so the controls that
                  depend on one are absent rather than disabled-and-lying. */}
              {shareUrl && !narrow && (
                <>
                  <ToolbarDivider />
                  <BarButton label={t("copyPreviewLink")} onClick={copyLink}>
                    <IconCopy className="h-[18px] w-[18px]" />
                  </BarButton>
                  <VentrioLinkButton
                    href={shareUrl}
                    target="_blank"
                    rel="noreferrer"
                    variant="icon"
                    size="md"
                    label={t("openPublicPage")}
                  >
                    <IconExternal className="h-[18px] w-[18px]" />
                  </VentrioLinkButton>
                </>
              )}

            </div>
            </div>

            {/* Pinned, and outside the scrolling region on purpose.
                These two are the ones a narrow screen cannot afford to lose.
                Publish is the point of the screen; Close is the only way back
                to the conversation on a phone, where the preview REPLACES the
                chat rather than sitting beside it (see `showChat` above). Both
                used to sit last in a row that scrolled horizontally at 390px,
                so both went off-screen — leaving no visible exit from the
                preview. On desktop the row does not overflow, so nothing here
                moves. */}
            <div className="flex shrink-0 items-center gap-1">
              {/* On a phone, everything else moves into a menu.
                  Pinning two controls fixed the two that mattered most and left
                  the rest — Reload, Copy link, Open public page — inside a row
                  that still scrolled sideways. An action reachable only by
                  dragging a toolbar is one a new person never finds; the owner
                  knows they exist because he built them. The menu carries words
                  rather than icons for the same reason. */}
              {narrow && hasOutput && (
                <ToolbarMenu
                  label={t("moreActions")}
                  items={[
                    {
                      key: "reload",
                      label: t("reload"),
                      icon: <IconRefresh className="h-[18px] w-[18px]" />,
                      onSelect: () => setReloadKey((key) => key + 1),
                    },
                    ...(shareUrl
                      ? [
                          {
                            key: "copy",
                            label: t("copyPreviewLink"),
                            icon: <IconCopy className="h-[18px] w-[18px]" />,
                            onSelect: () => { void copyLink(); },
                          },
                          {
                            key: "open",
                            label: t("openPublicPage"),
                            icon: <IconExternal className="h-[18px] w-[18px]" />,
                            href: shareUrl,
                          },
                        ]
                      : []),
                  ]}
                />
              )}

              {/* Publishing, handed in by the screen that owns the action. */}
              {publishControl && (
                <>
                  <ToolbarDivider />
                  <div className="shrink-0">{publishControl}</div>
                </>
              )}

              <ToolbarDivider />
              <BarButton label={t("closePreview")} onClick={() => changePreviewOpen(false)}>
                <IconClose className="h-[18px] w-[18px]" />
              </BarButton>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto px-4 pb-5 lg:pb-8 lg:pl-8 lg:pr-[92px] lg:pt-2">
            {/* Full-width centring container. The frame measures this to decide
                its scale, so its width must not depend on the frame — see
                ViewportFrame. The border therefore lives on the frame itself. */}
            {/* Stated, not silent. A running app that threw looks identical to
                one that rendered nothing, so the errors it reported sit over
                the frame rather than only in a console nobody has open. */}
            {hasOutput && runtimeErrors.length > 0 && (
              <div
                role="alert"
                className="mx-auto mb-3 w-full max-w-[720px] rounded-[var(--r-md)] border p-3"
                style={{ borderColor: "var(--warn)", background: "var(--surface)" }}
              >
                <p className="text-[13px] font-semibold" style={{ color: "var(--warn)" }}>
                  {t("previewRuntimeErrorTitle")}
                </p>
                <ul className="mt-1 space-y-0.5">
                  {runtimeErrors.slice(0, 3).map((message) => (
                    <li key={message} className="truncate font-mono text-[11.5px]" style={{ color: "var(--ink-2)" }}>
                      {message}
                    </li>
                  ))}
                </ul>
                <VentrioButton variant="secondary" size="sm" className="mt-2.5" onClick={() => setReloadKey((key) => key + 1)}>
                  {t("reload")}
                </VentrioButton>
              </div>
            )}

            {hasOutput ? (
              <div className="flex w-full justify-center">
                <ViewportFrame
                  key={`${reloadKey}-${device}`}
                  width={DEVICE_WIDTHS[device]}
                  title={t("previewRegion")}
                  className="lift-2 rounded-[var(--r-xl)] border"
                  style={{ borderColor: "var(--line)", background: "var(--surface)" }}
                >
                  {typeof preview === "function" ? preview(device) : preview}
                </ViewportFrame>
              </div>
            ) : (
              <PreviewPlaceholder
                status={previewStatus}
                onRetry={onPreviewRetry}
                t={t}
              />
            )}
          </div>
        </section>
      )}

      </div>

      {/* ── The panel toggle ─────────────────────────────────────────────
          All that is left of the floating rail. Switching between conversation
          and preview is a layout choice, not a product control, and it has to
          stay reachable when the preview is closed and its toolbar is not on
          screen. Everything that acts on the generated product moved into that
          toolbar. */}
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
        </div>
      </div>

      {copied && (
        <div
          className="pop lift-3 pointer-events-none absolute bottom-5 left-1/2 z-30 max-w-[min(92%,420px)] -translate-x-1/2 rounded-[var(--r-md)] px-3.5 py-2 text-center text-[13px] font-medium text-white"
          // A failure is not a status update, and a screen reader should not
          // have to wait its turn to hear that nothing was copied.
          role={copied === "failed" ? "alert" : "status"}
          style={{ background: copied === "failed" ? "var(--warn)" : "var(--ink)" }}
        >
          {copied === "failed" ? t("previewLinkCopyFailed") : t("previewLinkCopied")}
        </div>
      )}
    </div>
  );
}

/**
 * What the preview panel shows before there is a preview.
 *
 * The panel is reachable from the moment the workspace opens, so it has to
 * account for itself in every phase rather than being empty or absent. Each
 * state says only what is true: nothing built yet, building now, or a build
 * that failed and can be retried. No skeleton of fake content — a placeholder
 * shaped like a page would be a claim about a page that does not exist.
 */
function PreviewPlaceholder({
  status,
  onRetry,
  t,
}: {
  status: PreviewStatus;
  onRetry: (() => void) | null;
  t: ReturnType<typeof useTranslations<"workspace">>;
}) {
  const copy = {
    loading: ["previewLoadingTitle", "previewLoadingBody"],
    generating: ["previewGeneratingTitle", "previewGeneratingBody"],
    failed: ["previewFailedTitle", "previewFailedBody"],
    // A version exists and would not rebuild. Not the same as never having had
    // one, and not the same as a generation that failed — nothing is in flight
    // and nothing was lost; this copy of the workspace cannot render what is
    // stored.
    unavailable: ["previewUnavailableTitle", "previewUnavailableBody"],
    empty: ["previewEmptyTitle", "previewEmptyBody"],
  }[status] as [Parameters<typeof t>[0], Parameters<typeof t>[0]];

  // Only a real failure offers an action. "Loading" has nothing to retry, and
  // offering one would invite a click that does nothing.
  const showRetry = (status === "failed" || status === "unavailable") && !!onRetry;

  return (
    <div
      className="mx-auto flex h-full max-w-[420px] flex-col items-center justify-center gap-2 px-6 text-center"
      // Announced, because this is how the panel reports that a build finished
      // or failed to someone who is not watching it.
      role="status"
      aria-live="polite"
    >
      <span
        aria-hidden
        className={cn(
          "mb-1 h-9 w-9 rounded-full border-2",
          (status === "generating" || status === "loading") && "ai-pending"
        )}
        style={{
          borderColor: status === "failed" || status === "unavailable" ? "var(--warn)" : "var(--line-2)",
          borderStyle: status === "empty" ? "dashed" : "solid",
        }}
      />
      <p className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>
        {t(copy[0])}
      </p>
      <p className="text-[13px] leading-relaxed" style={{ color: "var(--ink-3)" }}>
        {t(copy[1])}
      </p>
      {showRetry && (
        <VentrioButton variant="primary" size="sm" className="mt-2" onClick={onRetry}>
          {t("previewRetry")}
        </VentrioButton>
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

/**
 * A control in the preview toolbar.
 *
 * `active` paints the button *and* announces it. Without `aria-pressed` the
 * selected viewport is conveyed by colour alone, so a screen reader hears three
 * identical Desktop/Tablet/Mobile buttons with no way to tell which is in
 * effect. Buttons that merely act — reload, close — take no `active` and stay
 * plain, rather than claiming a pressed state they do not have.
 */
/**
 * The overflow menu a phone toolbar needs.
 *
 * Deliberately labelled. The controls that moved in here — Reload, Copy link,
 * Open public page — were previously icons in a row that scrolled sideways at
 * 390 px, which is indistinguishable from not existing unless you already know
 * they are there. Words are what make them findable by someone who did not
 * build the product.
 *
 * A `<details>` element rather than state and a popover library: it opens,
 * closes on outside interaction via the summary's own toggle, is keyboard
 * reachable, and needs no effect to clean up. Rows are 44 px so they are
 * comfortable under a thumb.
 */
function ToolbarMenu({
  label,
  items,
}: {
  label: string;
  items: Array<{ key: string; label: string; icon: ReactNode; onSelect?: () => void; href?: string }>;
}) {
  if (items.length === 0) return null;
  return (
    <details className="relative shrink-0 [&[open]>summary>span]:opacity-100">
      <summary
        aria-label={label}
        className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-[var(--r-sm)] [&::-webkit-details-marker]:hidden"
        style={{ color: "var(--ink-2)" }}
      >
        <span aria-hidden className="text-[20px] leading-none">⋯</span>
      </summary>
      <div
        className="lift-3 absolute right-0 z-30 mt-1 flex min-w-[220px] flex-col rounded-[var(--r-md)] border p-1"
        style={{ borderColor: "var(--line)", background: "var(--surface)" }}
        role="menu"
      >
        {items.map((item) =>
          item.href ? (
            <a
              key={item.key}
              role="menuitem"
              href={item.href}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-[44px] items-center gap-3 rounded-[var(--r-sm)] px-3 text-[14.5px] font-medium"
              style={{ color: "var(--ink)" }}
            >
              {item.icon}
              {item.label}
            </a>
          ) : (
            <button
              key={item.key}
              role="menuitem"
              type="button"
              onClick={item.onSelect}
              className="flex min-h-[44px] items-center gap-3 rounded-[var(--r-sm)] px-3 text-left text-[14.5px] font-medium"
              style={{ color: "var(--ink)" }}
            >
              {item.icon}
              {item.label}
            </button>
          ),
        )}
      </div>
    </details>
  );
}

/**
 * Chat or Preview, stated rather than implied.
 *
 * On a phone the preview replaces the conversation, so without this the person
 * cannot tell whether they are talking to Ventrio or looking at what it built —
 * and after a generation the surface changes under them with no explanation.
 * A segment says which mode is active and makes the other one a single tap.
 *
 * Mobile only: on desktop both surfaces are on screen at once and a mode switch
 * would be answering a question nobody is asking.
 */
function ModeSwitch({
  mode,
  onChange,
  chatLabel,
  previewLabel,
}: {
  mode: "chat" | "preview";
  onChange: (next: "chat" | "preview") => void;
  chatLabel: string;
  previewLabel: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={`${chatLabel} / ${previewLabel}`}
      className="flex shrink-0 rounded-[var(--r-md)] p-0.5"
      style={{ background: "var(--sunken)" }}
    >
      {(["chat", "preview"] as const).map((value) => (
        <button
          key={value}
          role="tab"
          type="button"
          aria-selected={mode === value}
          onClick={() => onChange(value)}
          className={cn(
            "min-h-[36px] rounded-[var(--r-sm)] px-3.5 text-[13.5px] font-semibold transition-colors",
            mode === value ? "shadow-sm" : "",
          )}
          style={
            mode === value
              ? { background: "var(--surface)", color: "var(--ink)" }
              : { color: "var(--ink-2)" }
          }
        >
          {value === "chat" ? chatLabel : previewLabel}
        </button>
      ))}
    </div>
  );
}

function BarButton({
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
      on={active}
      {...(active === undefined ? {} : { "aria-pressed": active })}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </VentrioButton>
  );
}

/** A hairline between groups of toolbar controls. */
function ToolbarDivider() {
  return <span className="mx-1 h-5 w-px shrink-0" style={{ background: "var(--line)" }} aria-hidden />;
}
