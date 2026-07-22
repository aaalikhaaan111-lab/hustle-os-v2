begin;

alter table public.projects
  add constraint projects_id_user_id_unique
  unique (id, user_id);

create table public.project_publications (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  user_id uuid not null,
  slug text not null unique,
  locale text not null,
  output jsonb not null,
  is_published boolean not null default true,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint project_publications_project_owner_fk
    foreign key (project_id, user_id)
    references public.projects(id, user_id)
    on delete cascade,
  constraint project_publications_response_identity_unique
    unique (id, project_id, user_id),
  constraint project_publications_locale_check
    check (locale in ('en', 'ru')),
  constraint project_publications_slug_length_check
    check (char_length(slug) between 2 and 64),
  constraint project_publications_slug_format_check
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint project_publications_slug_reserved_check
    check (
      slug <> all (
        array[
          'admin', 'api', 'auth', 'build', 'challenges', 'contact',
          'cookies', 'courses', 'create', 'dashboard', 'delete-account',
          'first-session', 'login', 'onboarding', 'p', 'privacy',
          'profile', 'projects', 'settings', 'signup', 'terms', 'workshops'
        ]::text[]
      )
    ),
  constraint project_publications_output_object_check
    check ((jsonb_typeof(output) = 'object') is true),
  constraint project_publications_output_size_check
    check (octet_length(output::text) <= 131072),
  constraint project_publications_output_version_check
    check ((output ->> 'version' = '1') is true),
  constraint project_publications_output_preset_check
    check (
      (output ->> 'preset' in (
        'community_social', 'service', 'content_media', 'digital_product'
      )) is true
    ),
  constraint project_publications_output_form_check
    check (
      (
        jsonb_typeof(output -> 'form') = 'object'
        and jsonb_typeof(output #> '{form,fields}') = 'array'
      ) is true
    )
);

create index project_publications_user_updated_idx
  on public.project_publications(user_id, updated_at desc);
create index project_publications_live_slug_idx
  on public.project_publications(slug)
  where is_published = true;

create table public.project_responses (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null,
  project_id uuid not null,
  user_id uuid not null,
  payload jsonb not null,
  submitter_hash text not null,
  created_at timestamptz not null default now(),

  constraint project_responses_publication_identity_fk
    foreign key (publication_id, project_id, user_id)
    references public.project_publications(id, project_id, user_id)
    on delete cascade,
  constraint project_responses_payload_object_check
    check ((jsonb_typeof(payload) = 'object') is true),
  constraint project_responses_payload_size_check
    check (octet_length(payload::text) <= 12000),
  constraint project_responses_submitter_hash_check
    check (submitter_hash ~ '^[0-9a-f]{64}$')
);

create index project_responses_project_created_idx
  on public.project_responses(project_id, created_at desc);
create index project_responses_publication_created_idx
  on public.project_responses(publication_id, created_at desc);
create index project_responses_rate_limit_idx
  on public.project_responses(publication_id, submitter_hash, created_at desc);

create or replace function public.prevent_project_publication_identity_change()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.project_id is distinct from old.project_id
     or new.user_id is distinct from old.user_id
     or new.slug is distinct from old.slug then
    raise exception
      using
        errcode = '23514',
        message = 'Publication project, owner, and slug are immutable';
  end if;
  return new;
end;
$$;

create trigger preserve_project_publication_identity
before update on public.project_publications
for each row execute function public.prevent_project_publication_identity_change();

create trigger set_project_publications_updated_at
before update on public.project_publications
for each row execute function public.set_updated_at();

alter table public.project_publications enable row level security;
alter table public.project_responses enable row level security;

create policy "Owners can view their publications"
on public.project_publications for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Owners can create publications for their projects"
on public.project_publications for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.projects
    where projects.id = project_publications.project_id
      and projects.user_id = project_publications.user_id
      and projects.user_id = (select auth.uid())
  )
);

create policy "Owners can update their publications"
on public.project_publications for update to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.projects
    where projects.id = project_publications.project_id
      and projects.user_id = project_publications.user_id
      and projects.user_id = (select auth.uid())
  )
);

create policy "Owners can view their project responses"
on public.project_responses for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Owners can delete their project responses"
on public.project_responses for delete to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.project_publications from public, anon, authenticated;
revoke all on table public.project_responses from public, anon, authenticated;
grant select, insert, update on table public.project_publications to authenticated;
grant select, delete on table public.project_responses to authenticated;

