# BuildMyBill — project guide for Claude

This file is the handoff/onboarding context for **any** Claude Code session working
on this project — it auto-loads when Claude is started in this folder, regardless of
which Claude account is signed in. Read it first, then continue the work.

> **Switching Claude accounts?** Nothing about the app is tied to a Claude account.
> The app lives entirely in **GitHub** (all code), **Supabase** (database + storage),
> and this local folder. A different Claude account works on it identically — it just
> needs this file for context. See "Continue on a new account / machine" at the bottom.

---

## What this is

**BuildMyBill** — a construction/trades business-management SaaS for small-to-midsize
contractors. Live at **https://www.buildmybill.com**. Owner/operator: **Brady Holtvogt**
(Holtvogt Sand and Gravel), contact holtvogtsandandgravel@gmail.com.

Features built: quotes & invoices (line items, tax, PDF print), client CRM, jobs
(photos/videos, documents, map locations, crew, private/assigned visibility,
mobilization cost), team management (company join-code + owner approval + granular
per-section permissions), **time tracking with clocked-vs-logged efficiency**, daily
logs, work/manager logs, equipment (with maintenance readings), vehicle logs, safety
checks, inventory, warehouses, scheduling, subcontractors, contracts, billing/reports,
a market-priced subscriptions page, and an **installable phone-first field app (PWA)**.

---

## Where everything lives (asset inventory)

All of these are **the owner's own accounts** — they do NOT change when the Claude
account changes. Sign in with the owner's normal credentials.

| Asset | Details |
|---|---|
| **Source code** | This folder. Everything is one file: `index.html` (~5000 lines, React 18 + Babel, all vendored in `vendor/`). |
| **Git remote** | `https://github.com/BradyHoltvogt/buildmybill` (public repo, branch `main`). This is the source of truth — `git clone` gives you the whole app. |
| **Hosting** | GitHub Pages (auto-deploys on push to `main`). Custom domain via `CNAME` = `www.buildmybill.com`. |
| **Backend** | Supabase project ref **`kjyduwbvgaauxsljmrcy`** (URL in `config.js`). Postgres + Auth + Storage, isolated per company by Row Level Security. |
| **Domain / DNS** | `buildmybill.com` registered at **Wix**; nameservers point to GitHub Pages (apex A records 185.199.108–111.153) + Resend email DNS. |
| **Transactional email** | **Resend** (domain buildmybill.com verified via DKIM/SPF). API key lives ONLY in Supabase `private.secrets` — never in the repo, never seen by Claude. |

### Secrets policy (important)
- `config.js` holds the Supabase **anon key** — this is **public by design** (RLS
  enforces security), safe in the public repo.
- The Supabase **service_role key must NEVER be used, requested, or stored.**
- The **Resend API key** is only pasted by the owner into the Supabase SQL editor
  (see `supabase/emails.sql`), stored in `private.secrets`. Claude never handles it.

---

## Architecture

- **Single-file React app.** `index.html` contains all UI in one inline
  `<script type="text/babel">`. React/ReactDOM/Babel/Supabase are vendored in
  `vendor/` (no build step, no npm). `config.js` sets `window.BMB_CONFIG`.
- **Data model.** One generic `records` table in Postgres: every row is
  `{ company_id, collection, data(jsonb) }`. Collections are listed in the
  `COLLECTIONS` array in `index.html` (jobs, quotes, clients, employees,
  timeentries, shifts, job_media, job_docs, quote_docs, equipment, …). An
  in-memory `store` mirrors the current company's records; writes are optimistic
  (client generates a UUID, unshifts to the store, inserts in the background,
  rolls back + `notifyData()` on error).
- **Multi-tenant isolation via RLS.** `current_company_id()` (SECURITY DEFINER,
  active-members-only) is the linchpin; every record policy scopes by it. Team
  members join a company by 6-digit code → `pending` → owner approves → `active`.
- **Storage buckets** (private, company-foldered): `job-media` (photos/videos,
  downscaled on upload), `job-docs` (PDFs/documents for jobs AND quotes).
- **PWA / field app.** Small screens (or `?mobile=1`, or the desktop header's
  "📱 Field view" button) render `MobileShell`: bottom-tab app (Track / Daily Log /
  Schedule / Photos / More). Installable via `manifest.webmanifest` + `sw.js`.

---

## Deploy & test workflow

**Tools (Windows).** git at `C:\Program Files\Git\cmd\git.exe`, gh at
`C:\Program Files\GitHub CLI\gh.exe`. In this environment PATH isn't inherited, so
prepend it per shell: `export PATH="/c/Program Files/Git/cmd:$PATH"` (and the gh path).

**Deploy loop:** edit `index.html` → commit → `git push origin main`. GitHub Pages
auto-build **often lags** — force it and poll:
```
gh api -X POST repos/BradyHoltvogt/buildmybill/pages/builds
gh api repos/BradyHoltvogt/buildmybill/pages/builds/latest --jq '.commit[0:7] + " " + .status'   # wait for "<commit> built"
```

