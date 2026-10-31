"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, KeyRound, LogOut, Plus, RefreshCw, Share2, Users } from "lucide-react";
import { ago, codePattern, createCircle, inviteLink, joinCircle, leaveCircle, listCircles, pushStatus, readSharing, rotateCode, writeSharing, type Circle, type Member, type Sharing, type Status } from "./circles-client";

type Confirm = (target: { title: string; detail: string; confirmLabel: string; tone?: "danger" | "default"; onConfirm: () => unknown | Promise<unknown> }) => void;
type Props = {
  userId?: string;
  displayName: string;
  inviteCode: string;
  mine: { budgetPct: number | null; goal: { name: string; pct: number } | null; daysLogged: number };
  active: boolean;
  onConfirm: Confirm;
  onNotice: (message: string) => void;
};

function MemberRow({ member, you }: { member: Member; you: boolean }) {
  const s = member.status || {};
  const hasStatus = s.budgetPct !== undefined || s.goal || s.daysLogged !== undefined;
  const pct = s.budgetPct === undefined ? 0 : Math.min(100, s.budgetPct);
  return <li className="circle-member">
    <span className="circle-avatar" aria-hidden="true">{member.display_name.slice(0, 1).toUpperCase()}</span>
    <div className="circle-member-body">
      <strong>{member.display_name}{you && <small> (you)</small>}</strong>
      {hasStatus ? <>
        {s.budgetPct !== undefined && <div className="circle-line"><span className="dash-meter" role="progressbar" aria-label="Weekly budget used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} data-level={s.budgetPct > 100 ? "over" : s.budgetPct >= 80 ? "near" : "ok"}><i style={{ width: `${pct}%` }}/></span><span>{s.budgetPct > 100 ? `Over budget (${s.budgetPct}%)` : `${s.budgetPct}% of weekly budget used`}</span></div>}
        {s.goal && <p>Saving for {s.goal.name}: {s.goal.pct}%</p>}
        {s.daysLogged !== undefined && <p>{s.daysLogged} {s.daysLogged === 1 ? "day" : "days"} logged this week</p>}
        <small className="circle-time">Updated {ago(member.updated_at)}</small>
      </> : <p className="circle-quiet">Not sharing a status right now.</p>}
    </div>
  </li>;
}

export function Circles({ userId, displayName, inviteCode, mine, active, onConfirm, onNotice }: Props) {
  const [circles, setCircles] = useState<Circle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sharing, setSharing] = useState<Sharing>(readSharing);
  const [name, setName] = useState("");
  const [code, setCode] = useState(inviteCode);
  const [nickname, setNickname] = useState(displayName);
  useEffect(() => { if (inviteCode) setCode(inviteCode); }, [inviteCode]);

  const refresh = useCallback(async () => {
    try { setCircles(await listCircles()); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load your circles."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    if (!active) return;
    void refresh();
    const timer = setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 30000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, [active, refresh]);

  const status = useMemo<Status>(() => {
    if (sharing.paused) return {};
    return {
      ...(sharing.budget && mine.budgetPct !== null ? { budgetPct: mine.budgetPct } : {}),
      ...(sharing.goal && mine.goal ? { goal: mine.goal } : {}),
      ...(sharing.days ? { daysLogged: mine.daysLogged } : {}),
    };
  }, [sharing, mine.budgetPct, mine.goal?.name, mine.goal?.pct, mine.daysLogged]);
  const statusKey = JSON.stringify(status);
  const circleKey = circles.map(c => c.id).join(",");
  useEffect(() => {
    if (!userId || !circles.length) return;
    const timer = setTimeout(() => { void pushStatus(circles, userId, status).then(refresh).catch(() => {}); }, 800);
    return () => clearTimeout(timer);
  }, [statusKey, circleKey, userId]);

  function toggle(key: keyof Sharing) { const next = { ...sharing, [key]: !sharing[key] }; setSharing(next); writeSharing(next); }
  async function run(task: () => Promise<unknown>, done: string) {
    setBusy(true); setError("");
    try { await task(); await refresh(); onNotice(done); return true; }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Something went wrong."); return false; }
    finally { setBusy(false); }
  }
  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (await run(() => createCircle(name, nickname), "Circle created")) setName("");
  }
  async function join(event: React.FormEvent) {
    event.preventDefault();
    const clean = code.trim().toUpperCase();
    if (!codePattern.test(clean)) { setError("Invite codes are 8 letters and numbers."); return; }
    if (await run(() => joinCircle(clean, nickname), "You joined the circle")) { setCode(""); history.replaceState(null, "", window.location.pathname + window.location.search); }
  }
  async function share(circle: Circle) {
    const url = inviteLink(circle.code);
    try {
      if (navigator.share) await navigator.share({ title: `Join ${circle.name} on EvenFold`, text: `Join my circle "${circle.name}" on EvenFold. Code: ${circle.code}`, url });
      else { await navigator.clipboard.writeText(url); onNotice("Invite link copied"); }
    } catch (cause) { if ((cause as Error).name !== "AbortError") setError("Could not share. Copy the code instead."); }
  }
  async function copyCode(circle: Circle) {
    try { await navigator.clipboard.writeText(circle.code); onNotice("Code copied"); } catch { setError("Could not copy. Select the code and copy it by hand."); }
  }

  return <div className="circles">
    {error && <div className="error-banner" role="alert">{error}</div>}
    <section className="dash-card circle-privacy" aria-labelledby="circle-privacy-title">
      <h2 id="circle-privacy-title">What your friends see</h2>
      <p>Only the items you pick, as percentages. Amounts, purchases and loans are never shared.</p>
      <div className="circle-toggles">
        <label><input type="checkbox" checked={sharing.budget} disabled={sharing.paused} onChange={() => toggle("budget")}/> Weekly budget used</label>
        <label><input type="checkbox" checked={sharing.days} disabled={sharing.paused} onChange={() => toggle("days")}/> Days logged this week</label>
        <label><input type="checkbox" checked={sharing.goal} disabled={sharing.paused || !mine.goal} onChange={() => toggle("goal")}/> {mine.goal ? `Progress on “${mine.goal.name}”` : "Goal progress (add a goal first)"}</label>
        <label><input type="checkbox" checked={sharing.paused} onChange={() => toggle("paused")}/> Pause sharing everywhere</label>
      </div>
    </section>

    {loading ? <p className="circle-quiet" role="status">Loading your circles…</p> : circles.length === 0 ? <div className="empty-state"><span className="empty-icon"><Users size={23}/></span><strong>No circles yet</strong><p>Create one and invite friends, or join with a code someone sent you.</p></div> : circles.map(circle => <section key={circle.id} className="dash-card circle-card" aria-labelledby={`circle-${circle.id}`}>
      <header className="circle-head">
        <div><h2 id={`circle-${circle.id}`}>{circle.name}</h2><p>{circle.circle_members.length} {circle.circle_members.length === 1 ? "person" : "people"}</p></div>
        <div className="circle-actions">
          <button type="button" className="outline-button" onClick={() => void share(circle)}><Share2 size={16}/> Invite</button>
          <button type="button" className="outline-button" onClick={() => onConfirm({ title: `Leave ${circle.name}?`, detail: "You will stop seeing this circle and your status is removed from it.", confirmLabel: "Leave", tone: "danger", onConfirm: () => run(() => leaveCircle(circle.id), "You left the circle") })}><LogOut size={16}/> Leave</button>
        </div>
      </header>
      <div className="circle-code"><KeyRound size={16} aria-hidden="true"/><span>Invite code</span><code>{circle.code}</code>
        <button type="button" className="icon-control" aria-label={`Copy invite code for ${circle.name}`} onClick={() => void copyCode(circle)}><Copy size={16}/></button>
        {circle.created_by === userId && <button type="button" className="icon-control" aria-label={`Replace invite code for ${circle.name}`} onClick={() => onConfirm({ title: "Replace the invite code?", detail: "The old code and link stop working. People already in the circle stay.", confirmLabel: "Replace code", onConfirm: () => run(() => rotateCode(circle.id), "New invite code ready") })}><RefreshCw size={16}/></button>}
      </div>
      <ul className="circle-members">{[...circle.circle_members].sort((a, b) => Number(b.user_id === userId) - Number(a.user_id === userId) || a.display_name.localeCompare(b.display_name)).map(member => <MemberRow key={member.user_id} member={member} you={member.user_id === userId}/>)}</ul>
    </section>)}

    <div className="circle-forms">
      <label className="circle-nick">Your name in circles<input maxLength={40} value={nickname} onChange={event => setNickname(event.target.value)} autoComplete="nickname"/></label>
      <form className="dash-card form-grid" onSubmit={create}>
        <h2>Create a circle</h2>
        <label>Circle name<input required maxLength={40} placeholder="e.g. Barkada" value={name} onChange={event => setName(event.target.value)}/></label>
        <button className="primary-button" disabled={busy || !nickname.trim()}><Plus size={17}/> Create circle</button>
      </form>
      <form className="dash-card form-grid" onSubmit={join}>
        <h2>Join with a code</h2>
        <label>Invite code<input required maxLength={8} autoCapitalize="characters" autoComplete="off" spellCheck={false} placeholder="8 letters and numbers" value={code} onChange={event => setCode(event.target.value.toUpperCase())}/></label>
        <button className="primary-button" disabled={busy || !nickname.trim()}><Users size={17}/> Join circle</button>
      </form>
    </div>
  </div>;
}
