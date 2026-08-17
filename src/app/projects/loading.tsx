import { WorkspaceShell } from "@/components/workspace-ui/WorkspaceShell";
import { WsBlock } from "@/components/workspace-ui/Skeletons";

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
      <div className="min-h-full">
        <section className="s-sky-band px-5 pb-10 pt-10 sm:px-10 sm:pb-12 sm:pt-16">
          <div className="mx-auto flex w-full max-w-[1120px] flex-wrap items-end justify-between gap-5">
            <div className="min-w-0">
              <WsBlock className="h-[34px] w-64 max-w-full sm:h-[42px]" />
              <WsBlock className="mt-3 h-[15px] w-80 max-w-full" />
            </div>
            <WsBlock className="h-11 w-40" radius="999px" />
          </div>
        </section>
        <div className="s-sheet mx-auto w-full max-w-[1160px] px-5 pb-16 pt-7 sm:px-10 sm:pt-9">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b pb-3"
               style={{ borderColor: "var(--color-border)" }}>
            <WsBlock className="h-[15px] min-w-[160px] flex-1 sm:max-w-[240px] sm:flex-none" />
            <WsBlock className="h-[15px] w-[140px]" />
          </div>
          <ul className="mt-8 grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <li key={i}>
                <WsBlock className="aspect-[16/10] w-full" radius="var(--r-xl)" />
                <WsBlock className="mt-3 h-[17px] w-40 max-w-full" />
                <WsBlock className="mt-2 h-[13px] w-28" />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </WorkspaceShell>
  );
}
