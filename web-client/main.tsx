import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import Home from "../app/page";
import { LegalDialog, LegalTopic } from "../app/legal";
import "../app/globals.css";

document.body.classList.add("pages-mode");

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const privacyContact = import.meta.env.VITE_PRIVACY_CONTACT as string | undefined;
const hasPrivacyContact = Boolean(privacyContact && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(privacyContact));
if (url && key) window.EVENFOLD_CONFIG = { url: url.replace(/\/$/, ""), key };
if (hasPrivacyContact) window.EVENFOLD_PRIVACY_CONTACT = privacyContact;
type Session = { access_token: string; refresh_token: string; expires_at?: number; expires_in?: number; user?: { email?: string } };
const storageKey = "evenfold-session-v1";
function read(): Session | null { try { return JSON.parse(localStorage.getItem(storageKey) || "null"); } catch { return null; } }
async function auth(path: string, body: unknown, token?: string): Promise<Session> {
  if (!url || !key) throw new Error("Supabase connection is not configured yet.");
  const response = await fetch(`${url.replace(/\/$/, "")}/auth/v1/${path}`, { method: "POST", headers: { apikey: key, "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  const result = await response.json() as Session & { msg?: string; error_description?: string; message?: string }; if (!response.ok) throw new Error(result.msg || result.error_description || result.message || "Authentication failed."); return result;
}
function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [mode, setMode] = useState<"sign-in" | "register">("sign-in");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [legal, setLegal] = useState<LegalTopic>(null);
  function save(value: Session | null) { setSession(value); window.EVENFOLD_TOKEN = value?.access_token; if (value) localStorage.setItem(storageKey, JSON.stringify(value)); else localStorage.removeItem(storageKey); }
  useEffect(() => {
    let active = true;
    async function restore() {
      const old = read(); if (!old) { setChecking(false); return; }
      try { const next = old.expires_at && Date.now() / 1000 < old.expires_at - 60 ? old : await auth("token?grant_type=refresh_token", { refresh_token: old.refresh_token }); if (active) save({ ...next, expires_at: next.expires_at || Math.floor(Date.now()/1000) + (next.expires_in || 3600) }); }
      catch { if (active) save(null); }
      if (active) setChecking(false);
    }
    void restore(); return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!session) return;
    const time = Math.max(1000, ((session.expires_at || 0) * 1000) - Date.now() - 60000);
    const timer = setTimeout(async () => { try { const next = await auth("token?grant_type=refresh_token", { refresh_token: session.refresh_token }); save({ ...next, expires_at: next.expires_at || Math.floor(Date.now()/1000) + (next.expires_in || 3600) }); } catch { save(null); } }, time);
    return () => clearTimeout(timer);
  }, [session]);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      if (mode === "register") {
        if (password.length < 8) throw new Error("Use at least 8 characters for your password.");
        const result = await auth("signup", { email, password });
        if (result.access_token) save({ ...result, expires_at: result.expires_at || Math.floor(Date.now()/1000)+(result.expires_in || 3600) });
        else setMessage("Check your email to confirm your account, then sign in.");
      } else { const result = await auth("token?grant_type=password", { email, password }); save({ ...result, expires_at: result.expires_at || Math.floor(Date.now()/1000)+(result.expires_in || 3600) }); }
    } catch (e) { setMessage(e instanceof Error ? e.message : "Please try again."); }
    finally { setBusy(false); }
  }
  async function signOut() { const token = session?.access_token; save(null); if (token) await auth("logout", {}, token).catch(() => {}); }
  if (checking) return <main className="auth-page"><div className="auth-card">Loading your account…</div></main>;
  if (session) return <><div className="account-bar"><span>{session.user?.email || "Signed in"}</span><button onClick={() => void signOut()}>Sign out</button></div><Home/></>;
  return <main className="auth-page"><div className="auth-card"><div className="auth-brand"><span className="logo">E</span><span>EvenFold <b>FINANCE</b></span></div><p className="mini-label">YOUR MONEY, IN FOCUS</p><h1>{mode === "register" ? "Create your account" : "Welcome back"}</h1><p>Keep your spending, bills, goals, and group shares in one private space.</p><form className="form-grid" onSubmit={event => void submit(event)}><label>Email address<input autoComplete="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"/></label><label>Password<input autoComplete={mode === "register" ? "new-password" : "current-password"} type="password" minLength={mode === "register" ? 8 : undefined} required value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password"/></label>{mode === "register" && <label className="auth-consent"><input type="checkbox" required checked={accepted} onChange={e => setAccepted(e.target.checked)}/><span>I have read the <button type="button" onClick={() => setLegal("privacy")}>privacy notice</button> and agree to the <button type="button" onClick={() => setLegal("terms")}>terms and conditions</button>.</span></label>}{message && <p role="status" className="auth-message">{message}</p>}<button className="primary-button" disabled={busy || !url || !key}>{busy ? "Please wait…" : mode === "register" ? "Create account" : "Sign in"}</button></form><div className="auth-links"><button onClick={() => { setMode(mode === "register" ? "sign-in" : "register"); setMessage(""); }}>{mode === "register" ? "Already have an account? Sign in" : "New here? Create an account"}</button></div>{(!url || !key) && <p className="form-error">Configure a Supabase project to enable accounts.</p>}{!hasPrivacyContact && <p className="auth-message">Privacy contact can be added later in the app settings.</p>}<footer className="auth-footer"><span>Developed by Victor Tarra &amp; Codex</span><button onClick={() => setLegal("privacy")}>Privacy · RA 10173</button><button onClick={() => setLegal("terms")}>Terms</button></footer></div><LegalDialog topic={legal} onClose={() => setLegal(null)}/></main>;
}

createRoot(document.getElementById("root")!).render(<App/>);
