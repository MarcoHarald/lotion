/**
 * Capture README screenshots of the running UI (demo scenario).
 * Usage: npm run screenshots
 */
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "docs", "screenshots");
const port = 5173;
const url = `http://127.0.0.1:${port}/`;

await mkdir(outDir, { recursive: true });

const server = spawn("npx", ["vite", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
  cwd: root,
  env: {
    ...process.env,
    VITE_DEMO_MODE: "true",
    VITE_SUPABASE_URL: "https://example.invalid",
    VITE_SUPABASE_ANON_KEY: "demo",
  },
  stdio: ["ignore", "pipe", "pipe"],
  detached: true,
});

let readySettled = false;
const ready = new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("Vite did not start in time")), 30000);
  const onData = (buf) => {
    const text = buf.toString();
    process.stdout.write(text);
    if (!readySettled && (text.includes("Local:") || text.includes(`:${port}`))) {
      readySettled = true;
      clearTimeout(timer);
      resolve();
    }
  };
  server.stdout.on("data", onData);
  server.stderr.on("data", onData);
  server.on("exit", (code) => {
    if (!readySettled) {
      clearTimeout(timer);
      reject(new Error(`Vite exited early with code ${code}`));
    }
  });
});

const stop = () => {
  if (server.pid) {
    try {
      process.kill(-server.pid, "SIGKILL");
    } catch {
      try {
        server.kill("SIGKILL");
      } catch {
        /* already gone */
      }
    }
  }
};

try {
  await ready;
  await new Promise((r) => setTimeout(r, 400));

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.getByText("Hormuz mining campaign").first().waitFor({ timeout: 10000 });
  await page.locator("svg circle").first().waitFor({ timeout: 10000 });
  await page.waitForTimeout(600);

  await page.screenshot({
    path: path.join(outDir, "workspace_graph.png"),
    animations: "disabled",
  });

  await page.getByRole("button", { name: "Analogues" }).click();
  await page.waitForTimeout(250);
  await page.screenshot({
    path: path.join(outDir, "analogues.png"),
    animations: "disabled",
  });

  await page.getByRole("button", { name: "Source cards" }).click();
  await page.waitForTimeout(250);
  await page.screenshot({
    path: path.join(outDir, "source_cards.png"),
    animations: "disabled",
  });

  await browser.close();
  console.log(`Wrote screenshots to ${outDir}`);
} finally {
  stop();
}

process.exit(0);
