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

        {/* The search field and filter sit on a hairline now, not in boxes. */}
        <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 border-b pb-3"
             style={{ borderColor: "var(--color-border)" }}>
          <WsBlock className="h-[15px] min-w-[160px] flex-1 sm:max-w-[240px] sm:flex-none" />
          <WsBlock className="h-[15px] w-[140px]" />
        </div>

        <ul className="mt-1 flex flex-col">
          {[0, 1, 2, 3].map((i) => (
            <WsRowSkeleton key={i} />
          ))}
        </ul>
      </PageBody>
    </WorkspaceShell>
  );
}
