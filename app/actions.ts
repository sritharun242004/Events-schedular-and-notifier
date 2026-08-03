"use server";

import { revalidatePath } from "next/cache";
import { auth, signIn, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  upsertCalendarEvent,
  deleteCalendarEvent,
} from "@/lib/google";
import { parseFreeformDate, dateUTC, formatNice, formatTimeLabel } from "@/lib/date";
import {
  sendEmail,
  buildProjectCreatedHtml,
  buildSchedulesAddedHtml,
} from "@/lib/email";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session.user.id;
}

async function sessionUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return { id: session.user.id, email: session.user.email ?? null };
}

const appUrl = () => process.env.AUTH_URL || undefined;
const projectUrl = (id: string) =>
  process.env.AUTH_URL ? `${process.env.AUTH_URL}/dashboard?project=${id}` : undefined;

async function ownsProject(userId: string, projectId: string) {
  const p = await prisma.project.findFirst({ where: { id: projectId, userId } });
  if (!p) throw new Error("Project not found");
  return p;
}

// ── Account / calendar connection ────────────────────────
/** (Re)grant the Google Calendar scope via OAuth — for users who never connected. */
export async function connectCalendar() {
  await signIn("google", { redirectTo: "/dashboard" });
}

/** Turn calendar sync back on (scope already granted, was soft-disconnected). */
export async function enableCalendar() {
  const userId = await requireUser();
  await prisma.account.updateMany({
    where: { userId, provider: "google" },
    data: { calendarDisabled: false },
  });
  revalidatePath("/dashboard");
}

/** Stop syncing to Google Calendar (keeps login + existing events intact). */
export async function disconnectCalendar() {
  const userId = await requireUser();
  await prisma.account.updateMany({
    where: { userId, provider: "google" },
    data: { calendarDisabled: true },
  });
  revalidatePath("/dashboard");
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}

// ── Projects ─────────────────────────────────────────────
const PROJECT_COLORS = [
  "#E8A317", // amber
  "#E5484D", // red
  "#8B5CF6", // violet
  "#12A594", // teal
  "#3E63DD", // blue
  "#E93D82", // pink
];

export async function createProject(formData: FormData): Promise<void> {
  const { id: userId, email } = await sessionUser();
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  const count = await prisma.project.count({ where: { userId } });
  const project = await prisma.project.create({
    data: { userId, name, color: PROJECT_COLORS[count % PROJECT_COLORS.length] },
  });
  // Flow 2: confirm project creation (links straight to the project).
  const notify = process.env.NOTIFY_EMAIL || email;
  if (notify) {
    await sendEmail({
      to: notify,
      subject: `🔔 Project created — ${name}`,
      html: buildProjectCreatedHtml(name, projectUrl(project.id)),
    });
  }
  revalidatePath("/dashboard");
}

export async function renameProject(projectId: string, name: string) {
  const userId = await requireUser();
  await ownsProject(userId, projectId);
  await prisma.project.update({ where: { id: projectId }, data: { name: name.trim() || "Untitled" } });
  revalidatePath("/dashboard");
}

export async function deleteProject(
  projectId: string,
  deleteEvents: boolean
) {
  const userId = await requireUser();
  await ownsProject(userId, projectId);
  // Optionally remove the events from Google Calendar first.
  if (deleteEvents) {
    const events = await prisma.event.findMany({
      where: { projectId, googleEventId: { not: null } },
      select: { googleEventId: true },
    });
    await Promise.all(
      events.map((e) => e.googleEventId && deleteCalendarEvent(userId, e.googleEventId))
    );
  }
  // Always remove the project + its rows from the app (events cascade).
  await prisma.project.delete({ where: { id: projectId } });
  revalidatePath("/dashboard");
}

// ── Events ───────────────────────────────────────────────
type EventInput = {
  title: string;
  date: string;   // from <input type="date"> ("" if none)
  time: string;   // from <input type="time"> ("" => all-day)
  freeform: string;
  notes: string;
};

