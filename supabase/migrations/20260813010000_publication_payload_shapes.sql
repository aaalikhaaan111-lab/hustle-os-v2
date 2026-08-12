-- Publishing an application failed on constraints written for a page artifact.
--
-- `project_publications.output` carried four CHECK constraints describing the
-- old artifact payload: a version, a `preset` from the four project types, and
-- a `form` object containing a `fields` array. An app-runtime publication is a
-- different shape — `{kind:"app", version, app, name, description}` — so two of
-- them could never hold:
--
--   project_publications_output_preset_check  (no `preset` on an app payload)
--   project_publications_output_form_check    (no `form` on an app payload)
--
-- Postgres raised 23514, which is not the 23505 the publish action retries on,
-- so every attempt to publish a generated application returned "Не удалось
-- опубликовать проект" with nothing else recorded. Measured on a real payload:
-- preset and form checks fail, version passes, size was 117 965 of 131 072
-- bytes — under the limit, but only just.
--
-- The constraints are not dropped, they are scoped to the payload they describe
-- and paired with an equivalent for the other shape. Neither kind gets a
-- weaker rule than it had.

alter table public.project_publications
  drop constraint if exists project_publications_output_version_check,
  drop constraint if exists project_publications_output_preset_check,
  drop constraint if exists project_publications_output_form_check,
  drop constraint if exists project_publications_output_size_check;

alter table public.project_publications
  add constraint project_publications_output_shape_check
  check (
    case
      when output ->> 'kind' = 'app' then
        -- An application: the declaration itself must be present, and it must
        -- be an object rather than a string someone pasted in.
        (output ->> 'version' = '1')
        and jsonb_typeof(output -> 'app') = 'object'
        and jsonb_typeof(output #> '{app,files}') in ('object', 'array')
      else
        -- The page artifact, exactly as before.
        (output ->> 'version' = '1')
        and (output ->> 'preset' in (
          'community_social', 'service', 'content_media', 'digital_product'
        ))
        and jsonb_typeof(output -> 'form') = 'object'
        and jsonb_typeof(output #> '{form,fields}') = 'array'
    end
  );

-- Size, per shape. An artifact keeps its 128 KB. An application is source for a
-- whole multi-file project and the one measured above already used 90% of that
-- ceiling, so a slightly larger app would have failed with the same unhelpful
-- message. 512 KB sits above the 400 KB the provider transport will accept as a
-- single response, which is the real bound on how large a generated app can be.
alter table public.project_publications
  add constraint project_publications_output_size_check
  check (
    octet_length(output::text) <= (case when output ->> 'kind' = 'app' then 524288 else 131072 end)
  );
