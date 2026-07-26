-- ============================================================================
--  BuildMyBill — private jobs (database-enforced)
--
--  Jobs with data.visibility = 'private' are hidden from Employees. Owners and
--  Managers still see them. This is enforced in Row Level Security, so an
--  employee cannot reach a private job even by calling the API directly — the
--  database simply won't return those rows.
--
--  Run in Supabase → SQL Editor. Re-runnable.
-- ============================================================================

drop policy if exists "company records - select" on public.records;
create policy "company records - select" on public.records
  for select using (
    company_id = public.current_company_id()
    and not (
      collection = 'jobs'
      and coalesce(data->>'visibility', 'all') = 'private'
      and public.current_role() = 'Employee'
    )
  );

-- ============================================================================
--  Done. Everything else stays company-scoped exactly as before; only private
--  jobs are now additionally hidden from employees.
-- ============================================================================
