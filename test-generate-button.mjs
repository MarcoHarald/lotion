/**
 * Run: npx playwright test test-generate-button.mjs  (from lotion dir)
 * Requires dev server at http://localhost:5173/
 */
import { chromium } from "playwright";

const consoleLogs = [];
const url = "http://localhost:5173/";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

page.on("console", (msg) => {
  const type = msg.type();
  const text = msg.text();
  consoleLogs.push({ type, text });
});

page.on("pageerror", (err) => {
  consoleLogs.push({ type: "pageerror", text: err.message, stack: err.stack });
});

try {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
} catch (e) {
  console.error("Failed to load page:", e.message);
  process.exit(1);
}

// Find textarea and button
const textarea = page.locator('textarea[placeholder*="geopolitical"]');
const button = page.locator('button:has-text("Generate consequences")');

await textarea.fill("Iran Hormuz mining");
await button.click();

// Wait for request to complete (function can take 1–2 min) or 90s max
console.log("Waiting up to 90s for Generate to finish...");
await page.waitForTimeout(90000);

// See if button is enabled again (request finished)
const btnDisabled = await page.locator('button:has-text("Generate"), button:has-text("Generating")').first().getAttribute("disabled");
console.log("Button disabled after wait:", btnDisabled);

const errors = consoleLogs.filter((e) => e.type === "error" || e.type === "pageerror");
const all = consoleLogs.map((e) => `[${e.type}] ${e.text}`);

console.log("--- CONSOLE OUTPUT ---");
all.forEach((line) => console.log(line));
console.log("\n--- ERRORS ONLY ---");
errors.forEach((e) => console.log(JSON.stringify(e, null, 2)));

// Check if error message appears in UI
const errEl = await page.locator('[class*="red"], :text("error"), :text("Error")').first();
const uiError = await errEl.textContent().catch(() => null);
if (uiError) console.log("\n--- UI ERROR ---\n", uiError);

await browser.close();
process.exit(errors.length > 0 ? 1 : 0);
