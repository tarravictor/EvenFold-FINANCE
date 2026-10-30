import { addDays, Bill, dayLabel, Entry, Goal, GroupSplit, money, monthLabel, weekLabel } from "./finance-utils";

type Report = { period: "week" | "month" | "year"; weekStart: string; monthStart: string; entries: Entry[]; allLoans: Entry[]; groupSplits: GroupSplit[]; budgetCents: number | null; bills: Bill[]; goals: Goal[] };

/* One layout, two renderers. The layout is described in "units" on a page 1000 units wide.
   - PDF: real vector text (sharp at any zoom, selectable), paginated between rows.
   - JPG: the same layout drawn at 2x resolution on a canvas. */

const C = { ink: "#173129", muted: "#566e67", primary: "#116b52", tint: "#e8f4ed", zebra: "#f5f8f6", line: "#dce9e2", track: "#e3ede7", warn: "#b42318", white: "#ffffff" };
const FONT = `"Inter", "Plus Jakarta Sans", Arial, Helvetica, sans-serif`;
const WIDTH = 1000;
const MAX_PIXELS = 14_000_000;
const MAX_ROWS = 3000;

type Style = { size?: number; weight?: number; color?: string; align?: "left" | "right"; max?: number; shrink?: boolean };
type Op = LogoOp | ({ t: "text"; x: number; y: number; s: string } & Style) | { t: "rect"; x: number; y: number; w: number; h: number; fill: string; r?: number } | { t: "line"; x1: number; y1: number; x2: number; y2: number; color: string };
type LogoOp = { t: "logo"; x: number; y: number; w: number };
type Block = { h: number; ops: Op[] };

const text = (s: string, x: number, y: number, o: Style = {}): Op => ({ t: "text", s, x, y, ...o });
const logo = (x: number, y: number, w: number): Op => ({ t: "logo", x, y, w });
const LOGO = { bg: "#0f766e", mark: "#e7f2ec", gold: "#eab954", bars: [[48, 40, 96, 28], [48, 40, 32, 122], [48, 88, 84, 26], [48, 134, 96, 28]], tri: [[116, 40], [144, 68], [144, 40]] } as const;
const rect = (x: number, y: number, w: number, h: number, fill: string, r?: number): Op => ({ t: "rect", x, y, w, h, fill, r });
const line = (y: number, color = C.line): Op => ({ t: "line", x1: 0, y1: y, x2: WIDTH, y2: y, color });
const shift = (ops: Op[], dy: number): Op[] => ops.map(op => op.t === "line" ? { ...op, y1: op.y1 + dy, y2: op.y2 + dy } : { ...op, y: op.y + dy });
const stack = (...blocks: Block[]): Block => { let h = 0; const ops: Op[] = []; for (const b of blocks) { ops.push(...shift(b.ops, h)); h += b.h; } return { h, ops }; };
const gap = (h: number): Block => ({ h, ops: [] });

