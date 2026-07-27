import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  sendEmail,
  buildDayBeforeHtml,
  buildMonthlyHtml,
  type MonthCluster,
} from "@/lib/email";
import { dateUTC, formatNice, formatMonth, formatTimeLabel } from "@/lib/date";

export const dynamic = "force-dynamic";

type EventRow = {
  title: string;
  date: Date | null;
  time: string | null;
  project: { name: string; user: { email: string | null } };
};

/**
 * Daily reminder job (Vercel Cron, 08:00 IST). Always sends the day-before
 * reminder (Flow 3); on the 1st of the month also sends the monthly overview
 * (Flow 1). The instant creation confirmation (Flow 2) lives in the app.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    if (request.headers.get("authorization") !== `Bearer ${secret}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }

  const appUrl = process.env.AUTH_URL || undefined;
  const now = new Date();
  const today = dateUTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(today.getUTCDate() + 1);
  const dayAfter = new Date(today);
  dayAfter.setUTCDate(today.getUTCDate() + 2);

  let dayBeforeSent = 0;
  let monthlySent = 0;

  // ── Flow 3: day-before ──────────────────────────────────
  const tomorrowEvents = (await prisma.event.findMany({
    where: { date: { gte: tomorrow, lt: dayAfter } },
    include: { project: { include: { user: true } } },
    orderBy: { time: "asc" },
  })) as EventRow[];

  const byUserTomorrow = new Map<string, { project: string; title: string; dateLabel?: string }[]>();
  for (const ev of tomorrowEvents) {
    const email = ev.project.user.email;
    if (!email) continue;
    if (!byUserTomorrow.has(email)) byUserTomorrow.set(email, []);
    byUserTomorrow.get(email)!.push({
      project: ev.project.name,
      title: ev.title,
      dateLabel: formatTimeLabel(ev.time),
    });
  }
  for (const [email, items] of byUserTomorrow) {
    await sendEmail({
      to: process.env.NOTIFY_EMAIL || email,
      subject: "🔔 Tomorrow's schedule — Cinema Paiyan",
      html: buildDayBeforeHtml(items, formatNice(tomorrow), appUrl),
    });
    dayBeforeSent++;
  }

  // ── Flow 1: monthly overview (1st of the month) ─────────
  if (today.getUTCDate() === 1) {
    const monthStart = dateUTC(today.getUTCFullYear(), today.getUTCMonth(), 1);
    const nextMonth = dateUTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1);
    const monthEvents = (await prisma.event.findMany({
      where: { date: { gte: monthStart, lt: nextMonth } },
      include: { project: { include: { user: true } } },
      orderBy: [{ date: "asc" }, { time: "asc" }],
    })) as (EventRow & { date: Date })[];

    // group by user, then cluster by project
    const byUser = new Map<string, Map<string, MonthCluster>>();
    for (const ev of monthEvents) {
      const email = ev.project.user.email;
      if (!email) continue;
      if (!byUser.has(email)) byUser.set(email, new Map());
      const clusters = byUser.get(email)!;
      if (!clusters.has(ev.project.name))
        clusters.set(ev.project.name, { project: ev.project.name, events: [] });
      clusters.get(ev.project.name)!.events.push({
        title: ev.title,
        dateLabel:
          formatNice(ev.date) + (ev.time ? ` · ${formatTimeLabel(ev.time)}` : ""),
      });
    }
    for (const [email, clusters] of byUser) {
      await sendEmail({
        to: process.env.NOTIFY_EMAIL || email,
        subject: `🎬 Your ${formatMonth(monthStart)} schedule — Cinema Paiyan`,
        html: buildMonthlyHtml([...clusters.values()], formatMonth(monthStart), appUrl),
      });
      monthlySent++;
    }
  }

  return NextResponse.json({
    ok: true,
    dayBeforeSent,
    monthlySent,
    isFirstOfMonth: today.getUTCDate() === 1,
  });
}
