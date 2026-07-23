# Supabase setup — the secure backend

This gives BuildMyBill real logins and a database where **each company's data is
private and confidential**, enforced by the database itself.

## What you do (one-time, free)

### 1. Create the project
1. Go to **https://supabase.com** → sign up (free) → **New project**.
2. Name it `buildmybill`, pick a strong database password (save it somewhere),
   choose the region closest to you → **Create**. Wait ~2 minutes for it to spin up.

### 2. Run the schema
1. Left menu → **SQL Editor** → **New query**.
2. Open `supabase/schema.sql` from this folder, copy **everything**, paste it in,
   → **Run**. You should see "Success". This builds the tables and — most
   importantly — the privacy rules.

### 3. Send Claude two values
Left menu → **Project Settings** → **API**. Copy and give Claude:
- **Project URL** (looks like `https://abcdxyz.supabase.co`)
- **anon / public** API key (a long string labeled `anon` `public`)

> **These two are safe to share and to put in the code.** The `anon` key is
> *designed* to be public and live in the frontend — it only lets people do what
> the privacy rules allow (i.e. see their own company's data after logging in).
>
> **Never share the `service_role` key.** That one bypasses all security. Claude
> will never ask for it, use it, or put it anywhere. If you ever paste a key,
> double-check it says **anon / public**, not service_role.

## What Claude does next
- Wires the app to your Supabase project using those two values.
- Replaces the demo login with **real** email/password accounts.
- Switches all data (clients, jobs, quotes, time, etc.) from browser storage to
  the secure database, tagged by company.
- Tests that Company A genuinely cannot see Company B's data before we go live.

## Cost
Supabase's free tier is generous (500 MB database, 50,000 monthly active users).
You'll likely stay free for a long time; the next tier is ~$25/mo when you outgrow it.
