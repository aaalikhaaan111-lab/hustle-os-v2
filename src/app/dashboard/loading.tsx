import { WorkspaceShell } from "@/components/workspace-ui/WorkspaceShell";
import { PageBody } from "@/components/workspace-ui/PageBody";
import { WsBlock, WsHeadingSkeleton, WsRowSkeleton } from "@/components/workspace-ui/Skeletons";

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
        <WsHeadingSkeleton action />

        {/* The active project: the artifact beside its metadata column. */}
        <div className="mt-12 border-t pt-8" style={{ borderColor: "var(--color-border)" }}>
          <div className="flex flex-col gap-6 sm:flex-row sm:gap-8">
            <WsBlock className="h-[190px] w-full shrink-0 sm:h-[210px] sm:w-[300px]" radius="var(--r-lg)" />
            <div className="flex min-w-0 flex-1 flex-col justify-between gap-6">
              <div>
                <WsBlock className="h-[13px] w-40" />
                <WsBlock className="mt-3 h-[15px] w-full max-w-lg" />
              </div>
              <div>
                <div className="flex items-baseline justify-between gap-3">
                  <WsBlock className="h-[11px] w-28" />
                  <WsBlock className="h-[13px] w-8" />
                </div>
                <WsBlock className="mt-2 h-1 w-full" radius="9999px" />
                <WsBlock className="mt-3.5 h-[13px] w-48" />
              </div>
            </div>
          </div>
        </div>

        {/* Recent projects, as index rows rather than a three-column grid. */}
        <div className="mt-12">
          <WsBlock className="h-[11px] w-32" />
          <ul className="mt-3">
            {[0, 1, 2].map((i) => (
              <WsRowSkeleton key={i} />
            ))}
          </ul>
        </div>
      </PageBody>
    </WorkspaceShell>
  );
}
