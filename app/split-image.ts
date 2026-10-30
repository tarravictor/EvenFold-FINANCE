import { dayLabel, GroupSplit, money } from "./finance-utils";

const FONT = `"Inter", "Plus Jakarta Sans", Arial, Helvetica, sans-serif`;
const MAX_PIXELS = 14_000_000; // stays inside mobile canvas limits (iOS Safari allows ~16.7M)

function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, size: number, weight = 400, color = "#172f34") {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillText(value, x, y);
}

function short(ctx: CanvasRenderingContext2D, value: string, maxWidth: number) {
  if (ctx.measureText(value).width <= maxWidth) return value;
  let result = value;
  while (result && ctx.measureText(`${result}…`).width > maxWidth) result = result.slice(0, -1);
  return `${result}…`;
}

// ctx.roundRect is missing on older iOS/Safari; fall back to arcs.
function drawLogo(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const k = size / 192, at = (px: number, py: number): [number, number] => [x + px * k, y + py * k];
  ctx.fillStyle = "#0f766e"; round(ctx, x, y, size, size, 36 * k); ctx.fill();
  ctx.fillStyle = "#e7f2ec";
  for (const [bx, by, bw, bh] of [[48, 40, 96, 28], [48, 40, 32, 122], [48, 88, 84, 26], [48, 134, 96, 28]]) ctx.fillRect(x + bx * k, y + by * k, bw * k, bh * k);
  ctx.fillStyle = "#eab954"; ctx.beginPath(); ctx.moveTo(...at(116, 40)); ctx.lineTo(...at(144, 68)); ctx.lineTo(...at(144, 40)); ctx.closePath(); ctx.fill();
}
function round(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") { ctx.roundRect(x, y, w, h, r); return; }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

async function loadImage(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return { image, url };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

// Make sure the app fonts are ready, otherwise the canvas silently falls back to Arial.
async function ready() {
  try {
    await Promise.all([400, 700, 800].map(weight => document.fonts.load(`${weight} 24px "Inter"`)));
  } catch { /* fall back to system fonts */ }
}

// Scale a small QR up by a whole number with hard edges, so every square stays the same size,
// then let the final draw smooth only the (tiny) remaining difference.
function crispQr(image: HTMLImageElement, targetPx: number): CanvasImageSource {
  const naturalWidth = image.naturalWidth, naturalHeight = image.naturalHeight;
  if (Math.max(naturalWidth, naturalHeight) >= targetPx) return image;
  const factor = Math.min(Math.ceil(targetPx / Math.max(naturalWidth, naturalHeight)), Math.floor(4096 / Math.max(naturalWidth, naturalHeight)));
  if (factor <= 1) return image;
  const scaled = document.createElement("canvas");
  scaled.width = naturalWidth * factor; scaled.height = naturalHeight * factor;
  const inner = scaled.getContext("2d");
  if (!inner) return image;
  inner.imageSmoothingEnabled = false;
  inner.drawImage(image, 0, 0, scaled.width, scaled.height);
  return scaled;
}

export async function makeSplitImage(split: GroupSplit, qr?: File): Promise<Blob> {
  await ready();
  const width = 1200;
  const rowHeight = 88;
  const qrHeight = qr ? 420 : 0;
  const height = 600 + split.shares.length * rowHeight + qrHeight;
  // Render at 2x (3x on very sharp screens) so text and edges stay crisp when zoomed or printed.
  let scale = (window.devicePixelRatio || 1) >= 3 ? 3 : 2;
  while (scale > 1 && width * scale * height * scale > MAX_PIXELS) scale--;
  const canvas = document.createElement("canvas");
  canvas.width = width * scale; canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image creation is unavailable on this device.");
  ctx.scale(scale, scale);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#f5f8f5"; ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#173f39"; ctx.fillRect(0, 0, width, 26);
  ctx.fillStyle = "#fff"; round(ctx, 56, 62, 1088, height - 125, 30); ctx.fill();
  drawLogo(ctx, 94, 102, 66);
  text(ctx, "EVENFOLD FINANCE  /  GROUP SPLIT", 183, 127, 19, 800, "#3e7558");
  text(ctx, dayLabel(split.date, { month: "long", day: "numeric", year: "numeric" }), 183, 158, 18, 400, "#58706f");
  ctx.font = `800 44px ${FONT}`;
  text(ctx, short(ctx, split.title, 990), 94, 231, 44, 800);
  text(ctx, `Paid by ${split.payer}  ·  ${split.shares.length} people`, 94, 270, 21, 400, "#4f666c");
  ctx.fillStyle = "#e6f4d8"; round(ctx, 94, 303, 1012, 101, 18); ctx.fill();
  text(ctx, "TOTAL BILL", 119, 342, 17, 800, "#3f6350");
  text(ctx, money(split.totalCents), 119, 382, 36, 800);
  text(ctx, "EACH PERSON'S SHARE", 94, 456, 17, 800, "#3f6350");
  let y = 486;
  for (const share of split.shares) {
    ctx.fillStyle = "#e6ecea"; ctx.fillRect(94, y + 65, 1012, 1);
    ctx.font = `700 23px ${FONT}`;
    text(ctx, short(ctx, share.name, 485), 94, y + 24, 23, 700);
    text(ctx, share.name === split.payer ? "Paid upfront" : share.paid ? "Settled" : `Owes ${split.payer}`, 94, y + 51, 17, 400, "#58706f");
    ctx.textAlign = "right";
    text(ctx, money(share.amountCents), 1106, y + 33, 25, 800);
    ctx.textAlign = "left";
    y += rowHeight;
  }
  if (qr) {
    let loaded: { image: HTMLImageElement; url: string } | undefined;
    try {
      loaded = await loadImage(qr);
      const image = loaded.image;
      ctx.fillStyle = "#eef5ec"; round(ctx, 94, y + 35, 1012, 345, 18); ctx.fill();
      ctx.fillStyle = "#fff"; round(ctx, 119, y + 57, 300, 300, 12); ctx.fill();
      const box = 270;
      const fit = Math.min(box / image.naturalWidth, box / image.naturalHeight);
      const imageWidth = image.naturalWidth * fit, imageHeight = image.naturalHeight * fit;
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
      ctx.drawImage(crispQr(image, Math.ceil(Math.max(imageWidth, imageHeight) * scale)), 269 - imageWidth / 2, y + 207 - imageHeight / 2, imageWidth, imageHeight);
      text(ctx, "SCAN TO PAY", 460, y + 159, 19, 800, "#3f6350");
      text(ctx, "Use the QR code supplied", 460, y + 211, 27, 700);
      text(ctx, "by the person receiving payment.", 460, y + 245, 20, 400, "#4f666c");
    } catch { throw new Error("The QR image could not be read. Choose a PNG, JPG, or WebP image."); }
    finally { if (loaded) URL.revokeObjectURL(loaded.url); }
  }
  text(ctx, "Group split summary · Amounts in Philippine pesos", 94, height - 86, 16, 400, "#6b827c");
  // PNG is lossless, so text and QR edges are not smeared by JPEG compression.
  return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("The image could not be generated.")), "image/png"));
}
