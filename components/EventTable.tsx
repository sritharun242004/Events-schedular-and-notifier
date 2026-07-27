"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveEvent, removeEvent, syncProjectCalendar } from "@/app/actions";

type Row = {
  key: string;
  id?: string;
  title: string;
  date: string;
  time: string;
  freeform: string;
  notes: string;
  status: string;
  dirty: boolean;
};

type Initial = {
  id: string;
  title: string;
  date: string;
  time: string;
  freeform: string;
  notes: string;
  status: string;
};

const hasContent = (r: Row) =>
  Boolean(r.title.trim() || r.freeform.trim() || r.date);

let counter = 0;
const freshKey = () => `new-${counter++}`;
const blankRow = (): Row => ({
  key: freshKey(),
  title: "",
  date: "",
  time: "",
  freeform: "",
  notes: "",
  status: "pending",
  dirty: false,
});

export function EventTable({
  projectId,
  initialEvents,
}: {
  projectId: string;
  initialEvents: Initial[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(() => {
    const mapped = initialEvents.map((e) => ({ key: e.id, ...e, dirty: false }));
    return mapped.length ? mapped : [blankRow()];
  });
  const [state, setState] = useState<"saved" | "saving" | "syncing">("saved");
  const [focusKey, setFocusKey] = useState<string | null>(null);

  // Mirror rows in a ref so debounced async callbacks read the latest values.
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSync = useCallback(async () => {
    setState("syncing");
    const results = await syncProjectCalendar(projectId);
    setRows((rs) =>
      rs.map((r) => {
        const hit = results.find((z) => z.id === r.id);
        return hit ? { ...r, status: hit.status } : r;
      })
    );
    setState("saved");
    router.refresh(); // refresh header counts + sidebar badges
  }, [projectId, router]);

  const flush = useCallback(async () => {
    const dirty = rowsRef.current.filter((r) => r.dirty && hasContent(r));
    if (dirty.length === 0) {
      setState("saved");
      return;
    }
    await Promise.all(
      dirty.map(async (r) => {
        const res = await saveEvent(projectId, {
          id: r.id,
          title: r.title,
          date: r.date,
          time: r.time,
          freeform: r.freeform,
          notes: r.notes,
        });
        setRows((rs) =>
          rs.map((x) =>
            x.key === r.key
              ? { ...x, id: res.id, status: res.status, dirty: false }
              : x
          )
        );
      })
    );
    setState("saved");
    // Kick a background calendar sync shortly after saves settle.
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(runSync, 900);
  }, [projectId, runSync]);

  const scheduleFlush = useCallback(() => {
    setState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flush, 700);
  }, [flush]);

  const edit = (key: string, p: Partial<Row>) => {
    setRows((rs) =>
      rs.map((r) => (r.key === key ? { ...r, ...p, dirty: true } : r))
    );
    scheduleFlush();
  };

  const addRows = (n: number) => {
    setRows((rs) => [...rs, ...Array.from({ length: n }, blankRow)]);
  };

  const addRow = () => {
    const r = blankRow();
    setRows((rs) => [...rs, r]);
    setFocusKey(r.key); // autofocus the new row's title
  };

  const del = async (key: string) => {
    const row = rowsRef.current.find((r) => r.key === key);
    setRows((rs) => rs.filter((r) => r.key !== key));
    if (row?.id) {
      await removeEvent(row.id);
      router.refresh();
    }
  };

  const saveNow = async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (syncTimer.current) clearTimeout(syncTimer.current);
    await flush();
    await runSync();
  };

  // Flush any pending edits when leaving the page.
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (syncTimer.current) clearTimeout(syncTimer.current);
    };
  }, []);

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-end gap-3 mb-3">
        <SaveIndicator state={state} />
        <button onClick={saveNow} className="btn-primary py-1.5 px-3 text-sm">
          Save now
        </button>
      </div>

      {/* Grid */}
      <div className="bg-card rounded-xl border border-line shadow-card overflow-hidden">
       <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm border-collapse">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-muted border-b border-line">
              <th className="font-medium px-4 py-3 w-40">Date</th>
              <th className="font-medium px-4 py-3 w-28">Time</th>
              <th className="font-medium px-4 py-3">Event / asset</th>
              <th className="font-medium px-4 py-3 w-32">Planned</th>
              <th className="font-medium px-4 py-3">Notes</th>
              <th className="font-medium px-4 py-3 w-28">Status</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.key}
                className="group border-b border-line/70 last:border-b-0 hover:bg-paper/60 transition-colors"
              >
                <td className="px-4 py-2">
                  <input
                    type="date"
                    value={r.date}
                    onChange={(e) => edit(r.key, { date: e.target.value })}
                    className="field"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="time"
                    value={r.time}
                    onChange={(e) => edit(r.key, { time: e.target.value })}
                    className="field"
                    title="Leave blank for an all-day event"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    value={r.title}
                    autoFocus={r.key === focusKey}
                    onChange={(e) => edit(r.key, { title: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && i === rows.length - 1) addRow();
                    }}
                    placeholder="Untitled event"
                    className="field font-medium"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    value={r.freeform}
                    onChange={(e) => edit(r.key, { freeform: e.target.value })}
                    placeholder="TBD, Aug 4…"
                    className="field text-muted"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    value={r.notes}
                    onChange={(e) => edit(r.key, { notes: e.target.value })}
                    placeholder="—"
                    className="field text-muted"
                  />
                </td>
                <td className="px-4 py-2">
                  <StatusPill status={hasContent(r) ? r.status : "empty"} dirty={r.dirty} />
                </td>
                <td className="px-2 py-2">
                  <button
                    onClick={() => del(r.key)}
                    className="opacity-0 group-hover:opacity-100 text-muted hover:text-[#E5484D] transition"
                    title="Delete row"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
       </div>

        {/* Add-event footer, sits directly below the rows */}
        <div className="flex items-center justify-between border-t border-line px-4 py-2.5">
          <button
            onClick={addRow}
            className="inline-flex items-center gap-2 text-sm font-medium text-amber-dark hover:text-amber transition"
          >
            <span className="text-base leading-none">+</span> Add event
          </button>
          <button
            onClick={() => addRows(5)}
            className="text-xs text-muted hover:text-ink transition"
          >
            + 5 rows
          </button>
        </div>
      </div>

      <p className="text-xs text-muted mt-3">
        Changes save automatically. Dated rows sync to your Google Calendar a
        moment later — the status shows <b>Synced</b> when they land.
      </p>
    </div>
  );
}