function heading(title: string): Block {
  return { h: 64, ops: [text(title, 0, 38, { size: 28, weight: 800, color: C.ink }), line(54, C.primary)] };
}
function section(title: string, rows: Block[], head?: Block): Block[] {
  if (!rows.length) return [];
  const first = stack(gap(28), heading(title), ...(head ? [head] : []), rows[0]);
  return [first, ...rows.slice(1)];
}
function note(message: string): Block { return { h: 56, ops: [text(message, 0, 36, { size: 20, color: C.muted })] }; }
function barRow(label: string, amount: number, max: number, pct?: number): Block {
  const fill = max > 0 ? Math.max(amount > 0 ? 6 : 0, (amount / max) * 330) : 0;
  const ops: Op[] = [text(label, 0, 34, { size: 21, weight: 600, color: C.ink, max: 340 }), rect(370, 20, 330, 14, C.track, 7)];
  if (fill) ops.push(rect(370, 20, fill, 14, C.primary, 7));
  if (pct !== undefined) ops.push(text(`${pct}%`, 780, 34, { size: 20, color: C.muted, align: "right" }));
  ops.push(text(money(amount), WIDTH, 34, { size: 21, weight: 700, color: C.ink, align: "right" }), line(52));
  return { h: 54, ops };
}
function listRow(label: string, detail: string, amount: string): Block {
  return { h: 62, ops: [text(label, 0, 28, { size: 21, weight: 600, color: C.ink, max: 640 }), ...(detail ? [text(detail, 0, 50, { size: 16, color: C.muted, max: 640 })] : []), text(amount, WIDTH, 34, { size: 21, weight: 700, color: C.ink, align: "right" }), line(60)] };
}
function goalRow(name: string, saved: number, target: number): Block {
  const pct = target > 0 ? Math.min(100, Math.round(saved / target * 100)) : 0;
  return { h: 92, ops: [text(name, 0, 30, { size: 21, weight: 600, color: C.ink, max: 520 }), text(`${money(saved)} of ${money(target)}`, WIDTH, 30, { size: 20, weight: 700, color: C.ink, align: "right" }), rect(0, 46, WIDTH, 14, C.track, 7), ...(pct ? [rect(0, 46, Math.max(14, WIDTH * pct / 100), 14, C.primary, 7)] : []), text(`${pct}% saved`, 0, 82, { size: 16, color: C.muted }), text(`${money(Math.max(0, target - saved))} to go`, WIDTH, 82, { size: 16, color: C.muted, align: "right" }), line(90)] };
}
function txRow(e: Entry, index: number): Block {
  const kind = e.kind === "loan" ? `Lent to ${e.borrower || "someone"}${e.settled ? " · Repaid" : " · Not repaid yet"}` : e.category;
  return { h: 66, ops: [...(index % 2 ? [rect(0, 0, WIDTH, 66, C.zebra)] : []), text(dayLabel(e.date, { month: "short", day: "numeric" }), 14, 40, { size: 19, color: C.muted, weight: 500 }), text(e.description, 150, 30, { size: 21, weight: 600, color: C.ink, max: 620 }), text(kind, 150, 54, { size: 16, color: C.muted, max: 620 }), text(money(e.amountCents), WIDTH - 14, 40, { size: 21, weight: 700, color: C.ink, align: "right" })] };
}
const txHead: Block = { h: 44, ops: [text("DATE", 14, 30, { size: 15, weight: 700, color: C.muted }), text("DETAILS", 150, 30, { size: 15, weight: 700, color: C.muted }), text("AMOUNT", WIDTH - 14, 30, { size: 15, weight: 700, color: C.muted, align: "right" }), line(42)] };

