import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Goal, money, type Entry, todayInManila, addDays } from "./finance-utils";
import { preference, setPreference } from "./device-settings";
import type { Planner } from "./planner-model";

export function companionState(spent: number, budget: number | null, goals: Goal[]) {
  const savings = goals.reduce((total, goal) => total + goal.savedCents, 0);
  const stage = savings >= 100000000 ? "Legend" : savings >= 10000000 ? "Elder" : savings >= 2500000 ? "Fox" : savings >= 500000 ? "Cub" : "Paper";
  const ratio = budget === null ? null : budget === 0 ? (spent > 0 ? Infinity : 0) : spent / budget;
  const achieved = goals.some(goal => goal.targetCents > 0 && goal.savedCents >= goal.targetCents);
  const mood = ratio === null ? "Ready" : ratio > 1.2 ? "Needs a breather" : ratio > 1 ? "Taking care" : ratio >= 0.8 ? "Mindful" : achieved ? "Celebrating" : "Content";
  const message = ratio === null ? "Set a weekly budget when you're ready. We'll take it one step at a time." : ratio > 1 ? "A busy week happens. Let's review what matters for the next one." : achieved ? "A savings goal reached. That's a moment worth celebrating." : "Small steps count. Your next entry keeps the picture clear.";
  return { savings, stage, mood, message, ratio };
}

export function FoldArt({ stage }: { stage: string }) {
  return <svg className="fold-art" viewBox="0 0 240 200" role="img" aria-label={`Fold, your origami companion, ${stage} stage`}>
    <ellipse cx="120" cy="180" rx="70" ry="7" fill="#e1e8e6"/>
    {stage === "Paper" ? <g className="fold-body"><path d="m120 30 74 74-74 74-74-74Z" fill="#0f766e"/><path d="m46 104 74 0 0 74Z" fill="#9dd5c6"/><circle cx="104" cy="96" r="4"/><circle cx="136" cy="96" r="4"/><path d="m109 117 11 7 11-7" fill="none" stroke="#173e3a" strokeWidth="4"/></g> : <g className="fold-body">
      <path d="M126 142 208 86 191 165 128 176" fill="#eab954"/>
      <path d="m208 86-17 79-23-28" fill="#faf3d9"/>
      <path d="m66 108 66 0 31 65-90 0" fill="#31978b"/>
      <path d="m91 110 30 58 20-58" fill="#d7eeea"/>
      <path d="M48 30 88 61 142 61 180 30 165 113 114 148 60 113Z" fill="#0f766e"/>
      <path d="m48 30 40 31-30 16m122-47-38 31 30 16" fill="#eab954"/>
      <path d="m60 91 54 57-54-35m105-22-51 57 51-35" fill="#ecf6f2"/>
      <path d="m107 124 14 0-7 8Z" fill="#193d3a"/>
      <path d="m78 94 10 3m52-3-10 3" stroke="#102e2b" strokeWidth="5" strokeLinecap="round"/>
      {(stage === "Elder" || stage === "Legend") && <path d="m87 59 12-18 15 16 15-16 12 18Z" fill="#eab954"/>}
      {stage === "Legend" && <path d="m30 95 5 10 10 5-10 5-5 10-5-10-10-5 10-5m169-81 5 10 10 5-10 5-5 10-5-10-10-5 10-5" fill="#eab954"/>}
    </g>}
  </svg>;
}

