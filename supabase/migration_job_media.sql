-- ============================================================================
--  BuildMyBill — job media (photos & videos)
--
--  Files live in a PRIVATE Storage bucket, foldered by company then job:
--      {company_id}/{job_id}/{uuid}.{ext}
--  The policies below let a signed-in member touch ONLY their own company's
--  folder, so photos/videos are isolated exactly like every other record.
--
--  Also hides the media of PRIVATE jobs from employees (mirrors the private-jobs
--  rule), so a hidden job's photos stay hidden too.
--
--  Run in Supabase → SQL Editor. Safe to re-run.
-- ============================================================================

-- ── 1. The bucket ───────────────────────────────────────────────────────────
--  private (public=false); 50 MB per file; images & videos only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('job-media', 'job-media', false, 52428800, array['image/*', 'video/*'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types,
      public = false;

-- ── 2. Storage policies — a company can only reach its own top-level folder ──
--  The first path segment is the company id; current_company_id() resolves it
--  only for ACTIVE members, so pending/other-company users get nothing.
drop policy if exists "job-media read"   on storage.objects;
drop policy if exists "job-media insert" on storage.objects;
drop policy if exists "job-media delete" on storage.objects;

create policy "job-media read" on storage.objects
  for select to authenticated
  using (bucket_id = 'job-media'
         and (storage.foldername(name))[1] = public.current_company_id()::text);

create policy "job-media insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'job-media'
              and (storage.foldername(name))[1] = public.current_company_id()::text);

create policy "job-media delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'job-media'
         and (storage.foldername(name))[1] = public.current_company_id()::text);

-- ── 3. Hide private-job media from employees (extends the records select rule)
--  Same company scoping as before, plus: an Employee can't see 'jobs' rows that
--  are private, NOR 'job_media' rows whose parent job is private.
drop policy if exists "company records - select" on public.records;
create policy "company records - select" on public.records
  for select using (
    company_id = public.current_company_id()
    and not (
      collection = 'jobs'
      and coalesce(data->>'visibility', 'all') = 'private'
      and public.current_role() = 'Employee'
    )
    and not (
      collection = 'job_media'
      and public.current_role() = 'Employee'
      and exists (
        select 1 from public.records j
        where j.id = (records.data->>'jobId')::uuid
          and j.collection = 'jobs'
          and coalesce(j.data->>'visibility', 'all') = 'private'
      )
    )
  );

-- ============================================================================
--  Done. Uploads land in the private bucket; only the owning company can read
--  them; private-job media is hidden from employees.
-- ============================================================================