function build(data: Report) {
  const expenses = data.entries.filter(e => e.kind === "expense");
  const spent = expenses.reduce((n, e) => n + e.amountCents, 0);
  const rows = [...data.entries].sort((a, b) => a.date.localeCompare(b.date) || a.description.localeCompare(b.description));
  if (rows.length > MAX_ROWS) throw new Error("This report has too many entries. Choose a shorter period or export all transactions as CSV.");
  const openLoans = data.allLoans.filter(e => e.kind === "loan" && !e.settled);
  const groupShares = data.groupSplits.filter(s => s.payer === "You").flatMap(s => s.shares.filter(x => x.name !== "You" && !x.paid).map(share => ({ split: s, share })));
  const groupDebts = data.groupSplits.filter(s => s.payer !== "You").flatMap(s => s.shares.filter(x => x.name === "You" && !x.paid).map(share => ({ split: s, share })));
  const people = new Map<string, number>();
  openLoans.forEach(e => people.set(e.borrower || "Unknown", (people.get(e.borrower || "Unknown") || 0) + e.amountCents));
  groupShares.forEach(({ share }) => people.set(share.name, (people.get(share.name) || 0) + share.amountCents));
  const owed = [...people.values()].reduce((n, v) => n + v, 0);
  const categories = Object.entries(expenses.reduce<Record<string, number>>((t, e) => { t[e.category] = (t[e.category] || 0) + e.amountCents; return t; }, {})).sort((a, b) => b[1] - a[1]);
  const kindName = data.period === "week" ? "Weekly" : data.period === "year" ? "Yearly" : "Monthly";
  const periodName = data.period === "week" ? weekLabel(data.weekStart) : data.period === "year" ? data.monthStart.slice(0, 4) : monthLabel(data.monthStart);
  const generated = new Date().toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Manila" });
  const periods = data.period === "year"
    ? Array.from({ length: 12 }, (_, i) => { const m = `${data.monthStart.slice(0, 4)}-${String(i + 1).padStart(2, "0")}`; return { title: monthLabel(`${m}-01`), amount: expenses.filter(e => e.date.startsWith(m)).reduce((n, e) => n + e.amountCents, 0) }; })
    : data.period === "week"
      ? Array.from({ length: 5 }, (_, i) => { const d = addDays(data.weekStart, i); return { title: dayLabel(d, { weekday: "long", month: "short", day: "numeric" }), amount: expenses.filter(e => e.date === d).reduce((n, e) => n + e.amountCents, 0) }; })
      : (() => { const last = new Date(Date.UTC(Number(data.monthStart.slice(0, 4)), Number(data.monthStart.slice(5, 7)), 0)).getUTCDate(); return Array.from({ length: 5 }, (_, i) => { const from = i * 7 + 1, to = Math.min((i + 1) * 7, last); return { title: from > last ? "" : `Days ${from}–${to}`, amount: expenses.filter(e => { const d = Number(e.date.slice(8, 10)); return d >= from && d <= to; }).reduce((n, e) => n + e.amountCents, 0) }; }).filter(p => p.title); })();
  const periodMax = Math.max(...periods.map(p => p.amount), 0);

  const showBudget = data.period === "week" && data.budgetCents !== null;
  const cards: { label: string; value: string; sub: string; accent?: string; bad?: boolean }[] = [
    { label: "SPENT", value: money(spent), sub: `${expenses.length} ${expenses.length === 1 ? "expense" : "expenses"}`, accent: C.tint },
    { label: "OWED TO ME", value: money(owed), sub: `${people.size} ${people.size === 1 ? "person" : "people"}` },
    { label: "TRANSACTIONS", value: String(rows.length), sub: "In this period" },
    showBudget ? { label: "BUDGET LEFT", value: money((data.budgetCents as number) - spent), sub: `of ${money(data.budgetCents as number)}`, bad: (data.budgetCents as number) - spent < 0 } : { label: "TOP CATEGORY", value: categories[0]?.[0] ?? "None", sub: categories[0] ? money(categories[0][1]) : "No spending yet" },
  ];

  const header: Block = { h: 232, ops: [
    logo(0, 0, 60),
    text("EvenFold Finance", 80, 28, { size: 25, weight: 800, color: C.ink }), text(`${kindName} report`, 80, 54, { size: 18, color: C.muted }),
    text(`Generated ${generated}`, WIDTH, 28, { size: 17, color: C.muted, align: "right" }),
    text(periodName, 0, 142, { size: 50, weight: 800, color: C.ink, max: WIDTH }),
    text("Spending, money owed to you, and savings goals", 0, 184, { size: 21, color: C.muted }),
    line(212, C.line),
  ] };
  const cardBlock: Block = { h: 176, ops: cards.flatMap((c, i): Op[] => { const x = i * 255; return [
    rect(x, 0, 235, 148, c.accent ?? C.zebra, 14), text(c.label, x + 20, 40, { size: 15, weight: 700, color: C.muted }),
    text(c.value, x + 20, 88, { size: 33, weight: 800, color: c.bad ? C.warn : C.ink, max: 198, shrink: true }),
    text(c.sub, x + 20, 126, { size: 16, color: c.bad ? C.warn : C.muted, max: 200 }),
  ]; }) };

  const blocks: Block[] = [header, gap(24), cardBlock];
  blocks.push(...section(data.period === "year" ? "Spending by month" : data.period === "week" ? "Spending by day" : "Spending by week", periods.map(p => barRow(p.title, p.amount, periodMax))));
  blocks.push(...section("Spending by category", categories.length ? categories.map(([name, amount]) => barRow(name, amount, categories[0][1], spent ? Math.round(amount / spent * 100) : 0)) : [note("No spending recorded in this period.")]));
  blocks.push(...section("Transactions", rows.length ? rows.map(txRow) : [note("No entries recorded in this period.")], rows.length ? txHead : undefined));
  blocks.push(...section("Owed to me · current snapshot", [...people].sort((a, b) => b[1] - a[1]).map(([name, amount]) => listRow(name, "", money(amount)))));
  blocks.push(...section("You owe on group bills · current snapshot", groupDebts.map(({ split, share }) => listRow(split.payer, split.title, money(share.amountCents)))));
  blocks.push(...section("Bills · current snapshot", [...data.bills].sort((a, b) => a.dueDate.localeCompare(b.dueDate)).map(b => listRow(b.name, `Due ${dayLabel(b.dueDate)} · ${b.paid ? "Paid" : "Unpaid"}`, money(b.amountCents)))));
  blocks.push(...section("Savings goals · current snapshot", data.goals.map(g => goalRow(g.name, g.savedCents, g.targetCents))));
  blocks.push({ h: 96, ops: [line(24), text("Loans and savings are tracked separately from spending. All amounts are in Philippine pesos (PHP).", 0, 62, { size: 16, color: C.muted })] });
  return { blocks, periodName, generated };
}

