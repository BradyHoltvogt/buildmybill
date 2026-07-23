-- ============================================================================
--  BuildMyBill — Team / multi-user migration
--
--  Adds: company join codes, pending/active membership, per-person permissions.
--  Safety: a PENDING member can see NOTHING until the owner approves them —
--  enforced by current_company_id() below, which only resolves for ACTIVE members.
--
--  Run in Supabase → SQL Editor → paste all → Run. Safe to re-run.
-- ============================================================================

-- ── 1. New columns ──────────────────────────────────────────────────────────
alter table public.companies add column if not exists join_code text;

alter table public.profiles add column if not exists status text not null default 'active';
alter table public.profiles add column if not exists permissions jsonb not null default '{}'::jsonb;

-- Existing profiles are owners of their own company → keep them active.
update public.profiles set status = 'active' where status is null;

-- ── 2. Unique 6-digit join-code generator ───────────────────────────────────
create or replace function public.gen_join_code()
returns text language plpgsql as $$
declare code text; taken boolean;
begin
  loop
    code := lpad((floor(random() * 1000000))::int::text, 6, '0');
    select exists(select 1 from public.companies where join_code = code) into taken;
    exit when not taken;
  end loop;
  return code;
end; $$;

-- Backfill codes for companies that don't have one yet.
do $$
declare r record;
begin
  for r in select id from public.companies where join_code is null loop
    update public.companies set join_code = public.gen_join_code() where id = r.id;
  end loop;
end $$;

create unique index if not exists companies_join_code_idx on public.companies (join_code);

-- ── 3. current_company_id(): ONLY resolves for ACTIVE members ────────────────
--     This is the linchpin — a pending member's company id is NULL, so every
--     company-scoped RLS policy denies them until they're approved.
create or replace function public.current_company_id()
returns uuid language sql stable security definer set search_path = public as $$
  select company_id from public.profiles where id = auth.uid() and status = 'active';
$$;

create or replace function public.current_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and status = 'active';
$$;

-- ── 4. Look up a company NAME from a join code (for the "you're joining X"
--       confirmation on the signup screen). Returns only the name, nothing else.
create or replace function public.company_name_for_code(code text)
returns text language sql stable security definer set search_path = public as $$
  select name from public.companies where join_code = code;
$$;
grant execute on function public.company_name_for_code(text) to anon, authenticated;

-- ── 5. Signup handler: join existing company (pending) OR create a new one ───
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  code text := nullif(new.raw_user_meta_data->>'join_code', '');
  target_company uuid;
  new_company_id uuid;
begin
  if code is not null then
    -- Joining an existing company by code → PENDING, awaiting owner approval.
    select id into target_company from public.companies where join_code = code;
    if target_company is null then
      raise exception 'INVALID_COMPANY_CODE';
    end if;
    insert into public.profiles (id, company_id, full_name, email, role, status, permissions)
    values (new.id, target_company,
            coalesce(new.raw_user_meta_data->>'full_name',''), new.email,
            'Employee', 'pending',
            '{"dashboard":true,"time-entry":true,"daily-log":true,"profile":true}'::jsonb);
  else
    -- No code → brand-new company, this user is its active Owner.
    insert into public.companies (name, join_code)
    values (coalesce(nullif(new.raw_user_meta_data->>'company_name',''), 'My Company'),
            public.gen_join_code())
    returning id into new_company_id;
    insert into public.profiles (id, company_id, full_name, email, role, status)
    values (new.id, new_company_id,
            coalesce(new.raw_user_meta_data->>'full_name',''), new.email,
            'Owner', 'active');
  end if;
  return new;
end; $$;

-- ── 6. Row Level Security policies ──────────────────────────────────────────

-- PROFILES ------------------------------------------------------------------
-- See: your own profile always (so a pending user can read their status), plus
-- every profile in your company once you're active.
drop policy if exists "company profiles - select" on public.profiles;
drop policy if exists "own profile - update"      on public.profiles;
drop policy if exists "profiles - select"          on public.profiles;
create policy "profiles - select" on public.profiles
  for select using (id = auth.uid() or company_id = public.current_company_id());

-- Only the ACTIVE OWNER may change team members (approve/deny, role, permissions),
-- and only within their own company. Members cannot edit their own row (which
-- would let a pending user approve themselves).
drop policy if exists "profiles - owner manage" on public.profiles;
create policy "profiles - owner manage" on public.profiles
  for update using (company_id = public.current_company_id() and public.current_role() = 'Owner')
             with check (company_id = public.current_company_id() and public.current_role() = 'Owner');

drop policy if exists "profiles - owner delete" on public.profiles;
create policy "profiles - owner delete" on public.profiles
  for delete using (company_id = public.current_company_id() and public.current_role() = 'Owner' and id <> auth.uid());

-- COMPANIES ------------------------------------------------------------------
-- (unchanged: select/update own company — join_code rides along, owner-visible)

-- RECORDS --------------------------------------------------------------------
-- (unchanged: company-scoped via current_company_id(), which now excludes
--  pending members automatically — no edit needed here)

-- ============================================================================
--  Done. Pending members are locked out until an owner approves them.
-- ============================================================================
