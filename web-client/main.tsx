import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import Home from "../app/page";
import { LegalDialog, LegalTopic } from "../app/legal";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import "../app/globals.css";
import "../app/experience.css";
import "../app/wallet.css";
import "../app/dashboard.css";
import "../app/screens.css";
import "../app/typography.css";
import "../app/layout.css";
import "../app/polish.css";
import { offlineStore } from "../app/offline-store";

document.documentElement.dataset.theme = "light";
window.addEventListener("beforeinstallprompt", event => { event.preventDefault(); (window as Window & { evenfoldInstall?: Event }).evenfoldInstall = event; });
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => { void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {}); });
}

document.body.classList.add("pages-mode");

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const privacyContact = import.meta.env.VITE_PRIVACY_CONTACT as string | undefined;
const hasPrivacyContact = Boolean(privacyContact && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(privacyContact));
const authRedirectUrl = typeof window !== "undefined" ? new URL(import.meta.env.BASE_URL || "/", window.location.origin).toString() : "";
if (url && key) window.EVENFOLD_CONFIG = { url: url.replace(/\/$/, ""), key };
if (hasPrivacyContact) window.EVENFOLD_PRIVACY_CONTACT = privacyContact;

type SessionUser = { id?: string; email?: string; user_metadata?: { full_name?: string; name?: string } };
type Session = { access_token: string; refresh_token: string; expires_at?: number; expires_in?: number; user?: SessionUser };
const storageKey = "evenfold-session-v1";

function read(): Session | null {
  try { return JSON.parse(localStorage.getItem(storageKey) || "null"); } catch { return null; }
}

function expiry(session: Session) {
  return session.expires_at || Math.floor(Date.now() / 1000) + (session.expires_in || 3600);
}

function displayName(user?: SessionUser) {
  const metadataName = user?.user_metadata?.full_name || user?.user_metadata?.name;
  if (metadataName?.trim()) return metadataName.trim();
  return user?.email?.split("@")[0] || "there";
}

