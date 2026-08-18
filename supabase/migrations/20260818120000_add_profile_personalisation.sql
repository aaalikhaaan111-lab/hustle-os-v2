-- Adds the personalisation fields the Settings panel collects.
--
-- WHY THESE THREE. Settings previously held one editable value — display name —
-- so "General" was a single input in a large panel. The fields added here are
-- the ones Ventrio can actually use:
--
--   preferred_name        what to call someone in conversation, which is often
--                         not their full name and is the thing the assistant
--                         should say;
--   work_description      what they do, so a first version starts closer to
--                         their world than to a generic template;
--   personal_instructions standing preferences they should not have to repeat
--                         in every project.
--
-- All three are NULLABLE with no default. A person who has not filled them in
-- has not expressed a preference, and an empty string is not the same statement
-- as silence — the application distinguishes "no answer" from "deliberately
-- blank" by writing null when a field is cleared.
--
-- No length constraints in the database. The action trims and caps them before
-- writing (see `src/lib/actions/profile.ts`); a check constraint here would
-- turn a recoverable form error into a failed request, and the limits are a
-- product decision that will move.
--
-- Nothing reads these yet beyond the Settings panel that writes them. They are
-- stored so the preference survives a device change, which is the whole reason
-- for putting them on the profile rather than in local storage.

begin;

alter table public.profiles
  add column if not exists preferred_name text,
  add column if not exists work_description text,
  add column if not exists personal_instructions text;

commit;
