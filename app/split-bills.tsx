"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Download, FileImage, Plus, Trash2, Users } from "lucide-react";
import { dayLabel, GroupSplit, money, todayInManila } from "./finance-utils";
import { makeSplitImage } from "./split-image";

type Props = {
  splits: GroupSplit[];
  saving: boolean;
  loading: boolean;
  error: string;
  onSave: (payload: Record<string, unknown>) => Promise<boolean>;
  onConfirm: (target: { title: string; detail: string; confirmLabel: string; tone?: "danger" | "default"; onConfirm: () => unknown | Promise<unknown> }) => void;
};

export function SplitBills({ splits, saving, loading, error, onSave, onConfirm }: Props) {
  const [title, setTitle] = useState("");
  const [total, setTotal] = useState("");
  const [date, setDate] = useState(todayInManila);
  const [people, setPeople] = useState([""]);
  const [payerIndex, setPayerIndex] = useState(0);
  const [qrFiles, setQrFiles] = useState<Record<string, File>>({});
  const [qrPreviews, setQrPreviews] = useState<Record<string, string>>({});
  const [generated, setGenerated] = useState<Record<string, { url: string; filename: string }>>({});
  const [imageBusy, setImageBusy] = useState<string | null>(null);
  const [imageErrors, setImageErrors] = useState<Record<string, string>>({});
  const objectUrls = useRef(new Set<string>());
  useEffect(() => () => { for (const url of objectUrls.current) URL.revokeObjectURL(url); }, []);

  function release(url?: string) {
    if (url) { URL.revokeObjectURL(url); objectUrls.current.delete(url); }
  }
  function clearGenerated(id: string) {
    release(generated[id]?.url);
    setGenerated(current => { const next = { ...current }; delete next[id]; return next; });
  }
  function selectQr(id: string, file?: File) {
    release(qrPreviews[id]); clearGenerated(id);
    setImageErrors(current => ({ ...current, [id]: "" }));
    if (!file) {
      setQrFiles(current => { const next = { ...current }; delete next[id]; return next; });
      setQrPreviews(current => { const next = { ...current }; delete next[id]; return next; });
      return;
    }
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024) {
      setImageErrors(current => ({ ...current, [id]: "Choose a PNG, JPG, or WebP image under 8 MB." }));
      setQrFiles(current => { const next = { ...current }; delete next[id]; return next; });
      setQrPreviews(current => { const next = { ...current }; delete next[id]; return next; });
      return;
    }
    const url = URL.createObjectURL(file); objectUrls.current.add(url);
    setQrFiles(current => ({ ...current, [id]: file }));
    setQrPreviews(current => ({ ...current, [id]: url }));
  }
  async function generateImage(split: GroupSplit) {
    setImageBusy(split.id); setImageErrors(current => ({ ...current, [split.id]: "" }));
    try {
      const blob = await makeSplitImage(split, qrFiles[split.id]);
      clearGenerated(split.id);
      const url = URL.createObjectURL(blob); objectUrls.current.add(url);
      const safeTitle = split.title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "bill";
      setGenerated(current => ({ ...current, [split.id]: { url, filename: `split-${split.date}-${safeTitle}.jpg` } }));
    } catch (cause) { setImageErrors(current => ({ ...current, [split.id]: cause instanceof Error ? cause.message : "Could not create the image." })); }
    finally { setImageBusy(null); }
  }
  const names = ["You", ...people.map(name => name.trim())];
  const parsedTotal = Number(total);
  const cents = total !== "" && Number.isFinite(parsedTotal) && parsedTotal > 0 ? Math.round(parsedTotal * 100) : 0;
  const youOwe = splits.filter(split => split.payer !== "You").flatMap(split => split.shares.filter(share => share.name === "You" && !share.paid)).reduce((sum, share) => sum + share.amountCents, 0);
  const toCollect = splits.filter(split => split.payer === "You").flatMap(split => split.shares.filter(share => share.name !== "You" && !share.paid)).reduce((sum, share) => sum + share.amountCents, 0);
  const base = Math.floor(cents / names.length);
  const remainder = cents % names.length;
  const shares = names.map((name, index) => ({ name: name || `Person ${index + 1}`, amount: base + (index < remainder ? 1 : 0) }));

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await onSave({ action: "add_split", title, total, date, people, payer: names[payerIndex] })) {
      setTitle(""); setTotal(""); setDate(todayInManila()); setPeople([""]); setPayerIndex(0);
    }
  }

  return <div className="split-layout">
    <section className="surface split-form-card">
      <div className="surface-heading"><div><p className="mini-label">NEW GROUP BILL</p><h2>Split a payment</h2></div><span className="split-icon"><Users size={22}/></span></div>
      <p className="split-intro">Add the total and everyone sharing it. Each person pays an equal share, down to the cent. Splits track repayments separately from spending; record your own share as an expense if you want it in your budget.</p>
      <form className="form-grid" onSubmit={event => void submit(event)}>
        <label>What was the bill for?<input required maxLength={100} value={title} onChange={event => setTitle(event.target.value)} placeholder="e.g. Dinner with friends"/></label>
        <div className="split-two-fields"><label>Total bill (₱)<input required type="number" min="0.01" max="10000000" step="0.01" inputMode="decimal" value={total} onChange={event => setTotal(event.target.value)} placeholder="0.00"/></label><label>Date<input required type="date" value={date} onChange={event => setDate(event.target.value)}/></label></div>
        <div className="split-people-heading"><div><strong>Who is splitting?</strong><span>You are included in the split.</span></div><span>{names.length} people</span></div>
        <div className="split-person-list"><div className="split-person"><span className="split-person-number">1</span><strong>You</strong></div>{people.map((name, index) => <div className="split-person" key={index}><span className="split-person-number">{index + 2}</span><input aria-label={`Person ${index + 2} name`} required maxLength={100} value={name} onChange={event => setPeople(current => current.map((value, i) => i === index ? event.target.value : value))} placeholder={`Friend ${index + 1}`}/>{people.length > 1 && <button type="button" className="delete-button" aria-label={`Remove person ${index + 2}`} onClick={() => { setPeople(current => current.filter((_, i) => i !== index)); setPayerIndex(0); }}><Trash2 size={17}/></button>}</div>)}</div>
        <button type="button" className="outline-button split-add-person" disabled={people.length >= 19} onClick={() => setPeople(current => [...current, ""])}><Plus size={17}/> Add person</button>
        <label>Who paid the whole bill?<select value={payerIndex} onChange={event => setPayerIndex(Number(event.target.value))}>{names.map((name, index) => <option key={index} value={index}>{name || `Person ${index + 1}`}</option>)}</select></label>
        <div className="split-preview" aria-live="polite"><div className="split-preview-top"><span>Split preview</span><strong>{cents ? money(cents) : "₱0.00"}</strong></div>{shares.map((share, index) => <div className="split-preview-row" key={index}><span>{share.name}{index === payerIndex ? " · paid upfront" : ""}</span><b>{money(share.amount)}</b></div>)}<p>{payerIndex === 0 ? "Others owe you their shares after you pay." : `You owe ${names[payerIndex] || "the payer"} your share.`}</p></div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button submit-button" disabled={saving}>{saving ? "Saving…" : "Save group split"}<Check size={18}/></button>
      </form>
    </section>
    <section className="split-history" aria-label="Saved group splits"><div className="split-history-heading"><p className="mini-label">SAVED SPLITS</p><h2>Who owes whom</h2><div className="split-totals"><span>To collect <b>{money(toCollect)}</b></span><span>You owe <b>{money(youOwe)}</b></span></div></div>{splits.length ? splits.map(split => {
      const outstanding = split.shares.filter(share => share.name !== split.payer && !share.paid);
      return <article className="surface split-record" key={split.id}><div className="split-record-head"><div><h3>{split.title}</h3><span>{dayLabel(split.date)} · Paid by {split.payer} · {split.shares.length} people</span></div><strong>{money(split.totalCents)}</strong></div><div className="split-record-status">{outstanding.length ? `${outstanding.length} ${outstanding.length === 1 ? "share" : "shares"} still unpaid` : "All settled"}</div><div className="split-record-shares">{split.shares.map(share => <div className="split-record-share" key={share.id}><div><strong>{share.name}</strong><span>{share.name === split.payer ? "Paid the bill" : share.paid ? "Settled" : share.name === "You" ? `You owe ${split.payer}` : `Owes ${split.payer}`}</span></div><b>{money(share.amountCents)}</b>{share.name !== split.payer && <button type="button" className={share.paid ? "outline-button" : "light-button"} disabled={saving} onClick={() => onConfirm({ title: share.paid ? "Mark this share unpaid?" : share.name === "You" ? "Mark your share paid?" : "Mark this share received?", detail: `${share.name} · ${money(share.amountCents)} for ${split.title}.`, confirmLabel: share.paid ? "Mark unpaid" : share.name === "You" ? "Mark paid" : "Mark received", onConfirm: () => { clearGenerated(split.id); return onSave({ action: "toggle_split_share", id: share.id }); } })}>{share.paid ? "Undo" : share.name === "You" ? "Mark paid" : "Mark received"}</button>}</div>)}</div><div className="split-export"><div className="split-export-heading"><FileImage size={19}/><div><strong>Shareable image</strong><span>Add a payment QR, then create a JPG of this split.</span></div></div><label className="split-qr-picker">Payment QR image (optional)<input type="file" accept="image/png,image/jpeg,image/webp" disabled={imageBusy === split.id} onChange={event => selectQr(split.id, event.target.files?.[0])}/></label>{qrPreviews[split.id] && <div className="split-qr-selected"><img src={qrPreviews[split.id]} alt="Selected payment QR preview"/><span>{qrFiles[split.id]?.name}</span><button type="button" className="outline-button" onClick={() => selectQr(split.id)}>Remove</button></div>}<p className="split-export-note">The QR is used for this image only. Choose it again after reloading the app.</p>{imageErrors[split.id] && <p className="form-error" role="alert">{imageErrors[split.id]}</p>}<button type="button" className="outline-button" disabled={imageBusy === split.id} onClick={() => void generateImage(split)}>{imageBusy === split.id ? "Creating image…" : "Create JPG image"}</button>{generated[split.id] && <div className="split-image-ready"><img src={generated[split.id].url} alt={`Image preview for ${split.title}`}/><a className="primary-button" href={generated[split.id].url} download={generated[split.id].filename}><Download size={17}/> Download JPG</a><small>On iPhone, you can also press and hold the preview to save it.</small></div>}</div><button type="button" className="split-delete" disabled={saving} onClick={() => onConfirm({ title: "Delete this group split?", detail: `${split.title} and its payment statuses will be removed. This cannot be undone.`, confirmLabel: "Delete", tone: "danger", onConfirm: () => { release(qrPreviews[split.id]); clearGenerated(split.id); return onSave({ action: "delete_split", id: split.id }); } })}>Delete split</button></article>;
    }) : <div className="surface empty-state"><span className="empty-icon"><Users size={22}/></span><strong>{loading ? "Loading splits…" : "No group splits yet"}</strong><p>{loading ? "Getting your saved group bills." : "Your saved group bills and payment status will appear here."}</p></div>}</section>
  </div>;
}