create or replace function public.get_public_project(p_slug text)
returns table (
  slug text,
  locale text,
  output jsonb,
  published_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    publication.slug,
    publication.locale,
    publication.output,
    publication.published_at,
    publication.updated_at
  from public.project_publications as publication
  where publication.slug = p_slug
    and publication.is_published = true
  limit 1;
$$;

revoke all on function public.get_public_project(text) from public, anon, authenticated;
grant execute on function public.get_public_project(text) to anon, authenticated;

create or replace function public.submit_public_project_response(
  p_slug text,
  p_payload jsonb,
  p_server_submitter_hash text
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_publication public.project_publications%rowtype;
  v_fields jsonb;
  v_field jsonb;
  v_field_id text;
  v_field_label text;
  v_field_type text;
  v_required boolean;
  v_value text;
  v_max_length integer;
  v_field_count integer;
  v_distinct_field_count integer;
  v_recent_visitor_count integer;
  v_recent_publication_count integer;
  v_clean_payload jsonb := '{}'::jsonb;
begin
  if p_slug is null
     or char_length(p_slug) not between 2 and 64
     or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    return 'not_found';
  end if;
  if p_payload is null
     or jsonb_typeof(p_payload) <> 'object'
     or octet_length(p_payload::text) > 12000 then
    return 'invalid';
  end if;
  if p_server_submitter_hash is null
     or p_server_submitter_hash !~ '^[0-9a-f]{64}$' then
    return 'invalid';
  end if;

  select publication.* into v_publication
  from public.project_publications as publication
  where publication.slug = p_slug
    and publication.is_published = true
  for update;
  if not found then return 'not_found'; end if;

  v_fields := v_publication.output #> '{form,fields}';
  if coalesce(jsonb_typeof(v_fields), '') <> 'array' then return 'invalid'; end if;
  v_field_count := jsonb_array_length(v_fields);
  if v_field_count not between 2 and 5 then return 'invalid'; end if;

  select count(distinct (entry.value ->> 'id')) into v_distinct_field_count
  from jsonb_array_elements(v_fields) as entry(value);
  if v_distinct_field_count <> v_field_count then return 'invalid'; end if;

  if exists (
    select 1 from jsonb_object_keys(p_payload) as supplied(key)
    where not exists (
      select 1 from jsonb_array_elements(v_fields) as allowed(value)
      where allowed.value ->> 'id' = supplied.key
    )
  ) then return 'invalid'; end if;

  for v_field in select entry.value from jsonb_array_elements(v_fields) as entry(value)
  loop
    if coalesce(jsonb_typeof(v_field), '') <> 'object' then return 'invalid'; end if;
    v_field_id := v_field ->> 'id';
    v_field_label := btrim(coalesce(v_field ->> 'label', ''));
    v_field_type := v_field ->> 'type';

    if v_field_id is null
       or char_length(v_field_id) not between 1 and 40
       or v_field_id !~ '^[a-z0-9_-]+$' then return 'invalid'; end if;
    if char_length(v_field_label) not between 1 and 80 then return 'invalid'; end if;
    if v_field_type is null
       or v_field_type not in ('text', 'email', 'textarea', 'select') then return 'invalid'; end if;
    if coalesce(jsonb_typeof(v_field -> 'required'), '') <> 'boolean' then return 'invalid'; end if;
    v_required := (v_field -> 'required') = 'true'::jsonb;

    if v_field_type = 'select' then
      if coalesce(jsonb_typeof(v_field -> 'options'), '') <> 'array'
         or jsonb_array_length(v_field -> 'options') not between 2 and 5 then
        return 'invalid';
      end if;
      if exists (
        select 1 from jsonb_array_elements(v_field -> 'options') as option_entry(value)
        where jsonb_typeof(option_entry.value) <> 'string'
           or char_length(option_entry.value #>> '{}') not between 1 and 80
      ) then return 'invalid'; end if;
    end if;

    if p_payload ? v_field_id then
      if jsonb_typeof(p_payload -> v_field_id) <> 'string' then return 'invalid'; end if;
      v_value := btrim(p_payload ->> v_field_id);
      v_max_length := case v_field_type
        when 'email' then 254
        when 'textarea' then 2000
        when 'select' then 80
        else 320
      end;
      if char_length(v_value) > v_max_length then return 'invalid'; end if;
      if v_required and v_value = '' then return 'invalid'; end if;

      if v_field_type = 'email' and v_value <> '' then
        v_value := lower(v_value);
        if v_value !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
          return 'invalid';
        end if;
      end if;
      if v_field_type = 'select'
         and v_value <> ''
         and not exists (
           select 1 from jsonb_array_elements_text(v_field -> 'options') as option_entry(value)
           where option_entry.value = v_value
         ) then return 'invalid'; end if;

      v_clean_payload := v_clean_payload || jsonb_build_object(v_field_id, v_value);
    elsif v_required then
      return 'invalid';
    end if;
  end loop;

  if not exists (
    select 1 from jsonb_each_text(v_clean_payload) as submitted(key, value)
    where btrim(submitted.value) <> ''
  ) then return 'invalid'; end if;

  select count(*) into v_recent_visitor_count
  from public.project_responses
  where publication_id = v_publication.id
    and submitter_hash = p_server_submitter_hash
    and created_at >= now() - interval '1 hour';
  if v_recent_visitor_count >= 5 then return 'rate_limited'; end if;

  select count(*) into v_recent_publication_count
  from public.project_responses
  where publication_id = v_publication.id
    and created_at >= now() - interval '1 minute';
  if v_recent_publication_count >= 30 then return 'rate_limited'; end if;

  insert into public.project_responses (
    publication_id, project_id, user_id, payload, submitter_hash
  ) values (
    v_publication.id, v_publication.project_id, v_publication.user_id,
    v_clean_payload, p_server_submitter_hash
  );
  return 'accepted';
end;
$$;

revoke all on function public.submit_public_project_response(text, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.submit_public_project_response(text, jsonb, text)
  to service_role;
revoke all on function public.prevent_project_publication_identity_change()
  from public, anon, authenticated;

commit;
