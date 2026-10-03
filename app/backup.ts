import { z } from "zod";

const text = z.string().trim().min(1).max(100);
const id = z.string().uuid();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
});
const cents = z.number().int().min(0).max(1000000000);
const flag = z.union([z.literal(0), z.literal(1)]);
const entry = z.object({ id, date, kind: z.enum(["expense", "loan", "income"]), description: text, category: text, borrower: text.nullable(), amountCents: cents, settled: flag }).strict();
const bill = z.object({ id, name: text, amountCents: cents, dueDate: date, paid: flag }).strict();
const goal = z.object({ id, name: text, targetCents: cents.refine(n => n > 0), savedCents: cents }).strict();
const share = z.object({ id, splitId: id, name: text, amountCents: cents, paid: flag }).strict();
const split = z.object({ id, date, title: text, totalCents: cents, payer: text, shares: z.array(share).min(2).max(20) }).strict().refine(s => s.shares.every(x => x.splitId === s.id) && s.shares.some(x => x.name === s.payer) && s.shares.reduce((n, x) => n + x.amountCents, 0) === s.totalCents && new Set(s.shares.map(x => x.name.toLowerCase())).size === s.shares.length, "Invalid split totals or participants");
export const backupSchema = z.object({ entries: z.array(entry).max(20000), bills: z.array(bill).max(5000), goals: z.array(goal).max(5000), groupSplits: z.array(split).max(5000), budgets: z.record(date.refine(d => new Date(`${d}T12:00:00Z`).getUTCDay() === 2), cents) }).strict().refine(s => {
  const ids = [...s.entries, ...s.bills, ...s.goals, ...s.groupSplits, ...s.groupSplits.flatMap(x => x.shares)].map(x => x.id);
  return new Set(ids).size === ids.length;
}, "Duplicate record identifiers");
export type BackupData = z.infer<typeof backupSchema>;
const maxBytes = 5 * 1024 * 1024;
const envelope = z.object({ format: z.literal("evenfold-encrypted"), version: z.literal(1), salt: z.array(z.number().int().min(0).max(255)).length(16), iv: z.array(z.number().int().min(0).max(255)).length(12), data: z.string().max(maxBytes) }).strict();
async function derive(passphrase: string, salt: Uint8Array<ArrayBuffer>) {
  if (passphrase.length < 12 || passphrase.length > 256) throw new Error("Use a passphrase of 12 to 256 characters.");
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 600000, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
export async function encryptBackup(data: unknown, passphrase: string) {
  const plain = new TextEncoder().encode(JSON.stringify(backupSchema.parse(data)));
  if (plain.length > 3500000) throw new Error("This backup exceeds the supported size.");
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await derive(passphrase, salt), plain));
  let binary = "";
  for (const byte of encrypted) binary += String.fromCharCode(byte);
  return JSON.stringify({ format: "evenfold-encrypted", version: 1, salt: [...salt], iv: [...iv], data: btoa(binary) });
}
export async function decryptBackup(source: string, passphrase: string): Promise<BackupData> {
  if (new TextEncoder().encode(source).length > maxBytes) throw new Error("Backup must be smaller than 5 MB.");
  try {
    const parsed = envelope.parse(JSON.parse(source));
    const bytes = Uint8Array.from(atob(parsed.data), c => c.charCodeAt(0));
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(parsed.iv) }, await derive(passphrase, new Uint8Array(parsed.salt)), bytes);
    return backupSchema.parse(JSON.parse(new TextDecoder().decode(plain)));
  } catch { throw new Error("Could not open backup. Check the passphrase and file; no data was changed."); }
}
