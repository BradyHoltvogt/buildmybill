-- ============================================================================
--  BuildMyBill — job documents (PDFs of locates, permits, drawings, etc.)
--
--  A PRIVATE bucket kept SEPARATE from photos/videos, foldered by company/job,
--  with the same company isolation. Also hides documents of private jobs from
--  employees who aren't assigned (mirrors jobs/photos).
--
--  Run in Supabase → SQL Editor. Safe to re-run. Requires the private-jobs
--  migration first (it defines public.job_hidden_from_me).
-- ============================================================================

-- 1. Bucket — private, 25 MB/file, any file type (PDF, images, office docs).
insert into storage.buckets (id, name, public, file_size_limit)
values ('job-docs', 'job-docs', false, 26214400)
on conflict (id) do update set file_size_limit = excluded.file_size_limit, public = false;

-- 2. Storage policies — a company can only touch its own top-level folder.
drop policy if exists "job-docs read"   on storage.objects;
drop policy if exists "job-docs insert" on storage.objects;
drop policy if exists "job-docs delete" on storage.objects;

create policy "job-docs read" on storage.objects
  for select to authenticated
  using (bucket_id = 'job-docs' and (storage.foldername(name))[1] = public.current_company_id()::text);

create policy "job-docs insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'job-docs' and (storage.foldername(name))[1] = public.current_company_id()::text);

create policy "job-docs delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'job-docs' and (storage.foldername(name))[1] = public.current_company_id()::text);

-- 3. Extend the records SELECT policy so private-job DOCS are hidden too.
drop policy if exists "company records - select" on public.records;
create policy "company records - select" on public.records
  for select using (
    company_id = public.current_company_id()
    and not (collection = 'jobs'      and public.job_hidden_from_me(id))
    and not (collection = 'job_media' and public.job_hidden_from_me((data->>'jobId')::uuid))
    and not (collection = 'job_docs'  and public.job_hidden_from_me((data->>'jobId')::uuid))
  );

-- ============================================================================
--  Done. Job documents live in a private, company-isolated bucket; private-job
--  documents are hidden from employees who aren't assigned to the job.
-- ============================================================================
