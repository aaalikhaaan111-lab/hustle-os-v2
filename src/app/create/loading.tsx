import { WorkspaceShell } from "@/components/workspace-ui/WorkspaceShell";
import { WsBlock } from "@/components/workspace-ui/Skeletons";

/**
 * /create while the saved draft is read.
 *
 * The route resumes an unfinished creation session from the server, so the wait
 * is a real query and the screen was blank for it. What is drawn is the empty
 * composer this page opens with — the one thing that is on screen whether or
 * not a draft comes back — so an arriving conversation fills in above it rather
 * than replacing it.
 */
export default function CreateLoading() {
  return (
    <WorkspaceShell initials="" defaultCollapsed fill>
      <div className="flex h-full min-h-0 flex-col justify-end">
        <div className="px-5 pb-6 sm:px-8">
          <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4">
            <WsBlock className="h-[22px] w-56 max-w-full" />
            <WsBlock className="h-[52px] w-full" radius="var(--r-lg)" />
          </div>
        </div>
      </div>
    </WorkspaceShell>
  );
}
