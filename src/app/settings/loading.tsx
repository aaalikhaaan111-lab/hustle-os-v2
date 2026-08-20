import { WorkspaceShell } from "@/components/workspace-ui/WorkspaceShell";
import { WsBlock } from "@/components/workspace-ui/Skeletons";

/**
 * Settings while it loads.
 *
 * It was the one async workspace route without a `loading.tsx`, so opening it
 * showed the shell and then an empty column until the profile and usage reads
 * came back — the flash of nothing this file exists to prevent.
 *
 * The geometry matches `SettingsClient` rather than being generic: a 15rem rail
 * with a title, the search field and six section rows, a hairline, and a
 * 640px content column. A skeleton whose shape does not match what arrives is
 * two layouts in a row, which reads worse than one honest wait.
 */
export default function SettingsLoading() {
  return (
    <WorkspaceShell initials="">
      <div className="mx-auto w-full max-w-[1120px] px-5 py-10 sm:px-10 sm:py-14">
        <div className="flex flex-col gap-6 md:flex-row md:gap-0">
          {/* The rail: heading, search, then the six sections. */}
          <aside className="shrink-0 md:w-60 md:border-r md:pr-6" style={{ borderColor: "var(--color-border)" }}>
            <WsBlock className="h-[30px] w-40" />
            <WsBlock className="mt-4 h-[38px] w-full" radius="var(--r-md)" />
            <div className="mt-3 flex gap-1 overflow-hidden md:flex-col">
              {Array.from({ length: 6 }).map((_, i) => (
                <WsBlock key={i} className="h-10 w-32 shrink-0 md:w-full" radius="var(--r-md)" />
              ))}
            </div>
          </aside>

          {/* The panel: title, description, then the identity block and form. */}
          <div className="min-w-0 flex-1 md:max-w-[640px] md:pl-8">
            <WsBlock className="h-[22px] w-44" />
            <WsBlock className="mt-2 h-[15px] w-72 max-w-full" />

            <WsBlock className="mt-6 h-[76px] w-full" radius="var(--r-md)" />

            <div className="mt-6 flex flex-col gap-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i}>
                  <WsBlock className="h-[13px] w-40" />
                  <WsBlock className="mt-2 h-[46px] w-full" radius="12px" />
                </div>
              ))}
            </div>

            <WsBlock className="mt-6 h-11 w-36" radius="var(--r-md)" />
          </div>
        </div>
      </div>
    </WorkspaceShell>
  );
}
