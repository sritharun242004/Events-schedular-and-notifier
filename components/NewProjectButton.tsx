"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { createProject } from "@/app/actions";

export function NewProjectButton({
  variant = "sidebar",
}: {
  variant?: "sidebar" | "hero";
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, start] = useTransition();
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const submit = () => {
    if (!name.trim()) return;
    const fd = new FormData();
    fd.set("name", name.trim());
    start(async () => {
      await createProject(fd);
      setName("");
      setOpen(false);
    });
  };

  return (
    <>
      {variant === "sidebar" ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full flex items-center gap-2 rounded-lg border border-ink-line/60 px-3 py-2 text-sm text-white/80 hover:text-white hover:border-amber/60 hover:bg-white/5 transition"
        >
          <span className="text-amber text-base leading-none">+</span>
          New project
        </button>
      ) : (
        <button onClick={() => setOpen(true)} className="btn-amber">
          + New project
        </button>
      )}

      {open && mounted && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm"
          onClick={() => !pending && setOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-card rounded-xl shadow-pop p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-xl font-bold mb-1">New project</h2>
            <p className="text-sm text-muted mb-4">
              One project per film. Its events become a synced calendar timeline.
            </p>
            <input
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
                if (e.key === "Escape") setOpen(false);
              }}
              placeholder="e.g. KS 10, Sardar 2, Toxic"
              className="w-full border border-line rounded-lg px-3 py-2.5 text-sm outline-none focus:border-amber focus:ring-2 focus:ring-amber/30"
            />
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setOpen(false)}
                disabled={pending}
                className="btn-ghost"
              >
                Cancel
              </button>
              <button onClick={submit} disabled={pending || !name.trim()} className="btn-primary">
                {pending ? "Creating…" : "Create project"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
