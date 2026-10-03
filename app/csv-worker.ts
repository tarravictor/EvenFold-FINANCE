import Papa from "papaparse";
import { validDate } from "./planner-model";
self.onmessage = (event: MessageEvent<string>) => {
  try {
    const result = Papa.parse(event.data, { header: true, skipEmptyLines: true });
    const fields = ["date", "kind", "description", "category", "borrower", "amount", "settled"];
    if (result.errors.length || result.meta.fields?.length !== fields.length || !fields.every(x => result.meta.fields?.includes(x))) throw new Error("Use the seven columns from an exported CSV: date, kind, description, category, borrower, amount, settled.");
    if (!result.data.length || result.data.length > 5000) throw new Error("Import 1 to 5,000 rows at a time.");
    const entries = result.data.map((row, i) => {
      const fail = () => { throw new Error(`Row ${i + 2}: check the date, type, amount, and required text fields.`); };
      if (!validDate.safeParse(row.date).success || !["expense", "loan"].includes(row.kind) || !/^\d+(\.\d{1,2})?$/.test(row.amount) || Number(row.amount) <= 0 || Number(row.amount) > 10000000 || !["0", "1"].includes(row.settled)) fail();
      if (![row.description, row.category].every(s => s?.trim() && s.length <= 100) || (row.kind === "loan" && (!row.borrower?.trim() || row.borrower.length > 100))) fail();
      return { id: crypto.randomUUID(), date: row.date, kind: row.kind, description: row.description.trim(), category: row.category.trim(), borrower: row.kind === "loan" ? row.borrower.trim() : null, amountCents: Math.round(Number(row.amount) * 100), settled: Number(row.settled) };
    });
    self.postMessage({ entries });
  } catch (error) { self.postMessage({ error: error instanceof Error ? error.message : "Invalid CSV." }); }
};
