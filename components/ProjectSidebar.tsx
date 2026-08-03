import { NewProjectButton } from "./NewProjectButton";
import { ProjectRow } from "./ProjectRow";
import { ProfileButton } from "./ProfileButton";
import { ImportButton } from "./ImportButton";

type Project = {
  id: string;
  name: string;
  color: string;
  _count: { events: number };
};

export function ProjectSidebar({
  projects,
  currentId,
  userName,
  userEmail,
  calendarConnected,
  hasCalendarScope,
}: {
  projects: Project[];
  currentId: string | null;
  userName: string | null;
  userEmail: string;
  calendarConnected: boolean;
  hasCalendarScope: boolean;
}) {
  return (
    <aside className="w-64 h-full shrink-0 bg-ink text-white flex flex-col">
      {/* Brand */}
      <div className="h-16 flex items-center gap-3 px-5 border-b border-ink-line shrink-0">
        <span className="clapper-stripe h-7 w-7 rounded-md shadow-inner" />
        <div className="leading-tight">
          <div className="font-display font-extrabold text-lg tracking-tight">
            PingBot
          </div>
          <div className="text-[11px] text-white/40 -mt-0.5">event scheduler</div>
        </div>
      </div>

      {/* Projects */}
      <nav className="flex-1 overflow-auto px-3 py-4">
        <div className="flex items-center justify-between px-2 mb-2">
          <span className="text-[11px] uppercase tracking-wider text-white/40">
            Projects
          </span>
          <span className="text-[11px] text-white/30">{projects.length}</span>
        </div>

        {projects.length === 0 && (
          <p className="text-sm text-white/40 px-2 py-1">Nothing here yet.</p>
        )}

        <ul className="space-y-0.5">
          {projects.map((p) => (
            <ProjectRow
              key={p.id}
              project={{ id: p.id, name: p.name, color: p.color, eventCount: p._count.events }}
              active={p.id === currentId}
            />
          ))}
        </ul>

        <div className="mt-3 px-1">
          <NewProjectButton variant="sidebar" />
          <ImportButton currentProjectId={currentId} />
        </div>
      </nav>

      {/* Profile / account footer */}
      <ProfileButton
        name={userName}
        email={userEmail}
        projectCount={projects.length}
        calendarConnected={calendarConnected}
        hasCalendarScope={hasCalendarScope}
      />
    </aside>
  );
}
