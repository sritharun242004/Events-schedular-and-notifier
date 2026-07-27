import Link from "next/link";
import { signOut } from "@/auth";
import { NewProjectButton } from "./NewProjectButton";

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
          {projects.map((p) => {
            const active = p.id === currentId;
            return (
              <li key={p.id}>
                <Link
                  href={`/dashboard?project=${p.id}`}
                  className={`group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition ${
                    active
                      ? "bg-white/10 text-white"
                      : "text-white/70 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: p.color }}
                  />
                  <span className="truncate flex-1">{p.name}</span>
                  <span
                    className={`text-[11px] tabular-nums ${
                      active ? "text-white/60" : "text-white/30"
                    }`}
                  >
                    {p._count.events}
                  </span>
                </Link>
              </li>
            );
          })}
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
