"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, BarChart3, CalendarDays, Check, ChevronLeft, ChevronRight, CircleDollarSign, Clock3, Download, FileImage, FileText, LayoutDashboard, List, MoreHorizontal, Pencil, Plus, Receipt, Target, Trash2, Users, Wallet } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { addDays, Bill, currentWeekStart, dayLabel, Entry, Goal, GroupSplit, money, monthLabel, todayInManila, weekDays, weekLabel } from "./finance-utils";
import { downloadReport } from "./report";
import { SplitBills } from "./split-bills";
import { LegalDialog, LegalTopic } from "./legal";
import { Onboarding } from "./onboarding";
import { loadFinance, saveFinance } from "./finance-client";

type View = "overview" | "activity" | "collect" | "splits" | "insights" | "bills" | "goals" | "reports" | "more";
type EntryKind = "expense" | "loan";
type ReportPeriod = "week" | "month";
const navigation: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "activity", label: "Activity", icon: List },
  { id: "collect", label: "To collect", icon: Users },
  { id: "splits", label: "Split bills", icon: CircleDollarSign },
  { id: "insights", label: "Insights", icon: BarChart3 },
  { id: "bills", label: "Bills", icon: Receipt },
  { id: "goals", label: "Goals", icon: Target },
  { id: "reports", label: "Reports", icon: FileText },
];
const mobileViews: View[] = ["overview", "activity", "collect", "insights"];
const pageCopy: Record<View, { title: string; detail: string }> = {
  overview: { title: "Your money, in focus.", detail: "Spending, money lent, and what needs attention." },
  activity: { title: "All activity.", detail: "Every purchase and loan for the week." },
  collect: { title: "Money to collect.", detail: "Outstanding loans and group shares across all your weeks." },
  splits: { title: "Split bills together.", detail: "Share a bill evenly and keep track of who has paid." },
  insights: { title: "See the full picture.", detail: "Monthly trends and where your money goes." },
  bills: { title: "Bills to handle.", detail: "Stay ahead of upcoming payments." },
  goals: { title: "Goals in progress.", detail: "Keep savings targets within reach." },
  reports: { title: "Your reports.", detail: "Export a weekly or monthly record." },
  more: { title: "Your finance tools.", detail: "Bills, savings goals, and reports in one place." },
};
const sum = (entries: Entry[]) => entries.reduce((total, item) => total + item.amountCents, 0);
const greeting = () => {
  const hour = new Date().toLocaleString("en-US", { timeZone: "Asia/Manila", hour: "numeric", hour12: false });
  const value = Number(hour);
  if (value < 12) return "Good morning";
  if (value < 18) return "Good afternoon";
  return "Good evening";
};

function Entries({ entries, onDelete, onEdit }: { entries: Entry[]; onDelete: (entry: Entry) => void; onEdit: (entry: Entry) => void }) {
  if (!entries.length) return <div className="empty-state"><span className="empty-icon"><Wallet size={23}/></span><strong>No entries here yet</strong><p>Add a purchase or money lent to get started.</p></div>;
  return <div className="transaction-list">{entries.map(entry => {
    const isLoan = entry.kind === "loan";
    return <div className="transaction" key={entry.id}>
      <span className={`transaction-symbol ${isLoan ? "lent" : ""}`}>{isLoan ? <ArrowDownLeft size={19}/> : <ArrowUpRight size={19}/>}</span>
      <div className="transaction-name"><strong>{entry.description}</strong><span>{dayLabel(entry.date)} · {isLoan ? `${entry.borrower}${entry.settled ? " · Repaid" : " · Money lent"}` : entry.category}</span></div>
      <div className="transaction-value"><b>{money(entry.amountCents)}</b><small>{isLoan ? entry.settled ? "REPAID" : "TO COLLECT" : "SPENT"}</small></div>
      <button className="delete-button" type="button" aria-label={`Edit ${entry.description}`} onClick={() => onEdit(entry)}><Pencil size={16}/></button>
      <button className="delete-button" type="button" aria-label={`Delete ${entry.description}`} onClick={() => onDelete(entry)}><Trash2 size={16}/></button>
    </div>;
  })}</div>;
}