function resolveDate(input: EventInput): Date | null {
  if (input.date) {
    const [y, m, d] = input.date.split("-").map(Number);
    if (y && m && d) return dateUTC(y, m - 1, d);
  }
  return parseFreeformDate(input.freeform);
}

/** Push one already-loaded event to Google Calendar; returns its new status. */
async function syncOne(
  userId: string,
  ev: {
    id: string;
    title: string;
    date: Date | null;
    time: string | null;
    freeformDate: string | null;
    notes: string | null;
    googleEventId: string | null;
  }
): Promise<string> {
  if (!ev.date || !ev.title.trim()) {
    if (ev.googleEventId) await deleteCalendarEvent(userId, ev.googleEventId);
    const status = ev.title.trim() && !ev.date ? "needs_date" : "pending";
    await prisma.event.update({
      where: { id: ev.id },
      data: { googleEventId: null, status },
    });
    return status;
  }

  const googleEventId = await upsertCalendarEvent(userId, {
    googleEventId: ev.googleEventId,
    title: ev.title,
    date: ev.date,
    time: ev.time,
    description: [ev.notes, ev.freeformDate && `Planned: ${ev.freeformDate}`]
      .filter(Boolean)
      .join("\n"),
  });
  const status = googleEventId ? "synced" : "pending";
  await prisma.event.update({
    where: { id: ev.id },
    data: { googleEventId: googleEventId ?? ev.googleEventId, status },
  });
  return status;
}

/**
 * Fast, DB-only upsert powering Google-Sheets-style autosave. Deliberately does
 * NOT call Google Calendar (that happens in the background via
 * syncProjectCalendar), so typing and bulk entry stay instant. Returns the
 * row's id and a provisional status.
 */
export async function saveEvent(
  projectId: string,
  input: EventInput & { id?: string }
): Promise<{ id: string; status: string }> {
  const userId = await requireUser();
  await ownsProject(userId, projectId);

  const date = resolveDate(input);
  const title = input.title.trim();
  const status = !date && title ? "needs_date" : "pending";
  const data = {
    title,
    date,
    time: input.time.trim() || null,
    freeformDate: input.freeform.trim() || null,
    notes: input.notes.trim() || null,
    status,
  };

  if (input.id) {
    const ev = await prisma.event.update({ where: { id: input.id }, data });
    return { id: ev.id, status: ev.status };
  }
  const ev = await prisma.event.create({ data: { projectId, ...data } });
  return { id: ev.id, status: ev.status };
}

/**
 * Sync every not-yet-synced event in a project to Google Calendar.
 * Fast, email-free — the confirmation email is sent separately (and later)
 * via notifyNewSchedules so it can batch and wait until editing settles.
 */
export async function syncProjectCalendar(
  projectId: string
): Promise<{ id: string; status: string }[]> {
  const userId = await requireUser();
  await ownsProject(userId, projectId);
  const events = await prisma.event.findMany({
    where: { projectId, status: { in: ["pending", "needs_date"] } },
  });
  const out: { id: string; status: string }[] = [];
  for (const ev of events) {
    out.push({ id: ev.id, status: await syncOne(userId, ev) });
  }
  return out;
}

/**
 * Flow 2: send ONE "schedules added" email for events that have synced to the
 * calendar but haven't been confirmed yet (once each). Called from the client a
 * minute after editing settles, so a whole batch of entries produces one email.
 */
export async function notifyNewSchedules(projectId: string): Promise<void> {
  const { id: userId, email } = await sessionUser();
  const project = await ownsProject(userId, projectId);
  const to = process.env.NOTIFY_EMAIL || email;
  if (!to) return;

  const fresh = await prisma.event.findMany({
    where: { projectId, status: "synced", notified: false, date: { not: null } },
    orderBy: { date: "asc" },
  });
  if (!fresh.length) return;

  await sendEmail({
    to,
    subject: `🔔 ${fresh.length} schedule${fresh.length === 1 ? "" : "s"} added — ${project.name}`,
    html: buildSchedulesAddedHtml(
      project.name,
      fresh.map((e) => ({
        title: e.title,
        dateLabel: formatNice(e.date!) + (e.time ? ` · ${formatTimeLabel(e.time)}` : ""),
      })),
      projectUrl(projectId)
    ),
  });
  await prisma.event.updateMany({
    where: { id: { in: fresh.map((e) => e.id) } },
    data: { notified: true },
  });
}

