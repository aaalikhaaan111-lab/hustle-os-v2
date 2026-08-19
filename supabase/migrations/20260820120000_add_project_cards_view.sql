-- The gallery's own projection, so a card never carries a generated app.
--
-- WHAT WAS WRONG. `listProjects` ran `select("*")` and the gallery rendered
-- from it. Measured on the largest real account: 19 projects, 494 kB, of which
-- `snapshot_fields` was 475 kB — 96%. Nearly all of that is
-- `app_runtime.app.files`, the generated application's SOURCE, at ~90 kB per
-- project. The browser downloaded every project's source code to draw a grid of
-- names and pictures, and the cost grew ~27 kB per project with no bound.
--
-- Narrowing the column list does not help: every other column together is 19 kB.
-- The weight is inside one jsonb value, so the projection has to reach into it.
--
-- WHAT THE CARD ACTUALLY NEEDS, and nothing else:
--   * the row's own identity and timestamps
--   * a summary line, whichever of three sources exists
--   * for a page-shaped project, the few strings the drawn preview renders
--   * for an app, its name, description and route labels — NOT its files
--   * whether an app exists at all, for the "no first version yet" state
--
-- `security_invoker = true` IS LOAD-BEARING. A view without it executes as its
-- owner, which would read `projects` with the owner's rights and hand every
-- caller every user's rows — RLS silently bypassed. With it, the view runs as
-- the caller and the existing policies on `projects` apply unchanged. The
-- two-user probe in `scripts/security-rls.test.mts` covers this view for that
-- reason.

begin;

create or replace view public.project_cards
with (security_invoker = true) as
select
  p.id,
  p.user_id,
  p.name,
  p.project_type,
  p.status,
  p.created_at,
  p.updated_at,
  p.thumbnail_url,

  -- The first of these that exists is what the card shows under the name.
  coalesce(
    p.snapshot_fields->'stage3'->'output'->'identity'->>'description',
    p.snapshot_fields->'stage3'->'direction'->>'concept',
    p.snapshot_fields->>'solution'
  ) as summary,

  -- A page-shaped project draws its own hero. Only these strings are read.
  case
    when p.snapshot_fields->'stage3'->'output' is null then null
    else jsonb_build_object(
      'eyebrow',     p.snapshot_fields->'stage3'->'output'->'hero'->>'eyebrow',
      'headline',    p.snapshot_fields->'stage3'->'output'->'hero'->>'headline',
      'subheadline', p.snapshot_fields->'stage3'->'output'->'hero'->>'subheadline',
      'ctaLabel',    p.snapshot_fields->'stage3'->'output'->'cta'->>'label',
      'palette',     p.snapshot_fields->'stage3'->'output'->'visual'->'palette',
      'sections',    coalesce((
        select jsonb_agg(sec->>'title')
        from jsonb_array_elements(p.snapshot_fields->'stage3'->'output'->'sections') sec
        where nullif(sec->>'title', '') is not null
      ), '[]'::jsonb)
    )
  end as card_content,

  -- An application shows what it is called and which routes it answers. The
  -- files stay in the table; opening the project is what loads them.
  case
    when p.snapshot_fields->'app_runtime'->'app' is null then null
    else jsonb_build_object(
      'name',        p.snapshot_fields->'app_runtime'->'app'->'metadata'->>'name',
      'description', p.snapshot_fields->'app_runtime'->'app'->'metadata'->>'description',
      'routes',      coalesce((
        select jsonb_agg(coalesce(nullif(r->>'title', ''), r->>'path'))
        from jsonb_array_elements(p.snapshot_fields->'app_runtime'->'app'->'routes') r
      ), '[]'::jsonb)
    )
  end as card_app

from public.projects p;

comment on view public.project_cards is
  'Gallery projection of projects. Never exposes app_runtime.app.files. '
  'security_invoker=true so the caller''s RLS on projects applies.';

-- The API roles reach it through RLS on the underlying table, as they already
-- do for `projects` itself.
grant select on public.project_cards to authenticated;

commit;
