-- ============================================================================
--  BuildMyBill — private jobs visible to ASSIGNED crew
--
--  Jobs default to Private now. Private jobs (and their media) are hidden from
--  employees — EXCEPT employees assigned to that job, so a worker can still see
--  and clock into their own job. Owners and Managers always see everything.
--
--  Enforced in Row Level Security. Run in Supabase → SQL Editor. Re-runnable.
-- ============================================================================

-- The signed-in user's full name (SECURITY DEFINER bypasses RLS → no recursion).
create or replace function public.current_full_name()
returns text language sql stable security definer set search_path = public as $$
  select full_name from public.profiles where id = auth.uid() and status = 'active';
$$;

-- Is a job hidden from ME? True only when: the job is private, I'm an Employee,
-- and I'm NOT in the job's assignedEmployees list. Owners/managers → never hidden.
create or replace function public.job_hidden_from_me(job_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select coalesce(j.data->>'visibility','all') = 'private'
           and public.current_role() = 'Employee'
           and not coalesce(j.data->'assignedEmployees' ? public.current_full_name(), false)
      from public.records j
     where j.id = job_id and j.collection = 'jobs'
  ), false);
$$;

-- Records SELECT policy: company-scoped, minus jobs/media hidden from me.
drop policy if exists "company records - select" on public.records;
create policy "company records - select" on public.records
  for select using (
    company_id = public.current_company_id()
    and not (collection = 'jobs' and public.job_hidden_from_me(id))
    and not (collection = 'job_media' and public.job_hidden_from_me((data->>'jobId')::uuid))
  );

-- ============================================================================
--  Done. Private jobs are hidden from employees except the crew assigned to them.
-- ============================================================================
