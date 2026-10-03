export type Entry = { id: string; date: string; kind: "expense" | "loan" | "income"; description: string; category: string; borrower: string | null; amountCents: number; settled: number; source?: { currency: "USD" | "EUR" | "JPY" | "SGD" | "AUD"; amountCents: number; rate: number } };
export type GroupShare = { id: string; splitId: string; name: string; amountCents: number; paid: number };
export type GroupSplit = { id: string; date: string; title: string; totalCents: number; payer: string; shares: GroupShare[] };
export type Bill = { id: string; name: string; amountCents: number; dueDate: string; paid: number };
export type Goal = { id: string; name: string; targetCents: number; savedCents: number };
export const money = (cents: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(cents / 100);
export function addDays(date: string, count: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + count);
  return value.toISOString().slice(0, 10);
}
export function todayInManila() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (type: string) => parts.find(item => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function currentWeekStart() {
  const today = todayInManila();
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  const distance = (weekday - 2 + 7) % 7;
  return addDays(today, -distance);
}
export function monthLabel(start: string) {
  return dayLabel(start, { month: "long", year: "numeric" });
}
export const weekDays = (start: string) => Array.from({ length: 5 }, (_, i) => addDays(start, i));
export function dayLabel(date: string, options: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-PH", { ...options, timeZone: "UTC" });
}
export function weekLabel(start: string) {
  const end = addDays(start, 4);
  const first = dayLabel(start, { month: "short", day: "numeric" });
  const last = start.slice(0, 7) === end.slice(0, 7)
    ? `${Number(end.slice(8, 10))}, ${end.slice(0, 4)}`
    : dayLabel(end, { month: "short", day: "numeric", year: "numeric" });
  return `${first} – ${last}`;
}
