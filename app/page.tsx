"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, BarChart3, CalendarDays, Check, ChevronLeft, ChevronRight, CircleDollarSign, Clock3, Download, FileImage, FileText, LayoutDashboard, List, MessageSquare, MoreHorizontal, Pencil, Plus, Receipt, Target, Trash2, Users, Wallet, LogOut } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { addDays, Bill, currentWeekStart, dayLabel, Entry, Goal, GroupSplit, money, monthLabel, todayInManila, weekDays, weekLabel } from "./finance-utils";
import { Dashboard } from "./dashboard";
import { QuoteOfTheDay } from "./quote";
import { Feedback } from "./feedback";
import { About } from "./about";
import { BackupPanel } from "./backup-panel";
import { Settings } from "./settings";
import { CsvPanel } from "./csv-panel";
import { emptyPlanner, type Planner } from "./planner-model";
import { categories as baseCategories } from "./planner-model";
import { preference, setPreference } from "./device-settings";
import { Sparkles, UserRoundPlus, Settings2, Repeat2, CreditCard } from "lucide-react";
import { SplitBills } from "./split-bills";
import { LegalDialog, LegalTopic } from "./legal";
import { Onboarding } from "./onboarding";
import { Circles, CirclesComingSoon, friendsComingSoon } from "./circles";
import { codePattern } from "./circles-client";
import { loadFinance, saveFinance } from "./finance-client";

type View = "overview" | "activity" | "collect" | "splits" | "goals" | "circles" | "reports" | "feedback" | "settings";
type EntryKind = "expense" | "loan";
type ReportPeriod = "week" | "month" | "year";
type ConfirmTarget = { title: string; detail: string; confirmLabel: string; tone?: "danger" | "default"; onConfirm: () => unknown | Promise<unknown> };
const navigation: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "activity", label: "Activity", icon: List },
  { id: "collect", label: "To collect", icon: Users },
  { id: "splits", label: "Split bills", icon: CircleDollarSign },
  { id: "goals", label: "Goals", icon: Target },
  { id: "circles", label: "Friends", icon: UserRoundPlus },
  { id: "reports", label: "Reports", icon: FileText },
  { id: "feedback", label: "Feedback", icon: MessageSquare },
  { id: "settings", label: "Settings", icon: Settings2 },
];
const mobileViews: View[] = ["overview", "settings", "collect", "splits"];
const pageCopy: Record<View, { title: string; detail: string }> = {
  feedback: { title: "Share your feedback.", detail: "Help us make EvenFold better for you." },
  settings: { title: "Make it yours.", detail: "Account, privacy, and backups." },
  overview: { title: "Your money, at a glance.", detail: "A simpler way to stay on top of your week." },
  activity: { title: "All activity.", detail: "Every purchase and loan for the week." },
  collect: { title: "Money to collect.", detail: "Outstanding loans and group shares across all your weeks." },
  splits: { title: "Split bills together.", detail: "Share a bill evenly and keep track of who has paid." },
  circles: { title: "Friends and circles.", detail: "Share a simple status and cheer each other on, by invite code or link." },
  goals: { title: "Goals in progress.", detail: "Keep savings targets within reach." },
  reports: { title: "Your reports.", detail: "Export a weekly or monthly record." },
};
const sum = (entries: Entry[]) => entries.reduce((total, item) => total + item.amountCents, 0);
const greeting = () => {
  const hour = new Date().toLocaleString("en-US", { timeZone: "Asia/Manila", hour: "numeric", hour12: false });
  const value = Number(hour);
  if (value < 12) return "Good morning";
  if (value < 18) return "Good afternoon";
  return "Good evening";
};

function Entries({ entries, onDelete, onEdit, onAdd }: { entries: Entry[]; onDelete: (entry: Entry) => void; onEdit: (entry: Entry) => void; onAdd?: () => void }) {
  const [page, setPage] = useState(0);
  const gesture = useRef<{ x: number; y: number } | null>(null);
  const current = Math.min(page, Math.max(0, Math.ceil(entries.length / 25) - 1));
  if (!entries.length) return <div className="empty-state"><span className="empty-icon"><Wallet size={23}/></span><strong>No entries here yet</strong><p>Add a purchase or money lent to get started.</p>{onAdd && <button type="button" className="primary-button" onClick={onAdd}><Plus size={17}/> Add your first entry</button>}</div>;
  return <div className="transaction-list">{entries.slice(current * 25, (current + 1) * 25).map(entry => {
    const isLoan = entry.kind === "loan";
    return <div className="transaction" key={entry.id} onTouchStart={event => { gesture.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }; }} onTouchEnd={event => { if (!gesture.current) return; const dx = event.changedTouches[0].clientX - gesture.current.x, dy = event.changedTouches[0].clientY - gesture.current.y; gesture.current = null; if (Math.abs(dx) > 85 && Math.abs(dx) > Math.abs(dy) * 1.5) { if (dx > 0) onEdit(entry); else onDelete(entry); } }}>
      <span className={`transaction-symbol ${isLoan ? "lent" : ""}`}>{isLoan ? <ArrowDownLeft size={19}/> : <ArrowUpRight size={19}/>}</span>
      <div className="transaction-name"><strong>{entry.description}</strong><span>{entry.source ? `${entry.source.currency} ${(entry.source.amountCents/100).toFixed(2)} · ` : ""}{dayLabel(entry.date)} · {isLoan ? `${entry.borrower}${entry.settled ? " · Repaid" : " · Money lent"}` : entry.category}</span></div>
      <div className="transaction-value"><b>{money(entry.amountCents)}</b><small>{isLoan ? entry.settled ? "REPAID" : "TO COLLECT" : "SPENT"}</small></div>
      <button className="delete-button" type="button" aria-label={`Edit ${entry.description}`} onClick={() => onEdit(entry)}><Pencil size={16}/></button>
      <button className="delete-button" type="button" aria-label={`Delete ${entry.description}`} onClick={() => onDelete(entry)}><Trash2 size={16}/></button>
    </div>;
  })}{entries.length > 25 && <div className="pagination"><button className="icon-control" aria-label="Previous transactions" disabled={!current} onClick={() => setPage(current - 1)}><ChevronLeft size={18}/></button><span>{current + 1} / {Math.ceil(entries.length / 25)}</span><button className="icon-control" aria-label="Next transactions" disabled={(current + 1) * 25 >= entries.length} onClick={() => setPage(current + 1)}><ChevronRight size={18}/></button></div>}</div>;
}

