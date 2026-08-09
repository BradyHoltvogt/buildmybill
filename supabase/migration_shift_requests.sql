-- ============================================================================
--  BuildMyBill — shift-edit request emails via Resend (server-side)
--
--  Employees can't edit a clocked shift directly (e.g. forgot to clock out
--  and ended up with a 23-hour shift) — they submit a correction request from
--  "My Hours" on the field app instead. This fires an email to the company
--  OWNER and any MANAGER-role members so it gets reviewed and approved (or
--  rejected) on the Shift Requests page.
--
--  Reuses private.send_email(...) from emails.sql — run emails.sql FIRST
--  (it must already exist with your Resend API key pasted in).
--
--  Run in Supabase → SQL Editor. Re-runnable.
-- ============================================================================

create or replace function public.notify_shift_edit_request()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  rec jsonb;
  recipient record;
  subject text;
  html text;
begin
  if new.collection <> 'shiftrequests' then
    return new;
  end if;
  rec := new.data;
  if coalesce(rec->>'status', 'Pending') <> 'Pending' then
    return new;
  end if;

  subject := coalesce(rec->>'employeeName', 'An employee') || ' requested a shift correction';
  html := '<div style="font-family:system-ui,Arial,sans-serif;max-width:520px">'
    || '<h2 style="color:#111827">Shift correction requested</h2>'
    || '<p><strong>' || coalesce(rec->>'employeeName', '') || '</strong> is asking to correct their clocked shift on '
    || coalesce(rec->>'entryDate', '') || '.</p>'
    || '<p><strong>Logged:</strong> ' || coalesce(rec->>'originalStartTime', '?') || '–' || coalesce(rec->>'originalEndTime', '?')
    || ' (' || coalesce(rec->>'originalHours', '?') || ' h)<br/>'
    || '<strong>Requested:</strong> ' || coalesce(rec->>'requestedStartTime', '?') || '–' || coalesce(rec->>'requestedEndTime', '?') || '</p>'
    || '<p><strong>Reason:</strong> ' || coalesce(rec->>'reason', '—') || '</p>'
    || '<p><a href="https://www.buildmybill.com/#/shift-requests" style="display:inline-block;background:#16A34A;color:#fff;'
    || 'padding:11px 20px;border-radius:8px;text-decoration:none;font-weight:700">Review it →</a></p>'
    || '<p style="color:#6B7280;font-size:12px">Approving updates their shift automatically; rejecting just closes the request.</p></div>';

  for recipient in
    select email from public.profiles
    where company_id = new.company_id and status = 'active' and role in ('Owner', 'Manager') and email is not null
  loop
    perform private.send_email(recipient.email, subject, html);
  end loop;

  return new;
exception when others then
  return new;
end; $$;

drop trigger if exists on_shift_edit_request on public.records;
create trigger on_shift_edit_request
  after insert on public.records
  for each row execute function public.notify_shift_edit_request();

-- ============================================================================
--  Done. Submitting a shift-edit request from the field app now emails the
--  owner and all managers.
-- ============================================================================