export async function removeEvent(eventId: string): Promise<void> {
  const userId = await requireUser();
  const ev = await prisma.event.findUnique({
    where: { id: eventId },
    include: { project: true },
  });
  if (!ev || ev.project.userId !== userId) return;
  if (ev.googleEventId) await deleteCalendarEvent(userId, ev.googleEventId);
  await prisma.event.delete({ where: { id: eventId } });
}

// ── Bulk import (CSV / Excel) ────────────────────────────
type ImportRow = {
  project?: string;
  date?: string;
  time?: string;
  event?: string;
  planned?: string;
  notes?: string;
};

function importDate(raw: string): Date | null {
  const s = (raw || "").trim();
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return dateUTC(+m[1], +m[2] - 1, +m[3]);
  return parseFreeformDate(s); // "Aug 4", "July 20/21" → first date; "TBD" → null
}

/**
 * Bulk-create events from parsed spreadsheet rows. Routes each row to a project
 * by its "Project" column (creating it if new), or to fallbackProjectId when the
 * column is blank. Then syncs all dated events to Google Calendar.
 */
export async function importEvents(
  rows: ImportRow[],
  fallbackProjectId?: string
): Promise<{ created: number; synced: number; projects: number; skipped: number }> {
  const userId = await requireUser();
  if (!Array.isArray(rows)) return { created: 0, synced: 0, projects: 0, skipped: 0 };
  const capped = rows.slice(0, 2000);

  let fallback: string | undefined;
  if (fallbackProjectId) {
    const p = await prisma.project.findFirst({ where: { id: fallbackProjectId, userId } });
    fallback = p?.id;
  }

  const existing = await prisma.project.findMany({ where: { userId } });
  const byName = new Map<string, string>();
  for (const p of existing) byName.set(p.name.toLowerCase(), p.id);
  let colorIdx = existing.length;

  const affected = new Set<string>();
  let created = 0;
  let skipped = 0;

  for (const r of capped) {
    const title = String(r.event || "").trim();
    const pname = String(r.project || "").trim();
    let projectId: string | undefined;
    if (pname) {
      const key = pname.toLowerCase();
      projectId = byName.get(key);
      if (!projectId) {
        const proj = await prisma.project.create({
          data: { userId, name: pname, color: PROJECT_COLORS[colorIdx++ % PROJECT_COLORS.length] },
        });
        byName.set(key, proj.id);
        projectId = proj.id;
      }
    } else {
      projectId = fallback;
    }
    if (!projectId || !title) {
      skipped++;
      continue;
    }

    const rawDate = String(r.date || "").trim();
    const date = importDate(rawDate);
    const isIso = /^\d{4}-\d{1,2}-\d{1,2}$/.test(rawDate);
    const planned =
      String(r.planned || "").trim() || (rawDate && !isIso ? rawDate : "") || null;
    const timeRaw = String(r.time || "").trim();
    const time = /^\d{1,2}:\d{2}$/.test(timeRaw) ? timeRaw : null;

    await prisma.event.create({
      data: {
        projectId,
        title,
        date,
        time,
        freeformDate: planned,
        notes: String(r.notes || "").trim() || null,
        status: date ? "pending" : "needs_date",
        notified: true,
      },
    });
    created++;
    affected.add(projectId);
  }

  let synced = 0;
  for (const pid of affected) {
    const evs = await prisma.event.findMany({
      where: { projectId: pid, status: { in: ["pending", "needs_date"] } },
    });
    for (const ev of evs) {
      if ((await syncOne(userId, ev)) === "synced") synced++;
    }
  }

  revalidatePath("/dashboard");
  return { created, synced, projects: byName.size, skipped };
}
