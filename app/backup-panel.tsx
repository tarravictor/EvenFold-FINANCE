import { useEffect, useState } from "react";
import { decryptBackup, encryptBackup, type BackupData } from "./backup";
import { readBackupState, restoreBackup } from "./finance-client";

export function BackupPanel({ onRestored }: { onRestored: () => Promise<void> }) {
  const [passphrase, setPassphrase] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ data: BackupData; version: number } | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [download, setDownload] = useState<string | null>(null);
  useEffect(() => () => { if (download) URL.revokeObjectURL(download); }, [download]);
  async function run(action: () => Promise<void>) {
    setBusy(true); setMessage("");
    try { await action(); } catch (error) { setMessage(error instanceof Error ? error.message : "Backup operation failed."); }
    finally { setBusy(false); }
  }
  return <section className="surface backup-panel"><h2>Encrypted backups</h2><p>Download all finance records, across every week. Your account and password are not included. Keep the passphrase somewhere safe: it cannot be recovered.</p>
    <div className="form-grid"><label>Backup passphrase<input type="password" autoComplete="new-password" minLength={12} maxLength={256} value={passphrase} disabled={busy} onChange={e => { setPassphrase(e.target.value); setPreview(null); }} placeholder="At least 12 characters" /></label>
    <button className="primary-button" disabled={busy || passphrase.length < 12} onClick={() => void run(async () => {
      const current = await readBackupState();
      const encrypted = await encryptBackup(current.data, passphrase);
      setDownload(URL.createObjectURL(new Blob([encrypted], { type: "application/json" })));
      setMessage("Encrypted backup ready. Download it using the link below.");
    })}>{busy ? "Working..." : "Create encrypted backup"}</button>
    {download && <a className="report-ready" href={download} download="evenfold-encrypted-backup.json">Download encrypted backup</a>}
    <label>Restore from an encrypted backup<input type="file" accept=".json,application/json" disabled={busy} onChange={e => { setFile(e.target.files?.[0] || null); setPreview(null); setConfirmation(""); }} /></label>
    <button className="outline-button" disabled={busy || !file || passphrase.length < 12} onClick={() => void run(async () => {
      if (!file || file.size > 5 * 1024 * 1024) throw new Error("Choose a backup smaller than 5 MB.");
      const data = await decryptBackup(await file.text(), passphrase);
      const current = await readBackupState();
      setPreview({ data, version: current.version }); setConfirmation("");
    })}>Preview restore</button>
    {preview && <div className="backup-preview"><h3>Replace your cloud records?</h3><p>This backup contains {preview.data.entries.length} entries, {preview.data.bills.length} bills, {preview.data.goals.length} goals, and {preview.data.groupSplits.length} group bills. Restoring replaces all current finance records, including weekly budgets. Export your current records first.</p><label>Type RESTORE to confirm<input value={confirmation} disabled={busy} onChange={e => setConfirmation(e.target.value)} autoComplete="off" /></label><button className="danger-button" disabled={busy || confirmation !== "RESTORE"} onClick={() => void run(async () => { await restoreBackup(preview.data, preview.version); setPreview(null); setConfirmation(""); setPassphrase(""); await onRestored(); setMessage("Backup restored to your signed-in account."); })}>Replace finance records</button><button className="outline-button" disabled={busy} onClick={() => setPreview(null)}>Cancel</button></div>}
    <p role="status" aria-live="polite">{message}</p></div></section>;
}
