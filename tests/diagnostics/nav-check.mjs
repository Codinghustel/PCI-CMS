// Dev-only diagnostic: client-side navigations; reports Next dev-overlay issues and console errors.
import { chromium } from "@playwright/test";
const base = process.argv[2] ?? "http://localhost:3300";
const from = process.argv[3] ?? "/locations";
const linkName = new RegExp(process.argv[4] ?? "Bahria Intellectual Village");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(`[console] ${m.text().slice(0, 400)}`));
page.on("pageerror", (e) => errors.push(`[pageerror] ${e.message.slice(0, 400)}`));
const overlayText = () =>
  page.evaluate(() => {
    const root = document.querySelector("nextjs-portal")?.shadowRoot;
    if (!root) return "";
    const clone = document.createElement("div");
    root.childNodes.forEach((n) => clone.appendChild(n.cloneNode(true)));
    clone.querySelectorAll("style,script").forEach((n) => n.remove());
    return clone.textContent.replace(/\s+/g, " ").trim();
  });
await page.goto(base + from, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
console.log("overlay before nav:", (await overlayText()).slice(0, 300));
await page.getByRole("link", { name: linkName }).first().click();
await page.waitForLoadState("networkidle");
await page.waitForTimeout(3000);
console.log("url:", page.url(), "pins:", await page.locator(".pci-pin").count());
let text = await overlayText();
console.log("overlay after nav:", text.slice(0, 400));
// Open the issues panel if there is a badge.
const opened = await page.evaluate(() => {
  const root = document.querySelector("nextjs-portal")?.shadowRoot;
  const btn = root?.querySelector("[data-issues-open], [data-issues], button[aria-label*='issue' i], button[aria-label*='Issues' i]");
  if (btn) { btn.click(); return true; }
  return false;
});
if (opened) { await page.waitForTimeout(1000); text = await overlayText(); console.log("issues panel:", text.slice(0, 2500)); }
console.log(errors.join("\n") || "no console errors");
await browser.close();
