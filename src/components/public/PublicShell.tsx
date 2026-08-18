import type { ReactNode } from "react";
import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/currentUser";
import "@/components/public/public.css";

/**
 * The frame every public page is mounted in: one header, one footer, one
 * stylesheet, one width.
 *
 * WHY A SHELL AND NOT A LAYOUT FILE. `src/app/layout.tsx` is shared with the
 * signed-in application, which has its own chrome — putting the public header
 * there would put it behind the workspace too. The public routes are not
 * contiguous in the route tree either (`/pricing`, `/about`, `/faq`, `/contact`
 * and the legal pages sit at the root beside `/dashboard`), so there is no
 * single segment a layout could cover without also covering the app. A shell
 * that pages opt into is the honest shape.
 *
 * It resolves the visitor itself rather than taking a prop, because the only
 * thing the header needs it for is choosing between "Start free" and "Your
 * projects", and making twelve pages each remember to pass that through is how
 * one of them ends up wrong.
 */
export async function PublicShell({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  return (
    <div className="lp">
      <PublicHeader isAuthenticated={Boolean(user)} />
      <main>{children}</main>
      <div className="lp-wrap">
        <PublicFooter />
      </div>
    </div>
  );
}
