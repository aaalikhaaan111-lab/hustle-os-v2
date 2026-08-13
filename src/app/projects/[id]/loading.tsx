import { WorkspaceShell } from "@/components/workspace-ui/WorkspaceShell";
import { WsBlock } from "@/components/workspace-ui/Skeletons";

/**
 * The project workspace while the project, its conversation and its usage load.
 *
 * The shell takes `defaultCollapsed fill` exactly as the page does, so the rail
 * is already narrow and the sheet already full-height when the real workspace
 * replaces this — the frame does not move, only what is inside it.
 *
 * The shape is the conversation: a column of turns with the composer pinned at
 * the bottom. The preview is not drawn. Whether there is anything to preview is
 * precisely what this page is still finding out, and a preview-shaped
 * placeholder would promise a build to someone whose project has none.
 */
export default function ProjectWorkspaceLoading() {
  return (
    <WorkspaceShell initials="" defaultCollapsed fill>
      <div className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1 overflow-hidden">
          <div className="mx-auto flex w-full max-w-[720px] flex-col gap-7 px-5 py-8 sm:px-8">
            {/* An incoming turn. */}
            <div className="flex flex-col gap-2.5">
              <WsBlock className="h-[14px] w-full max-w-[560px]" />
              <WsBlock className="h-[14px] w-full max-w-[480px]" />
              <WsBlock className="h-[14px] w-40" />
            </div>
            {/* One of the visitor's own, which sits right. */}
            <div className="flex justify-end">
              <WsBlock className="h-[38px] w-full max-w-[280px]" radius="var(--r-md)" />
            </div>
            <div className="flex flex-col gap-2.5">
              <WsBlock className="h-[14px] w-full max-w-[520px]" />
              <WsBlock className="h-[14px] w-64" />
            </div>
          </div>
        </div>

        {/* The composer keeps its place at the bottom of the sheet. */}
        <div className="shrink-0 px-5 pb-6 sm:px-8">
          <div className="mx-auto w-full max-w-[720px]">
            <WsBlock className="h-[52px] w-full" radius="var(--r-lg)" />
          </div>
        </div>
      </div>
    </WorkspaceShell>
  );
}
