// Dev diagnostic: responsive layout invariants across breakpoints.
import { chromium } from "@playwright/test";
const base = process.argv[2] ?? "http://localhost:3300";
const widths = [375, 768, 1024, 1280, 1536];
const browser = await chromium.launch();
const intersects = (a, b) => a && b && a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
for (const w of widths) {
  const page = await browser.newPage({ viewport: { width: w, height: 900 } });
  await page.goto(base + "/", { waitUntil: "networkidle" });
  await page.evaluate(() => document.cookie = "pci_consent=necessary; path=/");
  await page.reload({ waitUntil: "networkidle" });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const header = await page.locator("header").first().boundingBox();
  const call = page.locator("header a[data-track='call_click']");
  const callVisible = await call.isVisible();
  const callText = callVisible ? (await call.innerText()).trim() : "";
  const eyebrow = await page.locator("main section").first().locator("p").first().evaluate((el) => getComputedStyle(el).color);
  // Footer legal links vs floating buttons when scrolled to the very bottom.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(400);
  const floatBoxes = await page.locator("div.fixed.end-4 > *").evaluateAll((els) => els.filter((e) => e.offsetParent !== null).map((e) => e.getBoundingClientRect().toJSON()));
  const legal = await page.locator("footer ul").last().locator("a").evaluateAll((els) => els.map((e) => ({ t: e.textContent, r: e.getBoundingClientRect().toJSON() })));
  const hits = legal.filter((l) => floatBoxes.some((f) => intersects(l.r, f))).map((l) => l.t);
  // Project page hero buttons
  await page.goto(base + "/projects/river-hills-5", { waitUntil: "networkidle" });
  const heights = await page.locator("main section").first().locator(".site-btn").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
  // Card heights per row on /projects
  await page.goto(base + "/projects", { waitUntil: "networkidle" });
  const cards = await page.locator("main article").evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { top: Math.round(r.top), h: Math.round(r.height) }; }));
  const rows = {};
  cards.forEach((c) => (rows[c.top] ??= new Set()).add(c.h));
  const uneven = Object.values(rows).filter((s) => s.size > 1).length;
  console.log(`${w}px: overflowX=${overflow} header=${Math.round(header.height)}px call=${callVisible ? JSON.stringify(callText || "icon") : "hidden"} eyebrow=${eyebrow} legalOverlap=${hits.length ? hits.join(",") : "none"} heroBtnHeights=${[...new Set(heights)].join("/")} unevenCardRows=${uneven}/${Object.keys(rows).length}`);
  await page.close();
}
await browser.close();
