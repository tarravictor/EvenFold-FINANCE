import { addDays, Bill, Entry, Goal, GroupSplit } from "./finance-utils";

type FinanceData = { entries: Entry[]; history: Entry[]; allLoans: Entry[]; bills: Bill[]; goals: Goal[]; groupSplits: GroupSplit[]; monthStart: string; budgetCents: number | null };
type Stored = { entries: Entry[]; bills: Bill[]; goals: Goal[]; groupSplits: GroupSplit[]; budgets: Record<string, number> };
const empty = (): Stored => ({ entries: [], bills: [], goals: [], groupSplits: [], budgets: {} });

declare global { interface Window { EVENFOLD_CONFIG?: { url: string; key: string }; EVENFOLD_TOKEN?: string } }
function config() { return typeof window !== "undefined" ? window.EVENFOLD_CONFIG : undefined; }
function amount(value: unknown, zero = false) {
  const n = Number(value);
  if (value === "" || value == null || !Number.isFinite(n) || n < (zero ? 0 : 0.01) || n > 10000000) throw new Error("Enter a valid amount.");
  return Math.round(n * 100);
}
function label(value: unknown, name: string) {
  if (typeof value !== "string" || !value.trim() || value.length > 100) throw new Error(`Enter a valid ${name}.`);
  return value.trim();
}
function asDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)) || new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) !== value) throw new Error("Choose a valid date.");
  return value;
}
function id(value: unknown) { if (typeof value !== "string" || !/^[a-f0-9-]{36}$/.test(value)) throw new Error("Invalid record."); return value; }
function mutate(s: Stored, p: Record<string, unknown>) {
  switch (p.action) {
    case "budget": { const week = asDate(p.weekStart); if (new Date(`${week}T12:00:00Z`).getUTCDay() !== 2) throw new Error("Choose a valid week."); s.budgets[week] = amount(p.amount, true); break; }
    case "add": { const week = asDate(p.weekStart), date = asDate(p.date); if (new Date(`${week}T12:00:00Z`).getUTCDay() !== 2 || date < week || date >= addDays(week, 5)) throw new Error("Choose a date in this week."); if (p.kind !== "expense" && p.kind !== "loan") throw new Error("Choose an entry type."); s.entries.unshift({ id: crypto.randomUUID(), date, kind: p.kind, description: label(p.description, "description"), category: p.kind === "loan" ? "Lent money" : label(p.category, "category"), borrower: p.kind === "loan" ? label(p.borrower, "borrower") : null, amountCents: amount(p.amount), settled: 0 }); break; }
    case "delete": s.entries = s.entries.filter(e => e.id !== id(p.id)); break;
    case "settle": { const e = s.entries.find(e => e.id === id(p.id) && e.kind === "loan"); if (!e) throw new Error("Invalid loan."); e.settled = e.settled ? 0 : 1; break; }
    case "add_split": { const date = asDate(p.date), title = label(p.title, "bill name"), totalCents = amount(p.total); if (!Array.isArray(p.people) || p.people.length < 1 || p.people.length > 19) throw new Error("Choose 2 to 20 people."); const names = ["You", ...p.people.map(x => label(x, "person's name"))]; if (new Set(names.map(x => x.toLocaleLowerCase())).size !== names.length || typeof p.payer !== "string" || !names.includes(p.payer)) throw new Error("Choose unique names and a payer."); const splitId = crypto.randomUUID(), base = Math.floor(totalCents / names.length), rest = totalCents % names.length; s.groupSplits.unshift({ id: splitId, title, date, totalCents, payer: p.payer, shares: names.map((name, i) => ({ id: crypto.randomUUID(), splitId, name, amountCents: base + (i < rest ? 1 : 0), paid: name === p.payer ? 1 : 0 })) }); break; }
    case "toggle_split_share": { const share = s.groupSplits.flatMap(x => x.shares.filter(a => a.name !== x.payer)).find(x => x.id === id(p.id)); if (!share) throw new Error("Invalid share."); share.paid = share.paid ? 0 : 1; break; }
    case "delete_split": s.groupSplits = s.groupSplits.filter(x => x.id !== id(p.id)); break;
    case "add_bill": s.bills.push({ id: crypto.randomUUID(), name: label(p.name, "bill name"), dueDate: asDate(p.dueDate), amountCents: amount(p.amount), paid: 0 }); break;
    case "toggle_bill": { const b = s.bills.find(x => x.id === id(p.id)); if (!b) throw new Error("Invalid bill."); b.paid = b.paid ? 0 : 1; break; }
    case "delete_bill": s.bills = s.bills.filter(x => x.id !== id(p.id)); break;
    case "add_goal": s.goals.push({ id: crypto.randomUUID(), name: label(p.name, "goal name"), targetCents: amount(p.target), savedCents: 0 }); break;
    case "adjust_goal": { const g = s.goals.find(x => x.id === id(p.id)); if (!g || (p.mode !== "add" && p.mode !== "withdraw")) throw new Error("Choose a valid goal adjustment."); const next = g.savedCents + amount(p.amount) * (p.mode === "add" ? 1 : -1); if (next < 0 || next > 1000000000) throw new Error("That adjustment cannot be saved."); g.savedCents = next; break; }
    case "delete_goal": s.goals = s.goals.filter(x => x.id !== id(p.id)); break;
    default: throw new Error("Unknown action.");
  }
}
async function request(path: string, method = "GET", body?: unknown) {
  const c = config(); if (!c || !window.EVENFOLD_TOKEN) throw new Error("Sign in to access your tracker.");
  const response = await fetch(`${c.url}/rest/v1/${path}`, { method, headers: { apikey: c.key, Authorization: `Bearer ${window.EVENFOLD_TOKEN}`, "Content-Type": "application/json", Prefer: method === "GET" ? "" : "return=representation" }, body: body === undefined ? undefined : JSON.stringify(body) });
  if (!response.ok) { const error = await response.json().catch(() => ({})) as { message?: string }; throw new Error(error.message || "Could not save your data."); }
  return response.json() as Promise<any>;
}
async function state() {
  const rows = await request("finance_state?select=data,version&limit=1") as { data: Stored; version: number }[];
  return rows[0] ?? { data: empty(), version: -1 };
}
export async function loadFinance(weekStart: string): Promise<FinanceData> {
  if (!config()) { const r = await fetch(`/api/finance?weekStart=${encodeURIComponent(weekStart)}`, { cache: "no-store" }); const d = await r.json() as FinanceData & { error?: string }; if (!r.ok) throw new Error(d.error || "Could not load your data."); return d; }
  const s = (await state()).data;
  const monthStart = `${weekStart.slice(0, 7)}-01`, start = `${new Date(Date.UTC(Number(monthStart.slice(0,4)), Number(monthStart.slice(5,7))-6, 1)).toISOString().slice(0,10)}`;
  return { entries: s.entries.filter(e => e.date >= weekStart && e.date < addDays(weekStart, 5)).sort((a,b) => b.date.localeCompare(a.date)), history: s.entries.filter(e => e.date >= start && e.date < addDays(`${weekStart.slice(0,7)}-01`, 35)), allLoans: s.entries.filter(e => e.kind === "loan"), bills: [...s.bills].sort((a,b) => a.dueDate.localeCompare(b.dueDate)), goals: [...s.goals].sort((a,b) => a.name.localeCompare(b.name)), groupSplits: [...s.groupSplits].sort((a,b) => b.date.localeCompare(a.date)), monthStart, budgetCents: s.budgets[weekStart] ?? null };
}
export async function saveFinance(payload: Record<string, unknown>): Promise<void> {
  if (!config()) { const r = await fetch("/api/finance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); const d = await r.json() as { error?: string }; if (!r.ok) throw new Error(d.error || "Could not save."); return; }
  for (let attempt = 0; attempt < 3; attempt++) {
    const old = await state(); const copy = structuredClone(old.data); mutate(copy, payload);
    if (old.version === -1) {
      const rows = await request("finance_state?on_conflict=owner&select=version", "POST", { data: copy, version: 0 });
      if (rows.length) return;
    } else {
      const rows = await request(`finance_state?version=eq.${old.version}&select=version`, "PATCH", { data: copy, version: old.version + 1 });
      if (rows.length) return;
    }
  }
  throw new Error("Your data changed in another tab. Please retry.");
}
