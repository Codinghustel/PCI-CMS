// Dev diagnostic: filter chips must keep the scroll position and not flash the loading skeleton.
import { chromium } from "@playwright/test";
const base = process.argv[2] ?? "http://localhost:3300";
const cases = [
  ["/projects?category=residential", "Browse projects", "Commercial"],
  ["/project-updates?project=box-park-2", "Filter updates", "Grand Orchard"],
  ["/media?category=news", "Media categories", "Event"],
];
const browser = await chromium.launch();
for (const [path, navLabel, chip] of cases) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(base + path, { waitUntil: "networkidle" });
  const nav = page.getByRole("navigation", { name: navLabel });
  await page.evaluate(() => window.scrollTo(0, 500));
  await page.waitForTimeout(300);
  const before = await page.evaluate(() => window.scrollY);
  // Record whether the skeleton (aria-busy) appears at any point during the navigation.
  await page.evaluate(() => {
    window.__busy = false;
    new MutationObserver(() => { if (document.querySelector("[aria-busy='true'], [aria-busy='']")) window.__busy = true; }).observe(document.body, { subtree: true, childList: true, attributes: true });
  });
  const url = page.url();
  // DOM click: unlike locator.click() it does not scroll the element into view.
  await nav.getByRole("link", { name: new RegExp(chip, "i") }).first().evaluate((a) => a.click());
  await page.waitForURL((u) => u.toString() !== url);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);
  const after = await page.evaluate(() => window.scrollY);
  const busy = await page.evaluate(() => window.__busy);
  const issues = await page.evaluate(() => {
    const root = document.querySelector("nextjs-portal")?.shadowRoot;
    const c = document.createElement("div");
    root?.childNodes.forEach((n) => c.appendChild(n.cloneNode(true)));
    c.querySelectorAll("style").forEach((n) => n.remove());
    return c.textContent.replace(/\s+/g, " ").trim().slice(0, 200);
  });
  console.log(`${path} → ${page.url().replace(base, "")}: scroll ${before} → ${after}${Math.abs(after - before) < 5 ? " ✓" : " ✗"} | skeleton flashed: ${busy} | overlay: ${issues || "none"}`);
  await page.close();
}
await browser.close();
