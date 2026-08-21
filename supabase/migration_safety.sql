-- ============================================================================
--  BuildMyBill — Safety & Compliance module
--
--  Adds row-level rules for the three safety collections:
--      formtemplates    what a safety form asks
--      formsubmissions  a filled-out form (answers, signature, photos)
--      certifications   a worker's ticket/card and its expiry date
--
--  These live in the existing `public.records` table like every other collection
--  (one generic table, `data` jsonb, isolated per company) rather than in three
--  new tables. The spec sketched them as separate tables; the whole app — the
--  in-memory store, every read/write helper, and the company-isolation policies
--  — is built on `records`, so splitting three collections out would mean a
--  second data layer beside the first for no gain in what the rules can express.
--  The rules the spec asked for are all expressible here, and that's what this
--  migration does.
--
--  What it enforces (spec §8):
--    * formsubmissions — a worker SELECTs only their own rows; an admin (Owner
--      or Manager) SELECTs all of the company's. INSERT: a worker may only file
--      a submission under their own identity.
--    * formtemplates / certifications — every active member can read them (crews
--      need to see the forms assigned to them and their own certification
--      status); only admins may INSERT / UPDATE / DELETE.
--    * Everything stays company-scoped through current_company_id(), exactly
--      like the rest of `records`.
--
--  Requires: schema.sql, migration_team.sql, migration_private_assigned.sql and
--  migration_job_docs.sql (this file re-creates the records SELECT policy those
--  built up, with the safety rule added — nothing they enforce is dropped).
--
--  Run in Supabase → SQL Editor. Safe to re-run.
-- ============================================================================

-- ── 1. Who counts as an admin ───────────────────────────────────────────────
--  The spec asks for an admin/worker role column on the workers table. That
--  column already exists as public.profiles.role — it's the role the app itself
--  runs on (Owner / Manager / Employee), set by the owner on the Team page, and
--  it's tied to the login rather than to a free-text employee name. Owner and
--  Manager are the "admin" side of the spec's split; Employee is "worker".
--
--  SECURITY DEFINER so the lookup never trips RLS. Note the hard-won rule from
--  this project's history: a policy on public.records must NOT sub-query
--  public.records directly (Postgres 42P17, infinite recursion) — profiles is a
--  different table, so this one is safe either way.
create or replace function public.is_safety_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role in ('Owner', 'Manager')
       from public.profiles
      where id = auth.uid() and status = 'active'),
    false);
$$;

-- Is this submission row mine? Matched on the auth user id the app stamps on
-- every submission (workerId). Rows written before that field existed, or
-- imported, fall back to the plain-text name match the rest of the app uses to
-- attribute work to a person (see current_full_name()).
create or replace function public.safety_submission_is_mine(d jsonb)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    nullif(d->>'workerId', '') = auth.uid()::text
    or (coalesce(d->>'workerId', '') = '' and d->>'workerName' = public.current_full_name()),
    false);
$$;

-- ── 2. SELECT ───────────────────────────────────────────────────────────────
--  Rebuilds the company SELECT policy: everything the earlier migrations
--  enforced (private jobs, their media, their documents), plus the new rule that
--  a worker sees only their own safety submissions.
drop policy if exists "company records - select" on public.records;
create policy "company records - select" on public.records
  for select using (
    company_id = public.current_company_id()
    and not (collection = 'jobs'      and public.job_hidden_from_me(id))
    and not (collection = 'job_media' and public.job_hidden_from_me((data->>'jobId')::uuid))
    and not (collection = 'job_docs'  and public.job_hidden_from_me((data->>'jobId')::uuid))
    and (
      collection <> 'formsubmissions'
      or public.is_safety_admin()
      or public.safety_submission_is_mine(data)
    )
  );

-- ── 3. INSERT ───────────────────────────────────────────────────────────────
--  A worker can file a submission, but only as themselves — they can't post a
--  signed form under a co-worker's name. Templates and certifications are
--  admin-only to create.
drop policy if exists "company records - insert" on public.records;
create policy "company records - insert" on public.records
  for insert with check (
    company_id = public.current_company_id()
    and (
      collection <> 'formsubmissions'
      or public.is_safety_admin()
      or public.safety_submission_is_mine(data)
    )
    and (collection not in ('formtemplates', 'certifications') or public.is_safety_admin())
  );

-- ── 4. UPDATE / DELETE ──────────────────────────────────────────────────────
--  A submitted safety form is a record of what someone signed at a point in
--  time, so nobody edits or deletes one from the app — not even an admin. (If a
--  form was filed in error, file the corrected one; the history keeps both.)
--  Templates and certifications remain admin-managed.
drop policy if exists "company records - update" on public.records;
create policy "company records - update" on public.records
  for update using (
    company_id = public.current_company_id()
    and collection <> 'formsubmissions'
    and (collection not in ('formtemplates', 'certifications') or public.is_safety_admin())
  ) with check (
    company_id = public.current_company_id()
    and collection <> 'formsubmissions'
    and (collection not in ('formtemplates', 'certifications') or public.is_safety_admin())
  );

drop policy if exists "company records - delete" on public.records;
create policy "company records - delete" on public.records
  for delete using (
    company_id = public.current_company_id()
    and collection <> 'formsubmissions'
    and (collection not in ('formtemplates', 'certifications') or public.is_safety_admin())
  );

-- ── 5. Files ────────────────────────────────────────────────────────────────
--  Signature PNGs and form photos go to the existing private `job-media` bucket
--  under {company_id}/safety/{uuid}.{ext}. Its policies key off the first path
--  segment (the company id), so safety files are already isolated per company —
--  nothing to add here. See migration_job_media.sql.

-- ============================================================================
--  Done. Workers file and see their own safety forms; owners and managers see
--  everything and manage templates and certifications.
-- ============================================================================
