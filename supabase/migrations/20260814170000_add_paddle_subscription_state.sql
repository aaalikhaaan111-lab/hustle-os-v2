-- Where a subscription came from, alongside the plan it grants.
--
-- `profiles.plan` stays the only thing the product reads: every entitlement
-- decision goes through src/lib/billing/plans.ts and asks for a plan, never for
-- a subscription. These three columns exist so a human can reconcile an account
-- with Paddle — "which subscription is this, and what did Paddle last say about
-- it" — and so a webhook arriving out of order can be recognised.
--
-- Deliberately not a billing system. No invoices, no prices, no periods, no
-- payment methods: Paddle owns all of that and mirroring it here would create a
-- second copy that can disagree with the real one.
--
-- Nullable throughout, because most accounts will never have a subscription and
-- an absent one is not an error.

begin;

alter table public.profiles
  add column if not exists paddle_customer_id text,
  add column if not exists paddle_subscription_id text,
  add column if not exists subscription_status text;

comment on column public.profiles.paddle_customer_id is
  'Paddle customer id. For support and reconciliation only; never an entitlement input.';
comment on column public.profiles.paddle_subscription_id is
  'Paddle subscription id. For support and reconciliation only.';
comment on column public.profiles.subscription_status is
  'Last status Paddle reported (active, trialing, past_due, canceled, ...). Entitlement comes from plan.';

-- One subscription belongs to one account. A second profile claiming the same
-- subscription id means something went wrong upstream, and it should fail loudly
-- rather than silently granting two accounts one payment.
create unique index if not exists profiles_paddle_subscription_id_key
  on public.profiles (paddle_subscription_id)
  where paddle_subscription_id is not null;

commit;
