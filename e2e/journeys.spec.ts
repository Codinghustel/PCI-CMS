import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "E2e-Password-2026";
const ADMIN = "admin@pci-orbit.local";
const AUTHOR = "author@pci-orbit.local";

async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.context().clearCookies(); // start from a signed-out state
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  if (password === PASSWORD) await page.waitForURL((url) => url.pathname.startsWith("/admin") && url.pathname !== "/admin/login");
}

test.describe.configure({ mode: "serial" });

test("public visitors can browse published content", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Inspiring Lifestyles" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Pay My Installment" }).first()).toBeVisible();

  await page.goto("/projects");
  await page.getByRole("link", { name: "Grand Orchard", exact: true }).first().click();
  await expect(page).toHaveURL(/\/projects\/grand-orchard$/);
  await expect(page.getByRole("heading", { level: 1, name: "Grand Orchard" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Enquire about Grand Orchard/ })).toBeVisible();

  // No empty VR section when a project has no tours.
  await expect(page.locator("#vr")).toHaveCount(0);
});

test("drafts stay private and legacy URLs redirect", async ({ request }) => {
  // UAE projects are seeded as drafts until DLD permits are added.
  expect((await request.get("/projects/gateway", { maxRedirects: 0 })).status()).toBe(404);
  expect((await request.get("/this-page-does-not-exist")).status()).toBe(404);
  const legacy = await request.get("/about-us", { maxRedirects: 0 });
  expect(legacy.status()).toBe(301);
  expect(legacy.headers()["location"]).toMatch(/\/about$/);
  // Staging is never indexed.
  expect((await request.get("/robots.txt")).ok()).toBe(true);
  expect(await (await request.get("/robots.txt")).text()).toContain("Disallow: /");
});

test("unauthorised visitors cannot reach the CMS or its APIs", async ({ page, request }) => {
  await page.goto("/admin/pages");
  await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Fpages/);
  const upload = await request.post("/api/admin/media", {
    headers: { origin: "http://localhost:3100" },
    multipart: { file: { name: "a.png", mimeType: "image/png", buffer: Buffer.from("x") } },
  });
  expect(upload.status()).toBe(401);
  const crossSite = await request.post("/api/leads", { headers: { origin: "https://evil.example" }, data: {} });
  expect(crossSite.status()).toBe(403);
});

