import { useState } from "react";
import { ExternalLink } from "lucide-react";

const formUrl = "https://form.jotform.com/263014382814049";

export function Feedback() {
  const [loaded, setLoaded] = useState(false);
  return <section className="feedback" aria-label="Feedback form">
    <div className="feedback-note">
      <p>Tell us what works, what's confusing, or what you'd like to see next. The form is hosted by Jotform, so your answers go to Jotform and not into your EvenFold records. Please don't enter passwords or financial account numbers.</p>
      <a className="outline-button" href={formUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={16}/> Open in a new tab</a>
    </div>
    {!navigator.onLine && <p className="offline-notice" role="status">You're offline. Reconnect to load the feedback form.</p>}
    <div className="feedback-frame">
      {!loaded && navigator.onLine && <p className="feedback-loading" role="status">Loading form…</p>}
      <iframe title="EvenFold feedback form" src={formUrl} loading="lazy" onLoad={() => setLoaded(true)} sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer" allow="" />
    </div>
  </section>;
}
