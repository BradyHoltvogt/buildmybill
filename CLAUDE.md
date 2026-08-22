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
logs, work/manager logs, **safety & compliance** (build-your-own digital
forms with signature capture and photos, offline submission queue, submission
history, worker certifications with expiry alerts), equipment (maintenance readings + general billable equipment
usage, rolled into Billing & Reports + a per-item usage log), vehicle logs, safety
checks, inventory, **warehouses with a drag-and-drop floor-plan builder** (racks/zones
placed on a grid, per-zone stock, capacity fill, reorder-threshold alerts),
scheduling, subcontractors, contracts, billing/reports,
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
  timeentries, shifts, job_media, job_docs, quote_docs, equipment, inventory, zones, …). An
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
9. `migration_safety.sql` — row-level rules for the Safety module: a worker sees
   and files only their OWN `formsubmissions`; owners/managers see all; only they
   can write `formtemplates` / `certifications`; submissions can never be edited
   or deleted. Re-creates the records SELECT policy including everything the
   job-media / job-docs / private-jobs migrations enforce — run it AFTER those.
   **NOT YET RUN on the live project** — and optional: without it the Safety
   module still works, but every member of the company can read every submission.

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
- **Warehouse floor plans.** A warehouse's plan is a grid (`warehouse.layout =
  {cols, rows}`); every rack/bin/pile is its own `zones` record holding its OWN
  `x/y/w/h` in grid cells plus a `capacity`. The spec sketched the rectangles both
  as a blob on the warehouse and as coordinates on the zone — storing them twice
  guarantees drift, so the **zone record is the single source of truth for its own
  rectangle** and the warehouse only owns the grid size. Don't "simplify" this by
  moving coordinates back onto the warehouse.
  - Inventory links to a zone by `zoneId`; `zoneLabel` + the warehouse *name* are
    the text fallback (`itemInZone`) for rows that predate zones or came back from
    an export where ids changed. `prepareEdit` on the Inventory page upgrades a
    label-only row to a real id the first time it's edited.
  - **Reorder-threshold alerts are derived, never stored.** `warehouseStats()`
    recomputes capacity/used/low-stock from live inventory on every render — there
    is no cron job and no cached rollup to go stale. `isLowStock` is the one rule.
  - The builder edits a local draft and writes nothing until Save; it then deletes
    removed zones (releasing, not deleting, their stock), upserts the rest, and
    saves the grid size. Renaming a warehouse cascades to its zones, inventory and
    equipment, since those match by name too.
  - `zones` is just another collection in the generic `records` table — **no SQL
    migration was needed** for any of this.
- **Quick Command** (⚡ in the desktop top bar / field-app header, Ctrl+K, and the
  More tab) turns a typed or spoken sentence into one of the app's existing
  actions. It is **not** a model and calls no service — it's an ordered catalog
  (`QC_ACTIONS`) where each entry owns its phrasings, a `parse` that pulls values
  out of the sentence, and a `run` that calls the **same db helpers the forms
  call**. Keep that last part true: a command must never write a record shape the
  manual form couldn't produce. Matching is longest-match with a `weight`
  tiebreaker (that's why "set the mileage" beats "hours" — see `qcMatch`), every
  parse is shown editable before it saves, and actions are hidden by the same
  `canAccess` permissions as the sidebar. Adding an entry to `QC_ACTIONS` is all
  it takes — the parser, review card, and examples pick it up automatically.
- **Photo-to-data** is the same catalog with an optional `fromPhoto` per action.
  OCR is Tesseract vendored in `vendor/tesseract/` — read
  `vendor/tesseract/README.md` before touching it; it explains why the language
  model is uncompressed, why `corePath` is a directory, and why those files are
  deliberately **not** in `sw.js`'s `SHELL` (they'd add ~6 MB to every install
  for a feature most sessions never use; the network-first worker caches them on
  first scan instead). `QC_PHOTO_KINDS` scores what a document is; the answer is
  always a dropdown on the review card, never a silent decision.
- **Safety forms are offline-first, and that's the whole point.** A crew in a pit
  has no signal, so EVERY submission goes into a localStorage queue first
  (`bmb_safety_queue`, status `pending`) and is pushed by `flushSafetyQueue()` on
  submit, on the browser's `online` event, and on a 45-second timer. The row id is
  generated client-side and reused on retry: if a push landed but the reply was
  lost, the retry hits the primary key, Postgres returns `23505`, and that counts
  as synced instead of writing a duplicate. Signature PNGs and photos ride in the
  queue as (downscaled) data URLs and upload during the flush, each path written
  back into the queue as it succeeds. Don't "simplify" this into a plain
  `db.create()` — that path rolls back and alerts when the network is down, which
  is exactly when a safety form must not be lost.
- **Safety files reuse the `job-media` bucket**, under `{company_id}/safety/`. That
  bucket's policy keys off the first path segment (the company id), so safety
  photos and signatures are already isolated per company — no new bucket, and the
  module works even before `migration_safety.sql` is run.
- **Safety data lives in `records` like everything else** — collections
  `formtemplates`, `formsubmissions`, `certifications`. The spec that drove this
  asked for three separate Postgres tables; they'd need a second data layer beside
  the store/`db` one, and every rule the spec wanted is expressible on `records`.
  See the header of `supabase/migration_safety.sql`.
- **Expired certifications warn, they don't block.** An expired ticket marks the
  name in the Jobs crew picker (`⛔ expired cert`) and raises a dashboard banner on
  every sign-in, but assignment still goes through — only the office knows whether
  a given job actually needs that ticket, and a hard block would stall real work.
- **Printable timesheets are built on `shifts`, not `timeentries`.** Work Logs →
  🖨 Timesheets prints a payroll hand-off for the accountant: a summary page, then
  a signed sheet per person. Payroll pays the **clocked envelope** (`shifts`), while
  `timeentries` is job time for billing and efficiency and routinely doesn't add up
  to a paid day — so the two must never be quietly summed. The sheet names its basis
  on the page, can be switched to logged time, and **warns by name** about anyone who
  has hours on the *other* basis but none on this one (someone who logs job time but
  never clocks in would otherwise print as zero and get paid nothing).
  - Days are subtotalled **by week**, deliberately, instead of one running total.
    Overtime rules vary by province and by agreement, so the sheet hands the
    accountant the weekly figure their own rule needs rather than encoding a guess.
    Don't "help" by adding an OT calculation.
  - Printing reuses the app-wide mechanism: one `id="print-area"` element is the
    only thing visible under `@media print`, `.no-print` hides the controls, and
    `.page-break` starts each person on a fresh page. Same as the quote preview.
- **Shifts have no direct edit UI.** Employees can't edit a clocked `shifts` record —
  they request a correction (My Hours → Request a correction), which lands in
  `shiftrequests` (`status: Pending/Approved/Rejected`) and emails the owner/managers.
  Approving on the Shift Requests page patches the `shifts` record directly; the
  `employees` collection is purely informational and NOT linked to login accounts —
  matching to "whose shift is this" is done by plain-text name (`employeeName ===
  user.name`), same as everywhere else time gets attributed to a person.
- **The Schedule is one month calendar on both devices**, off one set of helpers
  (`jobIsDone` / `jobSpan` / `spanMap` / `jobsOnDay` / `isCarryDay` / `monthGrid`)
  that sit above `SchedulePage`; the field app's `MobileSchedule` imports the same
  ones, so "what's on Thursday" has one answer per device. Dates are compared as
  `YYYY-MM-DD` **strings** — they sort correctly as text, which sidesteps both Date
  arithmetic and the timezone bug `toISOString()` causes west of Greenwich.
  - **Finished jobs are hidden, and "finished" is a name list.** Stages are
    company-defined in Workspace setup, so there is no structural "done" flag to
    read; `DONE_STAGES` matches the final-stage names the shipped presets use
    (completed/done/closed/delivered/picked up/cancelled…), case-insensitively. A
    company that invents its own final stage name keeps seeing those jobs — that's
    the safe direction to be wrong in. The desktop page has a "Show completed"
    checkbox, default off.
  - **An unfinished job carries forward onto every day since its end date, through
    today** (`jobSpan().carried`), drawn in amber with a ↻. Work that ran long is
    still work someone has to do, and it belongs on today's square. It deliberately
    never projects past today — tomorrow's square is for what's actually planned —
    and the days it was genuinely booked for are not marked as carried
    (`isCarryDay` is true only *past* `planned`).
  - **The grid is `repeat(7, minmax(0, 1fr))`, not `repeat(7, 1fr)`.** A bare `1fr`
    floors at its content's minimum size, so one long job title widened its own
    column to 354px and squeezed the other six to 87px. With the floor at 0 the
    columns are always equal and the chip's text is what gives, via an ellipsis.
    Cell height is likewise fixed (`CAL_CELL_H`) so no week row is taller than its
    neighbours. Don't "tidy" either back to auto sizing — the squares being
    identical is the whole requirement. Overflow goes to "+N more", and clicking
    any day opens the full list (`ScheduleDayList`, shared by the modal and the
    phone's day panel).

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

**Quick Command** (branch `worktree-quick-command`) adds a natural-language command
bar — type or say what you want done and it performs the matching existing action,
or read it off a photo. Sixteen actions; all on-device, no external service.
Possible next steps for Safety: emailing an admin when a certification is about to
lapse (the plumbing exists in `emails.sql`), and required-certification rules per
form or per job.

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
