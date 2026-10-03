import { useEffect, useState } from "react";
import { Download, ShieldCheck, UserRound, LogOut } from "lucide-react";
import { preference, setPreference, offlinePreference } from "./device-settings";
import { offlineStore } from "./offline-store";
import { readBackupState } from "./finance-client";
import { BackupPanel } from "./backup-panel";
import type { Planner } from "./planner-model";
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
export function Settings({ onAccount, onSignOut, reload, data, save, confirm }: { onAccount?: () => void; onSignOut?: () => void; reload: () => Promise<void>; data: Planner; save: (p: Record<string, unknown>) => Promise<boolean>; confirm: (target: { title: string; detail: string; confirmLabel: string; tone?: "danger" | "default"; onConfirm: () => unknown | Promise<unknown> }) => void }) {
  const [offline, setOffline] = useState(offlinePreference);
  const [theme, setTheme] = useState(preference("theme", "light"));
  const [install, setInstall] = useState<InstallPrompt | null>((window as Window & { evenfoldInstall?: InstallPrompt }).evenfoldInstall || null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [rateCurrency, setRateCurrency] = useState("USD");
  const [rate, setRate] = useState("");
  const [reminders, setReminders] = useState(() => preference(`reminders-${window.EVENFOLD_USER || "unsigned"}`) === "yes");
  useEffect(() => {
    const handler = (event: Event) => { event.preventDefault(); setInstall(event as InstallPrompt); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);
  async function cache(enabled: boolean) {
    setBusy(true); setMessage("");
    try {
      const owner = window.EVENFOLD_USER; if (!owner) throw new Error("Sign in again before changing offline access.");
      if (enabled) { const snapshot = await readBackupState(); await offlineStore(owner, snapshot); }
      else await offlineStore(owner, undefined, true);
      setPreference(`offline-${owner}`, enabled ? "yes" : "no"); setOffline(enabled);
      setMessage(enabled ? "Offline viewing enabled on this device. Records are stored unencrypted in this browser, so use a trusted device." : "Offline snapshot removed from this account on this device.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Could not update offline access."); }
    finally { setBusy(false); }
  }
  return <div className="settings-stack"><section className="settings-section"><h2>Your account</h2><div className="settings-row"><div><strong>Profile & security</strong><p>Name, email, password, and account deletion</p></div><button className="outline-button" onClick={onAccount} disabled={!onAccount}><UserRound size={18}/> Account</button></div><div className="settings-row"><div><strong>Sign out</strong><p>Removes this account's offline snapshot from this browser</p></div><button className="outline-button" onClick={onSignOut} disabled={!onSignOut}><LogOut size={18}/> Sign out</button></div></section>
    <section className="settings-section"><h2>On this device</h2><div className="settings-row"><label htmlFor="theme"><strong>Appearance</strong><p>Choose a comfortable contrast</p></label><select id="theme" value={theme} onChange={e => { const value = e.target.value; try { setPreference("theme", value); document.documentElement.dataset.theme = value; setTheme(value); } catch (error) { setMessage(String(error)); } }}><option value="light">Light</option><option value="dark">Dark</option></select></div><div className="settings-row"><label htmlFor="offline"><strong>Offline viewing</strong><p>Optional local copy. Cloud saving still requires a connection.</p></label><input id="offline" type="checkbox" checked={offline} disabled={busy} onChange={e => void cache(e.target.checked)} /></div><div className="settings-row"><div><strong>Install EvenFold</strong><p>{install ? "Open your tracker in its own app window." : "On iPhone: Share, then Add to Home Screen. Other browsers: use the install option in the browser menu when available."}</p></div>{install && <button className="outline-button" onClick={async () => { await install.prompt(); await install.userChoice; setInstall(null); }}><Download size={18}/> Install</button>}</div></section>
    <section className="settings-section"><h2>Notifications</h2><div className="settings-row"><label htmlFor="bill-reminders"><strong>Due bill reminder</strong><p>Shows a browser notification for unpaid bills due soon when EvenFold is open. Your browser may limit this feature.</p></label><input id="bill-reminders" type="checkbox" checked={reminders} onChange={async e => { if (e.target.checked) { if (!("Notification" in window)) { setMessage("This browser does not support notifications."); return; } const permission = await Notification.requestPermission(); if (permission !== "granted") { setMessage("Notification permission was not granted."); return; } } try { setPreference(`reminders-${window.EVENFOLD_USER || "unsigned"}`, e.target.checked ? "yes" : "no"); setReminders(e.target.checked); } catch (error) { setMessage(String(error)); } }}/></div></section>
    <section className="settings-section"><h2>Categories and currencies</h2><p>Add categories for expenses and monthly plans. Rates are PHP per one unit of foreign currency and are entered by you. Existing entries keep the rate used when saved.</p><form className="inline-form" onSubmit={e => { e.preventDefault(); confirm({ title: "Add category?", detail: newCategory, confirmLabel: "Add category", onConfirm: async () => { if (await save({ action: "category_add", name: newCategory })) setNewCategory(""); } }); }}><label>New category<input required maxLength={100} value={newCategory} onChange={e => setNewCategory(e.target.value)}/></label><button className="outline-button">Add</button></form><div className="category-chips">{data.customCategories.map(name => <span key={name}>{name}<button title={`Remove ${name}`} aria-label={`Remove ${name}`} onClick={() => confirm({ title: `Remove ${name}?`, detail: "Categories used by records cannot be removed.", confirmLabel: "Remove", tone: "danger", onConfirm: () => save({ action: "category_delete", name }) })}>×</button></span>)}</div><form className="inline-form" onSubmit={e => { e.preventDefault(); confirm({ title: "Save exchange rate?", detail: `1 ${rateCurrency} = PHP ${rate}. Existing entries keep their original conversion.`, confirmLabel: "Save rate", onConfirm: async () => { if (await save({ action: "rate_save", currency: rateCurrency, rate })) setRate(""); } }); }}><label>Currency<select value={rateCurrency} onChange={e => setRateCurrency(e.target.value)}>{["USD", "EUR", "JPY", "SGD", "AUD"].map(code => <option key={code}>{code}</option>)}</select></label><label>PHP for 1 unit<input type="number" required min="0.0001" max="100000" step="any" value={rate} onChange={e => setRate(e.target.value)} placeholder={String(data.exchangeRates[rateCurrency as keyof Planner["exchangeRates"]] || "")}/></label><button className="outline-button">Save rate</button></form><p className="section-description">Saved rates: {Object.entries(data.exchangeRates).length ? Object.entries(data.exchangeRates).map(([code, value]) => `1 ${code} = PHP ${value}`).join(" · ") : "None yet"}</p></section>
    <section className="settings-section"><h2><ShieldCheck size={20}/> Privacy first</h2><p>Finance records sync to your Supabase account. Offline copies are optional and device-local. No bank linking or third-party analytics. This app is not financial advice.</p><p>All reports and budgets use PHP. Foreign-currency entry uses your saved manual rate.</p></section><p role="status">{message}</p><BackupPanel onRestored={reload}/></div>;
}
