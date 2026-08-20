-- ============================================================================
-- Stop a user from granting themselves a paid plan.
--
-- THE HOLE, demonstrated against production on 2026-08-20 with an ordinary
-- signed-in account and nothing but its own access token:
--
--   PATCH /rest/v1/profiles?id=eq.<own uid>   {"plan":"pro"}   ->  200 OK
--
-- The account came back as `pro`. It was restored to `free` immediately, and
-- the same request also succeeded for `subscription_status` and
-- `paddle_customer_id`. Anyone with an account could unlock every paid
-- entitlement — src/lib/billing/userPlan.ts reads `plan` straight out of this
-- table and entitlementsFor() trusts it — and could equally have corrupted the
-- Paddle linkage that reconciles real subscriptions.
--
-- WHY IT WAS OPEN. The policy is right; the grant is too wide:
--
--   create policy "Users can update own profile" on public.profiles
--     for update using (auth.uid() = id) with check (auth.uid() = id);
--
-- That correctly restricts WHICH ROW you may write. It says nothing about WHICH
-- COLUMNS, because Postgres RLS has no column dimension — and `profiles` was
-- created on 2026-07-11 holding only a display name. `plan`,
-- `paddle_customer_id`, `paddle_subscription_id` and `subscription_status` were
-- added later by the billing migrations, and each one silently widened what
-- that existing policy allowed. The policy never changed; its blast radius did.
--
-- THE FIX is column-level GRANTs, which is the one mechanism that does have a
-- column dimension. This is not a new pattern in this schema — it is exactly
-- what 20260723120000_add_user_ai_usage.sql and 20260802211000_add_generation_jobs.sql
-- already do (`revoke all ... grant select`), and those two tables were verified
-- closed by the same probe that found this one open. `profiles` simply predates
-- the house style.
--
-- Billing is unaffected: src/app/api/webhooks/paddle/route.ts writes `plan` and
-- the Paddle columns through createServiceClient(), and the service role
-- bypasses both RLS and these grants. Nothing about billing logic changes.
-- ============================================================================

-- The five columns a person may change about themselves. Four are the Settings
-- form (src/lib/actions/profile.ts), the fifth is the language switcher
-- (src/lib/actions/locale.ts). These are the ONLY profile columns any
-- user-facing code writes; onboarding fields are not included because nothing
-- currently writes them, and a grant should be widened deliberately rather than
-- kept warm in advance.
revoke update on table public.profiles from anon, authenticated;
grant update (
  display_name,
  preferred_name,
  work_description,
  personal_instructions,
  locale
) on table public.profiles to authenticated;

-- Reading your own row stays as it was; the SELECT policy still scopes it to
-- auth.uid() = id.
grant select on table public.profiles to authenticated;

-- There is no INSERT or DELETE policy on profiles, so neither can match a row
-- today. Revoking the grants as well means a policy added later cannot quietly
-- inherit a privilege nobody meant to give it — the same defence-in-depth
-- reasoning as the column list above.
revoke insert, delete on table public.profiles from anon, authenticated;

-- ----------------------------------------------------------------------------
-- generation_jobs: closed in practice, tightened anyway.
--
-- It has only a SELECT policy, so an UPDATE or DELETE matches zero rows and the
-- probe returned an empty result. But the table-level grants are still present,
-- unlike user_ai_usage which revoked them. Aligning the two means the guarantee
-- rests on grants AND policies rather than on policies alone.
-- ----------------------------------------------------------------------------
revoke insert, update, delete on table public.generation_jobs from anon, authenticated;

comment on table public.profiles is
  'One row per auth user, provisioned by handle_new_user(). Self-service writes are limited by column GRANT to display_name, preferred_name, work_description, personal_instructions and locale: plan and the Paddle columns are writable only by the service role via the billing webhook.';
