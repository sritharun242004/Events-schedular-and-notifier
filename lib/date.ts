const MONTHS = "jan feb mar apr may jun jul aug sep oct nov dec".split(" ");

/**
 * Parse a free-form date string into a real UTC date-only value, or null.
 * Accepts "2026-08-04", "Aug 4", "Sep 4 or 5", "From Sep 29 to Oct 3"
 * (takes the first date). Returns null for "TBD"/blank/unparseable.
 */
export function parseFreeformDate(input: string, defaultYear?: number): Date | null {
  const s = (input || "").trim();
  if (!s || /tbd/i.test(s)) return null;
  const year = defaultYear ?? new Date().getUTCFullYear();

  // ISO or slash formats first.
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return dateUTC(+iso[1], +iso[2] - 1, +iso[3]);

  // "Aug 4" / "August 4"
  const m = s.match(/([A-Za-z]{3,9})\s+(\d{1,2})/);
  if (m) {
    const mi = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase());
    if (mi >= 0) return dateUTC(year, mi, +m[2]);
  }

  const d = new Date(s);
  if (!isNaN(d.getTime())) return dateUTC(d.getFullYear(), d.getMonth(), d.getDate());
  return null;
}

export function dateUTC(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m, d));
}

/** Format a Date as YYYY-MM-DD for <input type="date"> values. */
export function toInputValue(date: Date | null | undefined): string {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

export function formatNice(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatMonth(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "16:30" -> "4:30 PM"; blank -> "All day". */
export function formatTimeLabel(time?: string | null): string {
  if (!time || !/^\d{1,2}:\d{2}$/.test(time)) return "All day";
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = ((h + 11) % 12) + 1;
  return `${hr}:${String(m).padStart(2, "0")} ${ampm}`;
}
