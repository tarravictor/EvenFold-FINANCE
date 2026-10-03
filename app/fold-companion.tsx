import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Goal, money } from "./finance-utils";

export function companionState(spent: number, budget: number | null, goals: Goal[]) {
  const savings = goals.reduce((total, goal) => total + goal.savedCents, 0);
  const stage = savings >= 100000000 ? "Legend" : savings >= 10000000 ? "Elder" : savings >= 2500000 ? "Fox" : savings >= 500000 ? "Cub" : "Paper";
  const ratio = budget === null ? null : budget === 0 ? (spent > 0 ? Infinity : 0) : spent / budget;
  const achieved = goals.some(goal => goal.targetCents > 0 && goal.savedCents >= goal.targetCents);
  const mood = ratio === null ? "Ready" : ratio > 1.2 ? "Needs a breather" : ratio > 1 ? "Taking care" : ratio >= 0.8 ? "Mindful" : achieved ? "Celebrating" : "Content";
  const message = ratio === null ? "Set a weekly budget when you're ready. We'll take it one step at a time." : ratio > 1 ? "A busy week happens. Let's review what matters for the next one." : achieved ? "A savings goal reached. That's a moment worth celebrating." : "Small steps count. Your next entry keeps the picture clear.";
  return { savings, stage, mood, message, ratio };
}

function FoldArt({ stage }: { stage: string }) {
  return <svg className="fold-art" viewBox="0 0 240 200" role="img" aria-label={`Fold, your origami companion, ${stage} stage`}>
    <ellipse cx="120" cy="180" rx="70" ry="7" fill="#e1e8e6"/>
    <g className="fold-body">
      <path d="M126 142 208 86 191 165 128 176" fill="#eab954"/>
      <path d="m208 86-17 79-23-28" fill="#faf3d9"/>
      <path d="m66 108 66 0 31 65-90 0" fill="#31978b"/>
      <path d="m91 110 30 58 20-58" fill="#d7eeea"/>
      <path d="M48 30 88 61 142 61 180 30 165 113 114 148 60 113Z" fill="#0f766e"/>
      <path d="m48 30 40 31-30 16m122-47-38 31 30 16" fill="#eab954"/>
      <path d="m60 91 54 57-54-35m105-22-51 57 51-35" fill="#ecf6f2"/>
      <path d="m107 124 14 0-7 8Z" fill="#193d3a"/>
      <path d="m78 94 10 3m52-3-10 3" stroke="#102e2b" strokeWidth="5" strokeLinecap="round"/>
    </g>
  </svg>;
}

export function FoldCompanion({ spent, budget, goals, loading, onAdd }: { spent: number; budget: number | null; goals: Goal[]; loading: boolean; onAdd: () => void }) {
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const state = companionState(spent, budget, goals);
  if (hidden) return <button className="link-button fold-restore" onClick={() => setHidden(false)}>Show Fold companion</button>;
  return <>
    <section className="fold-strip" aria-label="Optional savings companion">
      <FoldArt stage={state.stage}/><div className="fold-copy"><span className="mini-label">YOUR SAVINGS COMPANION</span><h2>Meet Fold.</h2><p>{loading ? "Getting your numbers ready..." : state.message}</p><span className="fold-mood" role="status">{loading ? "Loading" : `${state.stage} / ${state.mood}`}</span></div>
      <div className="fold-actions"><button className="outline-button" onClick={() => setOpen(true)} disabled={loading}>Visit Fold</button><button className="link-button" onClick={() => setHidden(true)}>Hide for now</button></div>
    </section>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="account-dialog fold-dialog"><DialogHeader><DialogTitle>Your companion, Fold</DialogTitle><DialogDescription>A little encouragement, never a judgment of your financial health.</DialogDescription></DialogHeader><FoldArt stage={state.stage}/><p role="status"><strong>{state.stage} / {state.mood}</strong></p><p>{state.message}</p><dl className="fold-stats"><div><dt>Recorded goal savings</dt><dd>{money(state.savings)}</dd></div><div><dt>Selected week's budget used</dt><dd>{state.ratio === null ? "No budget set" : Number.isFinite(state.ratio) ? `${Math.round(state.ratio * 100)}%` : "Above zero budget"}</dd></div></dl><p className="fold-note">Growth follows recorded savings: Cub at PHP 5,000, Fox at PHP 25,000, Elder at PHP 100,000, Legend at PHP 1,000,000. These are playful milestones, not recommended savings targets. Fold never dies or penalizes missed days.</p><button className="primary-button" onClick={() => { setOpen(false); onAdd(); }}>Log an entry</button></DialogContent></Dialog>
  </>;
}
