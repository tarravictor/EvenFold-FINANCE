export function Loader({ label = "Loading your finances" }: { label?: string }) {
  return <main className="loader" role="status" aria-live="polite" aria-busy="true">
    <div className="loader-mark" aria-hidden="true"><span>E</span><svg viewBox="0 0 100 100"><circle className="loader-track" cx="50" cy="50" r="44"/><circle className="loader-arc" cx="50" cy="50" r="44"/></svg></div>
    <p className="loader-name">EvenFold <b>Finance</b></p>
    <p className="loader-label">{label}<span className="loader-dots" aria-hidden="true"><i/><i/><i/></span></p>
  </main>;
}