async function auth(path: string, body: unknown, token?: string): Promise<Session> {
  if (!url || !key) throw new Error("Supabase connection is not configured yet.");
  const response = await fetch(`${url.replace(/\/$/, "")}/auth/v1/${path}`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const result = await response.json() as Session & { msg?: string; error_description?: string; message?: string };
  if (!response.ok) throw new Error(result.msg || result.error_description || result.message || "Authentication failed.");
  return result;
}

async function updateAccount(token: string, body: Record<string, unknown>) {
  if (!url || !key) throw new Error("Supabase connection is not configured yet.");
  const response = await fetch(`${url.replace(/\/$/, "")}/auth/v1/user`, {
    method: "PUT",
    headers: { apikey: key, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json() as SessionUser & { user?: SessionUser; msg?: string; error_description?: string; message?: string };
  if (!response.ok) throw new Error(result.msg || result.error_description || result.message || "Account update failed.");
  return result.user || (result.id ? result : undefined);
}

async function deleteAccount(token: string) {
  if (!url || !key) throw new Error("Supabase connection is not configured yet.");
  const response = await fetch(`${url.replace(/\/$/, "")}/functions/v1/delete-account`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ confirm: "DELETE" }),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({})) as { error?: string; message?: string };
    throw new Error(result.error || result.message || "Could not delete your account.");
  }
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [mode, setMode] = useState<"sign-in" | "register" | "reset">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [legal, setLegal] = useState<LegalTopic>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [accountMessage, setAccountMessage] = useState("");
  const [accountBusy, setAccountBusy] = useState<"profile" | "password" | "delete" | null>(null);
  const name = useMemo(() => displayName(session?.user), [session]);

  function save(value: Session | null) {
    const previousOwner = window.EVENFOLD_USER;
    if (!value && previousOwner) void offlineStore(previousOwner, undefined, true).catch(() => {});
    setSession(value);
    window.EVENFOLD_TOKEN = value?.access_token;
    window.EVENFOLD_USER = value?.user?.id;
    if (value) localStorage.setItem(storageKey, JSON.stringify(value));
    else localStorage.removeItem(storageKey);
  }

  useEffect(() => {
    if (!accountOpen) return;
    const currentName = displayName(session?.user);
    setProfileName(currentName === "there" ? "" : currentName);
    setProfileEmail(session?.user?.email || "");
    setNewPassword("");
    setDeleteConfirm("");
    setAccountMessage("");
  }, [accountOpen, session]);

  useEffect(() => {
    let active = true;
    async function restore() {
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const hashError = hash.get("error_description") || hash.get("error");
      const hashSession = hash.get("access_token") && hash.get("refresh_token") ? {
        access_token: hash.get("access_token") || "",
        refresh_token: hash.get("refresh_token") || "",
        expires_at: Number(hash.get("expires_at")) || Math.floor(Date.now() / 1000) + Number(hash.get("expires_in") || 3600),
        expires_in: Number(hash.get("expires_in")) || undefined,
      } : null;
      if (window.location.hash) window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
      if (hashError) { setMessage(hashError); setChecking(false); return; }
      if (hashSession) {
        try {
          const response = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key || "", Authorization: `Bearer ${hashSession.access_token}` } });
          if (!response.ok) throw new Error("Verification session expired. Please sign in again.");
          const user = await response.json() as SessionUser;
          if (active) { save({ ...hashSession, user }); if (hash.get("type") === "recovery") setAccountOpen(true); }
        } catch (error) { setMessage(error instanceof Error ? error.message : "Please sign in again."); }
        setChecking(false); return;
      }
      const old = read();
      if (!old) { setChecking(false); return; }
      if (!navigator.onLine) { save(old); setChecking(false); return; }
      try {
        const next = old.expires_at && Date.now() / 1000 < old.expires_at - 60 ? old : await auth("token?grant_type=refresh_token", { refresh_token: old.refresh_token });
        if (active) save({ ...old, ...next, user: next.user || old.user, expires_at: expiry(next) });
      } catch {
        if (active) save(null);
      }
      if (active) setChecking(false);
    }
    void restore();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!session) return;
    const time = Math.max(1000, ((session.expires_at || 0) * 1000) - Date.now() - 60000);
    const timer = setTimeout(async () => {
      if (!navigator.onLine) return;
      try {
        const next = await auth("token?grant_type=refresh_token", { refresh_token: session.refresh_token });
        save({ ...session, ...next, user: next.user || session.user, expires_at: expiry(next) });
      } catch {
        save(null);
      }
    }, time);
    return () => clearTimeout(timer);
  }, [session]);
  useEffect(() => {
    const refresh = async () => {
      const old = read(); if (!old) return;
      try { const next = await auth("token?grant_type=refresh_token", { refresh_token: old.refresh_token }); save({ ...old, ...next, expires_at: expiry(next) }); }
      catch { setMessage("Session refresh failed. Sign in again when connected."); }
    };
    window.addEventListener("online", refresh);
    return () => window.removeEventListener("online", refresh);
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      if (mode === "reset") {
        await auth(`recover?redirect_to=${encodeURIComponent(authRedirectUrl)}`, { email });
        setMessage("If that email has an account, a reset link is on its way. Open it on this device to set a new password.");
      } else if (mode === "register") {
        if (password.length < 12) throw new Error("Use at least 12 characters for your password.");
        const result = await auth(`signup?redirect_to=${encodeURIComponent(authRedirectUrl)}`, { email, password, data: { full_name: email.split("@")[0] } });
        if (result.access_token) save({ ...result, expires_at: expiry(result) });
        else setMessage("Check your email to confirm your account, then sign in.");
      } else {
        const result = await auth("token?grant_type=password", { email, password });
        save({ ...result, expires_at: expiry(result) });
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    const token = session?.access_token;
    save(null);
    if (token) await auth("logout", {}, token).catch(() => {});
  }

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    if (!session) return;
    setAccountBusy("profile");
    setAccountMessage("");
    try {
      const user = await updateAccount(session.access_token, { email: profileEmail.trim(), data: { full_name: profileName.trim() } });
      save({ ...session, user: user || { ...session.user, email: profileEmail.trim(), user_metadata: { ...(session.user?.user_metadata || {}), full_name: profileName.trim() } } });
      setAccountMessage("Profile updated. If you changed your email, check your inbox to confirm it.");
    } catch (cause) {
      setAccountMessage(cause instanceof Error ? cause.message : "Could not update your profile.");
    } finally {
      setAccountBusy(null);
    }
  }

  async function savePassword(event: React.FormEvent) {
    event.preventDefault();
    if (!session) return;
    setAccountBusy("password");
    setAccountMessage("");
    try {
      if (newPassword.length < 12) throw new Error("Use at least 12 characters for your new password.");
      const user = await updateAccount(session.access_token, { password: newPassword });
      save({ ...session, user: user || session.user });
      setNewPassword("");
      setAccountMessage("Password updated.");
    } catch (cause) {
      setAccountMessage(cause instanceof Error ? cause.message : "Could not update your password.");
    } finally {
      setAccountBusy(null);
    }
  }

  async function deleteUserAccount() {
    if (!session) return;
    setAccountBusy("delete");
    setAccountMessage("");
    try {
      await deleteAccount(session.access_token);
      save(null);
    } catch (cause) {
      setAccountMessage(cause instanceof Error ? cause.message : "Could not delete your account.");
      setAccountBusy(null);
    }
  }

  if (checking) return <main className="auth-page"><div className="auth-card">Loading your account...</div></main>;
  if (session) return <>
    <Home key={session.user?.id || "session"} accountName={name} accountEmail={session.user?.email} onAccount={() => setAccountOpen(true)} onSignOut={() => void signOut()}/>
    <Dialog open={accountOpen} onOpenChange={setAccountOpen}><DialogContent className="account-dialog"><DialogHeader><DialogTitle>Account settings</DialogTitle><DialogDescription>Edit your profile, update your password, or delete your account.</DialogDescription></DialogHeader>
      <form className="form-grid account-section" onSubmit={event => void saveProfile(event)}>
        <h3>Edit information</h3>
        <label>Display name<input required maxLength={80} value={profileName} onChange={event => setProfileName(event.target.value)} placeholder="Your name"/></label>
        <label>Email address<input required type="email" value={profileEmail} onChange={event => setProfileEmail(event.target.value)} placeholder="you@example.com"/></label>
        <button className="primary-button submit-button" disabled={!!accountBusy}>{accountBusy === "profile" ? "Saving..." : "Save profile"}</button>
      </form>
      <form className="form-grid account-section" onSubmit={event => void savePassword(event)}>
        <h3>Change password</h3>
        <label>New password<input type="password" minLength={12} value={newPassword} onChange={event => setNewPassword(event.target.value)} placeholder="At least 12 characters"/></label>
        <button className="outline-button submit-button" disabled={!!accountBusy || !newPassword}>{accountBusy === "password" ? "Updating..." : "Update password"}</button>
      </form>
      <div className="account-section danger-zone">
        <h3>Delete account</h3>
        <p>This permanently deletes your EvenFold account and the finance data linked to it. This cannot be undone.</p>
        <label>Type DELETE to continue<input value={deleteConfirm} onChange={event => setDeleteConfirm(event.target.value)} placeholder="DELETE"/></label>
        <button className="danger-button" disabled={!!accountBusy || deleteConfirm !== "DELETE"} onClick={() => void deleteUserAccount()}>{accountBusy === "delete" ? "Deleting..." : "Delete account"}</button>
      </div>
      {accountMessage && <p className="auth-message" role="status">{accountMessage}</p>}
    </DialogContent></Dialog>
  </>;

  const heading = mode === "register" ? "Create your account" : mode === "reset" ? "Reset your password" : "Welcome back";
  const intro = mode === "reset" ? "Enter your email and we will send you a link to choose a new password." : "Keep your spending, bills, goals, and group shares in one private space.";
  const checks = [["12+ characters", password.length >= 12], ["A number", /\d/.test(password)], ["A letter", /[a-z]/i.test(password)]] as const;
  return <main className="auth-page"><div className="auth-card"><div className="auth-brand"><span className="logo">E</span><span>EvenFold <b>FINANCE</b></span></div><p className="mini-label">YOUR MONEY, IN FOCUS</p><h1>{heading}</h1><p>{intro}</p><form className="form-grid" onSubmit={event => void submit(event)}><label>Email address<input autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"/></label>{mode !== "reset" && <label>Password<span className="password-field"><input autoComplete={mode === "register" ? "new-password" : "current-password"} type={showPassword ? "text" : "password"} minLength={mode === "register" ? 12 : undefined} required value={password} onChange={e => setPassword(e.target.value)} placeholder={mode === "register" ? "At least 12 characters" : "Your password"}/><button type="button" className="password-toggle" aria-pressed={showPassword} onClick={() => setShowPassword(v => !v)}>{showPassword ? "Hide" : "Show"}</button></span></label>}{mode === "register" && <ul className="password-checks" aria-label="Password requirements">{checks.map(([label, ok]) => <li key={label} data-ok={ok}>{ok ? "✓" : "○"} {label}</li>)}</ul>}{mode === "register" && <label className="auth-consent"><input type="checkbox" required checked={accepted} onChange={e => setAccepted(e.target.checked)}/><span>I have read the <button type="button" onClick={() => setLegal("privacy")}>privacy notice</button> and agree to the <button type="button" onClick={() => setLegal("terms")}>terms and conditions</button>.</span></label>}<p role="status" aria-live="polite" className={message ? "auth-message" : "sr-only"}>{message}</p><button className="primary-button" disabled={busy || !url || !key || (mode === "register" && !checks.every(c => c[1]))}>{busy ? "Please wait..." : mode === "register" ? "Create account" : mode === "reset" ? "Send reset link" : "Sign in"}</button></form><div className="auth-links">{mode === "sign-in" && <button type="button" onClick={() => { setMode("reset"); setMessage(""); }}>Forgot your password?</button>}<button type="button" onClick={() => { setMode(mode === "sign-in" ? "register" : "sign-in"); setMessage(""); }}>{mode === "sign-in" ? "New here? Create an account" : mode === "register" ? "Already have an account? Sign in" : "Back to sign in"}</button></div>{(!url || !key) && <p className="form-error">Configure a Supabase project to enable accounts.</p>}<footer className="auth-footer"><span>Developed by Victor Tarra &amp; Codex</span><button type="button" onClick={() => setLegal("privacy")}>Privacy · RA 10173</button><button type="button" onClick={() => setLegal("terms")}>Terms</button></footer></div><LegalDialog topic={legal} onClose={() => setLegal(null)}/></main>;
}

createRoot(document.getElementById("root")!).render(<App/>);
