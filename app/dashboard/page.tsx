import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { prisma, withRetry } from "@/lib/prisma";
import { isCalendarConnected } from "@/lib/google";
import { formatNice } from "@/lib/date";
import { ProjectSidebar } from "@/components/ProjectSidebar";
import { EventTable } from "@/components/EventTable";
import { NewProjectButton } from "@/components/NewProjectButton";
import { DashboardChrome } from "@/components/DashboardChrome";

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const userId = session.user.id;
  const { project: selectedId } = await searchParams;

  const [projects, calendarConnected] = await withRetry(() =>
    Promise.all([
      prisma.project.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
        include: { _count: { select: { events: true } } },
      }),
      isCalendarConnected(userId),
    ])
  );

  const current =
    projects.find((p) => p.id === selectedId) ?? projects[0] ?? null;

  const events = current
    ? await prisma.event.findMany({
        where: { projectId: current.id },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      })
    : [];

  // Summary
  const syncedCount = events.filter((e) => e.status === "synced").length;
  const now = new Date();
  const upcoming = events
    .filter((e) => e.date && e.date >= new Date(now.toISOString().slice(0, 10)))
    .sort((a, b) => (a.date! > b.date! ? 1 : -1))[0];

  return (
    <DashboardChrome
      sidebar={
        <ProjectSidebar
          projects={projects}
          currentId={current?.id ?? null}
          userEmail={session.user.email ?? "you"}
        />
      }
    >
      {/* Header */}
      <header className="border-b border-line bg-card/70 backdrop-blur px-4 sm:px-8 py-4 sm:py-5 shrink-0">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              {current && (
                <span
                  className="h-3 w-3 rounded-full shrink-0"
                  style={{ backgroundColor: current.color }}
                />
              )}
              <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight truncate">
                {current ? current.name : "Welcome"}
              </h1>
            </div>
            {current && (
              <p className="text-[13px] sm:text-sm text-muted mt-1">
                {events.length} event{events.length === 1 ? "" : "s"}
                {" · "}
                {syncedCount} on your calendar
                {upcoming && (
                  <>
                    {" · "}
                    next: <span className="text-ink">{upcoming.title}</span> on{" "}
                    {formatNice(upcoming.date!)}
                  </>
                )}
              </p>
            )}
          </div>

          {calendarConnected ? (
            <span className="pill border-ok/20 bg-ok/10 text-ok self-start shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-ok" />
              Calendar connected
            </span>
          ) : (
            <form
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: "/dashboard" });
              }}
              className="self-start"
            >
              <button className="pill border-amber/40 bg-amber-soft text-amber-dark hover:bg-amber/20">
                ⚠ Reconnect calendar
              </button>
            </form>
          )}
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-auto px-4 sm:px-8 py-5 sm:py-6">
        {current ? (
          <EventTable
            key={current.id}
            projectId={current.id}
            initialEvents={events.map((e) => ({
              id: e.id,
              title: e.title,
              date: e.date ? e.date.toISOString().slice(0, 10) : "",
              time: e.time ?? "",
              freeform: e.freeformDate ?? "",
              notes: e.notes ?? "",
              status: e.status,
            }))}
          />
        ) : (
          <EmptyState />
        )}
      </div>
    </DashboardChrome>
  );
}

function EmptyState() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center max-w-sm">
        <div className="clapper-stripe h-14 w-14 rounded-xl mx-auto mb-5 shadow-inner" />
        <h2 className="font-display text-2xl font-bold mb-2">
          Start your first campaign
        </h2>
        <p className="text-muted mb-6">
          Create a project for a film, then add its beats — teasers, single
          drops, the release. Each dated event lands on your Google Calendar.
        </p>
        <NewProjectButton variant="hero" />
      </div>
    </div>
  );
}
