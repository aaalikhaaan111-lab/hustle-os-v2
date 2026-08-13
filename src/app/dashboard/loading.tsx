import { WorkspaceShell } from "@/components/workspace-ui/WorkspaceShell";
import { PageBody } from "@/components/workspace-ui/PageBody";
import { WsBlock, WsCardSkeleton, WsHeadingSkeleton } from "@/components/workspace-ui/Skeletons";

/**
 * What Overview looks like while its two queries run.
 *
 * The shell is rendered here as well as by the page. Without it the rail would
 * be absent for the length of the load and then appear, which moves the whole
 * page sideways at the moment the content arrives — the jump reads worse than
 * the wait. Rendering it in both places means the only thing that changes is
 * the content column.
 *
 * `initials` is empty on purpose: the avatar is a circle until the user's real
 * initials are known, rather than a guess that visibly corrects itself.
 */
export default function DashboardLoading() {
  return (
    <WorkspaceShell initials="">
      <PageBody>
        <WsHeadingSkeleton />

        {/* The active project card: preview panel beside its summary. */}
        <div className="mt-7 overflow-hidden rounded-[var(--r-lg)] border" style={{ borderColor: "var(--line)" }}>
          <div className="flex flex-col sm:flex-row">
            <WsBlock className="h-[180px] w-full shrink-0 sm:h-auto sm:w-[280px]" radius="0" />
            <div className="flex min-w-0 flex-1 flex-col justify-between gap-6 p-5">
              <div>
                <WsBlock className="h-[18px] w-44 max-w-full" />
                <WsBlock className="mt-2.5 h-[14px] w-full max-w-sm" />
                <WsBlock className="mt-2.5 h-[13px] w-32" />
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <WsBlock className="h-[13px] w-28" />
                <WsBlock className="h-[13px] w-10" />
              </div>
            </div>
          </div>
        </div>

        {/* Recent projects. */}
        <div className="mt-7 grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <WsCardSkeleton key={i}>
              <WsBlock className="h-[15px] w-28 max-w-full" />
              <WsBlock className="mt-2 h-[13px] w-20" />
            </WsCardSkeleton>
          ))}
        </div>
      </PageBody>
    </WorkspaceShell>
  );
}