export default function Home({ accountName = "there", accountEmail }: { accountName?: string; accountEmail?: string }) {
  const [weekStart, setWeekStart] = useState(currentWeekStart);
  const [currentWeek, setCurrentWeek] = useState(currentWeekStart);
  const [view, setView] = useState<View>("overview");
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
  const [error, setError] = useState("");
  const [legalTopic, setLegalTopic] = useState<LegalTopic>(null);
  const [tourOpen, setTourOpen] = useState(false);
  const [entryOpen, setEntryOpen] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [billOpen, setBillOpen] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);
  const [adjustGoal, setAdjustGoal] = useState<Goal | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string; action: "delete" | "delete_bill" | "delete_goal" } | null>(null);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [kind, setKind] = useState<EntryKind>("expense");
  const [date, setDate] = useState(currentWeekStart);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
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
      setBills(data.bills || []); setGoals(data.goals || []); setGroupSplits(data.groupSplits || []);
      setBudgetCents(data.budgetCents ?? null); setMonthStart(data.monthStart || `${weekStart.slice(0, 7)}-01`); setError("");
    } catch (cause) {
      if (request === requestVersion.current) setError(cause instanceof Error ? cause.message : "Could not load your data.");
    } finally { if (request === requestVersion.current) setLoading(false); }
  }, [weekStart]);
  useEffect(() => { void load(); }, [load]);
  async function save(payload: Record<string, unknown>) {
    setSaving(true); setError("");
    try {
      await saveFinance(payload);
      await load(); return true;
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
  const categories = Object.entries(expenses.reduce<Record<string, number>>((acc, e) => { acc[e.category] = (acc[e.category] || 0) + e.amountCents; return acc; }, {})).sort((a, b) => b[1] - a[1]);
  const monthly = history.filter(e => e.date.startsWith(monthStart.slice(0, 7)));
  const monthSpent = sum(monthly.filter(e => e.kind === "expense"));
  const previousMonthDate = new Date(`${monthStart}T12:00:00Z`); previousMonthDate.setUTCMonth(previousMonthDate.getUTCMonth() - 1);
  const previousMonth = previousMonthDate.toISOString().slice(0, 7);
  const previousSpent = sum(history.filter(e => e.kind === "expense" && e.date.startsWith(previousMonth)));
  const monthCategories = Object.entries(monthly.filter(e => e.kind === "expense").reduce<Record<string, number>>((acc, e) => { acc[e.category] = (acc[e.category] || 0) + e.amountCents; return acc; }, {})).sort((a, b) => b[1] - a[1]);
  const trend = Array.from({ length: 6 }, (_, index) => { const d = new Date(`${monthStart}T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() - 5 + index); const key = d.toISOString().slice(0, 7); return { key, label: dayLabel(`${key}-01`, { month: "short" }), spent: sum(history.filter(e => e.kind === "expense" && e.date.startsWith(key))) }; });
  const maxTrend = Math.max(...trend.map(item => item.spent), 1);
  const reportEntries = reportPeriod === "week" ? entries : monthly;
  const reportName = reportPeriod === "week" ? weekLabel(weekStart) : monthLabel(monthStart);

  function openEntry(type: EntryKind) { setEditingEntry(null); setKind(type); setDate(days.includes(todayInManila()) ? todayInManila() : days[0]); setDescription(""); setAmount(""); setBorrower(""); setCategory("Food"); setEntryOpen(true); }
  function editEntry(entry: Entry) { const nextKind: EntryKind = entry.kind === "loan" ? "loan" : "expense"; setEditingEntry(entry); setKind(nextKind); setDate(entry.date); setDescription(entry.description); setAmount(String(entry.amountCents / 100)); setBorrower(entry.borrower || ""); setCategory(nextKind === "loan" ? "Food" : entry.category || "Food"); setEntryOpen(true); }
  async function exportFile(format: "pdf" | "jpg") {
    setReportBusy(format); setError("");
    try { const result = await downloadReport({ period: reportPeriod, weekStart, monthStart, entries: reportEntries, allLoans, groupSplits, budgetCents, bills, goals }, format); setReportLink(result); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not generate report."); }
    finally { setReportBusy(null); }
  }
  const go = (next: View) => { setView(next); window.scrollTo({ top: 0, behavior: "smooth" }); };

  return <Tabs value={view} onValueChange={value => go(value as View)} className="app-shell">
    <aside className="sidebar"><div className="app-brand"><span className="logo">E</span><span><b>EvenFold</b><small>FINANCE</small></span></div><p className="nav-caption">YOUR SPACE</p><TabsList className="side-nav" aria-label="Main navigation">{navigation.map(({ id, label, icon: Icon }) => <TabsTrigger key={id} value={id}><Icon size={19}/><span>{label}</span></TabsTrigger>)}</TabsList><div className="sidebar-bottom"><span className="private-mark">● &nbsp; PRIVATE SPACE</span><p>Small steps. Clearer money.</p></div></aside>
    <div className="app-main"><header className="app-top"><div className="mobile-brand"><span className="logo">E</span><b>EvenFold FINANCE</b></div><div className="app-top-left"><span className="top-context">PERSONAL FINANCE</span><span className="top-divider"/><span className="top-status">{greeting()}, {accountName}</span></div><span className="avatar" aria-label={accountEmail ? `Signed in as ${accountEmail}` : "Private account"}>{accountName.slice(0, 1).toUpperCase()}</span></header>
      <div className="content"><div className="page-heading"><div><h1>{pageCopy[view].title}</h1><p className="heading-copy">{pageCopy[view].detail}</p></div><button className="primary-button heading-add" onClick={() => openEntry("expense")}><Plus size={18}/> Add entry</button></div>
        {(["overview", "activity", "insights", "reports"] as View[]).includes(view) && <div className="week-toolbar"><div className="week-label"><CalendarDays size={20}/><div><small>SELECTED WEEK · TUESDAY–SATURDAY</small><strong>{weekLabel(weekStart)}</strong></div></div><div className="week-controls"><button aria-label="Previous week" onClick={() => setWeekStart(w => addDays(w, -7))}><ChevronLeft size={20}/></button>{weekStart !== currentWeek && <button className="today-button" onClick={() => setWeekStart(currentWeek)}>This week</button>}<button aria-label="Next week" onClick={() => setWeekStart(w => addDays(w, 7))}><ChevronRight size={20}/></button></div></div>}
        {error && <div className="error-banner" role="alert">{error}<button onClick={() => void load()}>Retry</button></div>}
        <TabsContent value="overview" className="view-content"><div className="summary-grid three"><article className="hero-card"><div className="card-top"><span>SPENT THIS WEEK</span><ArrowUpRight size={21}/></div><strong>{loading ? "…" : money(spent)}</strong><div className="hero-bottom"><span>{expenses.length} {expenses.length === 1 ? "expense" : "expenses"} recorded</span></div></article><article className="summary-card"><div className="card-top"><span>TO COLLECT</span><Users size={20}/></div><strong>{loading ? "…" : money(outstanding)}</strong><p>Loans and group splits</p><button className="card-link" onClick={() => go("collect")}>View balances <ArrowRight size={15}/></button></article><article className="summary-card budget-card"><div className="card-top"><span>BUDGET LEFT</span><Wallet size={20}/></div><strong>{budgetCents === null ? "Not set" : money(budgetCents - spent)}</strong><p>{budgetCents === null ? "Set this week’s limit" : spent > budgetCents ? "Over your limit" : "After expenses"}</p><button className="card-link" onClick={() => { setBudgetInput(budgetCents === null ? "" : String(budgetCents / 100)); setBudgetOpen(true); }}>{budgetCents === null ? "Set budget" : "Edit budget"} <ArrowRight size={15}/></button></article></div>
          <div className="quick-actions"><button onClick={() => openEntry("expense")}><span><ArrowUpRight size={19}/></span>Expense</button><button onClick={() => openEntry("loan")}><span><ArrowDownLeft size={19}/></span>Money lent</button><button onClick={() => go("splits")}><span><Users size={19}/></span>Split bill</button><button onClick={() => go("reports")}><span><Download size={19}/></span>Export report</button></div>
          <div className="main-grid"><section className="surface"><div className="surface-heading"><div><p className="mini-label">THE PACE</p><h2>Daily spending</h2></div><span className="surface-note">{money(spent)} total</span></div><div className="chart">{daily.map(({ date: day, spent: total }) => <div className="chart-day" key={day}><strong>{total ? money(total) : "—"}</strong><div className="chart-track"><div style={{ height: `${total ? Math.max(9, total / maxDaily * 100) : 4}%` }} className="chart-bar"/></div><span>{dayLabel(day, { weekday: "short" })}</span><small>{day.slice(-2)}</small></div>)}</div></section><section className="surface"><div className="surface-heading"><div><p className="mini-label">WHERE IT WENT</p><h2>Categories</h2></div><button className="link-button" onClick={() => go("insights")}>Insights <ArrowRight size={15}/></button></div>{categories.length ? <div className="category-list">{categories.slice(0, 5).map(([name, total], index) => <div className="category" key={name}><span className={`category-dot tone-${index % 4}`}/><span>{name}</span><div className="category-meter"><i style={{ width: `${spent ? total / spent * 100 : 0}%` }}/></div><b>{money(total)}</b></div>)}</div> : <p className="muted-empty">Your spending categories will appear here.</p>}</section></div>
          <div className="main-grid attention-grid"><section className="surface compact-surface"><div className="surface-heading"><div><p className="mini-label">COMING UP</p><h2>Bills</h2></div><button className="link-button" onClick={() => go("bills")}>See bills <ArrowRight size={15}/></button></div>{overdueBills.length > 0 && <p className="attention-note">{overdueBills.length} {overdueBills.length === 1 ? "bill is" : "bills are"} overdue.</p>}{upcomingBills.length ? upcomingBills.map(b => <div className="preview-row" key={b.id}><div><strong>{b.name}</strong><small>Due {dayLabel(b.dueDate)}</small></div><b>{money(b.amountCents)}</b></div>) : <p className="muted-empty">No upcoming bills recorded.</p>}</section><section className="surface compact-surface"><div className="surface-heading"><div><p className="mini-label">SAVING FOR</p><h2>Goals</h2></div><button className="link-button" onClick={() => go("goals")}>See goals <ArrowRight size={15}/></button></div>{goals.length ? goals.slice(0, 3).map(g => <div className="goal-preview" key={g.id}><div><strong>{g.name}</strong><span>{money(g.savedCents)} of {money(g.targetCents)}</span></div><div className="goal-track"><i style={{ width: `${Math.min(100, g.savedCents / g.targetCents * 100)}%` }}/></div></div>) : <p className="muted-empty">No savings goals yet.</p>}</section></div>
          <section className="surface recent"><div className="surface-heading"><div><p className="mini-label">LATEST MOVES</p><h2>Recent activity</h2></div><button className="link-button" onClick={() => go("activity")}>See all <ArrowRight size={16}/></button></div><Entries entries={entries.slice(0, 5)} onEdit={editEntry} onDelete={entry => setDeleteTarget({ id: entry.id, label: entry.description, action: "delete" })}/></section></TabsContent>
        <TabsContent value="activity" className="view-content"><div className="activity-actions"><span>{entries.length} entries in this week</span><div><button className="outline-button" onClick={() => openEntry("loan")}><ArrowDownLeft size={17}/> Money lent</button><button className="primary-button" onClick={() => openEntry("expense")}><Plus size={17}/> Expense</button></div></div><section className="surface activity-surface">{days.map(day => { const found = entries.filter(e => e.date === day); return <div key={day} className="day-group"><div className="day-heading"><h2>{dayLabel(day, { weekday: "long", month: "long", day: "numeric" })}</h2><span>{money(sum(found.filter(e => e.kind === "expense")))} spent</span></div>{found.length ? <Entries entries={found} onEdit={editEntry} onDelete={entry => setDeleteTarget({ id: entry.id, label: entry.description, action: "delete" })}/> : <p className="quiet-row">No activity recorded.</p>}</div>; })}</section></TabsContent>
        <TabsContent value="collect" className="view-content"><div className="collect-banner"><div className="collect-symbol"><ArrowDownLeft size={25}/></div><div><span>OUTSTANDING ACROSS ALL WEEKS</span><strong>{money(outstanding)}</strong><p>Loans and group shares stay here until you mark them settled.</p></div><button className="light-button" onClick={() => openEntry("loan")}><Plus size={17}/> Add money lent</button></div>{borrowerTotals.length ? <div className="borrower-grid">{borrowerTotals.map(([name, data]) => <section className="surface borrower-card" key={name}><div className="borrower-head"><span className="borrower-avatar">{name.slice(0, 1).toUpperCase()}</span><div><h2>{name}</h2><small>{data.entries.length} {data.entries.length === 1 ? "entry" : "entries"}</small></div><strong>{money(data.total)}</strong></div><div className="borrower-lines">{data.entries.map(e => <div className="borrower-line" key={e.id}><div><b>{e.description}</b><small>{dayLabel(e.date)} · {e.settled ? "Repaid" : "Outstanding"}</small></div><div><strong>{money(e.amountCents)}</strong><button disabled={saving} onClick={() => editEntry(e)}>Edit</button><button disabled={saving} onClick={() => void save({ action: "settle", id: e.id })}>{e.settled ? "Mark unpaid" : "Mark repaid"}</button></div></div>)}</div></section>)}</div> : !groupToCollect.length ? <section className="surface"><div className="empty-state"><span className="empty-icon"><Users size={22}/></span><strong>No loans recorded</strong><p>Add a borrower whenever you lend money.</p><button className="primary-button" onClick={() => openEntry("loan")}>Add money lent</button></div></section> : null}{groupToCollect.length > 0 && <section className="surface group-collect"><div className="surface-heading"><div><p className="mini-label">GROUP BILLS</p><h2>Shares to collect</h2></div><button className="link-button" onClick={() => go("splits")}>See splits</button></div>{groupToCollect.map(({ split, share }) => <div className="preview-row" key={share.id}><div><strong>{share.name}</strong><small>{split.title} · {dayLabel(split.date)}</small></div><b>{money(share.amountCents)}</b></div>)}</section>}</TabsContent>
        <TabsContent value="splits" className="view-content"><SplitBills splits={groupSplits} saving={saving} loading={loading} error={error} onSave={save}/></TabsContent>
        <TabsContent value="insights" className="view-content"><div className="insight-heading"><span>LOOKING AT {monthLabel(monthStart).toUpperCase()}</span><button className="outline-button" onClick={() => { setReportPeriod("month"); go("reports"); }}><FileText size={17}/> Export month</button></div><div className="insight-cards"><article className="surface insight-stat"><small>SPENDING</small><strong>{money(monthSpent)}</strong><span>{previousSpent ? `${Math.abs(Math.round((monthSpent - previousSpent) / previousSpent * 100))}% ${monthSpent >= previousSpent ? "above" : "below"} last month` : "No previous month spending to compare"}</span></article><article className="surface insight-stat"><small>LAST MONTH</small><strong>{money(previousSpent)}</strong><span>Spending for comparison</span></article></div><div className="main-grid insight-grid"><section className="surface"><div className="surface-heading"><div><p className="mini-label">SIX MONTH VIEW</p><h2>Spending over time</h2></div></div><div className="trend-chart" aria-label="Spending over six months">{trend.map(item => <div className="trend-month" key={item.key}><div className="trend-pair"><div className="trend-bar expense-trend" style={{ height: `${Math.max(3, item.spent / maxTrend * 100)}%` }} title={`${item.label} spending: ${money(item.spent)}`}/></div><span>{item.label}</span></div>)}</div></section><section className="surface"><div className="surface-heading"><div><p className="mini-label">MONTHLY BREAKDOWN</p><h2>Spending categories</h2></div></div>{monthCategories.length ? <div className="category-list insight-categories">{monthCategories.map(([name, total], index) => <div className="category" key={name}><span className={`category-dot tone-${index % 4}`}/><span>{name}</span><div className="category-meter"><i style={{ width: `${monthSpent ? total / monthSpent * 100 : 0}%` }}/></div><b>{money(total)}</b></div>)}</div> : <p className="muted-empty">Add expenses to see your monthly breakdown.</p>}</section></div><section className="surface insight-summary"><div><p className="mini-label">THIS WEEK</p><h2>{weekLabel(weekStart)}</h2><p>{expenses.length} {expenses.length === 1 ? "expense" : "expenses"} recorded.</p></div><div><strong>{budgetCents === null ? money(spent) : money(budgetCents - spent)}</strong><span>{budgetCents === null ? "Spent this week" : "Budget left"}</span></div></section></TabsContent>
        <TabsContent value="bills" className="view-content"><div className="section-toolbar"><div><span className="section-kicker">BILL TRACKER</span><p>{unpaidBills.length} unpaid · {overdueBills.length} overdue</p></div><button className="primary-button" onClick={() => { setBillName(""); setBillAmount(""); setBillDate(todayInManila()); setBillOpen(true); }}><Plus size={17}/> Add bill</button></div><div className="disclosure">Bills are reminders. Marking one paid does not add an expense; record its payment in Activity to include it in spending.</div>{bills.length ? <section className="surface bill-list">{bills.map(b => <div className="bill-row" key={b.id}><span className={`bill-icon ${b.paid ? "paid" : b.dueDate < today ? "overdue" : ""}`}><Receipt size={19}/></span><div className="bill-main"><strong>{b.name}</strong><span>Due {dayLabel(b.dueDate, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</span></div><div className="bill-meta"><b>{money(b.amountCents)}</b><small className={b.paid ? "status-paid" : b.dueDate < today ? "status-overdue" : ""}>{b.paid ? "PAID" : b.dueDate < today ? "OVERDUE" : "UPCOMING"}</small></div><div className="bill-buttons"><button disabled={saving} onClick={() => void save({ action: "toggle_bill", id: b.id })}>{b.paid ? "Mark unpaid" : "Mark paid"}</button><button aria-label={`Delete ${b.name}`} onClick={() => setDeleteTarget({ id: b.id, label: b.name, action: "delete_bill" })}><Trash2 size={16}/></button></div></div>)}</section> : <section className="surface"><div className="empty-state"><span className="empty-icon"><Receipt size={22}/></span><strong>No bills tracked yet</strong><p>Add a payment and its due date.</p><button className="primary-button" onClick={() => setBillOpen(true)}>Add bill</button></div></section>}</TabsContent>
        <TabsContent value="goals" className="view-content"><div className="section-toolbar"><div><span className="section-kicker">SAVINGS GOALS</span><p>{goals.length} {goals.length === 1 ? "goal" : "goals"} · {money(goals.reduce((total, goal) => total + goal.savedCents, 0))} saved</p></div><button className="primary-button" onClick={() => { setGoalName(""); setGoalTarget(""); setGoalOpen(true); }}><Plus size={17}/> New goal</button></div><div className="disclosure">Goal contributions are tracked separately from spending.</div>{goals.length ? <div className="goal-grid">{goals.map(goal => { const progress = Math.min(100, Math.round(goal.savedCents / goal.targetCents * 100)); return <section className="surface goal-card" key={goal.id}><div className="goal-card-head"><span className="goal-icon"><Target size={20}/></span><button aria-label={`Delete ${goal.name}`} className="delete-button" onClick={() => setDeleteTarget({ id: goal.id, label: goal.name, action: "delete_goal" })}><Trash2 size={16}/></button></div><h2>{goal.name}</h2><strong>{money(goal.savedCents)}</strong><p>of {money(goal.targetCents)} target</p><div className="goal-progress-label"><span>Progress</span><b>{progress}%</b></div><div className="goal-track"><i style={{ width: `${progress}%` }}/></div><div className="goal-actions"><button className="primary-button" onClick={() => { setAdjustGoal(goal); setAdjustMode("add"); setAdjustAmount(""); }}>Add savings</button><button className="outline-button" onClick={() => { setAdjustGoal(goal); setAdjustMode("withdraw"); setAdjustAmount(""); }}>Withdraw</button></div></section>; })}</div> : <section className="surface"><div className="empty-state"><span className="empty-icon"><Target size={22}/></span><strong>No savings goals yet</strong><p>Set a target and track your progress.</p><button className="primary-button" onClick={() => setGoalOpen(true)}>Create goal</button></div></section>}</TabsContent>
        <TabsContent value="reports" className="view-content"><section className="report-card"><div className="report-visual"><div className="paper"><span className="paper-brand">EVENFOLD / FINANCE</span><div className="paper-line big"/><div className="paper-line"/><div className="paper-boxes"><i/><i/><i/></div><div className="paper-line"/><div className="paper-line short"/><div className="paper-line"/></div></div><div className="report-info"><p className="mini-label">WEEKLY OR MONTHLY</p><h2>Take your numbers with you.</h2><p>Choose a period and download a report with spending, category totals, transactions, outstanding loans and group shares, bills, and goals.</p><div className="kind-switch report-switch"><button className={reportPeriod === "week" ? "active" : ""} onClick={() => setReportPeriod("week")}>Selected week</button><button className={reportPeriod === "month" ? "active" : ""} onClick={() => setReportPeriod("month")}>Selected month</button></div><div className="report-selection"><strong>{reportName}</strong><span>{reportEntries.length} entries · {money(sum(reportEntries.filter(e => e.kind === "expense")))} spent</span></div><div className="report-buttons"><button className="primary-button" disabled={loading || !!reportBusy} onClick={() => void exportFile("pdf")}><FileText size={18}/>{reportBusy === "pdf" ? "Creating PDF…" : "Generate PDF"}</button><button className="outline-button" disabled={loading || !!reportBusy} onClick={() => void exportFile("jpg")}><FileImage size={18}/>{reportBusy === "jpg" ? "Creating JPG…" : "Generate JPG"}</button></div><small className="report-note"><Download size={14}/> Generated in your browser. Use the ready link to save it.</small>{reportLink && <a className="report-ready" href={reportLink.url} download={reportLink.filename}>Report ready: download {reportLink.filename} <ArrowRight size={15}/></a>}</div></section></TabsContent>
        <TabsContent value="more" className="view-content"><div className="more-grid">{navigation.filter(item => ["splits", "bills", "goals", "reports"].includes(item.id)).map(({ id, label, icon: Icon }) => <button className="surface more-card" key={id} onClick={() => go(id)}><span><Icon size={24}/></span><div><strong>{label}</strong><small>{id === "splits" ? `${groupSplits.length} group bills` : id === "bills" ? `${unpaidBills.length} unpaid payments` : id === "goals" ? `${goals.length} savings goals` : "Weekly and monthly downloads"}</small></div><ArrowRight size={18}/></button>)}</div></TabsContent>
        <footer className="app-footer"><span>Developed by <strong>Victor Tarra &amp; Codex</strong></span><div><button type="button" onClick={() => setTourOpen(true)}>How to use</button><button type="button" onClick={() => setLegalTopic("privacy")}>Privacy · RA 10173</button><button type="button" onClick={() => setLegalTopic("terms")}>Terms &amp; conditions</button></div></footer>
      </div></div>
    <nav className="bottom-nav" aria-label="Main navigation">{mobileViews.map(id => { const item = navigation.find(link => link.id === id)!; const Icon = item.icon; return <button key={id} type="button" className={view === id ? "active" : ""} aria-current={view === id ? "page" : undefined} onClick={() => go(id)}><Icon size={21}/><span>{item.label}</span></button>; })}<button type="button" className={![...mobileViews].includes(view) ? "active" : ""} aria-current={![...mobileViews].includes(view) ? "page" : undefined} onClick={() => go("more")}><MoreHorizontal size={21}/><span>More</span></button></nav><button className="mobile-add" aria-label="Add entry" onClick={() => openEntry("expense")}><Plus size={27}/></button>
    <Onboarding open={tourOpen} onClose={closeTour}/><LegalDialog topic={legalTopic} onClose={() => setLegalTopic(null)}/>
    <Dialog open={entryOpen} onOpenChange={open => { setEntryOpen(open); if (!open) setEditingEntry(null); }}><DialogContent className="entry-dialog"><DialogHeader><DialogTitle>{editingEntry ? "Edit entry" : "Add an entry"}</DialogTitle><DialogDescription>{editingEntry ? "Update this expense or lent-money record." : `Record a purchase or money lent for ${weekLabel(weekStart)}.`}</DialogDescription></DialogHeader><div className="kind-switch"><button className={kind === "expense" ? "active" : ""} onClick={() => { setKind("expense"); setCategory(category === "Lent money" ? "Food" : category); }} type="button"><ArrowUpRight size={17}/> Expense</button><button className={kind === "loan" ? "active" : ""} onClick={() => setKind("loan")} type="button"><ArrowDownLeft size={17}/> Lent</button></div><form className="form-grid" onSubmit={async event => { event.preventDefault(); const action = editingEntry ? "edit" : "add"; if (await save({ action, id: editingEntry?.id, weekStart, date, kind, description, amount, category, borrower })) { setEntryOpen(false); setEditingEntry(null); setDescription(""); setAmount(""); setBorrower(""); } }}><label>Date{editingEntry ? <input required type="date" value={date} onChange={event => setDate(event.target.value)}/> : <select value={date} onChange={event => setDate(event.target.value)}>{days.map(day => <option key={day} value={day}>{dayLabel(day, { weekday: "long", month: "short", day: "numeric" })}</option>)}</select>}</label><label>{kind === "loan" ? "What was it for?" : "Merchant or item"}<input required maxLength={100} placeholder={kind === "loan" ? "e.g. Lunch with friends" : "e.g. Coffee"} value={description} onChange={event => setDescription(event.target.value)}/></label><label>Amount (₱)<input required type="number" min="0.01" max="10000000" step="0.01" placeholder="0.00" value={amount} onChange={event => setAmount(event.target.value)}/></label>{kind === "loan" ? <label>Who owes you?<input required maxLength={100} placeholder="Enter their name" value={borrower} onChange={event => setBorrower(event.target.value)}/></label> : <label>Category<select value={category} onChange={event => setCategory(event.target.value)}>{["Food", "Coffee", "Groceries", "Transport", "School", "Bills", "Other"].map(option => <option key={option}>{option}</option>)}</select></label>}{error && <p className="form-error">{error}</p>}<button className="primary-button submit-button" disabled={saving}>{saving ? "Saving…" : editingEntry ? "Save changes" : "Save entry"}<ArrowRight size={17}/></button></form></DialogContent></Dialog>
    <Dialog open={budgetOpen} onOpenChange={setBudgetOpen}><DialogContent className="budget-dialog"><DialogHeader><DialogTitle>Weekly budget</DialogTitle><DialogDescription>Set a spending limit for {weekLabel(weekStart)}. Each week has its own budget.</DialogDescription></DialogHeader><form className="form-grid" onSubmit={async event => { event.preventDefault(); if (await save({ action: "budget", weekStart, amount: budgetInput })) setBudgetOpen(false); }}><label>Budget (₱)<input autoFocus required type="number" min="0" max="10000000" step="0.01" placeholder="0.00" value={budgetInput} onChange={event => setBudgetInput(event.target.value)}/></label>{error && <p className="form-error">{error}</p>}<button className="primary-button submit-button" disabled={saving}>{saving ? "Saving…" : "Save budget"}<Check size={17}/></button></form></DialogContent></Dialog>
    <Dialog open={billOpen} onOpenChange={setBillOpen}><DialogContent className="budget-dialog"><DialogHeader><DialogTitle>Add a bill</DialogTitle><DialogDescription>Keep its amount and due date in your list.</DialogDescription></DialogHeader><form className="form-grid" onSubmit={async event => { event.preventDefault(); if (await save({ action: "add_bill", name: billName, amount: billAmount, dueDate: billDate })) { setBillOpen(false); setBillName(""); setBillAmount(""); } }}><label>Bill name<input autoFocus required maxLength={100} placeholder="e.g. Internet" value={billName} onChange={event => setBillName(event.target.value)}/></label><label>Amount (₱)<input required type="number" min="0.01" max="10000000" step="0.01" placeholder="0.00" value={billAmount} onChange={event => setBillAmount(event.target.value)}/></label><label>Due date<input required type="date" value={billDate} onChange={event => setBillDate(event.target.value)}/></label>{error && <p className="form-error">{error}</p>}<button className="primary-button submit-button" disabled={saving}>{saving ? "Saving…" : "Add bill"}<ArrowRight size={17}/></button></form></DialogContent></Dialog>
    <Dialog open={goalOpen} onOpenChange={setGoalOpen}><DialogContent className="budget-dialog"><DialogHeader><DialogTitle>New savings goal</DialogTitle><DialogDescription>Choose a name and a target amount.</DialogDescription></DialogHeader><form className="form-grid" onSubmit={async event => { event.preventDefault(); if (await save({ action: "add_goal", name: goalName, target: goalTarget })) { setGoalOpen(false); setGoalName(""); setGoalTarget(""); } }}><label>Goal name<input autoFocus required maxLength={100} placeholder="e.g. Emergency fund" value={goalName} onChange={event => setGoalName(event.target.value)}/></label><label>Target (₱)<input required type="number" min="0.01" max="10000000" step="0.01" placeholder="0.00" value={goalTarget} onChange={event => setGoalTarget(event.target.value)}/></label>{error && <p className="form-error">{error}</p>}<button className="primary-button submit-button" disabled={saving}>{saving ? "Saving…" : "Create goal"}<Target size={17}/></button></form></DialogContent></Dialog>
    <Dialog open={!!adjustGoal} onOpenChange={open => { if (!open) setAdjustGoal(null); }}><DialogContent className="budget-dialog"><DialogHeader><DialogTitle>{adjustMode === "add" ? "Add to" : "Withdraw from"} {adjustGoal?.name}</DialogTitle><DialogDescription>Currently saved: {money(adjustGoal?.savedCents || 0)}. Savings are tracked separately from spending.</DialogDescription></DialogHeader><form className="form-grid" onSubmit={async event => { event.preventDefault(); if (adjustGoal && await save({ action: "adjust_goal", id: adjustGoal.id, mode: adjustMode, amount: adjustAmount })) { setAdjustGoal(null); setAdjustAmount(""); } }}><label>Amount (₱)<input autoFocus required type="number" min="0.01" max="10000000" step="0.01" placeholder="0.00" value={adjustAmount} onChange={event => setAdjustAmount(event.target.value)}/></label>{error && <p className="form-error">{error}</p>}<button className="primary-button submit-button" disabled={saving}>{saving ? "Saving…" : adjustMode === "add" ? "Add savings" : "Withdraw"}<Check size={17}/></button></form></DialogContent></Dialog>
    <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete this {deleteTarget?.action === "delete_bill" ? "bill" : deleteTarget?.action === "delete_goal" ? "goal" : "entry"}?</AlertDialogTitle><AlertDialogDescription>{deleteTarget?.label} will be removed. This cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction disabled={saving} onClick={() => { if (deleteTarget) void save({ action: deleteTarget.action, id: deleteTarget.id }); setDeleteTarget(null); }}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </Tabs>;
}
