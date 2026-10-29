import { ArrowDownLeft, ArrowRight, ArrowUpRight, Bus, Coffee, GraduationCap, Plus, Receipt, ShoppingBasket, Tag, Target, Users, Utensils, Wallet, type LucideIcon } from "lucide-react";
import { type Bill, dayLabel, type Entry, type Goal, money } from "./finance-utils";

const categoryIcons: Record<string, LucideIcon> = { Food: Utensils, Coffee, Groceries: ShoppingBasket, Transport: Bus, School: GraduationCap, Bills: Receipt };
export const CategoryIcon = ({ name, size = 18 }: { name: string; size?: number }) => { const Icon = categoryIcons[name] || Tag; return <Icon size={size} aria-hidden="true"/>; };

type Share = { share: { name: string; amountCents: number } };
export type DashboardProps = {
  loading: boolean; spent: number; outstanding: number; budgetCents: number | null;
  goals: Goal[]; categories: [string, number][]; recent: Entry[];
  loans: Entry[]; groupToCollect: Share[]; upcomingBills: Bill[]; overdueCount: number;
  go: (view: "collect" | "goals" | "bills" | "insights" | "activity") => void;
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
  const totalCategory = p.categories.reduce((n, [, v]) => n + v, 0) || 1;

  const people = new Map<string, { owed: number; paid: number }>();
  p.loans.forEach(e => { const name = e.borrower || "Unknown"; const row = people.get(name) || { owed: 0, paid: 0 }; if (e.settled) row.paid += e.amountCents; else row.owed += e.amountCents; people.set(name, row); });
  p.groupToCollect.forEach(({ share }) => { const row = people.get(share.name) || { owed: 0, paid: 0 }; row.owed += share.amountCents; people.set(share.name, row); });
  const rows = [...people].sort((a, b) => (b[1].owed > 0 ? 1 : 0) - (a[1].owed > 0 ? 1 : 0) || b[1].owed - a[1].owed).slice(0, 5);
  const figure = (value: string) => <strong className={`dash-figure num${p.loading ? " is-loading" : ""}`}>{p.loading ? "₱0,000" : value}</strong>;

  return <div className="dash">
    <section className="dash-stats" aria-label="This week at a glance">
      <button type="button" className="dash-stat" style={{ "--accent": "#0f766e" } as React.CSSProperties} onClick={p.onBudget}>
        <span className="dash-stat-top"><span className="mini-label">Spent this week</span><span className="dash-chip"><ArrowUpRight size={18}/></span></span>
        {figure(money(p.spent))}
        {hasBudget && !p.loading
          ? <><span className="dash-bar" data-over={used > 1} role="progressbar" aria-label="Weekly budget used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(used * 100))}><i style={{ width: `${Math.min(100, used * 100)}%` }}/></span><small>{Math.round(used * 100)}% of {money(p.budgetCents as number)} budget</small></>
          : <small className="dash-cta">{p.loading ? " " : <>Set a weekly budget <ArrowRight size={14}/></>}</small>}
      </button>
      <button type="button" className="dash-stat" style={{ "--accent": "#2563eb" } as React.CSSProperties} onClick={() => p.go("collect")}>
        <span className="dash-stat-top"><span className="mini-label">Owed to me</span><span className="dash-chip"><Users size={18}/></span></span>
        {figure(money(p.outstanding))}
        <small>{rows.filter(([, r]) => r.owed > 0).length} {rows.filter(([, r]) => r.owed > 0).length === 1 ? "person" : "people"} still to pay</small>
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
    </div>

    <div className="dash-grid">
      <section className="dash-card" aria-labelledby="dash-cat">
        <Head kicker="This week" title="Spending breakdown" link="Insights" onLink={() => p.go("insights")}/>
        {p.categories.length ? <ul className="dash-cats" id="dash-cat">{p.categories.slice(0, 6).map(([name, total], i) => <li key={name}>
          <span className={`dash-cat-icon tone-${i % 6}`}><CategoryIcon name={name}/></span>
          <div><div className="dash-cat-row"><span>{name}</span><b className="num">{money(total)}</b></div>
            <span className="dash-track"><i className={`tone-${i % 6}`} style={{ width: `${Math.max(3, total / totalCategory * 100)}%` }}/></span></div>
          <small className="num">{Math.round(total / totalCategory * 100)}%</small></li>)}</ul>
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
        {p.goals.length ? <ul className="dash-goals">{p.goals.slice(0, 4).map(g => { const pct = Math.min(100, Math.round(g.savedCents / g.targetCents * 100)); const left = Math.max(0, g.targetCents - g.savedCents); return <li key={g.id}>
          <div className="dash-goal-row"><strong>{g.name}</strong><b className="num">{pct}%</b></div>
          <span className="dash-track" role="progressbar" aria-label={g.name} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><i style={{ width: `${pct}%` }}/></span>
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

      <section className="dash-card">
        <Head kicker="Coming up" title="Bills" link="See bills" onLink={() => p.go("bills")}/>
        {p.overdueCount > 0 && <p className="dash-alert">{p.overdueCount} {p.overdueCount === 1 ? "bill is" : "bills are"} overdue.</p>}
        {p.upcomingBills.length ? <ul className="dash-recent">{p.upcomingBills.map(b => <li key={b.id}><span className="dash-cat-icon"><Receipt size={18} aria-hidden="true"/></span><div><strong>{b.name}</strong><small>Due {dayLabel(b.dueDate)}</small></div><b className="num">{money(b.amountCents)}</b></li>)}</ul>
          : p.overdueCount === 0 && <div className="dash-empty"><strong>No bills due</strong><p>You're all caught up.</p></div>}
      </section>
    </div>
  </div>;
}
