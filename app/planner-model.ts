import { z } from "zod";
export const categories = ["Food", "Coffee", "Groceries", "Transport", "School", "Bills", "Other"];
const cents = z.number().int().min(0).max(1000000000);
export const validDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(d => {
  const t = new Date(d + "T12:00:00Z");
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d;
});
const label = z.string().trim().min(1).max(100);
export const recurringSchema = z.object({ id: z.string().uuid(), name: label, category: label, amountCents: cents.refine(n => n > 0), nextDate: validDate, frequency: z.enum(["weekly", "monthly"]), active: z.boolean() }).strict();
export const debtSchema = z.object({ id: z.string().uuid(), name: label, balanceCents: cents, apr: z.number().min(0).max(100), minimumCents: cents }).strict();
export const plannerShape = {
  petStage: z.number().int().min(0).max(4).default(0),
  customCategories: z.array(z.string().trim().min(1).max(100)).max(50).default([]),
  exchangeRates: z.record(z.enum(["USD", "EUR", "JPY", "SGD", "AUD"]), z.number().positive().max(100000)).default({}),
  categoryBudgets: z.record(z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/), z.record(label, cents)).default({}),
  recurring: z.array(recurringSchema).max(500).default([]),
  debts: z.array(debtSchema).max(500).default([]),
  journal: z.array(z.object({ id: z.string().uuid(), date: validDate, note: z.string().trim().min(1).max(1000) }).strict()).max(1000).default([]),
};
export const plannerSchema = z.object(plannerShape);
export type Planner = z.infer<typeof plannerSchema>;
export const emptyPlanner = (): Planner => ({ petStage: 0, customCategories: [], exchangeRates: {}, categoryBudgets: {}, recurring: [], debts: [], journal: [] });
export function nextOccurrence(date: string, frequency: "weekly" | "monthly") {
  const d = new Date(date + "T12:00:00Z");
  if (frequency === "weekly") d.setUTCDate(d.getUTCDate() + 7);
  else {
    const day = d.getUTCDate();
    d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + 1);
    const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(day, end));
  }
  return d.toISOString().slice(0, 10);
}
