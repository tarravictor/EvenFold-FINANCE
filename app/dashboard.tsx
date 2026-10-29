import { ArrowDownLeft, ArrowRight, ArrowUpRight, Bus, CircleCheck, Coffee, Download, GraduationCap, OctagonAlert, Plus, Receipt, ShoppingBasket, Tag, Target, TrendingDown, TrendingUp, TriangleAlert, Users, Utensils, Wallet, type LucideIcon } from "lucide-react";
import { dayLabel, type Entry, type Goal, money } from "./finance-utils";

const categoryIcons: Record<string, LucideIcon> = { Food: Utensils, Coffee, Groceries: ShoppingBasket, Transport: Bus, School: GraduationCap, Bills: Receipt };
export const CategoryIcon = ({ name, size = 18 }: { name: string; size?: number }) => { const Icon = categoryIcons[name] || Tag; return <Icon size={size} aria-hidden="true"/>; };

/* Category colours come from the validated categorical palette (dataviz skill), assigned to the
   category itself, never to its rank, so "Food" is the same blue every week. Custom categories take
   the remaining hues in the order they were created; anything beyond that folds into grey "Other". */
const palette = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];
const baseOrder = ["Food", "Coffee", "Groceries", "Transport", "School", "Bills"];
const OTHER = "#7d8d87";
const slotOf = (name: string, custom: string[]) => {
  const base = baseOrder.indexOf(name);
  if (base >= 0) return base;
  const extra = custom.indexOf(name);
  return extra >= 0 && baseOrder.length + extra < palette.length ? baseOrder.length + extra : -1;
};

type Share = { share: { name: string; amountCents: number } };
export type DashboardProps = {
  loading: boolean; spent: number; prevSpent: number; outstanding: number; budgetCents: number | null;
  goals: Goal[]; categories: [string, number][]; customCategories: string[]; daily: { date: string; spent: number }[]; today: string; recent: Entry[];
  loans: Entry[]; groupToCollect: Share[];
  go: (view: "collect" | "goals" | "activity") => void; onExport: () => void;
  onAddExpense: () => void; onAddLoan: () => void; onAddGoal: () => void; onBudget: () => void;
};

function Empty({ title, hint, action, onAction }: { title: string; hint: string; action: string; onAction: () => void }) {
  return <div className="dash-empty"><strong>{title}</strong><p>{hint}</p><button type="button" className="outline-button" onClick={onAction}><Plus size={16}/> {action}</button></div>;
}

function Head({ kicker, title, link, onLink }: { kicker: string; title: string; link?: string; onLink?: () => void }) {
  return <div className="dash-head"><div><p className="mini-label">{kicker}</p><h2>{title}</h2></div>{link && <button type="button" className="link-button" onClick={onLink}>{link} <ArrowRight size={16}/></button>}</div>;
}

