# 🎬 Schedule CRM

A Next.js CRM to manage every project's events in a spreadsheet-style grid,
with one-click **Google Calendar sync** and **email reminders** (day before +
day after). Deploys to **Vercel**.

- **Sign in with Google** — the login *also* connects your Google Calendar.
- **Projects** = tabs in the sidebar (KS 10, Sardar 2, …).
- **Events** = editable rows (Date · Asset · Notes). Save a row → it appears on
  your Google Calendar. Change/clear the date → the calendar event moves/deletes.
- **Reminders** — a daily Vercel Cron emails you tomorrow's + yesterday's events.

---

## Tech stack

| Concern    | Choice |
|------------|--------|
| Framework  | Next.js 15 (App Router) + TypeScript + Tailwind |
| Auth       | Auth.js (NextAuth v5) — Google provider w/ Calendar scope |
| Database   | PostgreSQL via Prisma (Neon / Vercel Postgres / Supabase) |
| Calendar   | `googleapis` (Calendar v3) |
| Reminders  | Vercel Cron → Resend email |

---

## Local setup

### 1. Install
```bash
npm install
```

### 2. Create a Postgres database (free)
Pick one and copy its connection string into `DATABASE_URL`:
- **Neon** — https://neon.tech (recommended, generous free tier)
- **Vercel Postgres** — Storage tab in your Vercel project
- **Supabase** — https://supabase.com (use the "Connection string" / URI)

### 3. Google OAuth credentials
1. Go to https://console.cloud.google.com → create/select a project.
2. **APIs & Services → Enabled APIs → enable "Google Calendar API".**
3. **OAuth consent screen** → External → add your email as a **Test user**
   (while in "Testing" mode only test users can sign in).
4. **Credentials → Create credentials → OAuth client ID → Web application.**
   - Authorized redirect URIs:
     - `http://localhost:3000/api/auth/callback/google`
     - `https://YOUR-APP.vercel.app/api/auth/callback/google` (add after deploy)
5. Copy the Client ID / Secret into `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`.

### 4. Environment variables
```bash
cp .env.example .env
npx auth secret        # fills AUTH_SECRET (or use: openssl rand -base64 33)
```
Fill in `DATABASE_URL`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, and (for
reminders) `RESEND_API_KEY` + `CRON_SECRET`.

### 5. Create the database tables
```bash
npx prisma db push
```

### 6. Run
```bash
npm run dev
```
Open http://localhost:3000 → **Sign in with Google** → create a project → add events.

---

## Deploy to Vercel

1. Push this folder to a GitHub repo, then **Import** it in Vercel.
2. Add all env vars from `.env` to **Vercel → Settings → Environment Variables**
   (set `AUTH_URL` to your `https://YOUR-APP.vercel.app`).
3. Add your Vercel callback URL to the Google OAuth client (step 3.4 above).
4. Deploy. Run `npx prisma db push` once against the production `DATABASE_URL`
   (or `vercel env pull` then push locally).
5. The cron in `vercel.json` runs `/api/cron/reminders` daily at 08:00 UTC.
   Set `CRON_SECRET` so the endpoint is protected — Vercel sends it automatically.

### Test the reminder email
```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://YOUR-APP.vercel.app/api/cron/reminders
```

---

## Notes & next steps
- **Reminders go to the signed-in user's email.** To also notify a boss/others,
  add recipient emails to the project (small schema + cron tweak — easy to add).
- **All events are all-day.** Add a time column if you need specific times.
- **Reminder time** is 08:00 UTC — change the cron in `vercel.json`.
- **Google "Testing" mode** limits sign-in to added test users; submit the
  consent screen for verification to open it to everyone.
- **WhatsApp/SMS reminders** can replace/supplement email via Twilio later.
