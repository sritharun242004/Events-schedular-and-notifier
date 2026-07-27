"use client";

import { useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export function DashboardChrome({
  sidebar,
  children,
}: {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const search = useSearchParams();

  // Close the drawer whenever the route/project changes (mobile nav tap).
  useEffect(() => setOpen(false), [pathname, search]);

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-ink/50 z-30 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      {/* Sidebar — off-canvas drawer on mobile, static column on desktop */}
      <div
        className={`fixed lg:static inset-y-0 left-0 z-40 transition-transform duration-200 ease-out lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebar}
      </div>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center gap-3 h-14 px-4 border-b border-line bg-card shrink-0">
          <button
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="p-1.5 -ml-1.5 rounded-md hover:bg-black/5"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="clapper-stripe h-6 w-6 rounded" />
          <span className="font-display font-extrabold text-lg tracking-tight">
            PingBot
          </span>
        </div>

        {children}
      </div>
    </div>
  );
}
