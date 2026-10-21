import { chromium } from "@playwright/test";
const [base, email, password] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 600 } });
await page.goto(base + "/admin/login");
await page.getByLabel("Email").fill(email);
await page.getByLabel("Password").fill(password);
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForURL((u) => !u.pathname.endsWith("/login"));
await page.goto(base + "/admin/guide", { waitUntil: "networkidle" });
console.log(await page.locator("#guide-toc").evaluate((el) => {
  const cs = getComputedStyle(el);
  return { display: cs.display, overflowY: cs.overflowY, maxHeight: cs.maxHeight, clientHeight: el.clientHeight, scrollHeight: el.scrollHeight, links: el.querySelectorAll("a").length };
}));
await browser.close();
