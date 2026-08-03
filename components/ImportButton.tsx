"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { importEvents } from "@/app/actions";

const SAMPLE_CSV = `Project,Date,Time,Event,Planned,Notes
KS 10,2026-08-04,,Title Tease,,
KS 10,2026-08-13,,ASMR Promo,,First single announcement
KS 10,,,TIIF announcement asset,TBD,
KS 10,2026-09-23,16:30,Trailer launch event,,Chennai leg
Sardar 2,2026-06-24,,RELEASE DATE ANNOUNCEMENT,,
Sardar 2,,,MURUGAN SINGLE,TBD,
`;

type Result = { created: number; synced: number; projects: number; skipped: number };

function pick(obj: Record<string, unknown>, names: string[]): string {
  for (const k of Object.keys(obj)) {
    if (names.includes(k.trim().toLowerCase())) return String(obj[k] ?? "").trim();
  }
  return "";
}

export function ImportButton({ currentProjectId }: { currentProjectId?: string | null }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  useEffect(() => setMounted(true), []);

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pingbot-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const onFile = async (file: File) => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
      const rows = json
        .map((o) => ({
          project: pick(o, ["project"]),
          date: pick(o, ["date", "dates"]),
          time: pick(o, ["time"]),
          event: pick(o, ["event", "asset", "assets", "event / asset", "event/asset", "milestone", "title"]),
          planned: pick(o, ["planned", "planned date"]),
          notes: pick(o, ["notes", "note"]),
        }))
        .filter((r) => r.event || r.project);
      if (rows.length === 0) {
        setError("No rows found. Make sure the first row has column headers.");
        return;
      }
      const res = await importEvents(rows, currentProjectId ?? undefined);
      setResult(res);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read that file.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <>
      <button
        onClick={() => {
          setResult(null);
          setError(null);
          setOpen(true);
        }}
        className="w-full flex items-center gap-2 rounded-lg border border-ink-line/60 px-3 py-2 text-sm text-white/80 hover:text-white hover:border-amber/60 hover:bg-white/5 transition mt-1.5"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber">
          <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
        </svg>
        Import CSV / Excel
      </button>

      {open &&
        mounted &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ink/50 backdrop-blur-sm"
            onClick={() => !busy && setOpen(false)}
          >
            <div
              className="w-full max-w-lg bg-card rounded-xl shadow-pop p-6 text-ink"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="font-display text-xl font-bold mb-1">Import events</h2>
              <p className="text-sm text-muted mb-4">
                Upload a <b>.csv</b> or <b>.xlsx</b> file. Events are created in the app and
                dated ones sync to your Google Calendar.
              </p>

              <div className="rounded-lg bg-paper border border-line p-3 text-[13px] mb-4">
                <div className="font-medium mb-1.5">Columns (first row = headers)</div>
                <ul className="space-y-1 text-muted">
                  <li><b className="text-ink">Project</b> — project name (blank = imports into the open project)</li>
                  <li><b className="text-ink">Date</b> — <code>2026-08-04</code> or <code>Aug 4</code> (blank / <code>TBD</code> = no date)</li>
                  <li><b className="text-ink">Time</b> — <code>16:30</code> (blank = all-day)</li>
                  <li><b className="text-ink">Event</b> — the asset / title <span className="text-[#E5484D]">(required)</span></li>
                  <li><b className="text-ink">Planned</b> — original text like <code>July 20/21</code> (optional)</li>
                  <li><b className="text-ink">Notes</b> — extra details (optional)</li>
                </ul>
                <button onClick={downloadSample} className="text-amber-dark hover:text-amber font-medium mt-2.5 inline-flex items-center gap-1.5 text-sm">
                  ↓ Download sample CSV
                </button>
              </div>

              {result ? (
                <div className="rounded-lg border border-ok/30 bg-ok/5 p-4 text-sm">
                  <div className="font-medium text-ok mb-1">✅ Imported</div>
                  <div className="text-muted">
                    {result.created} event{result.created === 1 ? "" : "s"} created ·{" "}
                    {result.synced} synced to calendar
                    {result.skipped > 0 && <> · {result.skipped} skipped (no title/project)</>}
                  </div>
                </div>
              ) : (
                <label
                  className={`block border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition ${
                    busy ? "border-amber bg-amber-soft/40" : "border-line hover:border-amber hover:bg-amber-soft/20"
                  }`}
                >
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="hidden"
                    disabled={busy}
                    onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
                  />
                  <div className="text-sm font-medium">
                    {busy ? "Importing…" : "Click to choose a CSV / Excel file"}
                  </div>
                  <div className="text-xs text-muted mt-1">or drag & drop it here</div>
                </label>
              )}

              {error && <p className="text-sm text-[#E5484D] mt-3">{error}</p>}

              <div className="flex justify-end gap-2 mt-5">
                <button onClick={() => setOpen(false)} disabled={busy} className="btn-ghost">
                  {result ? "Done" : "Cancel"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
