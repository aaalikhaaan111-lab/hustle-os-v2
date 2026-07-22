begin;

do $$
begin
  if exists (
    select 1
    from public.project_publications
    group by project_id
    having count(*) > 1
  ) then
    raise exception
      using
        errcode = '23505',
        message = 'Cannot enforce one publication per project while duplicate publication rows exist';
  end if;
end;
$$;

alter table public.project_publications
  add constraint project_publications_project_id_unique
  unique (project_id);

commit;