export function Dashboard(p: DashboardProps) {
  const activeGoals = p.goals.filter(g => g.savedCents < g.targetCents);
  const hasBudget = p.budgetCents !== null && p.budgetCents > 0;
  const net = hasBudget ? (p.budgetCents as number) - p.spent + p.outstanding : null;
  const used = hasBudget ? p.spent / (p.budgetCents as number) : 0;
  const level = used > 1 ? "over" : used >= .8 ? "near" : "ok";
  const LevelIcon = level === "over" ? OctagonAlert : level === "near" ? TriangleAlert : CircleCheck;
  const levelText = level === "over" ? "Over budget" : level === "near" ? "Close to your limit" : "On track";

  const change = p.prevSpent > 0 ? Math.round((p.spent - p.prevSpent) / p.prevSpent * 100) : null;
  const maxDay = Math.max(...p.daily.map(d => d.spent), 0);
  const topDay = maxDay > 0 ? p.daily.find(d => d.spent === maxDay)?.date : undefined;

  // Composition: up to 6 named categories, the tail folds into "Other". Segments are stacked in
  // fixed palette order (not by size) so neighbours are always the validated adjacent pairs.
  const total = p.categories.reduce((n, [, v]) => n + v, 0);
  const shown = p.categories.slice(0, 6);
  const rest = p.categories.slice(6).reduce((n, [, v]) => n + v, 0);
  const legend = shown.map(([name, amount]) => ({ name, amount, color: slotOf(name, p.customCategories) >= 0 ? palette[slotOf(name, p.customCategories)] : OTHER }));
  if (rest > 0) { const other = legend.find(item => item.name === "Other"); if (other) other.amount += rest; else legend.push({ name: "Other", amount: rest, color: OTHER }); }
  const stacked = [...legend].sort((a, b) => (slotOf(a.name, p.customCategories) < 0 ? 99 : slotOf(a.name, p.customCategories)) - (slotOf(b.name, p.customCategories) < 0 ? 99 : slotOf(b.name, p.customCategories)));
  const pct = (amount: number) => total ? Math.round(amount / total * 100) : 0;

  const people = new Map<string, { owed: number; paid: number }>();
  p.loans.forEach(e => { const name = e.borrower || "Unknown"; const row = people.get(name) || { owed: 0, paid: 0 }; if (e.settled) row.paid += e.amountCents; else row.owed += e.amountCents; people.set(name, row); });
  p.groupToCollect.forEach(({ share }) => { const row = people.get(share.name) || { owed: 0, paid: 0 }; row.owed += share.amountCents; people.set(share.name, row); });
  const rows = [...people].sort((a, b) => (b[1].owed > 0 ? 1 : 0) - (a[1].owed > 0 ? 1 : 0) || b[1].owed - a[1].owed).slice(0, 5);
  const owing = [...people.values()].filter(r => r.owed > 0).length;
  const figure = (value: string) => <strong className={`dash-figure${p.loading ? " is-loading" : ""}`}>{p.loading ? "₱0,000" : value}</strong>;

  return <div className="dash">
    <section className="dash-hero" aria-label="Spent this week">
      <div className="dash-hero-main">
        <p className="mini-label">Spent this week</p>
        <strong className={`dash-hero-figure${p.loading ? " is-loading" : ""}`}>{p.loading ? "₱0,000" : money(p.spent)}</strong>
        {!p.loading && change !== null && <p className="dash-delta" data-dir={change > 0 ? "up" : change < 0 ? "down" : "flat"}>
          {change > 0 ? <TrendingUp size={16} aria-hidden="true"/> : change < 0 ? <TrendingDown size={16} aria-hidden="true"/> : null}
          <span>{change === 0 ? "Same as last week" : `${Math.abs(change)}% ${change > 0 ? "higher" : "lower"} than last week`}</span>
        </p>}
        {!p.loading && (hasBudget
          ? <button type="button" className="dash-meter-wrap" onClick={p.onBudget} aria-label={`Weekly budget: ${Math.round(used * 100)} percent used. ${levelText}. Change budget`}>
              <span className="dash-meter" data-level={level} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(used * 100))}><i style={{ width: `${Math.min(100, used * 100)}%` }}/></span>
              <span className="dash-meter-text"><span className="dash-level" data-level={level}><LevelIcon size={15} aria-hidden="true"/>{levelText}</span><span>{money(Math.abs((p.budgetCents as number) - p.spent))} {used > 1 ? "over" : "left"} of {money(p.budgetCents as number)}</span></span>
            </button>
          : <button type="button" className="dash-cta-link" onClick={p.onBudget}>Set a weekly budget <ArrowRight size={14}/></button>)}
      </div>
      <div className="dash-days" role="group" aria-label="Spending by day this week">
        {p.daily.map(d => { const height = maxDay ? Math.max(d.spent ? 8 : 2, d.spent / maxDay * 72) : 2; const isTop = d.date === topDay;
          return <div className="dash-day" key={d.date} data-today={d.date === p.today}>
            <span className="dash-day-value">{isTop ? money(d.spent).replace(/\.00$/, "") : ""}</span>
            <span className="dash-day-bar" data-top={isTop} data-empty={!d.spent} tabIndex={0} data-tip={`${dayLabel(d.date, { weekday: "long" })}: ${money(d.spent)}`} aria-label={`${dayLabel(d.date, { weekday: "long" })}: ${money(d.spent)}`} style={{ height }}/>
            <span className="dash-day-label">{dayLabel(d.date, { weekday: "short" })}</span>
          </div>; })}
      </div>
    </section>

    <section className="dash-stats" aria-label="This week at a glance">
      <button type="button" className="dash-stat" style={{ "--accent": "#2563eb" } as React.CSSProperties} onClick={() => p.go("collect")}>
        <span className="dash-stat-top"><span className="mini-label">Owed to me</span><span className="dash-chip"><Users size={18}/></span></span>
        {figure(money(p.outstanding))}
        <small>{owing} {owing === 1 ? "person" : "people"} still to pay</small>
      </button>
      <button type="button" className="dash-stat" style={{ "--accent": "#7c3aed" } as React.CSSProperties} onClick={() => p.go("goals")}>
        <span className="dash-stat-top"><span className="mini-label">Active goals</span><span className="dash-chip"><Target size={18}/></span></span>
        {figure(String(activeGoals.length))}
        <small>{p.goals.length - activeGoals.length > 0 ? `${p.goals.length - activeGoals.length} reached` : "Savings targets in progress"}</small>
      </button>
      <button type="button" className="dash-stat" data-negative={net !== null && net < 0} style={{ "--accent": net !== null && net < 0 ? "#b42318" : "#15803d" } as React.CSSProperties} onClick={p.onBudget}>
        <span className="dash-stat-top"><span className="mini-label">Net balance</span><span className="dash-chip"><Wallet size={18}/></span></span>
        {figure(net === null ? "Not set" : money(net))}
        <small>{net === null ? "Add a budget to see this" : "Budget left plus money owed to you"}</small>
      </button>
    </section>

    <div className="dash-actions">
      <button type="button" className="primary-button" onClick={p.onAddExpense}><ArrowUpRight size={18}/> Add expense</button>
      <button type="button" className="outline-button" onClick={p.onAddLoan}><ArrowDownLeft size={18}/> Money lent</button>
      <button type="button" className="outline-button" onClick={p.onExport}><Download size={18}/> Export</button>
    </div>

    <div className="dash-grid">
      <section className="dash-card" aria-labelledby="dash-cat">
        <Head kicker="This week" title="Where it went"/>
        {legend.length ? <>
          <div className="dash-stack" role="img" aria-label={`Spending by category: ${legend.map(item => `${item.name} ${pct(item.amount)} percent`).join(", ")}`}>
            {stacked.map(item => <span key={item.name} tabIndex={0} data-tip={`${item.name}: ${money(item.amount)} (${pct(item.amount)}%)`} style={{ flexGrow: Math.max(item.amount, total * .015), background: item.color }}/>)}
          </div>
          <ul className="dash-legend" id="dash-cat">{legend.map(item => <li key={item.name}>
            <span className="dash-key" style={{ background: item.color }} aria-hidden="true"/>
            <span className="dash-legend-name">{item.name}</span>
            <small className="num">{pct(item.amount)}%</small>
            <b className="num">{money(item.amount)}</b></li>)}</ul></>
          : <Empty title="No spending yet" hint="Your categories will show up here once you add an expense." action="Add expense" onAction={p.onAddExpense}/>}
      </section>

      <section className="dash-card">
        <Head kicker="Utang" title="Who owes me" link="See all" onLink={() => p.go("collect")}/>
        {rows.length ? <ul className="dash-people">{rows.map(([name, r]) => <li key={name}>
          <span className="dash-avatar" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>
          <div><strong>{name}</strong><small>{r.owed > 0 ? "Waiting to be paid" : "All settled"}</small></div>
          <b className="num">{money(r.owed > 0 ? r.owed : r.paid)}</b>
          <span className={`dash-badge ${r.owed > 0 ? "unpaid" : "paid"}`}>{r.owed > 0 ? "Unpaid" : "Paid"}</span></li>)}</ul>
          : <Empty title="Nobody owes you" hint="Lent money to a friend? Record it so you don't forget." action="Record a loan" onAction={p.onAddLoan}/>}
      </section>

      <section className="dash-card">
        <Head kicker="Saving for" title="Goals" link="See goals" onLink={() => p.go("goals")}/>
        {p.goals.length ? <ul className="dash-goals">{p.goals.slice(0, 4).map(g => { const share = Math.min(100, Math.round(g.savedCents / g.targetCents * 100)); const left = Math.max(0, g.targetCents - g.savedCents); return <li key={g.id}>
          <div className="dash-goal-row"><strong>{g.name}</strong><b className="num">{share}%</b></div>
          <span className="dash-track" role="progressbar" aria-label={g.name} aria-valuemin={0} aria-valuemax={100} aria-valuenow={share}><i style={{ width: `${share}%` }}/></span>
          <small className="num">{left ? `${money(left)} to go · ${money(g.savedCents)} saved` : "Goal reached 🎉"}</small></li>; })}</ul>
          : <Empty title="No goals yet" hint="Pick something to save for and track your progress." action="Create a goal" onAction={p.onAddGoal}/>}
      </section>

      <section className="dash-card">
        <Head kicker="Latest" title="Recent activity" link="See all" onLink={() => p.go("activity")}/>
        {p.recent.length ? <ul className="dash-recent">{p.recent.slice(0, 5).map(e => <li key={e.id}>
          <span className={`dash-cat-icon ${e.kind === "loan" ? "lent" : ""}`}>{e.kind === "loan" ? <ArrowDownLeft size={18} aria-hidden="true"/> : <CategoryIcon name={e.category}/>}</span>
          <div><strong>{e.description}</strong><small>{dayLabel(e.date)} · {e.kind === "loan" ? `Lent to ${e.borrower}` : e.category}</small></div>
          <b className="num">{money(e.amountCents)}</b></li>)}</ul>
          : <Empty title="Nothing recorded this week" hint="Add your first expense and it will appear here." action="Add expense" onAction={p.onAddExpense}/>}
      </section>
    </div>
  </div>;
}
