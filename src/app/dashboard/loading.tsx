import { WorkspaceShell } from "@/components/workspace-ui/WorkspaceShell";
import { WsBlock } from "@/components/workspace-ui/Skeletons";

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
      {/* The greeting band, then the sheet of work — the real composition, so
          nothing jumps when the data lands. */}
      <div className="min-h-full">
        <section className="s-sky-band px-5 pb-12 pt-12 sm:px-10 sm:pb-16 sm:pt-20">
          <div className="mx-auto w-full max-w-[1120px]">
            <WsBlock className="h-[42px] w-[18rem] max-w-full sm:h-[56px] sm:w-[26rem]" />
            <WsBlock className="mt-5 h-[16px] w-[22rem] max-w-full" />
            <div className="mt-8 flex gap-3">
              <WsBlock className="h-11 w-40" radius="999px" />
              <WsBlock className="h-11 w-52" radius="999px" />
            </div>
          </div>
        </section>
        <div className="s-sheet mx-auto w-full max-w-[1160px] px-5 pb-16 pt-8 sm:px-10 sm:pt-10">
          <WsBlock className="h-[20px] w-32" />
          <ul className="mt-6 grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
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
