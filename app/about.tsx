const stack = ["React 19", "TypeScript", "Vite", "Supabase", "Recharts", "jsPDF", "Tailwind CSS", "Radix UI", "Cloudflare", "GitHub Pages"];

export function About() {
  return (
    <section className="about-card" aria-labelledby="about-title">
      <div className="about-head">
        <img src={`${import.meta.env.BASE_URL}app-icon.svg`} alt="EvenFold Finance logo" width={40} height={40}/>
        <span><b>About EvenFold FINANCE</b><small>Created by Victor Tarra · Built with Claude Code &amp; Codex</small></span>
      </div>
      <blockquote className="about-quote">
        <p id="about-title">“Your money. Your moves. Your control. Make every peso count.”</p>
        <footer>— Victor Tarra, Creator</footer>
      </blockquote>
      <ul className="about-stack">{stack.map((t) => <li key={t}>{t}</li>)}<li className="is-ai">Claude Code</li><li className="is-ai">Codex</li></ul>
      <p className="about-copy">© 2026 EvenFold Finance. All rights reserved.</p>
    </section>
  );
}
