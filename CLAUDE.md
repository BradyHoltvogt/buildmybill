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

**BuildMyBill** — a business-management SaaS for small-to-midsize service businesses.
It ships written for construction/trades, and a paid **workspace customization layer**
reshapes it per company for any industry (lawn care, plumbing, cleaning, hauling, auto
repair, a law office…). Live at **https://www.buildmybill.com**. Owner/operator: **Brady Holtvogt**
(Holtvogt Sand and Gravel), contact holtvogtsandandgravel@gmail.com.

Features built: quotes & invoices (line items, tax, PDF print), client CRM, jobs
(photos/videos, documents, map locations, crew, private/assigned visibility,
mobilization cost), team management (company join-code + owner approval + granular
per-section permissions), **time tracking with clocked-vs-logged efficiency**, daily
logs, work/manager logs, equipment (maintenance readings + general billable equipment
usage, rolled into Billing & Reports + a per-item usage log), vehicle logs, safety
checks, inventory, warehouses, scheduling, subcontractors, contracts, billing/reports,
a market-priced subscriptions page, a **guided 3-stage workspace setup** that re-labels
and re-shapes the whole app per company, and an **installable phone-first field app (PWA)**
with clock-in/out geofence alerts (real phone notifications, foreground-only), live
crew location + trail for owners/managers while clocked in, hauling-load tracking,
"Local Sites" GPS-matched recurring billable locations, and employee self-serve
**shift-edit requests** (My Hours → request a correction → owner/manager email +
approval, since employees can't edit a clocked shift directly).

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
8. `migration_shift_requests.sql` — emails the owner + managers (via `private.send_email`
   from `emails.sql`, which must be run first) when an employee submits a shift-edit
   request from My Hours. Trigger lives on `public.records`, filtered to
   `collection = 'shiftrequests'` inside the function body (not the trigger clause).

**RLS lesson (once caused an outage):** a policy on `public.records` must NOT run a
subquery against `public.records` — Postgres throws `42P17 infinite recursion`, which
500s ALL reads. Put any same-table lookup inside a `SECURITY DEFINER` function
(e.g. `job_hidden_from_me`, `job_is_private`).

---

## Workspace customization layer (per-company)

A company answers three screens at signup — **Your business** (industry, name, logo,
colours) → **How you work** (wording, workflow stages, which sections exist) → **Review
& launch** — and the whole app reshapes itself. Owners only; everyone else in the company
just gets the finished workspace. Reachable later from **Settings → Workspace setup** and
from the add-on card on **Subscriptions** (route `#/setup`).

- **Where it lives.** All of it is in `companies.settings` (jsonb) via the `BRANDING_KEYS`
  whitelist: `industry`, `industryDetail`, `terms`, `stages`, `modules`, `setupComplete`,
  `setupSkipped`, `setupCompletedAt`. **No migration needed** — `settings` already existed.
- **`syncWorkspace(company)`** runs *during* `AuthProvider`'s render (not an effect):
  plain helpers like `relabel()` are called mid-render, so the config has to be live before
  the first paint.
- **Wording — `relabel(str)`.** Rewrites app-authored copy ("Job" → "Work Order"). It is
  wired into the shared primitives only — `PageHeader`, `EmptyState`, `Field`, `Modal`,
  `DataTable` headers, `StatCard`, `Checkbox`, `TextInput` placeholders, `Toast`,
  `ConfirmHost`, nav labels — so **records are never rewritten**, only UI text.
  - It compiles **one combined regex, longest match first, single pass**. Do NOT refactor
    it into a chain of `.replace()` calls: that lets one term's output be caught by the
    next term's rule ("Job Site" → "Matter Site").
  - **Never relabel a string twice.** Anything already passed through `relabel()` /
    `relabelWith()` must not be handed to a primitive as a plain string — wrap it in a
    `<span>` (non-strings pass through untouched), as the setup screen's section
    checkboxes do.
- **Stages — `workflowStages()`.** The job status list. Custom stages with no entry in
  `STATUS_COLORS` get a colour from `STAGE_FALLBACK` by position.
- **Sections — `moduleEnabled(id)`,** checked inside `canAccess()`, so switching a section
  off hides it in the sidebar, the field app and the router for everyone, owner included.
  `CORE_MODULES` can never be switched off. Turning one back on returns its records
  untouched — nothing is ever deleted.
- **Presets are starting points.** `INDUSTRY_PRESETS` prefills wording/stages/sections/
  colours per trade; every one stays editable on stage 2.
- **Payment isn't wired.** The Subscriptions add-on card prices the setup
  (`SETUP_ADDON_PRICE`) the same way plan selection works today — a stated price, no card
  charged. Real enforcement needs Stripe (still unbuilt).

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
  onto the matching `equipment` record (running totals) — separate from general
  **equipment usage** (also loggable from the daily log), which bills hours at the
  equipment's rate and *adds* to its running total instead of overwriting it.
- **Shifts have no direct edit UI.** Employees can't edit a clocked `shifts` record —
  they request a correction (My Hours → Request a correction), which lands in
  `shiftrequests` (`status: Pending/Approved/Rejected`) and emails the owner/managers.
  Approving on the Shift Requests page patches the `shifts` record directly; the
  `employees` collection is purely informational and NOT linked to login accounts —
  matching to "whose shift is this" is done by plain-text name (`employeeName ===
  user.name`), same as everywhere else time gets attributed to a person.

---

## Current state

The workspace customization layer is built and validated locally (not yet deployed at the
time of writing). Note: an existing owner with no `setupComplete` flag — including the
owner's own live company — lands on the guided setup once on their next sign-in, and can
skip it to keep the stock construction wording.

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