**Always validate before deploying** — a Babel compile error white-screens the
whole live app. Start the local server and load it first:
```
serve.ps1        # PowerShell TcpListener at http://localhost:8321  (no Node needed)
```
Check the browser console for errors before pushing.

**Testing gotchas:**
- SPA uses hash routing: navigating `#/x → #/x` (or any hash-only change) does NOT
  reload. To load new code, navigate to a genuinely different URL or `location.reload()`.
- Preview the mobile field app on desktop with `?mobile=1`.
- After a service-worker change, bump `CACHE` in `sw.js` so installed apps update.
- Commit messages end with the Co-Authored-By trailer per this environment's rules.

---

## Database migrations (all in `supabase/`, run by the owner in the SQL editor)

Run in order if rebuilding; all are re-runnable. **These have already been run on the
live project** unless noted:
1. `schema.sql` — companies/profiles/records tables, base RLS, `handle_new_user`.
2. `migration_team.sql` — join codes, pending/active status, permissions,
   `current_company_id()`/`current_role()`, `company_name_for_code()`.
3. `emails.sql` — pg_net + Resend, `private.secrets`, join-request/approval emails.
   (Owner pastes their Resend API key into the marked line.)
4. `migration_job_media.sql` — `job-media` bucket + policies + private-job media hiding.
5. `migration_private_assigned.sql` — jobs default Private; `job_hidden_from_me()` so
   assigned crew still see private jobs; updates the records SELECT policy.
6. `migration_job_docs.sql` — `job-docs` bucket + policies; extends the records SELECT
   policy to hide private-job documents.
7. `migration_private_jobs.sql` — earlier/superseded private-jobs policy (kept for history).

**RLS lesson (once caused an outage):** a policy on `public.records` must NOT run a
subquery against `public.records` — Postgres throws `42P17 infinite recursion`, which
500s ALL reads. Put any same-table lookup inside a `SECURITY DEFINER` function
(e.g. `job_hidden_from_me`, `job_is_private`).

---

## Implementation notes — do NOT casually "simplify" these

- **Time-tracking / efficiency model.** Clock in/out writes a `shifts` record (the paid
  "envelope"). Job time is separate `timeentries` (source `mobile-worklog`/`mobile-log`).
  **Efficiency = logged hours ÷ clocked hours**, shown per employee and team. Legacy
  `source==='mobile-clock'` entries are excluded from "logged". Owner sees over-100%
  as a blue "verify" badge (someone logged more than they clocked).
- **Daily-log time display.** Durations show as `hmm()` — `2.75 h` renders "2.45"
  (h.mm, minutes after the dot) — but reports/payroll keep true decimal hours.
- **DLS land-location math** (`landToLatLng`). Converts Prairie legal descriptions
  (e.g. `SW-14-32-20-W2`) → lat/long offline. Constants `TWP_H=0.0873` and
  `RANGE_W=6.094` are **calibrated to a surveyed SK point (~130 m accuracy)** — do NOT
  revert to 6.0/0.0868 (that gives ~3 km error). An exact SK-gov lookup was rejected:
  the service needs a token whose source is CORS-blocked; owner chose the free math.
- **Address geocoding** uses OpenStreetMap Nominatim (keyless, low volume) via
  `geocodeAddress()`. **Job detail modal** re-renders locally (a `bump()` tick) on
  media/doc changes so it doesn't remount and close.
- **Equipment maintenance** in the daily log pushes the latest mileage/engine-hours
  onto the matching `equipment` record (running totals).

---

## Current state

All planned work through this project's second build phase is **done, tested, and live**:
market-priced subscriptions page, "Remember me", map locations, job photos/videos with
per-photo customer sharing on quotes, the field-app PWA (installable, iPhone-safe),
efficiency time-tracking, daily-log polish, in-app location lookup, private-by-default
jobs, mobilization cost, job & quote documents, equipment maintenance totals.

Possible next steps discussed but not built: online payments (Stripe) on invoices,
QuickBooks/accounting sync, native mobile app, quote-document attachment already done.

---

## Continue on a new Claude account / machine

The app is not tied to any Claude account. To keep working under a different account:

1. **Same machine (just switched Claude account):** nothing to move — the code is
   already in this folder and pushed to GitHub. Start Claude Code **inside this
   folder** so it reads this `CLAUDE.md`, and continue.
2. **New machine:** install Git + GitHub CLI, then
   `git clone https://github.com/BradyHoltvogt/buildmybill` and start Claude Code in
   the cloned folder. That's the entire app. (Optional: install the same tools noted
   in "Deploy & test workflow".)
3. **Access you already own and keep** (log in with your normal credentials — unchanged
   by the Claude account switch): the GitHub repo, the Supabase project, the Wix domain,
   and the Resend account. Claude only ever *guides* changes to these; you hold the logins.
4. First thing a fresh session should do: read this file, run `git log --oneline -15`
   to see recent history, and load the app locally via `serve.ps1` to confirm it builds.
