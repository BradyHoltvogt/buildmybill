# Going live at www.buildmybill.com

This gets BuildMyBill onto the public internet at your domain, with an
**auto-deploy loop**: once set up, every code change is pushed to GitHub and
Cloudflare rebuilds the live site automatically in ~30 seconds.

**How the work splits:**
- 🧑 **You** do the parts that touch your accounts and money (logins, DNS). Claude
  cannot do these — they need your credentials.
- 🤖 **Claude** does everything else: the code, the repo, the pushes, and every
  future edit once you're logged in.

---

## The pieces

```
  Claude edits index.html
          │  git push
          ▼
     GitHub  (your repo — holds the code)
          │  auto-trigger
          ▼
  Cloudflare Pages  (builds + hosts, free)
          │
          ▼
  www.buildmybill.com   ← your visitors
```

Nothing here costs money. GitHub, Cloudflare Pages, and HTTPS are all free.
You already own the domain (it's on Wix now).

---

## Step 1 — 🧑 Log in to GitHub (one command)

Open **Windows Terminal** or **PowerShell** (a fresh window, so it sees the newly
installed tools) and run:

```
gh auth login
```

Answer the prompts:
- **GitHub.com**
- **HTTPS**
- **Authenticate with a web browser** → Yes → it shows a one-time code → press
  Enter → sign in / create your free GitHub account in the browser → paste the code.

That's it. This logs in both GitHub CLI and Git. **Tell Claude when it's done.**

> No GitHub account yet? The browser step lets you create one free in ~1 minute.

---

## Step 2 — 🤖 Claude pushes the code to GitHub

Once you're logged in, Claude runs (you don't have to):

```
gh repo create buildmybill --private --source . --remote origin --push
```

This creates a private repo `buildmybill` under your account and uploads the code.
Now your app lives on GitHub.

---

## Step 3 — 🧑 Connect Cloudflare Pages (free host)

1. Go to **https://dash.cloudflare.com** → create a free account (or sign in).
2. Left menu → **Workers & Pages** → **Create** → **Pages** tab →
   **Connect to Git**.
3. Authorize GitHub, pick the **buildmybill** repo.
4. Build settings — this app has **no build step**, so:
   - **Framework preset:** `None`
   - **Build command:** *(leave blank)*
   - **Build output directory:** `/`
5. **Save and Deploy.**

In ~1 minute you get a live URL like `buildmybill.pages.dev`. **The app is now
online.** Open it and confirm it works.

---

## Step 4 — 🧑 Point buildmybill.com at it

Your domain's DNS is on Wix right now. The cleanest move is to let Cloudflare
manage DNS (it's free and makes the domain "just work").

1. In Cloudflare dash → **Add a site** → enter `buildmybill.com`.
2. Cloudflare **scans and imports your current DNS records** (this preserves any
   email you have on the domain — check the list includes your MX records if you
   use `name@buildmybill.com` email).
3. Cloudflare shows you **two nameservers** (e.g. `xxx.ns.cloudflare.com`).
4. In **Wix**: My Domains → `buildmybill.com` → **Advanced / Nameservers** →
   choose **Use custom / external nameservers** → paste Cloudflare's two
   nameservers → save.
5. Back in Cloudflare, wait for it to confirm the domain is active (minutes to a
   few hours).
6. **Workers & Pages → buildmybill (your Pages project) → Custom domains** →
   **Set up a custom domain** → add `buildmybill.com`, then again for
   `www.buildmybill.com`. Cloudflare wires the DNS for you and issues HTTPS
   automatically.

Done — **https://www.buildmybill.com** now serves the app. 🎉

> ⚠️ Moving nameservers means the current Wix page at that domain stops showing.
> That's expected — this app replaces it. Just make sure Step 4.2 kept your email
> (MX) records if you use domain email.

---

## After go-live — 🤖 The edit loop (Claude, on request)

From here, whenever you want a change ("make the invoice logo bigger", "add a new
field"), Claude:

1. Edits the code,
2. Commits and pushes to GitHub,
3. Cloudflare auto-rebuilds.

Your live site updates in about 30 seconds. You don't touch anything — just ask,
then refresh the page.

---

## Notes & limits

- **Data:** this version stores each visitor's data in *their own browser*. Great
  for you or a single company. Turning it into real multi-company accounts with a
  shared database is a separate, larger build (needs a backend + paid hosting).
- **Speed:** the app compiles itself in the browser (via Babel) on load, which
  adds a second or two to first paint. Fine for launch; can be optimized later by
  pre-compiling.
- **Rollback:** every deploy is a Git commit, so any change can be reverted, and
  Cloudflare keeps every previous deployment one click away.