/* ---------- JPG: same layout on a high-resolution canvas ---------- */
async function fonts() {
  try { await Promise.all([400, 500, 600, 700, 800].map(w => document.fonts.load(`${w} 20px "Inter"`))); } catch { /* system fonts */ }
}
function fit(ctx: CanvasRenderingContext2D, value: string, max?: number) {
  if (!max || ctx.measureText(value).width <= max) return value;
  let result = value;
  while (result && ctx.measureText(`${result}…`).width > max) result = result.slice(0, -1);
  return `${result}…`;
}
async function toJpg(blocks: Block[]): Promise<Blob> {
  await fonts();
  const pad = 64, total = blocks.reduce((n, b) => n + b.h, 0) + pad * 2, widthUnits = WIDTH + pad * 2;
  let scale = (window.devicePixelRatio || 1) >= 3 ? 3 : 2;
  while (scale > 1 && widthUnits * scale * total * scale > MAX_PIXELS) scale--;
  if (widthUnits * total * scale * scale > MAX_PIXELS) throw new Error("This report is too long for one image. Choose a shorter period, or use the PDF.");
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(widthUnits * scale); canvas.height = Math.round(total * scale);
  const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("Report drawing is unavailable on this device.");
  ctx.scale(scale, scale); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = C.white; ctx.fillRect(0, 0, widthUnits, total);
  ctx.fillStyle = C.primary; ctx.fillRect(0, 0, widthUnits, 12);
  let y = pad;
  for (const block of blocks) {
    for (const op of block.ops) {
      if (op.t === "logo") {
        const k = op.w / 192, ox = pad + op.x, oy = y + op.y;
        ctx.fillStyle = LOGO.bg; ctx.beginPath();
        if (typeof ctx.roundRect === "function") ctx.roundRect(ox, oy, op.w, op.w, 36 * k); else ctx.rect(ox, oy, op.w, op.w);
        ctx.fill();
        ctx.fillStyle = LOGO.mark; for (const [bx, by, bw, bh] of LOGO.bars) ctx.fillRect(ox + bx * k, oy + by * k, bw * k, bh * k);
        ctx.fillStyle = LOGO.gold; ctx.beginPath(); LOGO.tri.forEach(([tx, ty], i) => i ? ctx.lineTo(ox + tx * k, oy + ty * k) : ctx.moveTo(ox + tx * k, oy + ty * k)); ctx.closePath(); ctx.fill();
      } else if (op.t === "rect") {
        ctx.fillStyle = op.fill; ctx.beginPath();
        if (op.r && typeof ctx.roundRect === "function") ctx.roundRect(pad + op.x, y + op.y, op.w, op.h, op.r); else ctx.rect(pad + op.x, y + op.y, op.w, op.h);
        ctx.fill();
      } else if (op.t === "line") {
        ctx.fillStyle = op.color; ctx.fillRect(pad + op.x1, y + op.y1 - .5, op.x2 - op.x1, op.color === C.primary ? 2 : 1);
      } else {
        let size = op.size ?? 20;
        ctx.font = `${op.weight ?? 400} ${size}px ${FONT}`; ctx.fillStyle = op.color ?? C.ink; ctx.textAlign = op.align ?? "left"; ctx.textBaseline = "alphabetic";
        if (op.shrink && op.max) while (size > (op.size ?? 20) * .6 && ctx.measureText(op.s).width > op.max) { size *= .94; ctx.font = `${op.weight ?? 400} ${size}px ${FONT}`; }
        ctx.fillText(fit(ctx, op.s, op.max), pad + op.x, y + op.y);
      }
    }
    y += block.h;
  }
  ctx.textAlign = "left";
  return await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("Could not create the JPG report.")), "image/jpeg", .96));
}

