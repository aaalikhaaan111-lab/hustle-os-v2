import { createClient } from "@supabase/supabase-js";

/**
 * Cross-user authorization, proved rather than assumed.
 *
 * Every check here runs through PostgREST with a REAL user's access token —
 * the same path the browser uses — because that is the only way to exercise
 * row-level security. Testing with the service role would prove nothing: it
 * bypasses RLS by design.
 *
 * The shape of every assertion is "User B tries to reach User A's row and gets
 * nothing". A silent empty result is a PASS: RLS filters rather than errors, so
 * "no rows" is exactly what a correctly denied read looks like. A returned row
 * is the failure.
 *
 * B is created and deleted by this script. Nothing else is written.
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
 * SUPABASE_SERVICE_ROLE_KEY and DEV_TEST_EMAIL / DEV_TEST_PASSWORD. Without
 * them it skips, so the offline suite stays runnable.
 */
let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail?: string) {
  if (ok) { passed += 1; return; }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const A_EMAIL = process.env.DEV_TEST_EMAIL;
const A_PASSWORD = process.env.DEV_TEST_PASSWORD;

if (!URL_ || !ANON || !SERVICE || !A_EMAIL || !A_PASSWORD) {
  console.log("  (rls probe skipped: needs Supabase env + DEV_TEST_EMAIL/PASSWORD)");
  process.exit(0);
}

const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });
const anon = () => createClient(URL_, ANON, { auth: { persistSession: false } });

/* ── the two identities ──────────────────────────────────────────────────── */

const clientA = anon();
const signInA = await clientA.auth.signInWithPassword({ email: A_EMAIL, password: A_PASSWORD });
if (signInA.error || !signInA.data.user) {
  console.error("cannot sign in as user A:", signInA.error?.message);
  process.exit(1);
}
const A = signInA.data.user.id;

const B_EMAIL = `rls-probe+${Date.now()}@ventrio.invalid`;
const B_PASSWORD = `Probe!${Math.random().toString(36).slice(2)}Aa1`;
const created = await admin.auth.admin.createUser({
  email: B_EMAIL, password: B_PASSWORD, email_confirm: true,
});
if (created.error || !created.data.user) {
  console.error("cannot create user B:", created.error?.message);
  process.exit(1);
}
const B = created.data.user.id;

const clientB = anon();
const signInB = await clientB.auth.signInWithPassword({ email: B_EMAIL, password: B_PASSWORD });
if (signInB.error) { console.error("cannot sign in as user B:", signInB.error.message); }

async function cleanup() {
  await admin.auth.admin.deleteUser(B).catch(() => {});
}

