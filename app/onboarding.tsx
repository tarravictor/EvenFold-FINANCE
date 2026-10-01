"use client";

import { useEffect, useState } from "react";

const steps = [
  { selector: ".week-toolbar", title: "Pick a week", detail: "The Tuesday–Saturday dates move forward each week. Use the arrows to revisit another week." },
  { selector: ".summary-grid", title: "See what matters", detail: "Track spending, money to collect, and the budget left for this week." },
  { selector: ".quick-actions", title: "Record and split", detail: "Add an expense or loan, split a bill with friends, or export a report." },
  { selector: ".bottom-nav, .side-nav", title: "Find every tool", detail: "Open Activity, To collect, Insights, and More for bills, goals, splits, and reports." },
];

export function Onboarding({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  useEffect(() => { if (open) setIndex(0); }, [open]);
  useEffect(() => {
    if (!open) return;
    const selector = index === 3 ? (innerWidth < 871 ? ".bottom-nav" : ".side-nav") : steps[index].selector;
    const target = document.querySelector(selector);
    target?.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
    const update = () => {
      setRect(document.querySelector(selector)?.getBoundingClientRect() ?? null);
    };
    const timer = window.setTimeout(update, 260);
    update(); window.addEventListener("resize", update); window.addEventListener("scroll", update, true);
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", escape);
    return () => { window.clearTimeout(timer); window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true); window.removeEventListener("keydown", escape); };
  }, [open, index, onClose]);
  if (!open) return null;
  const top = rect && rect.bottom + 16 < innerHeight - 220 ? rect.bottom + 16 : Math.max(18, (rect?.top ?? 0) - 215);
  return <div className="tour" role="dialog" aria-modal="true" aria-labelledby="tour-title">
    <div className="tour-backdrop" onClick={onClose}/>
    {rect && <div className="tour-highlight" style={{ top: rect.top - 5, left: rect.left - 5, width: rect.width + 10, height: rect.height + 10 }}/>}
    <section className="tour-panel" style={{ top, left: Math.max(16, Math.min((rect?.left ?? 16), innerWidth - 336)) }}>
      <span className="tour-count">QUICK TOUR · {index + 1} OF {steps.length}</span>
      <h2 id="tour-title">{steps[index].title}</h2><p>{steps[index].detail}</p>
      <div className="tour-actions"><button type="button" className="tour-skip" onClick={onClose}>Skip tour</button><button type="button" className="primary-button" onClick={() => index === steps.length - 1 ? onClose() : setIndex(index + 1)}>{index === steps.length - 1 ? "Got it" : "Next"}</button></div>
    </section>
  </div>;
}