/* ---------- PDF: vector text, paginated between rows ---------- */
// Standard PDF fonts cannot draw the peso sign or characters outside Latin-1, so substitute safely.
const pdfSafe = (value: string) => value.replace(/₱/g, "PHP ").replace(/[^\x20-\x7E -ÿ–—‘’“”•…]/g, "?");
async function toPdf(blocks: Block[], periodName: string, generated: string): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "pt", format: "a4", compress: true });
  const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight();
  const marginX = 36, top = 44, bottom = 52, u = (pw - marginX * 2) / WIDTH;
  const pageUnits = (ph - top - bottom) / u;
  const hex = (color: string) => color;
  const fitPdf = (value: string, max?: number) => {
    if (!max || pdf.getTextWidth(value) <= max * u) return value;
    let result = value;
    while (result && pdf.getTextWidth(`${result}…`) > max * u) result = result.slice(0, -1);
    return `${result}…`;
  };
  const drawOps = (ops: Op[], offsetY: number) => {
    for (const op of ops) {
      if (op.t === "logo") {
        const k = op.w / 192 * u, ox = marginX + op.x * u, oy = top + (offsetY + op.y) * u, size = op.w * u;
        pdf.setFillColor(LOGO.bg); pdf.roundedRect(ox, oy, size, size, 36 * k, 36 * k, "F");
        pdf.setFillColor(LOGO.mark); for (const [bx, by, bw, bh] of LOGO.bars) pdf.rect(ox + bx * k, oy + by * k, bw * k, bh * k, "F");
        pdf.setFillColor(LOGO.gold); const [a, b, c] = LOGO.tri; pdf.triangle(ox + a[0] * k, oy + a[1] * k, ox + b[0] * k, oy + b[1] * k, ox + c[0] * k, oy + c[1] * k, "F");
      } else if (op.t === "rect") {
        pdf.setFillColor(hex(op.fill));
        if (op.r) pdf.roundedRect(marginX + op.x * u, top + (offsetY + op.y) * u, op.w * u, op.h * u, op.r * u, op.r * u, "F");
        else pdf.rect(marginX + op.x * u, top + (offsetY + op.y) * u, op.w * u, op.h * u, "F");
      } else if (op.t === "line") {
        pdf.setDrawColor(hex(op.color)); pdf.setLineWidth(op.color === C.primary ? 1.6 : .6);
        pdf.line(marginX + op.x1 * u, top + (offsetY + op.y1) * u, marginX + op.x2 * u, top + (offsetY + op.y2) * u);
      } else {
        pdf.setFont("helvetica", (op.weight ?? 400) >= 600 ? "bold" : "normal"); pdf.setFontSize((op.size ?? 20) * u); pdf.setTextColor(hex(op.color ?? C.ink));
        const safe = pdfSafe(op.s);
        if (op.shrink && op.max) { let size = (op.size ?? 20) * u; while (size > (op.size ?? 20) * u * .6 && pdf.getTextWidth(safe) > op.max * u) { size *= .94; pdf.setFontSize(size); } }
        const value = fitPdf(safe, op.max);
        pdf.text(value, marginX + op.x * u, top + (offsetY + op.y) * u, { align: op.align ?? "left" });
      }
    }
  };
  const runningHead = () => {
    drawOps([text(`EvenFold Finance · ${periodName}`, 0, 14, { size: 16, weight: 600, color: C.muted }), line(26)], 0);
  };
  let y = 0;
  for (const block of blocks) {
    if (y > 0 && y + block.h > pageUnits) { pdf.addPage(); y = 0; runningHead(); y = 48; }
    drawOps(block.ops, y);
    y += block.h;
  }
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(8); pdf.setTextColor(C.muted);
    pdf.text(pdfSafe(`EvenFold Finance · Generated ${generated}`), marginX, ph - 26);
    pdf.text(`Page ${page} of ${pages}`, pw - marginX, ph - 26, { align: "right" });
  }
  pdf.setProperties({ title: `EvenFold Finance report · ${pdfSafe(periodName)}`, creator: "EvenFold Finance" });
  return pdf.output("blob");
}

export async function downloadReport(data: Report, format: "jpg" | "pdf") {
  const { blocks, periodName, generated } = build(data);
  const filename = `finance-${data.period}-${data.period === "week" ? data.weekStart : data.monthStart}`;
  const blob = format === "jpg" ? await toJpg(blocks) : await toPdf(blocks, periodName, generated);
  return { url: URL.createObjectURL(blob), filename: `${filename}.${format}` };
}