export function FoldCompanion({ spent, budget, goals, loading, onAdd, full = false, entries = [], journal = [], onSave }: { spent: number; budget: number | null; goals: Goal[]; loading: boolean; onAdd: () => void; full?: boolean; entries?: Entry[]; journal?: Planner["journal"]; onSave?: (p: Record<string, unknown>) => Promise<boolean> }) {
  const key = `pet-hidden-${typeof window !== "undefined" ? window.EVENFOLD_USER || "local" : "local"}`;
  const [hidden, setHidden] = useState(() => preference(key) === "yes");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [visible, setVisible] = useState(true);
  useEffect(() => { const update = () => setVisible(!document.hidden); document.addEventListener("visibilitychange", update); return () => document.removeEventListener("visibilitychange", update); }, []);
  useEffect(() => { if (playing) { const timer = setTimeout(() => setPlaying(false), 1400); return () => clearTimeout(timer); } }, [playing]);
  const [open, setOpen] = useState(false);
  const state = companionState(spent, budget, goals);
  const dates = new Set(entries.map(e => e.date).filter(d => d <= todayInManila()));
  let streak = 0, cursor = dates.has(todayInManila()) ? todayInManila() : addDays(todayInManila(), -1);
  while (dates.has(cursor)) { streak++; cursor = addDays(cursor, -1); }
  const stages = ["Paper", "Cub", "Fox", "Elder", "Legend"];
  const streakStage = streak >= 365 ? 4 : streak >= 90 ? 3 : streak >= 30 ? 2 : streak >= 7 ? 1 : 0;
  state.stage = stages[Math.max(stages.indexOf(state.stage), streakStage)];
  function hide(value: boolean) { setHidden(value); try { setPreference(key, value ? "yes" : "no"); } catch {} }
  if (full) return <div className="pet-home"><section className={`pet-stage ${playing && visible ? "is-playing" : ""}`}><span className="mini-label">{state.stage.toUpperCase()} / {state.mood.toUpperCase()}</span><FoldArt stage={state.stage}/><h2>Every small step counts.</h2><p>{state.message}</p><div className="pet-buttons"><button className="primary-button" onClick={onAdd}>Feed with an entry</button><button className="outline-button" disabled={playing} onClick={() => setPlaying(true)}>Play with Fold</button></div><p role="status">{playing ? "Fold is happy to spend a moment with you." : "Fold never dies. Taking a break is always okay."}</p></section><section className="pet-details"><h2>Your journey</h2><dl className="pet-stats"><div><dt>Goal savings</dt><dd>{money(state.savings)}</dd></div><div><dt>Logging streak</dt><dd>{streak} days</dd></div><div><dt>Days with entries</dt><dd>{dates.size}</dd></div><div><dt>Today</dt><dd>{dates.has(todayInManila()) ? "Fed" : "Ready for a note"}</dd></div></dl><p className="section-description">Growth uses recorded savings or a 7 / 30 / 90 / 365-day logging streak. These are playful milestones, not financial targets.</p><label className="setting-toggle"><input type="checkbox" checked={!hidden} onChange={e => hide(!e.target.checked)}/> Show companion on Overview</label><form className="form-grid" onSubmit={async e => { e.preventDefault(); if (!onSave) return; setBusy(true); try { if (await onSave({ action: "journal_add", date: todayInManila(), note })) setNote(""); } finally { setBusy(false); } }}><label>Money journal<textarea required maxLength={1000} value={note} onChange={e => setNote(e.target.value)} placeholder="Something you noticed about spending today..."/></label><button className="outline-button" disabled={busy || !note.trim()}>Save reflection</button></form><div className="journal-list">{journal.slice(0, 10).map(item => <article key={item.id}><small>{item.date}</small><p>{item.note}</p></article>)}</div></section></div>;
  if (hidden) return <button className="link-button fold-restore" onClick={() => hide(false)}>Show Fold companion</button>;
  return <>
    <section className="fold-strip" aria-label="Optional savings companion">
      <FoldArt stage={state.stage}/><div className="fold-copy"><span className="mini-label">YOUR SAVINGS COMPANION</span><h2>Meet Fold.</h2><p>{loading ? "Getting your numbers ready..." : state.message}</p><span className="fold-mood" role="status">{loading ? "Loading" : `${state.stage} / ${state.mood}`}</span></div>
      <div className="fold-actions"><button className="outline-button" onClick={() => setOpen(true)} disabled={loading}>Visit Fold</button><button className="link-button" onClick={() => hide(true)}>Hide companion</button></div>
    </section>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="account-dialog fold-dialog"><DialogHeader><DialogTitle>Your companion, Fold</DialogTitle><DialogDescription>A little encouragement, never a judgment of your financial health.</DialogDescription></DialogHeader><FoldArt stage={state.stage}/><p role="status"><strong>{state.stage} / {state.mood}</strong></p><p>{state.message}</p><dl className="fold-stats"><div><dt>Recorded goal savings</dt><dd>{money(state.savings)}</dd></div><div><dt>Selected week's budget used</dt><dd>{state.ratio === null ? "No budget set" : Number.isFinite(state.ratio) ? `${Math.round(state.ratio * 100)}%` : "Above zero budget"}</dd></div></dl><p className="fold-note">Growth follows recorded savings: Cub at PHP 5,000, Fox at PHP 25,000, Elder at PHP 100,000, Legend at PHP 1,000,000. These are playful milestones, not recommended savings targets. Fold never dies or penalizes missed days.</p><button className="primary-button" onClick={() => { setOpen(false); onAdd(); }}>Log an entry</button></DialogContent></Dialog>
  </>;
}
