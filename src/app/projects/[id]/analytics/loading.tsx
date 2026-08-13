import { WorkspaceShell } from "@/components/workspace-ui/WorkspaceShell";
import { PageBody } from "@/components/workspace-ui/PageBody";
import { WsMetricSkeleton, WsHeadingSkeleton } from "@/components/workspace-ui/Skeletons";

/**
 * Analytics while its publication and response queries run.
 *
 * Four tiles, matching the four the live state renders. The page has three
 * outcomes — unpublished, published-but-quiet, and live — and only the live one
 * shows tiles; a skeleton cannot know which is coming. Tiles are the right
 * guess because they are the shape that costs a query, and the two empty states
 * replace them without moving the heading.
 */
export default function AnalyticsLoading() {
  return (
    <WorkspaceShell initials="">
      <PageBody>
        <WsHeadingSkeleton />
        <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <WsMetricSkeleton key={i} />
          ))}
        </div>
      </PageBody>
    </WorkspaceShell>
  );
}
