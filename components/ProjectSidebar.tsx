import { signOut } from "@/auth";
import { NewProjectButton } from "./NewProjectButton";
import { ProjectRow } from "./ProjectRow";

type Project = {
  id: string;
  name: string;
  color: string;
  _count: { events: number };
};

export function ProjectSidebar({
  projects,
  currentId,
  userEmail,
}: {
  projects: Project[];
  currentId: string | null;
  userEmail: string;
}) {
  const initial = (userEmail[0] || "?").toUpperCase();

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
        </div>
      </nav>

      {/* User footer */}
      <div className="border-t border-ink-line p-3 flex items-center gap-3">
        <span className="h-8 w-8 rounded-full bg-amber text-ink font-semibold text-sm flex items-center justify-center shrink-0">
          {initial}
        </span>
        <span className="text-xs text-white/60 truncate flex-1" title={userEmail}>
          {userEmail}
        </span>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <button className="text-xs text-white/40 hover:text-white" title="Sign out">
            ⏻
          </button>
        </form>
      </div>
    </aside>
  );
}