test("administrators can sign in and out; bad passwords are rejected", async ({ page }) => {
  await signIn(page, ADMIN, "wrong-password");
  await expect(page.getByText("Invalid email or password.")).toBeVisible();
  await signIn(page, ADMIN);
  await expect(page.getByRole("heading", { name: /Welcome/ })).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).first().click();
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("editors create and publish pages; duplicate slugs are rejected", async ({ page }) => {
  await signIn(page, ADMIN);
  await page.goto("/admin/pages");
  await page.getByRole("button", { name: "New page" }).click();
  await page.getByLabel("Title").fill("E2E Landing");
  await page.getByRole("button", { name: "Create page" }).click();
  await expect(page).toHaveURL(/\/admin\/pages\/[a-z0-9]+$/);

  // Public visitors cannot see the draft.
  expect((await page.request.get("/e2e-landing")).status()).toBe(404);

  await page.getByRole("button", { name: "Add block" }).click();
  await page.getByRole("button", { name: /^Text Formatted text/ }).click();
  await page.getByRole("textbox", { name: "Heading", exact: true }).fill("Hello from the page builder");
  await page.locator(".tiptap-editor [contenteditable=true]").fill("This page was published by the end-to-end test.");
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Published.").first()).toBeVisible();

  // New URLs reach the proxy routing index within about a second.
  await expect(async () => {
    await page.goto("/e2e-landing");
    await expect(page.getByRole("heading", { name: "Hello from the page builder" })).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  await expect(page.getByText("This page was published by the end-to-end test.")).toBeVisible();

  await page.goto("/admin/pages");
  await page.getByRole("button", { name: "New page" }).click();
  await page.getByLabel("Title").fill("Another");
  await page.getByLabel("URL").fill("e2e-landing");
  await page.getByRole("button", { name: "Create page" }).click();
  await expect(page.getByText(/already in use/).first()).toBeVisible();
});

test("authors can draft and submit but not publish", async ({ page }) => {
  await signIn(page, AUTHOR);
  await page.goto("/admin/pages");
  await page.getByRole("button", { name: "New page" }).click();
  await page.getByLabel("Title").fill("Author Draft");
  await page.getByRole("button", { name: "Create page" }).click();
  await expect(page).toHaveURL(/\/admin\/pages\/[a-z0-9]+$/);
  await expect(page.getByRole("button", { name: "Publish" })).toHaveCount(0);
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.getByText("Submitted for review.").first()).toBeVisible();
  expect((await page.request.get("/author-draft")).status()).toBe(404);

  // Authors cannot open administrator-only areas.
  await page.goto("/admin/theme");
  await expect(page).toHaveURL(/\/admin\/forbidden/);
});

test("theme changes are applied to the public website", async ({ page }) => {
  await signIn(page, ADMIN);
  await page.goto("/admin/theme");
  await page.getByLabel("Primary", { exact: true }).fill("#7A1F3D");
  await page.getByRole("button", { name: "Publish theme" }).click();
  await expect(page.getByText("Theme published to the website.").first()).toBeVisible();
  const html = await (await page.request.get("/")).text();
  expect(html).toContain("--primary:#7A1F3D");
});

test("enquiry forms validate input and succeed even when the CRM is unreachable", async ({ page }) => {
  await page.goto("/contact");
  const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Send enquiry" }) });
  await form.getByLabel("Full name *").fill("A");
  await form.getByRole("button", { name: "Send enquiry" }).click();
  await expect(form.getByText("Please enter your name")).toBeVisible();

  await form.getByLabel("Full name *").fill("E2E Visitor");
  await form.getByLabel("Email *").fill("visitor@example.com");
  await form.getByLabel(/Phone/).fill("+971 50 123 4567");
  await form.getByRole("checkbox").check();
  await page.waitForTimeout(2700); // minimum human fill time (anti-bot)
  await form.getByRole("button", { name: "Send enquiry" }).click();
  await expect(page.getByRole("status")).toContainText("Thank you");

  // The lead is stored and its failed CRM delivery is visible to staff.
  await signIn(page, ADMIN);
  await page.goto("/admin/leads?q=visitor%40example.com");
  await expect(page.getByRole("link", { name: "E2E Visitor" })).toBeVisible();
  await page.getByRole("link", { name: "E2E Visitor" }).click();
  await expect(page.getByText(/Attempt 1 · failed/)).toBeVisible({ timeout: 15_000 });
});

test("media uploads reject disguised and unsupported files", async ({ page }) => {
  await signIn(page, ADMIN);
  await page.goto("/admin");
  const svg = await page.request.post("/api/admin/media", {
    headers: { origin: "http://localhost:3100" },
    multipart: { file: { name: "logo.png", mimeType: "image/png", buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>') } },
  });
  expect(svg.status()).toBe(422);
  expect((await svg.json()).message).toMatch(/Unsupported file type/);
});

test("administrators customise role permissions and the change applies immediately", async ({ page }) => {
  await signIn(page, ADMIN);
  await page.goto("/admin/roles?role=AUTHOR");
  await expect(page.getByRole("heading", { name: "Roles & permissions" })).toBeVisible();
  await page.getByRole("switch", { name: /Publish & unpublish/ }).click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText(/Permissions updated/).first()).toBeVisible();
  // Administrator-only permission cannot be granted.
  await expect(page.getByRole("switch", { name: /Manage users & roles/ })).toBeDisabled();

  await signIn(page, AUTHOR);
  await page.goto("/admin/pages");
  await page.getByRole("button", { name: "New page" }).click();
  await page.getByLabel("Title").fill("Author Can Publish");
  await page.getByRole("button", { name: "Create page" }).click();
  await expect(page.getByRole("button", { name: "Publish" })).toBeVisible();
});

test("settings show integrations in a dedicated tab", async ({ page }) => {
  await signIn(page, ADMIN);
  await page.goto("/admin/settings");
  await expect(page.getByText("Scheduled job")).toHaveCount(0); // old status cards removed from the top
  await page.getByRole("tab", { name: "Integrations" }).click();
  await expect(page.getByText("Bitrix24 CRM", { exact: true })).toBeVisible();
  await expect(page.getByText("Scheduled job", { exact: true })).toBeVisible();
  await expect(page.getByText("Payment Service", { exact: true })).toBeVisible();
  await expect(page.getByText("Search indexing", { exact: true })).toBeVisible();
  await expect(page.getByText(/\/rest\/1\/e2e/)).toHaveCount(0); // webhook path is masked
  await page.getByRole("button", { name: "Deliver pending leads now" }).click();
  await expect(page.getByText(/Delivery job finished/).first()).toBeVisible();
});

test("every user can open the role-aware user guide", async ({ page }) => {
  await signIn(page, "viewer@pci-orbit.local");
  await page.getByRole("link", { name: "User guide" }).first().click();
  await expect(page).toHaveURL(/\/admin\/guide$/);
  await expect(page.getByRole("heading", { name: "User guide", level: 1 })).toBeVisible();
  await expect(page.getByText(/Viewer \(Leads & Reports\)/).first()).toBeVisible();
  // Viewers can read leads but not manage users.
  await expect(page.locator("#leads").getByText("You can do this")).toBeVisible();
  await expect(page.locator("#users").getByText(/Requires Administrator/)).toBeVisible();
  await page.getByLabel("Search the guide").fill("brochure");
  await expect(page.locator("#projects")).toBeVisible();
  await expect(page.locator("#audit")).toHaveCount(0);
});

test("the user guide scrolls: independent contents list, jump links and back to top", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  await signIn(page, ADMIN);
  await page.goto("/admin/guide");
  const toc = page.locator("#guide-toc");
  await expect(toc.getByRole("link", { name: "Troubleshooting & FAQs" })).toBeAttached();
  // The contents list is taller than the window, so it scrolls on its own.
  expect(await toc.evaluate((el) => getComputedStyle(el).overflowY)).toBe("auto");
  await expect.poll(() => toc.evaluate((el) => el.scrollHeight > el.clientHeight + 50)).toBe(true);

  await toc.getByRole("link", { name: "Troubleshooting & FAQs" }).click();
  await expect(page).toHaveURL(/#troubleshooting$/);
  await expect(page.locator("#troubleshooting")).toBeInViewport();
  await expect(toc.getByRole("link", { name: "Troubleshooting & FAQs" })).toHaveAttribute("aria-current", "location");
  // The highlighted entry was scrolled into view inside the contents list.
  await expect(toc.getByRole("link", { name: "Troubleshooting & FAQs" })).toBeInViewport();

  await page.getByRole("button", { name: "Back to top" }).click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
});
