"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  connectCalendar,
  enableCalendar,
  disconnectCalendar,
  signOutAction,
} from "@/app/actions";

export function ProfileButton({
  name,
  email,
  projectCount,
  calendarConnected,
  hasCalendarScope,
}: {
  name: string | null;
  email: string;
  projectCount: number;
  calendarConnected: boolean;
  hasCalendarScope: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  useEffect(() => setMounted(true), []);

  const initial = (name?.[0] || email[0] || "?").toUpperCase();

  const doDisconnect = () =>
    start(async () => {
      await disconnectCalendar();
      router.refresh();
    });
  const doEnable = () =>
    start(async () => {
      await enableCalendar();
      router.refresh();
    });

  return (
    <>
      {/* Footer button */}
      <button
        onClick={() => setOpen(true)}
        className="w-full border-t border-ink-line p-3 flex items-center gap-3 text-left hover:bg-white/5 transition"
      >
        <span className="h-8 w-8 rounded-full bg-amber text-ink font-semibold text-sm flex items-center justify-center shrink-0">
          {initial}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs text-white/80 truncate">{name || "Account"}</span>
          <span className="block text-[11px] text-white/40 truncate">{email}</span>
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/40 shrink-0">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>

      {open &&
        mounted &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ink/50 backdrop-blur-sm"
            onClick={() => !pending && setOpen(false)}
          >
            <div
              className="w-full max-w-md bg-card rounded-xl shadow-pop overflow-hidden text-ink"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-ink text-white p-6 flex items-center gap-4">
                <span className="h-12 w-12 rounded-full bg-amber text-ink font-bold text-lg flex items-center justify-center shrink-0">
                  {initial}
                </span>
                <div className="min-w-0">
                  <div className="font-display font-bold text-lg truncate">{name || "Account"}</div>
                  <div className="text-sm text-white/50 truncate">{email}</div>
                </div>
              </div>

              <div className="p-6 space-y-5">
                {/* Stats */}
                <div className="text-sm text-muted">
                  <b className="text-ink">{projectCount}</b> project{projectCount === 1 ? "" : "s"}
                </div>

                {/* Calendar connection */}
                <div className="rounded-lg border border-line p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <GoogleCalIcon />
                      <div>
                        <div className="text-sm font-medium">Google Calendar</div>
                        {calendarConnected ? (
                          <div className="text-xs text-ok flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-ok" /> Connected — events sync automatically
                          </div>
                        ) : (
                          <div className="text-xs text-amber-dark">
                            {hasCalendarScope ? "Sync turned off" : "Not connected"}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3">
                    {calendarConnected ? (
                      <button
                        onClick={doDisconnect}
                        disabled={pending}
                        className="btn border border-line text-ink hover:bg-black/[0.03] w-full"
                      >
                        {pending ? "Disconnecting…" : "Disconnect calendar"}
                      </button>
                    ) : hasCalendarScope ? (
                      <button
                        onClick={doEnable}
                        disabled={pending}
                        className="btn-amber w-full"
                      >
                        {pending ? "Connecting…" : "Reconnect calendar"}
                      </button>
                    ) : (
                      <form action={connectCalendar}>
                        <button type="submit" className="btn-amber w-full">
                          Connect Google Calendar
                        </button>
                      </form>
                    )}
                  </div>
                  {!calendarConnected && (
                    <p className="text-[11px] text-muted mt-2 leading-relaxed">
                      {hasCalendarScope
                        ? "Turning it back on resumes syncing your dated events to Google Calendar."
                        : "You'll be sent to Google — keep the Calendar permission checked to finish."}
                    </p>
                  )}
                </div>

                {/* Sign out */}
                <form action={signOutAction}>
                  <button type="submit" className="btn-ghost w-full justify-start px-0 hover:bg-transparent hover:text-[#E5484D]">
                    Sign out
                  </button>
                </form>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

function GoogleCalIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" className="shrink-0">
      <rect x="3" y="4" width="18" height="17" rx="3" fill="#fff" stroke="#E7E6E1" />
      <rect x="3" y="4" width="18" height="4.5" rx="3" fill="#4285F4" />
      <text x="12" y="17.5" textAnchor="middle" fontSize="9" fontWeight="700" fill="#5F6368">31</text>
    </svg>
  );
}