try {
  /* A row of A's that B will try to reach, found with the service role so the
     probe is not limited to what B can already see. */
  const { data: aProject } = await admin
    .from("projects").select("id, name").eq("user_id", A).limit(1).single();
  const { data: aPublication } = await admin
    .from("project_publications").select("id, slug, project_id").eq("user_id", A).limit(1).single();

  check("fixture: user A has a project to protect", Boolean(aProject?.id));

  /* ── 1. B cannot READ A's rows ─────────────────────────────────────────── */

  const OWNED = [
    /* The gallery projection is a VIEW. A view without `security_invoker`
       executes as its owner and hands every caller every user's rows — RLS
       silently bypassed — so it is probed exactly like a table. */
    "project_cards",
    "projects", "project_publications", "project_ai_messages",
    "project_ai_conversations", "project_ai_memory", "generation_jobs",
    "user_ai_usage", "project_feedback_analyses",
  ] as const;

/* project_tasks and project_outputs used to be probed here. They were dropped
   on 2026-08-20 with the retired build system
   (20260820160200_drop_retired_build_tables.sql); a probe against a table that
   no longer exists reports "no rows" and would pass forever while proving
   nothing. Section 6 asserts their absence instead. */

  for (const table of OWNED) {
    const { data, error } = await clientB.from(table).select("*").eq("user_id", A);
    /* Either denied outright or filtered to nothing. Both are correct; a row is
       not. */
    check(`B cannot read A's ${table}`,
      (data?.length ?? 0) === 0,
      error ? `error ${error.code}` : `returned ${data?.length} row(s)`);
  }

  /* Profiles are keyed by id rather than user_id. */
  const { data: bSeesAProfile } = await clientB.from("profiles").select("*").eq("id", A);
  check("B cannot read A's profile", (bSeesAProfile?.length ?? 0) === 0);

  /* ── 2. B cannot MUTATE A's rows ───────────────────────────────────────── */

  if (aProject?.id) {
    const upd = await clientB.from("projects")
      .update({ name: "owned-by-b" }).eq("id", aProject.id).select();
    check("B cannot rename A's project",
      (upd.data?.length ?? 0) === 0,
      upd.error ? `error ${upd.error.code}` : "update returned rows");

    const del = await clientB.from("projects").delete().eq("id", aProject.id).select();
    check("B cannot delete A's project",
      (del.data?.length ?? 0) === 0,
      del.error ? `error ${del.error.code}` : "delete returned rows");

    /* The row must still be there and unchanged. */
    const { data: after } = await admin
      .from("projects").select("id, name").eq("id", aProject.id).single();
    check("A's project survived both attempts",
      Boolean(after) && after?.name === aProject.name);
  }

  /* B must not be able to forge a row that CLAIMS to be A's. */
  const forged = await clientB.from("projects").insert({
    user_id: A, niche: "x", intended_outcome: "x", time_availability: "x",
    project_type: "landing", starting_stage: "idea", status: "draft",
  } as never).select();
  check("B cannot insert a project owned by A",
    (forged.data?.length ?? 0) === 0,
    forged.error ? `error ${forged.error.code}` : "insert succeeded");

  /* ── 3. anonymous reaches nothing private ──────────────────────────────── */

  const guest = anon();
  for (const table of OWNED) {
    const { data } = await guest.from(table).select("*").limit(1);
    check(`anonymous cannot read ${table}`, (data?.length ?? 0) === 0,
      `returned ${data?.length} row(s)`);
  }
  const { data: guestProfiles } = await guest.from("profiles").select("*").limit(1);
  check("anonymous cannot read profiles", (guestProfiles?.length ?? 0) === 0);

  /* ── 4. what anonymous SHOULD reach: a published project ───────────────── */

  if (aPublication?.slug) {
    const { data: pub } = await guest
      .from("project_publications").select("slug").eq("slug", aPublication.slug);
    /* Published rows are served through a server route with the service role,
       not read directly by the browser — so anonymous seeing nothing here is
       the correct, tighter answer. Recorded either way so a policy change is
       visible rather than silent. */
    check("published rows are not world-readable through PostgREST",
      (pub?.length ?? 0) === 0,
      `anonymous saw ${pub?.length} publication row(s) directly`);
  }

  /* ── 5. B's own data still works (RLS is not just "deny everything") ───── */

  const { error: ownProfileError } = await clientB.from("profiles").select("id").eq("id", B);
  check("B can still reach its own profile row", !ownProfileError);

  /* ── 6. a user cannot buy themselves a plan ────────────────────────────── */

  /* THIS IS A REGRESSION TEST FOR A REAL HOLE, not a hypothetical. Until
     20260820160400 the "Users can update own profile" policy scoped writes to
     the right ROW but said nothing about which COLUMNS, because RLS has no
     column dimension. A signed-in account could PATCH its own `plan` to "pro"
     and unlock every paid entitlement — confirmed against production, then
     reverted. The fix is a column-level GRANT, and this is what stops the next
     billing column from silently widening that policy again. */
  const escalation = await clientB.from("profiles")
    .update({ plan: "pro" } as never).eq("id", B).select("plan");
  check("B cannot grant itself a paid plan",
    (escalation.data?.length ?? 0) === 0,
    escalation.error ? `error ${escalation.error.code}` : "the update was accepted");

  for (const column of ["paddle_customer_id", "paddle_subscription_id", "subscription_status"]) {
    const billing = await clientB.from("profiles")
      .update({ [column]: "forged" } as never).eq("id", B).select("id");
    check(`B cannot write its own ${column}`,
      (billing.data?.length ?? 0) === 0,
      billing.error ? `error ${billing.error.code}` : "the update was accepted");
  }

  /* The plan must still read as it did — proof the attempts changed nothing. */
  const { data: planAfter } = await admin.from("profiles").select("plan").eq("id", B).single();
  check("B's plan is still free after the attempts", planAfter?.plan === "free",
    `plan is now ${planAfter?.plan}`);

  /* But the four fields Settings owns must still save, or the grant is too
     tight and the panel is broken. */
  const allowed = await clientB.from("profiles")
    .update({ preferred_name: "rls-probe" }).eq("id", B).select("preferred_name");
  check("B can still edit its own preferred name", (allowed.data?.length ?? 0) === 1,
    allowed.error ? `error ${allowed.error.code}` : `${allowed.data?.length} row(s)`);
  await clientB.from("profiles").update({ preferred_name: null }).eq("id", B);

  /* ── 7. the retired tables are really gone ─────────────────────────────── */

  /* A dropped table must fail as UNDEFINED, not as "empty". PostgREST answers
     an unknown relation with PGRST205; anything else means the cleanup did not
     apply, or something recreated them. */
  for (const table of ["project_tasks", "project_outputs", "project_proofs",
                       "ventures", "workshop_sessions", "workshop_participants",
                       "workshop_answers", "workshops", "workshop_registrations",
                       "challenges", "challenge_progress", "courses", "course_lessons"]) {
    const { error } = await admin.from(table as never).select("*").limit(1);
    check(`${table} no longer exists`, error?.code === "PGRST205",
      error ? `error ${error.code}` : "the relation still answers queries");
  }
} finally {
  await cleanup();
}

if (failures.length > 0) {
  console.error(`\n✗ ${failures.length} failed, ${passed} passed\n`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`✓ rls: ${passed} cross-user checks passed`);
