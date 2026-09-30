import { dayLabel, GroupSplit, money } from "./finance-utils";

function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, size: number, weight = 400, color = "#172f34") {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px Arial, Helvetica, sans-serif`;
  ctx.fillText(value, x, y);
}

function short(ctx: CanvasRenderingContext2D, value: string, maxWidth: number) {
  if (ctx.measureText(value).width <= maxWidth) return value;
  let result = value;
  while (result && ctx.measureText(`${result}…`).width > maxWidth) result = result.slice(0, -1);
  return `${result}…`;
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

export async function makeSplitImage(split: GroupSplit, qr?: File): Promise<Blob> {
  const width = 1200;
  const rowHeight = 88;
  const qrHeight = qr ? 420 : 0;
  const height = 600 + split.shares.length * rowHeight + qrHeight;
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image creation is unavailable on this device.");
  ctx.fillStyle = "#f5f8f5"; ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#173f39"; ctx.fillRect(0, 0, width, 26);
  ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.roundRect(56, 62, 1088, height - 125, 30); ctx.fill();
  ctx.fillStyle = "#d8f2b2"; ctx.beginPath(); ctx.roundRect(94, 102, 66, 66, 17); ctx.fill();
  text(ctx, "E", 112, 149, 40, 800, "#173f39");
  text(ctx, "EVENFOLD FINANCE  /  GROUP SPLIT", 183, 127, 19, 800, "#3e7558");
  text(ctx, dayLabel(split.date, { month: "long", day: "numeric", year: "numeric" }), 183, 158, 18, 400, "#647b80");
  ctx.font = "800 44px Arial, Helvetica, sans-serif";
  text(ctx, short(ctx, split.title, 990), 94, 231, 44, 800);
  text(ctx, `Paid by ${split.payer}  ·  ${split.shares.length} people`, 94, 270, 21, 400, "#597078");
  ctx.fillStyle = "#e6f4d8"; ctx.beginPath(); ctx.roundRect(94, 303, 1012, 101, 18); ctx.fill();
  text(ctx, "TOTAL BILL", 119, 342, 17, 800, "#4d715a");
  text(ctx, money(split.totalCents), 119, 382, 36, 800);
  text(ctx, "EACH PERSON'S SHARE", 94, 456, 17, 800, "#4d715a");
  let y = 486;
  for (const share of split.shares) {
    ctx.fillStyle = "#e6ecea"; ctx.fillRect(94, y + 65, 1012, 1);
    ctx.font = "700 23px Arial, Helvetica, sans-serif";
    text(ctx, short(ctx, share.name, 485), 94, y + 24, 23, 700);
    text(ctx, share.name === split.payer ? "Paid upfront" : share.paid ? "Settled" : `Owes ${split.payer}`, 94, y + 51, 17, 400, "#647b80");
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
      ctx.fillStyle = "#eef5ec"; ctx.beginPath(); ctx.roundRect(94, y + 35, 1012, 345, 18); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.roundRect(119, y + 57, 300, 300, 12); ctx.fill();
      const scale = Math.min(270 / image.naturalWidth, 270 / image.naturalHeight);
      const imageWidth = image.naturalWidth * scale, imageHeight = image.naturalHeight * scale;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(image, 269 - imageWidth / 2, y + 207 - imageHeight / 2, imageWidth, imageHeight);
      ctx.imageSmoothingEnabled = true;
      text(ctx, "SCAN TO PAY", 460, y + 159, 19, 800, "#4d715a");
      text(ctx, "Use the QR code supplied", 460, y + 211, 27, 700);
      text(ctx, "by the person receiving payment.", 460, y + 245, 20, 400, "#597078");
    } catch { throw new Error("The QR image could not be read. Choose a PNG, JPG, or WebP image."); }
    finally { if (loaded) URL.revokeObjectURL(loaded.url); }
  }
  text(ctx, "Group split summary · Amounts in Philippine pesos", 94, height - 86, 16, 400, "#78908a");
  return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("The image could not be generated.")), "image/jpeg", .95));
}
