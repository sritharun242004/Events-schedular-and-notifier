"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { deleteProject } from "@/app/actions";

type Project = { id: string; name: string; color: string; eventCount: number };

export function ProjectRow({
  project,
  active,
}: {
  project: Project;
  active: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [alsoDelete, setAlsoDelete] = useState(false); // false = keep calendar events
  const [pending, start] = useTransition();
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  useEffect(() => setMounted(true), []);

  const confirm = () => {
    start(async () => {
      await deleteProject(project.id, alsoDelete);
      setOpen(false);
      if (active) router.push("/dashboard");
      else router.refresh();
    });
  };

  const n = project.eventCount;
  const plural = n === 1 ? "event" : "events";

  return (
    <li>
      <div
        className={`group/row flex items-center gap-2 rounded-lg pl-2.5 pr-1.5 py-2 text-sm transition ${
          active ? "bg-white/10 text-white" : "text-white/70 hover:text-white hover:bg-white/5"
        }`}
      >
        <Link
          href={`/dashboard?project=${project.id}`}
          className="flex items-center gap-2.5 flex-1 min-w-0"
        >
          <span
            className="h-2.5 w-2.5 rounded-full shrink-0"
            style={{ backgroundColor: project.color }}
          />
          <span className="truncate flex-1">{project.name}</span>
        </Link>
        <span
          className={`text-[11px] tabular-nums ${active ? "text-white/60" : "text-white/30"}`}
        >
          {n}
        </span>
        <button
          onClick={() => {
            setAlsoDelete(false);
            setOpen(true);
          }}
          className="opacity-0 group-hover/row:opacity-100 text-white/40 hover:text-[#F2777A] transition p-1 -mr-0.5"
          title="Delete project"
          aria-label={`Delete ${project.name}`}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
            <path d="M10 11v6M14 11v6" />
          </svg>
        </button>
      </div>

      {open &&
        mounted &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ink/50 backdrop-blur-sm"
            onClick={() => !pending && setOpen(false)}
          >
            <div
              className="w-full max-w-md bg-card rounded-xl shadow-pop p-6 text-ink"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="font-display text-xl font-bold mb-1">
                Delete “{project.name}”?
              </h2>
              <p className="text-sm text-muted mb-4">
                This project has <b>{n}</b> {plural}. Choose what happens to them:
              </p>

              <div className="space-y-2">
                <label
                  className={`flex gap-3 items-start p-3 rounded-lg border cursor-pointer transition ${
                    !alsoDelete ? "border-amber bg-amber-soft/50" : "border-line hover:bg-black/[0.02]"
                  }`}
                >
                  <input
                    type="radio"
                    name="delmode"
                    checked={!alsoDelete}
                    onChange={() => setAlsoDelete(false)}
                    className="mt-0.5 accent-amber"
                  />
                  <div>
                    <div className="font-medium text-sm">Delete the project only</div>
                    <div className="text-xs text-muted">
                      Keep the {n} {plural} on your Google Calendar
                    </div>
                  </div>
                </label>

                <label
                  className={`flex gap-3 items-start p-3 rounded-lg border cursor-pointer transition ${
                    alsoDelete ? "border-[#E5484D] bg-[#E5484D]/5" : "border-line hover:bg-black/[0.02]"
                  }`}
                >
                  <input
                    type="radio"
                    name="delmode"
                    checked={alsoDelete}
                    onChange={() => setAlsoDelete(true)}
                    className="mt-0.5 accent-[#E5484D]"
                  />
                  <div>
                    <div className="font-medium text-sm">
                      Delete the project and its calendar events
                    </div>
                    <div className="text-xs text-muted">
                      Also removes all {n} {plural} from your Google Calendar
                    </div>
                  </div>
                </label>
              </div>

              <div className="flex justify-end gap-2 mt-5">
                <button onClick={() => setOpen(false)} disabled={pending} className="btn-ghost">
                  Cancel
                </button>
                <button
                  onClick={confirm}
                  disabled={pending}
                  className="btn bg-[#E5484D] text-white hover:bg-[#cf3b40]"
                >
                  {pending ? "Deleting…" : alsoDelete ? "Delete project + events" : "Delete project"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </li>
  );
}
