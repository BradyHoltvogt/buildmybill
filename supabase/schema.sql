-- ============================================================================
--  BuildMyBill — multi-tenant schema with per-company data isolation
--
--  HOW TO RUN:
--    Supabase dashboard → SQL Editor → New query → paste ALL of this → Run.
--    Safe to run more than once (uses "if not exists" / "drop ... if exists").
--
--  THE GUARANTEE:
--    Row Level Security (RLS) below makes every read/write automatically
--    scoped to the logged-in user's company. One company can NEVER see or
--    touch another company's rows — the database enforces it, not the app.
-- ============================================================================

-- ── 1. Companies (one row per tenant/customer) ──────────────────────────────
create table if not exists public.companies (
  id         uuid primary key default gen_random_uuid(),
  name       text not null default 'My Company',
  settings   jsonb not null default '{}'::jsonb,   -- branding, colors, etc.
  created_at timestamptz not null default now()
);

-- ── 2. Profiles: links each auth user to a company + role ────────────────────
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  full_name  text,
  email      text,
  role       text not null default 'Owner',
  created_at timestamptz not null default now()
);

-- ── 3. Records: all app data (clients, jobs, quotes, ...), tagged by company ─
--     Mirrors the app's collections. Flexible JSONB payload keeps the existing
--     record shapes; company_id is what the privacy rules key off.
create table if not exists public.records (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  collection text not null,                         -- 'clients' | 'jobs' | ...
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists records_company_collection_idx
  on public.records (company_id, collection, created_at desc);

-- ── Helper: the current user's company_id ───────────────────────────────────
--   SECURITY DEFINER so it can read profiles without tripping RLS recursion.
create or replace function public.current_company_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select company_id from public.profiles where id = auth.uid();
$$;

-- ============================================================================
--  ROW LEVEL SECURITY — the actual privacy wall
-- ============================================================================
alter table public.companies enable row level security;
alter table public.profiles  enable row level security;
alter table public.records   enable row level security;

-- Companies: see/update only your own company
drop policy if exists "own company - select" on public.companies;
create policy "own company - select" on public.companies
  for select using (id = public.current_company_id());
drop policy if exists "own company - update" on public.companies;
create policy "own company - update" on public.companies
  for update using (id = public.current_company_id());

-- Profiles: see teammates in your company; edit only yourself
drop policy if exists "company profiles - select" on public.profiles;
create policy "company profiles - select" on public.profiles
  for select using (company_id = public.current_company_id());
drop policy if exists "own profile - update" on public.profiles;
create policy "own profile - update" on public.profiles
  for update using (id = auth.uid());

-- Records: full CRUD, but ONLY inside your own company
drop policy if exists "company records - select" on public.records;
create policy "company records - select" on public.records
  for select using (company_id = public.current_company_id());
drop policy if exists "company records - insert" on public.records;
create policy "company records - insert" on public.records
  for insert with check (company_id = public.current_company_id());
drop policy if exists "company records - update" on public.records;
create policy "company records - update" on public.records
  for update using (company_id = public.current_company_id())
             with check (company_id = public.current_company_id());
drop policy if exists "company records - delete" on public.records;
create policy "company records - delete" on public.records
  for delete using (company_id = public.current_company_id());

-- ============================================================================
--  Auto-provision a company + profile whenever someone signs up
--    New signup → a brand-new company is created and the user becomes its
--    Owner. (Inviting teammates into an existing company is a later feature.)
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  new_company_id uuid;
begin
  insert into public.companies (name)
  values (coalesce(nullif(new.raw_user_meta_data->>'company_name',''), 'My Company'))
  returning id into new_company_id;

  insert into public.profiles (id, company_id, full_name, email, role)
  values (
    new.id,
    new_company_id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    'Owner'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
--  Keep records.updated_at fresh on every update
-- ============================================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists records_touch_updated on public.records;
create trigger records_touch_updated
  before update on public.records
  for each row execute function public.touch_updated_at();
