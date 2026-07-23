# BuildMyBill

Construction business management app — quotes & invoices, jobs, clients, time tracking,
equipment, inventory, safety checks, and billing reports.

## Running it

Double-click **`BuildMyBill.bat`** (or just open `index.html` in Chrome/Edge).

No installation, no server, no internet connection required — React and Babel are bundled
in the `vendor/` folder.

Sign-in is local demo mode: any email + password creates your account on this computer.

### Alternative: run it on localhost

`Start-Server.bat` serves the app at `http://localhost:8321/` using a small PowerShell
web server (`serve.ps1`). You only need this for browser extensions or dev tools that
refuse to operate on `file://` pages. Close the console window to stop it.

> ⚠️ **Pick one and stick with it.** Browsers keep separate storage for `file://` and
> `http://localhost`, so records entered in one will *not* appear in the other. To move
> between them, use Export/Import in Settings.

## Where your data lives

Everything is stored in your browser's `localStorage`, on this machine only.

- **Nothing is uploaded anywhere.**
- Data is tied to *this browser on this computer*. A different browser = different data.
- Clearing browser data for this page will erase your records.

**Back up regularly:** Settings → *Export All Data* writes a `.json` backup.
*Import Backup* restores it. *Load Sample Data* fills the app with example records so you
can try it out.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | The entire app (UI + logic), organized into commented sections |
| `vendor/` | React 18 and Babel — bundled so it works offline |
| `BuildMyBill.bat` | Launcher (opens `index.html` directly) |
| `Start-Server.bat` | Optional: serve at `http://localhost:8321/` |
| `serve.ps1` | The static file server used by `Start-Server.bat` |

To edit the app, open `index.html` in any text editor. The code sits inside the
`<script type="text/babel">` block at the bottom, split into labelled sections:
storage, UI atoms, CRUD engine, quotes, time tracking, dashboard, settings, shell.

## Printing an invoice

Quotes & Invoices → open a document → **Preview & Print** → *Print / Save as PDF*.
In the print dialog choose "Save as PDF" as the destination.

## Known limits (by design, for this local version)

- No real authentication — anyone with access to this computer can open the app.
- No multi-user sync; each computer holds its own data.
- Subscription plans are a UI mock-up; no payment processing.

Moving to real accounts, shared data, and payments means adding a backend — that's a
bigger step than this local version, and this code is structured so the storage layer
(`db` at the top of the script) is the only part that has to change.
