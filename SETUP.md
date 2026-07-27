# 🎬 Movie Schedule CRM → Google Calendar + Reminders

Turns your existing **"Work flow"** Google Sheet into a calendar-connected CRM.
Type a date in a row → it appears in Google Calendar → the boss gets an email
reminder **the day before** and a follow-up **the day after**.

**You never need the boss's password.** You only need their email address.

---

## What you get

- **One tab = one project** (KS 10, Sardar 2, Hello Kadhal, Toxic…) — same as now.
- A new **`Event Date`** column (real date) and a **`Calendar Sync`** status column,
  added automatically to every project tab.
- Type/change a date → the calendar event is **created/updated instantly**.
- The **boss is added as a guest**, so events show on the boss's calendar too.
- **Daily 8am email** to the boss: what's happening tomorrow + yesterday's follow-up.

---

## One-time setup (≈5 minutes)

### 0. Access
- The **boss shares the "Work flow" sheet with you as an _Editor_** (Share button → add your email → Editor).

### 1. Open the script editor
- Open the sheet → menu **Extensions ▸ Apps Script**.
- Delete anything in the editor, then **paste the entire contents of `Code.gs`**.

### 2. Set your 3 config values (top of the file)
```js
ADMIN_EMAIL:   'boss@gmail.com',   // ← the boss's real email
CALENDAR_NAME: 'Movie Schedule',   // ← name for the auto-created calendar
TIMEZONE:      'Asia/Kolkata',     // ← your timezone
```
Click **💾 Save**.

### 3. Run the setup
- Back in the sheet, **reload the page** once.
- A new menu **🎬 Schedule Sync** appears → click **⚙️ First-time setup**.
- Google asks you to **authorize** — click through:
  *Advanced ▸ Go to (project) ▸ Allow*. (This is normal; it's your own script.)
- Run **⚙️ First-time setup** once more if the first run only did the authorization.

That's it. ✅

---

## Daily use

1. In any project tab, fill the **`Event Date`** column with the real date
   (e.g. `Aug 4` or `2026-08-04`). Your original messy `Date` column
   (`TBD`, `July 20/21`…) stays untouched for humans to read.
2. The **`Calendar Sync`** column shows `✅ Aug 4, 2026` once synced.
   - Blank asset or no date → nothing is created.
   - Row with an asset but no date yet → shows `⏳ needs a date`.
3. Change a date → the event moves. Clear the date → the event is removed.

---

## FAQ

**Do I need the boss's login?** No. Everything runs on *your* account; the boss
just receives emails and calendar invites.

**Where do the calendar events live?** On a calendar called *Movie Schedule* on
your account, with the boss invited as a guest so it also appears on theirs.

**Can I get WhatsApp/SMS reminders instead of email?** Yes, later — it needs a
paid provider (e.g. Twilio). Email is free and built in; say the word to add it.

**Two-way sync (edit in Calendar → update sheet)?** Not included (sheet is the
source of truth). Can be added if needed.

**Reminder time?** Change `REMINDER_HOUR` in the config (0–23), save, then run
**🔔 Reinstall automatic triggers**.

**Test it now?** Menu → **✉️ Send reminder email now (test)**.