export default function Home({ accountName = "there", accountEmail, onAccount, onSignOut }: { accountName?: string; accountEmail?: string; onAccount?: () => void; onSignOut?: () => void }) {
  const [planner, setPlanner] = useState<Planner>(emptyPlanner);
  const [weeklyBudgets, setWeeklyBudgets] = useState<Record<string, number>>({});
  const [weekStart, setWeekStart] = useState(currentWeekStart);
  const [currentWeek, setCurrentWeek] = useState(currentWeekStart);
  const [inviteCode] = useState(() => { const match = /^#join=([A-Za-z0-9]{8})$/.exec(window.location.hash); const found = match?.[1].toUpperCase() ?? ""; return codePattern.test(found) ? found : ""; });
  const [view, setView] = useState<View>(inviteCode ? "circles" : "overview");
  const [search, setSearch] = useState("");
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update(); window.addEventListener("online", update); window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [history, setHistory] = useState<Entry[]>([]);
  const [allLoans, setAllLoans] = useState<Entry[]>([]);
  const [groupSplits, setGroupSplits] = useState<GroupSplit[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [monthStart, setMonthStart] = useState(weekStart.slice(0, 7) + "-01");
  const [budgetCents, setBudgetCents] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [legalTopic, setLegalTopic] = useState<LegalTopic>(null);
  const [tourOpen, setTourOpen] = useState(false);
  const [entryOpen, setEntryOpen] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [billOpen, setBillOpen] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);
  const [adjustGoal, setAdjustGoal] = useState<Goal | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [kind, setKind] = useState<EntryKind>("expense");
  const [date, setDate] = useState(currentWeekStart);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("PHP");
  const [category, setCategory] = useState("Food");
  const [borrower, setBorrower] = useState("");
  const [budgetInput, setBudgetInput] = useState("");
  const [billName, setBillName] = useState("");
  const [billAmount, setBillAmount] = useState("");
  const [billDate, setBillDate] = useState(todayInManila);
  const [goalName, setGoalName] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustMode, setAdjustMode] = useState<"add" | "withdraw">("add");
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>("week");
  const [reportBusy, setReportBusy] = useState<"pdf" | "jpg" | null>(null);
  const [reportLink, setReportLink] = useState<{ url: string; filename: string } | null>(null);
  const requestVersion = useRef(0);
  const days = useMemo(() => weekDays(weekStart), [weekStart]);
  const today = todayInManila();
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k" && !document.querySelector('[role="dialog"], [role="alertdialog"]')) {
        event.preventDefault(); openEntry("expense");
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [weekStart]);

  useEffect(() => {
    const timer = setInterval(() => {
      const fresh = currentWeekStart();
      setCurrentWeek(previous => {
        if (previous !== fresh) setWeekStart(selected => selected === previous ? fresh : selected);
        return fresh;
      });
    }, 60000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => { if (!editingEntry && !entryOpen) setDate(days.includes(todayInManila()) ? todayInManila() : days[0]); }, [days, editingEntry, entryOpen]);
  useEffect(() => { if (!localStorage.getItem("evenfold-tour-v1")) setTourOpen(true); }, []);
  const closeTour = useCallback(() => { setTourOpen(false); localStorage.setItem("evenfold-tour-v1", "seen"); }, []);
  useEffect(() => () => { if (reportLink) URL.revokeObjectURL(reportLink.url); }, [reportLink]);
  useEffect(() => { setReportLink(null); }, [weekStart, reportPeriod]);

  const load = useCallback(async () => {
    const request = ++requestVersion.current;
    setLoading(true);
    try {
      const data = await loadFinance(weekStart);
      if (request !== requestVersion.current) return;
      setEntries(data.entries || []); setHistory(data.history || []); setAllLoans(data.allLoans || []);
      setPlanner(data.planner || emptyPlanner());
      setWeeklyBudgets(data.weeklyBudgets || {});
      setBills(data.bills || []); setGoals(data.goals || []); setGroupSplits(data.groupSplits || []);
      setBudgetCents(data.budgetCents ?? null); setMonthStart(data.monthStart || `${weekStart.slice(0, 7)}-01`); setError("");
    } catch (cause) {
      if (request === requestVersion.current) setError(cause instanceof Error ? cause.message : "Could not load your data.");
    } finally { if (request === requestVersion.current) setLoading(false); }
  }, [weekStart]);
  useEffect(() => { void load(); }, [load]);
  async function save(payload: Record<string, unknown>) {
    if (!navigator.onLine) { setError("You are offline. Reconnect before saving; changes are not queued."); return false; }
    setSaving(true); setError("");
    try {
      await saveFinance(payload);
      await load(); setNotice("Saved"); return true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save."); return false; }
    finally { setSaving(false); }
  }
  useEffect(() => {
    const context = (document as Document & { modelContext?: { registerTool: (tool: object, options: { signal: AbortSignal }) => void | Promise<void> } }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: "add_finance_entry", title: "Add finance entry", description: "Save an expense or money lent in a Tuesday–Saturday week.",
      inputSchema: { type: "object", properties: { weekStart: { type: "string" }, date: { type: "string" }, kind: { type: "string", enum: ["expense", "loan"] }, description: { type: "string" }, amount: { type: "number" }, category: { type: "string" }, borrower: { type: "string" } }, required: ["weekStart", "date", "kind", "description", "amount"], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute(input: unknown) {
        await saveFinance({ action: "add", category: "Other", ...(input as object) });
        await load(); return { saved: true };
      },
    }, { signal: lifecycle.signal })).catch(() => {});
    return () => lifecycle.abort();
  }, [load]);

  const expenses = entries.filter(e => e.kind === "expense");
  const weeklyLoans = entries.filter(e => e.kind === "loan");
  const spent = sum(expenses);
  const groupToCollect = groupSplits.filter(split => split.payer === "You").flatMap(split => split.shares.filter(share => share.name !== "You" && !share.paid).map(share => ({ split, share })));
  const outstanding = sum(allLoans.filter(e => !e.settled)) + groupToCollect.reduce((total, item) => total + item.share.amountCents, 0);
  const unpaidBills = bills.filter(b => !b.paid);
  const upcomingBills = unpaidBills.filter(b => b.dueDate >= today).slice(0, 3);
  const overdueBills = unpaidBills.filter(b => b.dueDate < today);
  const borrowerTotals = useMemo(() => {
    const map = new Map<string, { total: number; entries: Entry[] }>();
    allLoans.forEach(e => { const name = e.borrower || "Unknown"; const item = map.get(name) || { total: 0, entries: [] }; item.entries.push(e); if (!e.settled) item.total += e.amountCents; map.set(name, item); });
    return [...map].sort((a, b) => b[1].total - a[1].total);
  }, [allLoans]);
  const daily = days.map(d => ({ date: d, spent: sum(expenses.filter(e => e.date === d)) }));
  const maxDaily = Math.max(...daily.map(d => d.spent), 1);
  const prevWeekSpent = sum(history.filter(e => e.kind === "expense" && e.date >= addDays(weekStart, -7) && e.date < weekStart));
  const categories = Object.entries(expenses.reduce<Record<string, number>>((acc, e) => { acc[e.category] = (acc[e.category] || 0) + e.amountCents; return acc; }, {})).sort((a, b) => b[1] - a[1]);
  const monthly = history.filter(e => e.date.startsWith(monthStart.slice(0, 7)));
  const monthSpent = sum(monthly.filter(e => e.kind === "expense"));
  const previousMonthDate = new Date(`${monthStart}T12:00:00Z`); previousMonthDate.setUTCMonth(previousMonthDate.getUTCMonth() - 1);
  const previousMonth = previousMonthDate.toISOString().slice(0, 7);
  const previousSpent = sum(history.filter(e => e.kind === "expense" && e.date.startsWith(previousMonth)));
  const monthCategories = Object.entries(monthly.filter(e => e.kind === "expense").reduce<Record<string, number>>((acc, e) => { acc[e.category] = (acc[e.category] || 0) + e.amountCents; return acc; }, {})).sort((a, b) => b[1] - a[1]);
  const trend = Array.from({ length: 6 }, (_, index) => { const d = new Date(`${monthStart}T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() - 5 + index); const key = d.toISOString().slice(0, 7); return { key, label: dayLabel(`${key}-01`, { month: "short" }), spent: sum(history.filter(e => e.kind === "expense" && e.date.startsWith(key))) }; });
  const maxTrend = Math.max(...trend.map(item => item.spent), 1);
  const reportEntries = reportPeriod === "week" ? entries : reportPeriod === "year" ? history.filter(e => e.date.startsWith(monthStart.slice(0, 4))) : monthly;
  const reportName = reportPeriod === "week" ? weekLabel(weekStart) : reportPeriod === "year" ? monthStart.slice(0, 4) : monthLabel(monthStart);

  function openEntry(type: EntryKind) { setEditingEntry(null); setKind(type); setDate(days.includes(todayInManila()) ? todayInManila() : days[0]); setDescription(""); setAmount(""); setCurrency("PHP"); setBorrower(""); setCategory("Food"); setEntryOpen(true); }
  function editEntry(entry: Entry) { const nextKind: EntryKind = entry.kind === "loan" ? "loan" : "expense"; setEditingEntry(entry); setKind(nextKind); setDate(entry.date); setDescription(entry.description); setAmount(String((entry.source?.amountCents ?? entry.amountCents) / 100)); setCurrency(entry.source?.currency || "PHP"); setBorrower(entry.borrower || ""); setCategory(nextKind === "loan" ? "Food" : entry.category || "Food"); setEntryOpen(true); }
  async function exportFile(format: "pdf" | "jpg") {
    setReportBusy(format); setError("");
    try { const { downloadReport } = await import("./report"); const result = await downloadReport({ period: reportPeriod, weekStart, monthStart, entries: reportEntries, allLoans, groupSplits, budgetCents, bills, goals }, format); setReportLink(result); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not generate report."); }
    finally { setReportBusy(null); }
  }
  const go = (next: View) => { setView(next); window.scrollTo({ top: 0 }); };
  const startTour = () => { setView("overview"); window.scrollTo({ top: 0, behavior: "smooth" }); window.setTimeout(() => setTourOpen(true), 180); };
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(""), 2600); return () => clearTimeout(timer); }, [notice]);
  // Routine, reversible saves run straight away (the user already pressed a submit button); only deletes, sign-out and report generation ask again.
  function confirmChange(target: ConfirmTarget) {
    if (target.tone !== "danger" && /^(Save|Add|Create)\b/.test(target.title)) { void target.onConfirm(); return; }
    setConfirmTarget(target);
  }
  function confirmDelete(label: string, action: "delete" | "delete_bill" | "delete_goal" | "delete_split", id: string) {
    const noun = action === "delete_bill" ? "bill" : action === "delete_goal" ? "goal" : action === "delete_split" ? "group split" : "entry";
    confirmChange({
      title: `Delete this ${noun}?`,
      detail: `${label} will be removed. This cannot be undone.`,
      confirmLabel: "Delete",
      tone: "danger",
      onConfirm: () => save({ action, id }),
    });
  }
  function confirmStatus(title: string, detail: string, confirmLabel: string, payload: Record<string, unknown>) {
    confirmChange({ title, detail, confirmLabel, onConfirm: () => save(payload) });
  }
  function confirmReport(format: "pdf" | "jpg") {
    confirmChange({
      title: `Generate ${format.toUpperCase()} report?`,
      detail: `This will create a downloadable ${reportPeriod} report for ${reportName}.`,
      confirmLabel: `Generate ${format.toUpperCase()}`,
      onConfirm: () => exportFile(format),
    });
  }

  return <Tabs value={view} onValueChange={value => go(value as View)} className="app-shell">
    <aside className="sidebar"><div className="app-brand"><img className="logo-img" src={`${import.meta.env.BASE_URL}app-icon.svg`} alt="" width={40} height={40}/><span><b>EvenFold</b><small>FINANCE</small></span></div><p className="nav-caption">YOUR SPACE</p><TabsList className="side-nav" aria-label="Main navigation">{navigation.map(({ id, label, icon: Icon }) => <TabsTrigger key={id} value={id}><Icon size={19}/><span>{label}</span></TabsTrigger>)}</TabsList><div className="sidebar-bottom"><QuoteOfTheDay/></div></aside>
    <div className="app-main"><header className="app-top"><div className="mobile-brand"><img className="logo-img" src={`${import.meta.env.BASE_URL}app-icon.svg`} alt="" width={36} height={36}/><span><b>EvenFold</b><small>FINANCE</small></span></div><div className="app-top-left"><span className="top-context">EVENFOLD FINANCE</span><span className="top-divider"/><span className="top-status">{greeting()}, {accountName}</span></div><div className="app-top-actions"><button type="button" onClick={() => go("settings")} className="avatar" title="Open settings" aria-label={accountEmail ? `Signed in as ${accountEmail}` : "Private account"}>{accountName.slice(0, 1).toUpperCase()}</button><button type="button" className="top-logout" title="Sign out" aria-label="Sign out" disabled={!onSignOut} onClick={() => confirmChange({ title: "Sign out?", detail: "Your cloud records stay saved. The offline copy for this account will be removed from this browser.", confirmLabel: "Sign out", onConfirm: () => onSignOut?.() })}><LogOut size={18}/></button></div></header>
      <a className="skip-link" href="#main-content">Skip to content</a><main id="main-content" className="content" tabIndex={-1}><div className="page-heading"><div><h1>{pageCopy[view].title}</h1><p className="heading-copy">{pageCopy[view].detail}</p></div><button type="button" className="outline-button heading-friends" onClick={() => go("circles")}><UserRoundPlus size={18}/> Friends</button><button className="primary-button heading-add" onClick={() => openEntry("expense")}><Plus size={18}/> Add entry</button></div>
        {(["overview", "activity", "insights", "reports"] as View[]).includes(view) && <div className="week-toolbar"><div className="week-label"><CalendarDays size={20}/><div><small>SELECTED WEEK · TUESDAY–SATURDAY</small><strong>{weekLabel(weekStart)}</strong></div></div><div className="week-controls"><button aria-label="Previous week" onClick={() => setWeekStart(w => addDays(w, -7))}><ChevronLeft size={20}/></button>{weekStart !== currentWeek && <button className="today-button" onClick={() => setWeekStart(currentWeek)}>This week</button>}<button aria-label="Next week" onClick={() => setWeekStart(w => addDays(w, 7))}><ChevronRight size={20}/></button></div></div>}
        {offline && <p className="offline-notice" role="status">You are offline. Displayed records may be out of date. Reconnect to save changes or create a cloud backup.</p>}
        {error && <div className="error-banner" role="alert">{error}<button onClick={() => void load()}>Retry</button></div>}
        <TabsContent value="overview" className="view-content wallet-overview">
          <QuoteOfTheDay className="quote-mobile"/>
          <Dashboard loading={loading} spent={spent} prevSpent={prevWeekSpent} customCategories={planner.customCategories} daily={daily} today={todayInManila()} outstanding={outstanding} budgetCents={budgetCents} goals={goals} categories={categories} recent={entries} loans={allLoans} groupToCollect={groupToCollect} go={go} onExport={() => go("reports")} onAddExpense={() => openEntry("expense")} onAddLoan={() => openEntry("loan")} onAddGoal={() => setGoalOpen(true)} onBudget={() => { setBudgetInput(budgetCents === null ? "" : String(budgetCents / 100)); setBudgetOpen(true); }}/>
          <About/></TabsContent>
        <TabsContent value="activity" className="view-content"><div className="activity-actions"><span>{entries.length} entries in this week</span><div><button className="outline-button" onClick={() => openEntry("loan")}><ArrowDownLeft size={17}/> Money lent</button><button className="primary-button" onClick={() => openEntry("expense")}><Plus size={17}/> Expense</button></div></div><label className="activity-search">Search this week<input type="search" placeholder="Merchant, category, or borrower" value={search} onChange={event => setSearch(event.target.value)} /></label><section className="surface activity-surface">{days.map(day => { const found = entries.filter(e => e.date === day && `${e.description} ${e.category} ${e.borrower || ""}`.toLowerCase().includes(search.trim().toLowerCase())); return <div key={day} className="day-group"><div className="day-heading"><h2>{dayLabel(day, { weekday: "long", month: "long", day: "numeric" })}</h2><span>{money(sum(found.filter(e => e.kind === "expense")))} spent</span></div>{found.length ? <Entries entries={found} onEdit={editEntry} onDelete={entry => confirmDelete(entry.description, "delete", entry.id)}/> : <p className="quiet-row">No activity recorded.</p>}</div>; })}</section></TabsContent>
        <TabsContent value="collect" className="view-content"><div className="collect-banner"><div className="collect-symbol"><ArrowDownLeft size={25}/></div><div><span>OUTSTANDING ACROSS ALL WEEKS</span><strong>{money(outstanding)}</strong><p>Loans and group shares stay here until you mark them settled.</p></div><button className="light-button" onClick={() => openEntry("loan")}><Plus size={17}/> Add money lent</button></div>{borrowerTotals.length ? <div className="borrower-grid">{borrowerTotals.map(([name, data]) => <section className="surface borrower-card" key={name}><div className="borrower-head"><span className="borrower-avatar">{name.slice(0, 1).toUpperCase()}</span><div><h2>{name}</h2><small>{data.entries.length} {data.entries.length === 1 ? "entry" : "entries"}</small></div><strong>{money(data.total)}</strong></div><div className="borrower-lines">{data.entries.map(e => <div className="borrower-line" key={e.id}><div><b>{e.description}</b><small>{dayLabel(e.date)} · {e.settled ? "Repaid" : "Outstanding"}</small></div><div><strong>{money(e.amountCents)}</strong><button disabled={saving} onClick={() => editEntry(e)}>Edit</button><button disabled={saving} onClick={() => confirmStatus(e.settled ? "Mark this loan unpaid?" : "Mark this loan repaid?", `${e.description} for ${money(e.amountCents)} will be updated.`, e.settled ? "Mark unpaid" : "Mark repaid", { action: "settle", id: e.id })}>{e.settled ? "Mark unpaid" : "Mark repaid"}</button></div></div>)}</div></section>)}</div> : !groupToCollect.length ? <section className="surface"><div className="empty-state"><span className="empty-icon"><Users size={22}/></span><strong>No loans recorded</strong><p>Add a borrower whenever you lend money.</p><button className="primary-button" onClick={() => openEntry("loan")}>Add money lent</button></div></section> : null}{groupToCollect.length > 0 && <section className="surface group-collect"><div className="surface-heading"><div><p className="mini-label">GROUP BILLS</p><h2>Shares to collect</h2></div><button className="link-button" onClick={() => go("splits")}>See splits</button></div>{groupToCollect.map(({ split, share }) => <div className="preview-row" key={share.id}><div><strong>{share.name}</strong><small>{split.title} · {dayLabel(split.date)}</small></div><b>{money(share.amountCents)}</b></div>)}</section>}</TabsContent>
        <TabsContent value="splits" className="view-content"><SplitBills splits={groupSplits} saving={saving} loading={loading} error={error} onSave={save} onConfirm={confirmChange}/></TabsContent>
        <TabsContent value="goals" className="view-content"><div className="section-toolbar"><div><span className="section-kicker">SAVINGS GOALS</span><p>{goals.length} {goals.length === 1 ? "goal" : "goals"} · {money(goals.reduce((total, goal) => total + goal.savedCents, 0))} saved</p></div><button className="primary-button" onClick={() => { setGoalName(""); setGoalTarget(""); setGoalOpen(true); }}><Plus size={17}/> New goal</button></div><div className="disclosure">Goal contributions are tracked separately from spending.</div>{goals.length ? <div className="goal-grid">{goals.map(goal => { const progress = Math.min(100, Math.round(goal.savedCents / goal.targetCents * 100)); return <section className="surface goal-card" key={goal.id}><div className="goal-card-head"><span className="goal-icon"><Target size={20}/></span><button aria-label={`Delete ${goal.name}`} className="delete-button" onClick={() => confirmDelete(goal.name, "delete_goal", goal.id)}><Trash2 size={16}/></button></div><h2>{goal.name}</h2><strong>{money(goal.savedCents)}</strong><p>of {money(goal.targetCents)} target</p><div className="goal-progress-label"><span>Progress</span><b>{progress}%</b></div><div className="goal-track"><i style={{ width: `${progress}%` }}/></div><div className="goal-actions"><button className="primary-button" onClick={() => { setAdjustGoal(goal); setAdjustMode("add"); setAdjustAmount(""); }}>Add savings</button><button className="outline-button" onClick={() => { setAdjustGoal(goal); setAdjustMode("withdraw"); setAdjustAmount(""); }}>Withdraw</button></div></section>; })}</div> : <section className="surface"><div className="empty-state"><span className="empty-icon"><Target size={22}/></span><strong>No savings goals yet</strong><p>Set a target and track your progress.</p><button className="primary-button" onClick={() => setGoalOpen(true)}>Create goal</button></div></section>}</TabsContent>
        <TabsContent value="circles" className="view-content">{friendsComingSoon ? <CirclesComingSoon/> : <Circles userId={window.EVENFOLD_USER} displayName={accountName === "there" ? "" : accountName} inviteCode={inviteCode} active={view === "circles"} onConfirm={confirmChange} onNotice={setNotice} mine={{ budgetPct: budgetCents ? Math.round(spent / budgetCents * 100) : null, goal: goals[0] && goals[0].targetCents ? { name: goals[0].name, pct: Math.min(100, Math.round(goals[0].savedCents / goals[0].targetCents * 100)) } : null, daysLogged: new Set(expenses.map(e => e.date)).size }}/>}</TabsContent>
        <TabsContent value="reports" className="view-content"><section className="report-card"><div className="report-visual"><div className="paper"><span className="paper-brand">EVENFOLD / FINANCE</span><div className="paper-line big"/><div className="paper-line"/><div className="paper-boxes"><i/><i/><i/></div><div className="paper-line"/><div className="paper-line short"/><div className="paper-line"/></div></div><div className="report-info"><p className="mini-label">WEEKLY OR MONTHLY</p><h2>Take your numbers with you.</h2><p>Choose a period and download a report with spending, category totals, transactions, outstanding loans and group shares, bills, and goals.</p><div className="kind-switch report-switch"><button className={reportPeriod === "week" ? "active" : ""} onClick={() => setReportPeriod("week")}>Selected week</button><button className={reportPeriod === "month" ? "active" : ""} onClick={() => setReportPeriod("month")}>Selected month</button><button className={reportPeriod === "year" ? "active" : ""} onClick={() => setReportPeriod("year")}>Selected year</button></div><div className="report-selection"><strong>{reportName}</strong><span>{reportEntries.length} entries · {money(sum(reportEntries.filter(e => e.kind === "expense")))} spent</span></div><div className="report-buttons"><button className="primary-button" disabled={loading || !!reportBusy} onClick={() => confirmReport("pdf")}><FileText size={18}/>{reportBusy === "pdf" ? "Creating PDF…" : "Generate PDF"}</button><button className="outline-button" disabled={loading || !!reportBusy} onClick={() => confirmReport("jpg")}><FileImage size={18}/>{reportBusy === "jpg" ? "Creating JPG…" : "Generate JPG"}</button></div><small className="report-note"><Download size={14}/> Generated in your browser. Use the ready link to save it.</small>{reportLink && <a className="report-ready" href={reportLink.url} download={reportLink.filename}>Report ready: download {reportLink.filename} <ArrowRight size={15}/></a>}</div></section><CsvPanel entries={history} save={save}/><BackupPanel onRestored={load}/></TabsContent>
        <TabsContent value="feedback" className="view-content"><Feedback/></TabsContent>
        <TabsContent value="settings" className="view-content"><Settings reload={load} data={planner} save={save} confirm={confirmChange} onAccount={onAccount} onSignOut={() => confirmChange({ title: "Sign out?", detail: "Your cloud records stay saved. The offline copy for this account will be removed from this browser.", confirmLabel: "Sign out", onConfirm: () => onSignOut?.() })}/></TabsContent>
        <footer className="app-footer"><span>© 2026 <strong>EvenFold Finance</strong> · Developed by Victor Tarra</span><div><button type="button" onClick={startTour}>How to use</button><button type="button" onClick={() => go("feedback")}>Send feedback</button><button type="button" onClick={() => setLegalTopic("privacy")}>Privacy · RA 10173</button><button type="button" onClick={() => setLegalTopic("terms")}>Terms &amp; conditions</button></div></footer>
      </main></div>
    <nav className="bottom-nav" aria-label="Main navigation">{mobileViews.map((id, index) => { const item = navigation.find(link => link.id === id)!; const Icon = item.icon; return <div className="bottom-nav-slot" key={id}>{index === 2 && <button type="button" className="nav-add" aria-label="Add entry" onClick={() => openEntry("expense")}><span><img src={`${import.meta.env.BASE_URL}app-icon.svg`} alt="" width={48} height={48}/></span><small>Add</small></button>}<button type="button" className={view === id ? "active" : ""} aria-current={view === id ? "page" : undefined} onClick={() => go(id)}><Icon size={21}/><span>{id === "overview" ? "Home" : item.label}</span></button></div>; })}</nav>
    {notice && <div className="save-status" role="status" aria-live="polite"><Check size={16}/> {notice}</div>}
    <Onboarding open={tourOpen} onClose={closeTour}/><LegalDialog topic={legalTopic} onClose={() => setLegalTopic(null)}/>
    <Dialog open={entryOpen} onOpenChange={open => { setEntryOpen(open); if (!open) setEditingEntry(null); }}><DialogContent className="entry-dialog"><DialogHeader><DialogTitle>{editingEntry ? "Edit entry" : "Add an entry"}</DialogTitle><DialogDescription>{editingEntry ? "Update this expense or lent-money record." : `Record a purchase or money lent for ${weekLabel(weekStart)}.`}</DialogDescription></DialogHeader><div className="kind-switch"><button className={kind === "expense" ? "active" : ""} onClick={() => { setKind("expense"); setCategory(category === "Lent money" ? "Food" : category); }} type="button"><ArrowUpRight size={17}/> Expense</button><button className={kind === "loan" ? "active" : ""} onClick={() => setKind("loan")} type="button"><ArrowDownLeft size={17}/> Lent</button></div><form className="form-grid" onSubmit={event => { event.preventDefault(); const action = editingEntry ? "edit" : "add"; confirmChange({ title: editingEntry ? "Save changes?" : "Save entry?", detail: `${description}: ${currency === "PHP" ? money(Math.round(Number(amount) * 100)) : `${currency} ${amount} at PHP ${planner.exchangeRates[currency as keyof Planner["exchangeRates"]] || "rate not set"} per unit`}.`, confirmLabel: editingEntry ? "Save changes" : "Save entry", onConfirm: async () => { if (await save({ action, id: editingEntry?.id, weekStart, date, kind, description, amount, currency, category, borrower })) { setEntryOpen(false); setEditingEntry(null); setDescription(""); setAmount(""); setBorrower(""); } } }); }}><label>Date{editingEntry ? <input required type="date" value={date} onChange={event => setDate(event.target.value)}/> : <select value={date} onChange={event => setDate(event.target.value)}>{days.map(day => <option key={day} value={day}>{dayLabel(day, { weekday: "long", month: "short", day: "numeric" })}</option>)}</select>}</label><label>{kind === "loan" ? "What was it for?" : "Merchant or item"}<input required maxLength={100} placeholder={kind === "loan" ? "e.g. Lunch with friends" : "e.g. Coffee"} value={description} onChange={event => setDescription(event.target.value)}/></label><label>Currency<select value={currency} onChange={event => setCurrency(event.target.value)}><option value="PHP">PHP</option>{(["USD","EUR","JPY","SGD","AUD"] as const).map(code => <option key={code} value={code} disabled={!planner.exchangeRates[code]}>{code}{!planner.exchangeRates[code] ? " · set rate in Settings" : ""}</option>)}</select></label><label>Amount ({currency})<input required type="number" min="0.01" max="10000000" step="0.01" placeholder="0.00" value={amount} onChange={event => setAmount(event.target.value)}/></label>{kind === "loan" ? <label>Who owes you?<input required maxLength={100} placeholder="Enter their name" value={borrower} onChange={event => setBorrower(event.target.value)}/></label> : <label>Category<select value={category} onChange={event => setCategory(event.target.value)}>{[...new Set([...baseCategories, ...planner.customCategories, category])].map(option => <option key={option}>{option}</option>)}</select></label>}{error && <p className="form-error">{error}</p>}<button className="primary-button submit-button" disabled={saving}>{saving ? "Saving…" : editingEntry ? "Save changes" : "Save entry"}<ArrowRight size={17}/></button></form></DialogContent></Dialog>
    <Dialog open={budgetOpen} onOpenChange={setBudgetOpen}><DialogContent className="budget-dialog"><DialogHeader><DialogTitle>Weekly budget</DialogTitle><DialogDescription>Set a spending limit for {weekLabel(weekStart)}. Each week has its own budget.</DialogDescription></DialogHeader><form className="form-grid" onSubmit={event => { event.preventDefault(); confirmChange({ title: "Save weekly budget?", detail: `${weekLabel(weekStart)}: ${money(Math.round(Number(budgetInput) * 100))}.`, confirmLabel: "Save budget", onConfirm: async () => { if (await save({ action: "budget", weekStart, amount: budgetInput })) setBudgetOpen(false); } }); }}><label>Budget (₱)<input autoFocus required type="number" min="0" max="10000000" step="0.01" placeholder="0.00" value={budgetInput} onChange={event => setBudgetInput(event.target.value)}/></label>{error && <p className="form-error">{error}</p>}<button className="primary-button submit-button" disabled={saving}>{saving ? "Saving…" : "Save budget"}<Check size={17}/></button></form></DialogContent></Dialog>
    <Dialog open={goalOpen} onOpenChange={setGoalOpen}><DialogContent className="budget-dialog"><DialogHeader><DialogTitle>New savings goal</DialogTitle><DialogDescription>Choose a name and a target amount.</DialogDescription></DialogHeader><form className="form-grid" onSubmit={event => { event.preventDefault(); confirmChange({ title: "Create savings goal?", detail: `${goalName}: ${money(Math.round(Number(goalTarget) * 100))}.`, confirmLabel: "Create goal", onConfirm: async () => { if (await save({ action: "add_goal", name: goalName, target: goalTarget })) { setGoalOpen(false); setGoalName(""); setGoalTarget(""); } } }); }}><label>Goal name<input autoFocus required maxLength={100} placeholder="e.g. Emergency fund" value={goalName} onChange={event => setGoalName(event.target.value)}/></label><label>Target (₱)<input required type="number" min="0.01" max="10000000" step="0.01" placeholder="0.00" value={goalTarget} onChange={event => setGoalTarget(event.target.value)}/></label>{error && <p className="form-error">{error}</p>}<button className="primary-button submit-button" disabled={saving}>{saving ? "Saving…" : "Create goal"}<Target size={17}/></button></form></DialogContent></Dialog>
    <Dialog open={!!adjustGoal} onOpenChange={open => { if (!open) setAdjustGoal(null); }}><DialogContent className="budget-dialog"><DialogHeader><DialogTitle>{adjustMode === "add" ? "Add to" : "Withdraw from"} {adjustGoal?.name}</DialogTitle><DialogDescription>Currently saved: {money(adjustGoal?.savedCents || 0)}. Savings are tracked separately from spending.</DialogDescription></DialogHeader><form className="form-grid" onSubmit={event => { event.preventDefault(); if (!adjustGoal) return; confirmChange({ title: adjustMode === "add" ? "Add savings?" : "Withdraw savings?", detail: `${money(Math.round(Number(adjustAmount || 0) * 100))} will be ${adjustMode === "add" ? "added to" : "withdrawn from"} ${adjustGoal.name}.`, confirmLabel: adjustMode === "add" ? "Add savings" : "Withdraw", onConfirm: async () => { if (await save({ action: "adjust_goal", id: adjustGoal.id, mode: adjustMode, amount: adjustAmount })) { setAdjustGoal(null); setAdjustAmount(""); } } }); }}><label>Amount (₱)<input autoFocus required type="number" min="0.01" max="10000000" step="0.01" placeholder="0.00" value={adjustAmount} onChange={event => setAdjustAmount(event.target.value)}/></label>{error && <p className="form-error">{error}</p>}<button className="primary-button submit-button" disabled={saving}>{saving ? "Saving…" : adjustMode === "add" ? "Add savings" : "Withdraw"}<Check size={17}/></button></form></DialogContent></Dialog>
    <AlertDialog open={!!confirmTarget} onOpenChange={open => { if (!open) setConfirmTarget(null); }}><AlertDialogContent className={`app-confirm ${confirmTarget?.tone === "danger" ? "danger-confirm" : ""}`}><AlertDialogHeader><AlertDialogTitle>{confirmTarget?.title}</AlertDialogTitle><AlertDialogDescription>{confirmTarget?.detail}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction disabled={saving || !!reportBusy} className={confirmTarget?.tone === "danger" ? "confirm-danger-button" : "confirm-primary-button"} onClick={() => { const action = confirmTarget?.onConfirm; setConfirmTarget(null); if (action) void action(); }}>{confirmTarget?.confirmLabel || "Confirm"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </Tabs>;
}