function SaveIndicator({ state }: { state: "saved" | "saving" | "syncing" }) {
  if (state === "saving")
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted">
        <Spinner /> Saving…
      </span>
    );
  if (state === "syncing")
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted">
        <Spinner /> Syncing calendar…
      </span>
    );
  return (
    <span className="flex items-center gap-1.5 text-xs text-ok">
      <span className="h-1.5 w-1.5 rounded-full bg-ok" /> All changes saved
    </span>
  );
}

function StatusPill({ status, dirty }: { status: string; dirty: boolean }) {
  if (dirty)
    return <span className="pill border-line bg-black/[0.03] text-muted">Editing…</span>;
  if (status === "synced")
    return (
      <span className="pill border-ok/20 bg-ok/10 text-ok">
        <span className="h-1.5 w-1.5 rounded-full bg-ok" /> Synced
      </span>
    );
  if (status === "needs_date")
    return (
      <span className="pill border-amber/30 bg-amber-soft text-amber-dark">
        Needs date
      </span>
    );
  if (status === "empty") return <span className="text-muted/50 text-xs">—</span>;
  return <span className="pill border-line bg-black/[0.03] text-muted">Pending</span>;
}

function Spinner() {
  return (
    <span className="inline-block h-3 w-3 border-2 border-line border-t-amber rounded-full animate-spin" />
  );
}
