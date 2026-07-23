-- ============================================================================
--  BuildMyBill — team notification emails via Resend (server-side)
--
--  Sends two emails, entirely from the database (no key ever in the frontend):
--    1. To the OWNER when someone requests to join their company.
--    2. To the EMPLOYEE when the owner approves them.
--
--  PREREQUISITES:
--    - Resend account with buildmybill.com verified.
--    - A Resend API key (you paste it into the marked line below).
--
--  Run in Supabase → SQL Editor. Re-runnable.
-- ============================================================================

-- pg_net lets Postgres make outbound HTTP calls (to Resend's API).
create extension if not exists pg_net;

-- Private schema for the API key. NOT exposed to the REST API, so the anon /
-- authenticated roles can never read it — only the SECURITY DEFINER functions below.
create schema if not exists private;
create table if not exists private.secrets (key text primary key, value text not null);

-- ▶▶ PASTE YOUR RESEND API KEY BETWEEN THE QUOTES, then run this file. ◀◀
insert into private.secrets (key, value)
values ('resend_api_key', 'RESEND_API_KEY_HERE')
on conflict (key) do update set value = excluded.value;

-- ── Core sender ─────────────────────────────────────────────────────────────
create or replace function private.send_email(to_email text, subject text, html text)
returns void
language plpgsql
security definer
set search_path = private, net, public
as $$
declare api_key text;
begin
  select value into api_key from private.secrets where key = 'resend_api_key';
  if api_key is null or api_key = 'RESEND_API_KEY_HERE' then return; end if;
  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object('Authorization', 'Bearer ' || api_key, 'Content-Type', 'application/json'),
    body := jsonb_build_object(
      'from', 'BuildMyBill <help@buildmybill.com>',
      'to', jsonb_build_array(to_email),
      'subject', subject,
      'html', html
    )
  );
exception when others then
  -- Never let an email problem break the signup/approval that triggered it.
  return;
end; $$;

-- ── 1. Notify the owner when a new person requests to join ──────────────────
create or replace function public.notify_owner_of_request()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare owner_email text; company_name text; who text;
begin
  if new.status = 'pending' then
    select p.email into owner_email
      from public.profiles p
      where p.company_id = new.company_id and p.role = 'Owner' and p.status = 'active'
      order by p.created_at asc limit 1;
    select name into company_name from public.companies where id = new.company_id;
    who := coalesce(nullif(new.full_name, ''), new.email);
    if owner_email is not null then
      perform private.send_email(
        owner_email,
        who || ' wants to join ' || coalesce(company_name, 'your company'),
        '<div style="font-family:system-ui,Arial,sans-serif;max-width:520px">'
        || '<h2 style="color:#111827">New team request</h2>'
        || '<p><strong>' || who || '</strong> (' || new.email || ') has asked to join <strong>'
        || coalesce(company_name, 'your company') || '</strong> on BuildMyBill.</p>'
        || '<p>Approve or decline them on your Team page:</p>'
        || '<p><a href="https://www.buildmybill.com/#/team" style="display:inline-block;background:#16A34A;color:#fff;'
        || 'padding:11px 20px;border-radius:8px;text-decoration:none;font-weight:700">Review request →</a></p>'
        || '<p style="color:#6B7280;font-size:12px">You''re receiving this because you own a company on BuildMyBill.</p></div>'
      );
    end if;
  end if;
  return new;
exception when others then
  return new;
end; $$;

drop trigger if exists on_member_request on public.profiles;
create trigger on_member_request
  after insert on public.profiles
  for each row execute function public.notify_owner_of_request();

-- ── 2. Notify the employee when the owner approves them ─────────────────────
create or replace function public.notify_member_approved()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare company_name text;
begin
  if new.status = 'active' and coalesce(old.status, '') = 'pending' then
    select name into company_name from public.companies where id = new.company_id;
    perform private.send_email(
      new.email,
      'You''re approved to join ' || coalesce(company_name, 'the company'),
      '<div style="font-family:system-ui,Arial,sans-serif;max-width:520px">'
      || '<h2 style="color:#111827">You''re in! ✅</h2>'
      || '<p>Your request to join <strong>' || coalesce(company_name, 'the company')
      || '</strong> on BuildMyBill has been approved.</p>'
      || '<p><a href="https://www.buildmybill.com/" style="display:inline-block;background:#16A34A;color:#fff;'
      || 'padding:11px 20px;border-radius:8px;text-decoration:none;font-weight:700">Sign in →</a></p>'
      || '<p style="color:#6B7280;font-size:12px">You''ll see the sections your company owner has given you access to.</p></div>'
    );
  end if;
  return new;
exception when others then
  return new;
end; $$;

drop trigger if exists on_member_approved on public.profiles;
create trigger on_member_approved
  after update on public.profiles
  for each row execute function public.notify_member_approved();

-- ============================================================================
--  Done. Emails fire automatically on join-request and on approval.
-- ============================================================================
