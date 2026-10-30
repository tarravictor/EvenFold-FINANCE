import { Code2, Quote, Sparkles } from "lucide-react";

const stack = ["React 19", "TypeScript", "Vite", "Supabase", "Recharts", "jsPDF", "Tailwind CSS", "Radix UI", "Cloudflare", "GitHub Pages"];

export function About() {
  return (
    <section className="about-card" aria-labelledby="about-title">
      <div className="about-glow" aria-hidden="true" />
      <span className="about-kicker"><Sparkles size={14} aria-hidden="true" /> ABOUT EVENFOLD FINANCE</span>
      <blockquote className="about-quote">
        <Quote size={28} aria-hidden="true" />
        <p id="about-title">Managing your finances doesn’t need to be hard. It just needs an app on your phone.</p>
        <footer>— Victor Tarra, creator</footer>
      </blockquote>
      <p className="about-text">EvenFold FINANCE is a simple, private money tracker for everyday life. Log expenses and loans, split bills with friends, set savings goals, and export clean reports, all from your phone or desktop, even offline.</p>
      <div className="about-grid">
        <div><small>Created by</small><strong>Victor Tarra</strong></div>
        <div><small>Built with</small><strong>Claude Code &amp; Codex</strong></div>
      </div>
      <div className="about-stack">
        <span className="about-stack-title"><Code2 size={14} aria-hidden="true" /> Technologies</span>
        <ul>{stack.map((t) => <li key={t}>{t}</li>)}<li className="is-ai">Claude Code</li><li className="is-ai">Codex</li></ul>
      </div>
      <p className="about-copy">© 2026 EvenFold Finance. All rights reserved.</p>
    </section>
  );
}
