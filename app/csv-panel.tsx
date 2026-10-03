import { useEffect, useRef, useState } from "react";
import Papa from "papaparse";
import { type Entry, money } from "./finance-utils";
export function CsvPanel({ entries, save }: { entries: Entry[]; save: (p: Record<string, unknown>) => Promise<boolean> }) {
  const [preview, setPreview] = useState<Entry[] | null>(null), [message, setMessage] = useState(""), [busy, setBusy] = useState(false), [url, setUrl] = useState("");
  const worker = useRef<Worker | null>(null);
  useEffect(() => () => worker.current?.terminate(), []);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  return <section className="settings-section csv-panel"><h2>CSV import & export</h2><p>All recorded expenses and loans, in PHP. CSV is not encrypted; protect downloaded files. Identical rows are skipped during import.</p><button className="outline-button" onClick={() => {
    const rows = entries.filter(e => e.kind !== "income").map(e => ({ date: e.date, kind: e.kind, description: e.description, category: e.category, borrower: e.borrower || "", amount: (e.amountCents / 100).toFixed(2), settled: e.settled }));
    const csv = rows.length ? Papa.unparse(rows, { escapeFormulae: true }) : "date,kind,description,category,borrower,amount,settled\r\n";
    setUrl(URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })));
  }}>Prepare CSV download</button>{url && <a className="report-ready" href={url} download="evenfold-transactions.csv">Download transactions CSV</a>}<label className="activity-search">Import CSV (maximum 2 MB)<input type="file" accept=".csv,text/csv" disabled={busy} onChange={async e => {
    setPreview(null); setMessage(""); const file = e.target.files?.[0]; if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setMessage("Choose a CSV smaller than 2 MB."); return; }
    setBusy(true); worker.current?.terminate();
    try { const parser = new Worker(new URL("./csv-worker.ts", import.meta.url), { type: "module" }); worker.current = parser;
      parser.onmessage = event => { setBusy(false); if (event.data.error) setMessage(event.data.error); else setPreview(event.data.entries); parser.terminate(); };
      parser.onerror = () => { setMessage("CSV could not be read. No data was changed."); setBusy(false); parser.terminate(); };
      parser.postMessage(await file.text());
    } catch { setBusy(false); setMessage("Could not read CSV."); }
  }}/></label>{preview && <div className="backup-preview"><h3>Import {preview.length} rows?</h3><p>Total listed: {money(preview.reduce((n, e) => n + e.amountCents, 0))}. Existing records will remain.</p><button className="primary-button" disabled={busy} onClick={async () => { setBusy(true); try { if (await save({ action: "import_entries", entries: preview })) { setPreview(null); setMessage("Import complete. Identical existing rows were skipped."); } } finally { setBusy(false); } }}>Confirm import</button><button className="outline-button" disabled={busy} onClick={() => setPreview(null)}>Cancel</button></div>}<p role="status">{busy ? "Processing..." : message}</p></section>;
}
