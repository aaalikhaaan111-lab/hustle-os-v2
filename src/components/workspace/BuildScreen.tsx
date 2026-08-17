"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  chooseWorkspaceMode,
  chosenWorkspaceMode,
  subscribeWorkspaceMode,
} from "@/lib/workspace/workspaceMode";
import { useTranslations } from "next-intl";
import {
  IconClose,
  IconCopy,
  IconDesktop,
  IconExpand,
  IconMinimize,
  IconExternal,
  IconMobile,
  IconTablet,
  IconRefresh,
} from "@/components/workspace-ui/parts";
import { VentrioButton, VentrioLinkButton } from "@/components/ui/VentrioButton";
import { Tooltip } from "@/components/workspace-ui/Tooltip";
import { cn } from "@/lib/utils";
import { ViewportFrame } from "@/components/workspace/ViewportFrame";
import { DEVICE_WIDTHS, type DeviceMode } from "@/lib/build/deviceWidths";
import { toast } from "sonner";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/shadcn/resizable";

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
   * The project's identity, rendered in the head of the conversation card.
   * Supplied rather than derived so this screen keeps knowing nothing about
   * routing or publication shape.
   */
  projectHead?: ReactNode;
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
  projectHead,
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
  /**
   * A phone previews as a phone.
   *
   * This defaulted to `"desktop"`, so someone on an iPhone opened their app
   * rendered at a desktop width and scaled down — small text, a layout they
   * were not going to ship to a phone anyway, and no indication that the
   * viewport was a choice. The device toggles are hidden on narrow screens
   * (a phone IS the mobile viewport), which made the wrong default permanent
   * there rather than merely wrong.
   */
  const [device, setDevice] = useState<DeviceMode>("desktop");
  const effectiveDevice: DeviceMode = narrow ? "mobile" : device;
  const [reloadKey, setReloadKey] = useState(0);

  /**
   * THE MOMENT IT GOES LIVE.
   *
   * Publishing was silent: a button changed label, a pill changed colour, and
   * the single most significant thing a person does in this product — putting
   * something they made in front of other people — passed without being
   * marked at all. This watches the transition into published and plays one
   * soft ring around the page itself, once. Not confetti; the product stays
   * calm. But it should not be possible to publish and wonder whether it
   * worked.
   */
  const [justPublished, setJustPublished] = useState(false);
  const wasPublished = useRef(published);
  useEffect(() => {
    if (published && !wasPublished.current) {
      setJustPublished(true);
      const timer = setTimeout(() => setJustPublished(false), 1000);
      wasPublished.current = published;
      return () => clearTimeout(timer);
    }
    wasPublished.current = published;
  }, [published]);

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

  /* The copy notice used to be a floating pill with its own dismissal timer —
     2.2s for success, 6s for failure — positioned over the canvas. It is a
     toast now: same two outcomes, one surface for every piece of feedback in
     the product, and no timer to keep in sync. */

  async function copyLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success(t("previewLinkCopied"));
    } catch {
      // A refused clipboard used to be swallowed entirely, on the reasoning
      // that silence beats claiming a copy that did not happen. But silence
      // makes the button look broken and leaves nothing to paste, so say what
      // went wrong and where the link still is. The publish dock already
      // answers this way; this is the same answer in the rail.
      toast.error(t("previewLinkCopyFailed"));
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
          style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
        >
          <ModeSwitch
            mode={previewOpen ? "preview" : "chat"}
            onChange={(next) => changePreviewOpen(next === "preview")}
            chatLabel={t("modeChat")}
            previewLabel={t("modePreview")}
          />
        </div>
      )}

      {/* RESIZABLE, on desktop, and only when both panes are actually on
          screen. How much room the conversation needs against the page is a
          judgement that changes with the task — reading a long reply wants
          width, checking a layout wants the preview — and it was fixed at 43%.

          Deliberately NOT on a phone: there, one surface is shown at a time
          and the mode switch is the control. A drag handle between two panes
          that are never side by side would be a handle for nothing. */}
      <ResizablePanelGroup
        orientation="horizontal"
        className="relative flex min-h-0 flex-1 overflow-hidden"
      >
      {showChat && (
        /* THE CONVERSATION IS A COLUMN OF PAPER ON THE CANVAS.
           It was a flush pane sharing a hard vertical rule with the preview —
           two boxes in a frame. It floats now: inset, its own surface, its own
           soft edge. Nothing divides the two halves of the screen; they sit on
           the same desk. */
        <ResizablePanel
          id="conversation"
          /* Strings, not numbers. In this version of the library a NUMBER is
             pixels and a string is a percentage — `defaultSize={43}` sized the
             conversation to 43 pixels, which is exactly the sliver it became. */
          defaultSize={previewOpen && !narrow ? "43%" : "100%"}
          minSize="28%"
          className="flex min-h-0 min-w-0 flex-col p-3 md:py-4 md:pl-4 md:pr-2"
        >
          <div
            className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--r-xl)] border"
            style={{
              borderColor: "var(--color-border)",
              background: "var(--color-surface)",
              boxShadow: "var(--shadow-soft)",
            }}
          >
            {/* THE CARD NAMES WHAT THE CONVERSATION IS ABOUT.
                This was a bar across the top of the whole app. It is the head
                of the card now: no rule across the screen, and the name sits
                with the thing it names. Desktop only — on a phone the bar above
                the canvas already carries it. */}
            {!narrow && projectHead && (
              <div className="flex shrink-0 items-center gap-2.5 px-4 pb-1 pt-4">{projectHead}</div>
            )}
          {chat({
            previewOpen,
            canOpenPreview: !previewOpen,
            openPreview: () => changePreviewOpen(true),
          })}
          </div>
        </ResizablePanel>
      )}

      {showChat && previewOpen && !narrow && <ResizableHandle withHandle />}

      {previewOpen && (
        <ResizablePanel id="preview" minSize="30%" className="min-h-0 min-w-0">
        <section
          aria-label={t("previewRegion")}
          /* OPEN SKY. The preview was a bordered panel filled with canvas
             grey, which made the thing you made look like a file inside a
             pane. It is a colour field now — the same field the New Project
             screen opens on — so the page you built is the only object in it,
             and the screen visibly warms when there is something to see. */
          className="s-fade s-sky relative flex min-h-0 min-w-0 flex-1 flex-col"
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
          {/* THE CONTROLS BELONG TO THE THING THEY ACT ON.
              They were a full-width strip pinned to the top of the panel, in
              the shape of an editor toolbar. A floating capsule over the sky,
              centred above the page it controls — closer to the chrome on a
              photograph than to a builder's ribbon. */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center px-4 pt-4">
          <div className="s-capsule pointer-events-auto flex max-w-full items-center px-1">
            {/* The part that may scroll: the title, the status, and the
                controls you can do without for a moment. The outer row has no
                gap of its own, so on a wide toolbar this sits flush against the
                pinned group below and the desktop row is the one it always
                was. */}
            <div className={cn("flex min-w-0 flex-1 items-center gap-2", narrow ? "overflow-hidden" : "overflow-x-auto")}>
            {/* THE TOOLBAR IS ACTIONS ONLY, at every width.
                It used to open with the word "Preview" and the publication
                state. The header one row above already names the project and
                says whether it is live, and on a phone the mode switch between
                them says which of the two surfaces you are looking at — so this
                was the third statement of the same fact.

                It was also costing real room. In Russian the device labels are
                "Компьютер / Планшет / Телефон", and with the title in the row
                the switcher truncated to "Т…" on a 1440px screen. Dropping the
                repetition is what let the controls say words at all. */}
            <div className="ml-auto flex shrink-0 items-center gap-1">
              {/* THE DEVICE SWITCHER IS ICONS, WITH THE WORDS ONE HOVER AWAY.
                  It carried the nouns inline — "Computer / Tablet / Phone" —
                  which made the meaning unmissable and the toolbar cluttered:
                  three words plus three icons plus four more controls in one
                  bar, and in Russian the labels are long enough to truncate.

                  Icon-only, with the label in a tooltip AND in `aria-label`,
                  so the meaning is available on hover, on keyboard focus and
                  to a screen reader. The tooltip opens below the control
                  rather than beside it, because a side tooltip in a row of
                  icons lands on the next one.

                  Phones do not get this control at all — a phone IS the
                  mobile viewport — so nothing here has to survive a tap-only
                  device without hover. */}
              {hasOutput && !narrow && (
                <>
                <div
                  role="group"
                  aria-label={t("viewportGroup")}
                  className="s-capsule border-0 p-0 shadow-none"
                >
                  {([
                    ["desktop", t("viewportDesktop"), IconDesktop],
                    ["tablet", t("viewportTablet"), IconTablet],
                    ["mobile", t("viewportMobile"), IconMobile],
                  ] as const).map(([mode, label, Icon]) => (
                    <Tooltip key={mode} label={label} side="bottom">
                      <button
                        type="button"
                        aria-label={label}
                        aria-pressed={device === mode}
                        onClick={() => setDevice(mode)}
                        className="s-seg"
                      >
                        <Icon className="h-[16px] w-[16px]" />
                      </button>
                    </Tooltip>
                  ))}
                </div>
                  <ToolbarDivider />
                  <Tooltip label={t("reload")} side="bottom">
                    <BarButton label={t("reload")} onClick={() => setReloadKey((key) => key + 1)}>
                      <IconRefresh className="h-[18px] w-[18px]" />
                    </BarButton>
                  </Tooltip>
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
          </div>

          {/* Top padding clears the floating capsule. `lg:pr-[92px]` reserved a
              gutter for a rail of buttons down the right edge that no longer
              exists, and it was pushing the page off-centre. */}
          <div className="min-h-0 flex-1 overflow-auto px-4 pb-6 pt-[4.75rem] lg:px-8 lg:pb-10">
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
                style={{ borderColor: "var(--color-warning)", background: "var(--color-warning-soft)" }}
              >
                <p className="text-[13px] font-semibold" style={{ color: "var(--color-warning)" }}>
                  {t("previewRuntimeErrorTitle")}
                </p>
                <ul className="mt-1 space-y-0.5">
                  {runtimeErrors.slice(0, 3).map((message) => (
                    <li key={message} className="truncate font-mono text-[11.5px]" style={{ color: "var(--color-ink-secondary)" }}>
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
                {/* The generated application is the one lit object in a dark
                    room, and the only thing in the system carrying a real
                    shadow — because unlike every other surface it genuinely is
                    floating above the room, and that contrast is the whole
                    point of the studio. It used to be a white panel with a grey
                    hairline on a grey panel, which is why it never read as the
                    subject of the screen it is the subject of. */}
                <ViewportFrame
                  key={`${reloadKey}-${effectiveDevice}`}
                  width={DEVICE_WIDTHS[effectiveDevice]}
                  title={t("previewRegion")}
                  className={cn("s-artifact", justPublished && "s-landed")}
                >
                  {typeof preview === "function" ? preview(effectiveDevice) : preview}
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
        </ResizablePanel>
      )}

      </ResizablePanelGroup>

      {/* THE FLOATING RAIL IS GONE.
          Two icon buttons in a pill down the right edge, for switching between
          the conversation and the page. It was the last survivor of an older
          layout, it reserved a 92px gutter that pushed the page off-centre, and
          it duplicated a control that already exists in two better places:
          Close lives in the capsule attached to the page, and on a phone the
          mode switch sits above both surfaces. */}

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
      {/* WAITING IS A MOMENT, NOT A GAP.
          This was a 36px dashed ring above two lines of small grey text — the
          visual language of an error state, shown to somebody who is watching
          their idea get built for the first time. While something is genuinely
          being made the three dots are the same indicator the conversation
          uses, so "Ventrio is working" looks the same wherever it happens. */}
      {status === "generating" || status === "loading" ? (
        <span className="s-thinking mb-3 flex items-center gap-1.5" aria-hidden>
          <span />
          <span />
          <span />
        </span>
      ) : (
        <span
          aria-hidden
          className="mb-3 h-10 w-10 rounded-full border-2"
          style={{
            borderColor:
              status === "failed" || status === "unavailable"
                ? "var(--color-warning)"
                : "var(--color-border-strong)",
            borderStyle: status === "empty" ? "dashed" : "solid",
          }}
        />
      )}
      <p className="s-title">{t(copy[0])}</p>
      <p className="s-body mt-1.5">
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
 * WHY IT IS PORTALLED, which is the whole fix. The first version was a
 * `<details>` with an absolutely positioned panel, and it was reported clipping
 * off the visible surface. It had to: the toolbar sits inside two ancestors
 * carrying `overflow-hidden` — the workspace root and the panel row — and an
 * absolutely positioned child cannot escape either. `position: fixed` would not
 * have been reliable either, because any ancestor with a transform (the panel's
 * own entrance animation) makes fixed positioning resolve against that ancestor
 * instead of the viewport.
 *
 * So it renders into `document.body` and positions itself from the trigger's
 * measured rect, clamped to the viewport on both axes. It cannot be clipped by
 * anything, and it cannot run off the edge of a narrow screen.
 *
 * Rows are 44px, and it closes on outside pointer, Escape, scroll and resize —
 * the four ways a person expects a popover on a phone to go away.
 */
function ToolbarMenu({
  label,
  items,
}: {
  label: string;
  items: Array<{ key: string; label: string; icon: ReactNode; onSelect?: () => void; href?: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [spot, setSpot] = useState<{ top: number; right: number; maxHeight: number } | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const panel = useRef<HTMLDivElement | null>(null);

  /**
   * Placed against the VISIBLE viewport, and aware of its own height.
   *
   * The previous version clamped the menu's TOP edge to the bottom of the
   * screen — which is not a constraint at all, because the menu has height. A
   * trigger near the bottom put the top edge just inside the viewport and the
   * remaining rows below it, off screen. That is the "leaves the viewport"
   * report, and it survived being portalled because the portal fixed clipping,
   * not arithmetic.
   *
   * It also measured `window.innerHeight`, which is the LAYOUT viewport: with
   * the keyboard open or the URL bar showing, that is a taller box than the one
   * the person can see.
   *
   * So: measure the panel, prefer below the trigger, flip above when it does
   * not fit, and cap the height when it fits in neither — a menu that scrolls
   * inside itself is finished; one that runs off the screen is not.
   */
  const place = useCallback(() => {
    const node = trigger.current;
    if (!node) return;

    const rect = node.getBoundingClientRect();
    const view = window.visualViewport;
    const viewH = view?.height ?? window.innerHeight;
    const viewW = view?.width ?? window.innerWidth;

    const GAP = 6;
    const MARGIN = 8;
    // Before the first measurement the panel is not mounted; the estimate only
    // has to be close enough to choose a side, and it is corrected on the next
    // frame once the real height is known.
    const height = panel.current?.offsetHeight ?? 200;

    const below = viewH - rect.bottom - GAP - MARGIN;
    const above = rect.top - GAP - MARGIN;
    const openUp = below < height && above > below;

    setSpot({
      top: openUp
        ? Math.max(MARGIN, rect.top - GAP - Math.min(height, above))
        : Math.min(rect.bottom + GAP, Math.max(MARGIN, viewH - Math.min(height, below) - MARGIN)),
      right: Math.max(MARGIN, viewW - rect.right),
      maxHeight: Math.max(120, (openUp ? above : below)),
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    place();
    // Again on the next frame: the first call ran before the panel was mounted
    // and had to estimate its height.
    const settle = window.requestAnimationFrame(place);
    const close = () => setOpen(false);
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    // `true` so a scroll inside the preview panel closes it too, not only one
    // on the document.
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    document.addEventListener("keydown", onKey);
    return () => {
      window.cancelAnimationFrame(settle);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, place]);

  if (items.length === 0) return null;

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--r-sm)]"
        style={{ color: "var(--color-ink-secondary)" }}
      >
        <span aria-hidden className="text-[20px] leading-none">⋯</span>
      </button>

      {open && spot && createPortal(
        <>
          {/* Catches the outside tap. Transparent, full-screen, below the menu. */}
          <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="menu"
            aria-label={label}
            ref={panel}
            className="lift-3 fixed z-[61] flex min-w-[224px] max-w-[calc(100vw-16px)] flex-col overflow-y-auto overscroll-contain rounded-[var(--r-md)] border p-1"
            style={{
              top: spot.top,
              right: spot.right,
              maxHeight: spot.maxHeight,
              borderColor: "var(--color-border)",
              background: "var(--color-surface)",
            }}
          >
            {items.map((item) =>
              item.href ? (
                <a
                  key={item.key}
                  role="menuitem"
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setOpen(false)}
                  className="flex min-h-[44px] items-center gap-3 rounded-[var(--r-sm)] px-3 text-[14.5px] font-medium"
                  style={{ color: "var(--color-ink)" }}
                >
                  {item.icon}
                  {item.label}
                </a>
              ) : (
                <button
                  key={item.key}
                  role="menuitem"
                  type="button"
                  onClick={() => { item.onSelect?.(); setOpen(false); }}
                  className="flex min-h-[44px] items-center gap-3 rounded-[var(--r-sm)] px-3 text-left text-[14.5px] font-medium"
                  style={{ color: "var(--color-ink)" }}
                >
                  {item.icon}
                  {item.label}
                </button>
              ),
            )}
          </div>
        </>,
        document.body,
      )}
    </>
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
 * would answer a question nobody is asking.
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
      style={{ background: "var(--color-surface-sunken)" }}
    >
      {(["chat", "preview"] as const).map((value) => (
        <button
          key={value}
          role="tab"
          type="button"
          aria-selected={mode === value}
          onClick={() => onChange(value)}
          className={cn(
            "min-h-[38px] rounded-[var(--r-xs)] px-4 text-[14px] font-medium transition-colors",
            mode === value ? "shadow-sm" : "",
          )}
          style={
            mode === value
              ? { background: "var(--color-surface)", color: "var(--color-ink)" }
              : { color: "var(--color-ink-secondary)" }
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
  return <span className="mx-1 h-5 w-px shrink-0" style={{ background: "var(--color-border)" }} aria-hidden />;
}
