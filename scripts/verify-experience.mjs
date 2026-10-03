import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import { createServer } from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const root = path.resolve("pages-dist"), base = "/EvenFold-FINANCE/";
const server = createServer(async (req, res) => {
  try {
    const name = decodeURIComponent(new URL(req.url, "http://local").pathname).replace(base, "");
    const file = path.resolve(root, name || "index.html");
    if (!file.startsWith(root + "/")) { res.writeHead(403).end(); return; }
    const body = await fs.readFile(file);
    const ext = path.extname(file);
    res.setHeader("Content-Type", ({ ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json" })[ext] || "application/octet-stream");
    res.end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(4178, "127.0.0.1", resolve));
const browser = await chromium.launch({ headless: true, ...(process.env.TEST_BROWSER ? { executablePath: process.env.TEST_BROWSER } : {}) });
const output = path.resolve("/tmp/evenfold-qa"); await fs.mkdir(output, { recursive: true });
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const seed = { entries: [{ id: uuid(1), date: "2026-10-02", kind: "expense", description: "Lunch with friends and a longer merchant name", category: "Food", borrower: null, amountCents: 18500, settled: 0 }, { id: uuid(2), date: "2026-10-03", kind: "loan", description: "Dinner", category: "Lent money", borrower: "Alex", amountCents: 5000, settled: 0 }], bills: [{ id: uuid(3), name: "Internet", dueDate: "2026-10-08", amountCents: 120000, paid: 0 }], goals: [{ id: uuid(4), name: "Emergency fund", targetCents: 1000000, savedCents: 500000 }], groupSplits: [], budgets: { "2026-09-29": 300000 }, categoryBudgets: { "2026-10": { Food: 500000 } }, recurring: [], debts: [], journal: [] };
const results = [];
try {
  for (const width of [320, 390, 768, 1440]) {
    let state = structuredClone(seed), version = 1;
    const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: "block", bypassCSP: width === 390 });
    await context.addInitScript(() => {
      localStorage.setItem("evenfold-tour-v1", "seen");
      localStorage.setItem("evenfold-session-v1", JSON.stringify({ access_token: "test-not-real", refresh_token: "test-not-real", expires_at: 4102444800, user: { id: "test-owner", email: "test@example.invalid", user_metadata: { full_name: "Victor" } } }));
    });
    await context.route("https://aonoxfezdzwkvuocpelz.supabase.co/**", async route => {
      const request = route.request();
      if (request.method() === "PATCH") {
        const expected = new URL(request.url()).searchParams.get("version");
        if (expected !== `eq.${version}`) { await route.fulfill({ json: [] }); return; }
        const body = request.postDataJSON(); state = body.data; version = body.version;
      }
      await route.fulfill({ json: [{ data: state, version }] });
    });
    const page = await context.newPage(), errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:4178${base}`);
    await page.getByRole("heading", { name: "Your money, in focus." }).waitFor();
    await page.getByText("2 expenses recorded").count();
    await page.screenshot({ path: `${output}/home-${width}.png`, fullPage: true });
    const screens = ["Activity", "Budget", "Fold", "Reports", "Settings", "Recurring", "Debts", "Split bills", "To collect", "Goals", "Bills", "Insights"];
    for (const screen of screens) {
      if (width > 870) await page.getByRole("tab", { name: screen, exact: true }).click();
      else {
        const nav = page.getByRole("navigation", { name: "Main navigation" });
        if (["Activity", "Budget", "Fold"].includes(screen)) await nav.getByRole("button", { name: screen, exact: true }).click();
        else { await nav.getByRole("button", { name: "More", exact: true }).click(); await page.locator(".more-card").filter({ has: page.getByText(screen, { exact: true }) }).click(); }
      }
      await page.waitForTimeout(60);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      assert.equal(overflow, false, `${screen} overflows at ${width}px`);
      if (["Budget", "Fold", "Settings"].includes(screen)) await page.screenshot({ path: `${output}/${screen.toLowerCase()}-${width}.png`, fullPage: true });
      if (width === 390 && ["Budget", "Fold", "Settings"].includes(screen)) {
        if (!await page.evaluate(() => !!window.axe) && process.env.AXE_PATH) await page.addScriptTag({ path: process.env.AXE_PATH });
        if (process.env.AXE_PATH) {
        const violations = await page.evaluate(async () => {
          const result = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] } });
          return result.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => n.target.join(" ")).slice(0, 4) }));
        });
        assert.deepEqual(violations, [], `${screen} accessibility: ${JSON.stringify(violations)}`);
        }
      }
    }
    if (width === 390) {
      const nav = page.getByRole("navigation", { name: "Main navigation" });
      await nav.getByRole("button", { name: "Budget", exact: true }).click();
      await page.getByLabel("Monthly limit (PHP)").fill("1200.50");
      await page.getByRole("button", { name: "Save limit" }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Save budget" }).click();
      await page.waitForTimeout(200);
      assert.equal(state.categoryBudgets["2026-10"].Food, 120050);
      await nav.getByRole("button", { name: "More", exact: true }).click();
      await page.locator(".more-card").filter({ has: page.getByText("Recurring", { exact: true }) }).click();
      const form = page.locator(".planner-form");
      await form.getByLabel("Name").fill("Rent");
      await form.getByLabel("Amount (PHP)").fill("2000");
      await form.getByLabel("Next date").fill("2026-10-03");
      await form.getByRole("button", { name: "Save schedule" }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Save schedule" }).click();
      await page.waitForTimeout(200);
      assert.equal(state.recurring.length, 1);
      await page.getByRole("button", { name: "Record due" }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Record expense" }).click();
      await page.waitForTimeout(200);
      assert.equal(state.entries.filter(x => x.description === "Rent").length, 1);
      await nav.getByRole("button", { name: "More", exact: true }).click();
      await page.locator(".more-card").filter({ has: page.getByText("Reports", { exact: true }) }).click();
      await page.getByRole("button", { name: "Prepare CSV download" }).click();
      await page.getByRole("link", { name: "Download transactions CSV" }).waitFor();
      await page.getByLabel("Import CSV (maximum 2 MB)").setInputFiles({ name: "entries.csv", mimeType: "text/csv", buffer: Buffer.from("date,kind,description,category,borrower,amount,settled\n2026-10-01,expense,Book,School,,20.00,0\n") });
      await page.getByRole("button", { name: "Confirm import" }).click();
      await page.waitForTimeout(150);
      assert.equal(state.entries.find(x => x.description === "Book").amountCents, 2000);
      await page.getByRole("button", { name: "Selected year" }).click();
      await page.getByRole("button", { name: "Generate PDF" }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: /Generate PDF|Create PDF|Confirm/ }).click();
      await page.getByRole("link", { name: /Report ready/ }).waitFor({ timeout: 12000 });
      await nav.getByRole("button", { name: "More", exact: true }).click();
      await page.locator(".more-card").filter({ has: page.getByText("Settings", { exact: true }) }).click();
      await page.getByLabel("Backup passphrase").fill("sufficiently long secret for test");
      await page.getByRole("button", { name: "Create encrypted backup" }).click();
      await page.getByRole("link", { name: "Download encrypted backup" }).waitFor();
      const transfer = page.waitForEvent("download");
      await page.getByRole("link", { name: "Download encrypted backup" }).click();
      const fileDownload = await transfer;
      await fileDownload.saveAs(`${output}/encrypted-backup.json`);
      const encrypted = await fs.readFile(`${output}/encrypted-backup.json`);
      await page.getByLabel("Restore from an encrypted backup").setInputFiles({ name: "backup.json", mimeType: "application/json", buffer: encrypted });
      await page.getByLabel("Backup passphrase").fill("wrong passphrase");
      await page.getByRole("button", { name: "Preview restore" }).click();
      await page.getByText(/Could not open backup/).waitFor();
      await page.getByLabel("Backup passphrase").fill("sufficiently long secret for test");
      await page.getByRole("button", { name: "Preview restore" }).click();
      await page.getByText("Replace your cloud records?").waitFor();
      assert.equal(await page.getByRole("button", { name: "Replace finance records" }).isDisabled(), true);
      const beforeRestore = version;
      await page.getByLabel("Type RESTORE to confirm").fill("RESTORE");
      await page.getByRole("button", { name: "Replace finance records" }).click();
      await page.getByText(/Backup restored/).waitFor();
      assert.equal(version, beforeRestore + 1);
      const settings = page.locator(".settings-stack");
      await settings.getByLabel("Appearance").selectOption("dark");
      await page.screenshot({ path: `${output}/settings-dark-390.png`, fullPage: true });
      assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), "dark");
      await settings.getByLabel("Appearance").selectOption("light");
      await settings.getByLabel("New category").fill("Health");
      await settings.getByRole("button", { name: "Add", exact: true }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Add category" }).click();
      await page.waitForTimeout(120);
      assert.equal(state.customCategories.includes("Health"), true);
      await settings.getByLabel("PHP for 1 unit").fill("56.25");
      await settings.getByRole("button", { name: "Save rate" }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Save rate" }).click();
      await page.waitForTimeout(120);
      assert.equal(state.exchangeRates.USD, 56.25);
      await nav.getByRole("button", { name: "Overview", exact: true }).click();
      await page.getByRole("button", { name: "Add entry", exact: true }).click();
      await page.getByRole("dialog").getByLabel("Merchant or item").fill("Medicine");
      await page.getByRole("dialog").getByLabel("Currency").selectOption("USD");
      await page.getByRole("dialog").getByLabel("Amount (USD)").fill("2");
      await page.getByRole("dialog").getByLabel("Category").selectOption("Health");
      await page.getByRole("dialog").getByRole("button", { name: "Save entry" }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Save entry" }).click();
      await page.waitForTimeout(200);
      assert.equal(state.entries.find(x => x.description === "Medicine").amountCents, 11250);
      assert.equal(state.entries.find(x => x.description === "Medicine").source.currency, "USD");
    }
    assert.deepEqual(errors, [], `Browser errors at ${width}`);
    results.push(`${width}px: 12 views, no horizontal overflow or uncaught errors`);
    await context.close();
  }
  // Service worker and opt-in offline snapshot use a real browser context.
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "allow" });
  await context.addInitScript(() => {
    localStorage.setItem("evenfold-tour-v1", "seen");
    localStorage.setItem("evenfold-session-v1", JSON.stringify({ access_token: "test-not-real", refresh_token: "test-not-real", expires_at: 4102444800, user: { id: "test-owner", email: "test@example.invalid", user_metadata: { full_name: "Victor" } } }));
  });
  await context.route("https://aonoxfezdzwkvuocpelz.supabase.co/**", route => route.fulfill({ json: [{ data: seed, version: 1 }] }));
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:4178${base}`);
  await page.getByRole("heading", { name: "Your money, in focus." }).waitFor();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 12000 });
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: "More" }).click();
  await page.locator(".more-card").filter({ has: page.getByText("Settings", { exact: true }) }).click();
  await page.getByLabel("Offline viewing").click();
  await page.getByText(/Offline viewing enabled/).waitFor();
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("heading", { name: "Your money, in focus." }).waitFor();
  await page.getByText(/You are offline/).waitFor();
  await page.getByText("₱185.00").first().waitFor();
  results.push("Offline app shell and opt-in snapshot: loaded after network loss");
  await context.close();
  console.log(results.join("\n"));
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
