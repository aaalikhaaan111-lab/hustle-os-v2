import { WorkspaceShell } from "@/components/workspace-ui/WorkspaceShell";
import { PageBody } from "@/components/workspace-ui/PageBody";
import { WsBlock, WsHeadingSkeleton, WsRowSkeleton } from "@/components/workspace-ui/Skeletons";

/**
 * The projects list while it loads.
 *
 * Four rows, because the list is usually short and a long column of
 * placeholders would promise more than most accounts have. See
 * `dashboard/loading.tsx` for why the shell is rendered here too.
 */
export default function ProjectsLoading() {
  return (
    <WorkspaceShell initials="">
      <PageBody>
        <WsHeadingSkeleton action />

        {/* The search field and view toggle above the list. */}
        <div className="mt-7 flex flex-wrap items-center gap-2">
          <WsBlock className="h-10 min-w-[200px] flex-1 sm:max-w-[280px] sm:flex-none" radius="var(--r-md)" />
          <WsBlock className="h-10 w-[92px]" radius="var(--r-md)" />
        </div>

        <ul className="mt-5 flex flex-col">
          {[0, 1, 2, 3].map((i) => (
            <WsRowSkeleton key={i} />
          ))}
        </ul>
      </PageBody>
    </WorkspaceShell>
  );
}
