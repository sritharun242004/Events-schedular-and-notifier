import nodemailer from "nodemailer";

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;

// Gmail SMTP — sends from GMAIL_USER to any recipient (no domain needed).
const transporter =
  GMAIL_USER && GMAIL_APP_PASSWORD
    ? nodemailer.createTransport({
        service: "gmail",
        auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
      })
    : null;

export async function sendEmail(opts: {
  to: string | string[];
  subject: string;
  html: string;
}): Promise<void> {
  if (!transporter) {
    console.warn("GMAIL_USER/GMAIL_APP_PASSWORD not set — skipping email:", opts.subject);
    return;
  }
  try {
    await transporter.sendMail({
      from: `Cinema Paiyan <${GMAIL_USER}>`,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
  } catch (err) {
    console.error("Gmail send failed:", opts.to, err instanceof Error ? err.message : err);
  }
}

// ── Shared building blocks ───────────────────────────────
const PALETTE = ["#E8A317", "#E5484D", "#8B5CF6", "#12A594", "#3E63DD", "#E93D82"];

/** Stable accent color per project name. */
export function projectColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

type Item = { project: string; title: string; dateLabel?: string };

function eventCard(item: Item): string {
  const color = projectColor(item.project);
  const datePill = item.dateLabel
    ? `<td align="right" style="vertical-align:middle;padding-left:12px;">
         <span style="display:inline-block;font-size:12px;font-weight:700;color:#17161C;background:#F3F2EF;border:1px solid #E7E6E1;border-radius:8px;padding:5px 9px;white-space:nowrap;">${item.dateLabel}</span>
       </td>`
    : "";
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border:1px solid #ECEBE6;border-radius:12px;overflow:hidden;margin-bottom:10px;">
    <tr>
      <td width="5" style="width:5px;background:${color};"></td>
      <td style="padding:13px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:middle;">
            <div style="font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${color};">${item.project}</div>
            <div style="font-size:15px;font-weight:600;color:#17161C;margin-top:3px;line-height:1.35;">${item.title}</div>
          </td>
          ${datePill}
        </tr></table>
      </td>
    </tr>
  </table>`;
}

function shell(
  title: string,
  subtitle: string,
  inner: string,
  appUrl?: string
): string {
  const cta = appUrl
    ? `<tr><td style="padding:20px 28px 0;">
         <a href="${appUrl}" style="display:inline-block;background:#17161C;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 20px;border-radius:10px;">Open Cinema Paiyan</a>
       </td></tr>`
    : "";
  return `
<div style="background:#F3F2EF;margin:0;padding:28px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid #E7E6E1;">
      <tr>
        <td style="background:#17161C;padding:22px 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="font-size:20px;font-weight:800;letter-spacing:-0.02em;color:#FFFFFF;">🎬 Cinema Paiyan</td>
            <td align="right" style="font-size:12px;color:#8A8895;">event scheduler</td>
          </tr></table>
        </td>
      </tr>
      <tr>
        <td style="padding:26px 28px 2px;">
          <div style="font-size:21px;font-weight:700;color:#17161C;letter-spacing:-0.01em;">${title}</div>
          <div style="font-size:13px;color:#8A8895;margin-top:4px;">${subtitle}</div>
        </td>
      </tr>
      ${inner}
      ${cta}
      <tr>
        <td style="padding:26px 28px;border-top:1px solid #EFEEEA;">
          <div style="font-size:12px;color:#A5A3AD;line-height:1.5;">
            You're getting this from Cinema Paiyan because you have events scheduled.
          </div>
        </td>
      </tr>
    </table>
    <div style="font-size:11px;color:#B7B5BD;margin-top:14px;">Cinema Paiyan · Event Scheduler</div>
  </td></tr></table>
</div>`;
}

function sectionBlock(heading: string, right: string, body: string): string {
  return `
  <tr><td style="padding:22px 28px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="font-size:13px;font-weight:700;color:#17161C;">${heading}</td>
      <td align="right" style="font-size:12px;color:#8A8895;white-space:nowrap;">${right}</td>
    </tr></table>
    <div style="height:12px;line-height:12px;">&nbsp;</div>
    ${body}
  </td></tr>`;
}

// ── Flow 3: day-before reminder ──────────────────────────
export function buildDayBeforeHtml(
  items: Item[],
  dateLabel: string,
  appUrl?: string
): string {
  const body = items.length
    ? items.map(eventCard).join("")
    : `<div style="font-size:14px;color:#9B99A3;">Nothing scheduled for tomorrow.</div>`;
  return shell(
    "Tomorrow's schedule",
    "Here's what's happening tomorrow across your projects.",
    sectionBlock("🔔 Happening tomorrow", dateLabel, body),
    appUrl
  );
}

// ── Flow 1: monthly overview ─────────────────────────────
export type MonthCluster = { project: string; events: { title: string; dateLabel: string }[] };

export function buildMonthlyHtml(
  clusters: MonthCluster[],
  monthLabel: string,
  appUrl?: string
): string {
  const total = clusters.reduce((n, c) => n + c.events.length, 0);
  const inner = clusters.length
    ? clusters
        .map((c) =>
          sectionBlock(
            `<span style="display:inline-block;width:9px;height:9px;border-radius:9px;background:${projectColor(
              c.project
            )};margin-right:7px;"></span>${c.project}`,
            `${c.events.length} event${c.events.length === 1 ? "" : "s"}`,
            c.events
              .map((e) => eventCard({ project: c.project, title: e.title, dateLabel: e.dateLabel }))
              .join("")
          )
        )
        .join("")
    : sectionBlock("This month", "", `<div style="font-size:14px;color:#9B99A3;">No dated schedules this month yet.</div>`);
  return shell(
    `Your ${monthLabel} schedule`,
    `${total} scheduled event${total === 1 ? "" : "s"} across ${clusters.length} project${
      clusters.length === 1 ? "" : "s"
    } this month.`,
    inner,
    appUrl
  );
}

// ── Flow 2: creation confirmations ───────────────────────
export function buildProjectCreatedHtml(projectName: string, appUrl?: string): string {
  return shell(
    "Project created",
    `“${projectName}” is ready. Add its schedule and each dated item syncs to your calendar.`,
    sectionBlock(
      `<span style="display:inline-block;width:9px;height:9px;border-radius:9px;background:${projectColor(
        projectName
      )};margin-right:7px;"></span>${projectName}`,
      "new",
      `<div style="font-size:14px;color:#9B99A3;">No schedules yet — add events in the grid to get started.</div>`
    ),
    appUrl
  );
}

export function buildSchedulesAddedHtml(
  projectName: string,
  events: { title: string; dateLabel: string }[],
  appUrl?: string
): string {
  const days = new Set(events.map((e) => e.dateLabel)).size;
  const body = events
    .map((e) => eventCard({ project: projectName, title: e.title, dateLabel: e.dateLabel }))
    .join("");
  return shell(
    "Schedules added",
    `${events.length} schedule${events.length === 1 ? "" : "s"} across ${days} day${
      days === 1 ? "" : "s"
    } added to “${projectName}” and synced to your calendar.`,
    sectionBlock("🎬 Added to " + projectName, `${events.length} new`, body),
    appUrl
  );
}
