import { google, type calendar_v3 } from "googleapis";
import { prisma } from "./prisma";

const CALENDAR_ID = "primary";
const TIMEZONE = process.env.APP_TIMEZONE || "Asia/Kolkata";
const DEFAULT_DURATION_MIN = 60;

/**
 * Build an authenticated Google Calendar client for a user, refreshing the
 * access token if it is expired (or about to be) and persisting the new one.
 * Returns null if the user has no connected Google account / refresh token.
 */
export async function getCalendarClient(
  userId: string
): Promise<calendar_v3.Calendar | null> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "google" },
  });
  if (!account) return null;

  const oauth2 = new google.auth.OAuth2(
    process.env.AUTH_GOOGLE_ID,
    process.env.AUTH_GOOGLE_SECRET
  );
  oauth2.setCredentials({
    access_token: account.access_token ?? undefined,
    refresh_token: account.refresh_token ?? undefined,
    expiry_date: account.expires_at ? account.expires_at * 1000 : undefined,
  });

  const expiresSoon =
    !account.expires_at || account.expires_at * 1000 < Date.now() + 60_000;

  if (expiresSoon) {
    if (!account.refresh_token) return null; // can't refresh — user must reconnect
    try {
      const { credentials } = await oauth2.refreshAccessToken();
      oauth2.setCredentials(credentials);
      await prisma.account.update({
        where: {
          provider_providerAccountId: {
            provider: "google",
            providerAccountId: account.providerAccountId,
          },
        },
        data: {
          access_token: credentials.access_token ?? account.access_token,
          expires_at: credentials.expiry_date
            ? Math.floor(credentials.expiry_date / 1000)
            : account.expires_at,
          // Google usually omits refresh_token on refresh — keep the old one.
          refresh_token: credentials.refresh_token ?? account.refresh_token,
        },
      });
    } catch {
      return null;
    }
  }

  return google.calendar({ version: "v3", auth: oauth2 });
}

/** True if the user has a usable Google Calendar connection. */
export async function isCalendarConnected(userId: string): Promise<boolean> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "google" },
    select: { refresh_token: true, scope: true },
  });
  return Boolean(
    account?.refresh_token && account.scope?.includes("calendar.events")
  );
}

function toDateOnly(date: Date): string {
  // Google all-day events want a plain YYYY-MM-DD (in the event's own tz).
  return date.toISOString().slice(0, 10);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Build a wall-clock RFC3339 string (no offset) — interpreted in `timeZone`. */
function localDateTime(date: Date, hh: number, mm: number, addMinutes = 0): string {
  const base = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hh, mm)
  );
  const dt = new Date(base.getTime() + addMinutes * 60_000);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(
    dt.getUTCDate()
  )}T${pad(dt.getUTCHours())}:${pad(dt.getUTCMinutes())}:00`;
}

/**
 * Create or update a calendar event. With `time` ("HH:MM") it's a timed event
 * (default 1h) in the app timezone; without it, an all-day event.
 * Returns the Google event id (new or existing), or null if not synced.
 */
export async function upsertCalendarEvent(
  userId: string,
  opts: {
    googleEventId?: string | null;
    title: string;
    date: Date;
    time?: string | null;
    description?: string;
  }
): Promise<string | null> {
  const cal = await getCalendarClient(userId);
  if (!cal) return null;

  let start: calendar_v3.Schema$EventDateTime;
  let end: calendar_v3.Schema$EventDateTime;
  const timed = opts.time && /^\d{1,2}:\d{2}$/.test(opts.time);
  if (timed) {
    const [hh, mm] = opts.time!.split(":").map(Number);
    start = { dateTime: localDateTime(opts.date, hh, mm), timeZone: TIMEZONE };
    end = {
      dateTime: localDateTime(opts.date, hh, mm, DEFAULT_DURATION_MIN),
      timeZone: TIMEZONE,
    };
  } else {
    const day = toDateOnly(opts.date);
    start = { date: day };
    end = { date: day };
  }

  const requestBody: calendar_v3.Schema$Event = {
    summary: opts.title,
    description: opts.description,
    start,
    end,
    reminders: {
      useDefault: false,
      overrides: [{ method: "email", minutes: 24 * 60 }],
    },
  };

  try {
    if (opts.googleEventId) {
      const res = await cal.events.update({
        calendarId: CALENDAR_ID,
        eventId: opts.googleEventId,
        requestBody,
      });
      return res.data.id ?? opts.googleEventId;
    }
    const res = await cal.events.insert({
      calendarId: CALENDAR_ID,
      requestBody,
    });
    return res.data.id ?? null;
  } catch (err) {
    // If the stored event was deleted in Calendar, retry as a fresh insert.
    if (opts.googleEventId) {
      try {
        const res = await cal.events.insert({
          calendarId: CALENDAR_ID,
          requestBody,
        });
        return res.data.id ?? null;
      } catch {
        return null;
      }
    }
    return null;
  }
}

export async function deleteCalendarEvent(
  userId: string,
  googleEventId: string
): Promise<void> {
  const cal = await getCalendarClient(userId);
  if (!cal) return;
  try {
    await cal.events.delete({ calendarId: CALENDAR_ID, eventId: googleEventId });
  } catch {
    // already gone — ignore
  }
}
