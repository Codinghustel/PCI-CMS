import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { createPage, deletePage, duplicatePage, listRevisions, restoreRevision, setPageStatus, updatePage } from "@/server/services/pages";
import { createProject, reviewCommercial, updateProject } from "@/server/services/projects";
import { saveProjectUpdate } from "@/server/services/content";
import { saveMenu, saveRedirect, saveTheme, getTheme } from "@/server/services/site";
import { ConflictError, ForbiddenError, ValidationError } from "@/server/errors";
import { DEFAULT_THEME } from "@/lib/theme";
import { makeImage, makeUser, resetDb } from "../support/db";

beforeEach(resetDb);

const hero = (heading: string) => ({ id: "hero1", type: "hero", hidden: false, data: { heading } });

describe("pages", () => {
  it("creates drafts, rejects duplicate and reserved slugs", async () => {
    const editor = await makeUser("EDITOR");
    const page = await createPage(editor, { title: "About", slug: "about", sections: [hero("About PCI")] });
    expect(page?.status).toBe("DRAFT");
    await expect(createPage(editor, { title: "Copy", slug: "about" })).rejects.toBeInstanceOf(ConflictError);
    await expect(createPage(editor, { title: "X", slug: "projects" })).rejects.toBeInstanceOf(ValidationError);
    await expect(createPage(editor, { title: "X", slug: "Bad Slug!" })).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects invalid blocks and sanitises rich text before saving", async () => {
    const editor = await makeUser("EDITOR");
    await expect(createPage(editor, { title: "T", slug: "t", sections: [{ id: "a", type: "hero", hidden: false, data: {} }] })).rejects.toMatchObject({
      fieldErrors: expect.objectContaining({ "sections.0.heading": expect.any(Array) }),
    });
    const page = await createPage(editor, {
      title: "T",
      slug: "t2",
      sections: [{ id: "b", type: "richText", hidden: false, data: { body: '<p>ok</p><script>alert(1)</script><a href="javascript:x">l</a>' } }],
    });
    expect(JSON.stringify(page!.sections)).not.toMatch(/script|javascript:/);
  });

  it("enforces the author → editor publishing workflow", async () => {
    const author = await makeUser("AUTHOR");
    const editor = await makeUser("EDITOR");
    const page = (await createPage(author, { title: "Landing", slug: "landing" }))!;
    await expect(updatePage(author, page.id, { title: "Landing", slug: "landing" }, "publish")).rejects.toBeInstanceOf(ForbiddenError);
    await updatePage(author, page.id, { title: "Landing", slug: "landing" }, "submit");
    expect((await db.page.findUniqueOrThrow({ where: { id: page.id } })).status).toBe("IN_REVIEW");
    // Another author cannot touch it.
    const other = await makeUser("AUTHOR");
    await expect(updatePage(other, page.id, { title: "Hijack", slug: "landing" })).rejects.toBeInstanceOf(ForbiddenError);
    const published = await setPageStatus(editor, page.id, "publish");
    expect(published.status).toBe("PUBLISHED");
    expect(published.publishedAt).toBeInstanceOf(Date);
    // Once published, the author can no longer edit it.
    await expect(updatePage(author, page.id, { title: "Edit", slug: "landing" })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("keeps revisions, restores them and redirects changed URLs", async () => {
    const editor = await makeUser("EDITOR");
    const page = (await createPage(editor, { title: "V1", slug: "story", sections: [hero("First")] }))!;
    await updatePage(editor, page.id, { title: "V2", slug: "story", sections: [hero("Second")] }, "publish");
    await updatePage(editor, page.id, { title: "V3", slug: "our-story", sections: [hero("Third")] });
    expect(await db.redirect.findUnique({ where: { fromPath: "/story" } })).toMatchObject({ toPath: "/our-story" });

    const revisions = await listRevisions(page.id);
    expect(revisions.length).toBe(3);
    const first = revisions[revisions.length - 1];
    await restoreRevision(editor, page.id, first.id);
    const restored = await db.page.findUniqueOrThrow({ where: { id: page.id } });
    expect(restored.title).toBe("V1");
    expect(restored.slug).toBe("our-story"); // URL is kept when restoring content
  });

  it("duplicates pages as drafts and protects the homepage from deletion", async () => {
    const editor = await makeUser("EDITOR");
    const home = (await createPage(editor, { title: "Home", slug: "home" }))!;
    const copy = await duplicatePage(editor, home.id);
    expect(copy.slug).toBe("home-copy");
    expect(copy.status).toBe("DRAFT");
    await expect(deletePage(editor, home.id)).rejects.toBeInstanceOf(ConflictError);
    const viewer = await makeUser("VIEWER");
    await expect(deletePage(viewer, copy.id)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("projects", () => {
  const base = (over: Record<string, unknown> = {}) => ({
    name: "Gateway",
    slug: "gateway",
    category: "MIXED_USE",
    constructionStatus: "ONGOING",
    market: "UAE",
    city: "Dubai",
    overview: "<p>Gateway is a mixed-use development in Jumeirah Village Circle with residential and retail space.</p>",
    ...over,
  });

  it("blocks publishing a UAE project without DLD permit and QR code", async () => {
    const editor = await makeUser("EDITOR");
    const p = await createProject(editor, { name: "Gateway", category: "MIXED_USE", constructionStatus: "ONGOING", market: "UAE", city: "Dubai" });
    const heroImageId = await makeImage();
    await expect(updateProject(editor, p.id, base({ heroImageId }), "publish")).rejects.toMatchObject({
      fieldErrors: { _publish: expect.arrayContaining([expect.stringContaining("DLD advertising permit")]) },
    });
    const qr = await makeImage();
    const ok = await updateProject(editor, p.id, base({ heroImageId, dldPermitNumber: "71234", dldQrImageId: qr }), "publish");
    expect(ok?.project.status).toBe("PUBLISHED");
  });

  it("requires Sales approval for commercial changes, with separation of duties", async () => {
    const editor = await makeUser("EDITOR");
    const approver = await makeUser("SALES_APPROVER");
    const p = await createProject(editor, { name: "River Hills 5", category: "RESIDENTIAL", constructionStatus: "ONGOING", market: "PAKISTAN", city: "Islamabad" });
    const result = await updateProject(editor, p.id, base({ name: "River Hills 5", slug: "river-hills-5", market: "PAKISTAN", city: "Islamabad", priceFrom: 12500000, currency: "PKR", handover: "Q4 2027" }));
    expect(result?.commercialChanged).toBe(true);
    expect((await db.project.findUniqueOrThrow({ where: { id: p.id } })).commercialStatus).toBe("PENDING");

    await expect(reviewCommercial(editor, p.id, { decision: "approve" })).rejects.toBeInstanceOf(ForbiddenError);
    await reviewCommercial(approver, p.id, { decision: "approve", note: "Matches price list" });
    const approved = await db.project.findUniqueOrThrow({ where: { id: p.id } });
    expect(approved.commercialStatus).toBe("APPROVED");
    expect(approved.commercialAsOf).toBeInstanceOf(Date);

    // A later price change resets the approval.
    await updateProject(editor, p.id, base({ name: "River Hills 5", slug: "river-hills-5", market: "PAKISTAN", city: "Islamabad", priceFrom: 13000000, currency: "PKR", handover: "Q4 2027" }));
    expect((await db.project.findUniqueOrThrow({ where: { id: p.id } })).commercialStatus).toBe("PENDING");

    // An approver who edited the commercial fields themselves cannot approve them.
    const approverEditor = { ...approver };
    await db.project.update({ where: { id: p.id }, data: { updatedById: approverEditor.id } });
    await expect(reviewCommercial(approverEditor, p.id, { decision: "approve" })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("links dated construction updates to a project", async () => {
    const editor = await makeUser("EDITOR");
    const p = await createProject(editor, { name: "Buraq Heights", category: "RESIDENTIAL", constructionStatus: "ONGOING", market: "PAKISTAN", city: "Islamabad" });
    await expect(saveProjectUpdate(editor, null, { projectId: p.id, title: "No date", slug: "no-date" })).rejects.toBeInstanceOf(ValidationError);
    const u = await saveProjectUpdate(editor, null, { projectId: p.id, title: "July 2025", slug: "buraq-2025-07", date: "2025-07-01", progressPercent: 55 }, "publish");
    expect(u?.status).toBe("PUBLISHED");
    await expect(saveProjectUpdate(editor, null, { projectId: p.id, title: "Bad", slug: "bad", date: "2025-07-01", progressPercent: 140 })).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("site configuration", () => {
  it("validates theme colours server-side and stores valid themes", async () => {
    const admin = await makeUser("ADMIN");
    const editor = await makeUser("EDITOR");
    await expect(saveTheme(editor, DEFAULT_THEME)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(saveTheme(admin, { ...DEFAULT_THEME, colors: { ...DEFAULT_THEME.colors, primary: "url(javascript:x)" } })).rejects.toBeInstanceOf(ValidationError);
    await saveTheme(admin, { ...DEFAULT_THEME, colors: { ...DEFAULT_THEME.colors, primary: "#123456" } });
    expect((await getTheme()).colors.primary).toBe("#123456");
  });

  it("saves menus and rejects unsafe links", async () => {
    const editor = await makeUser("EDITOR");
    await expect(saveMenu(editor, "header", { items: [{ label: "X", href: "javascript:alert(1)" }] })).rejects.toBeInstanceOf(ValidationError);
    await saveMenu(editor, "header", { items: [{ label: "Projects", href: "/projects", children: [{ label: "Residential", href: "/projects?category=residential" }] }] });
    expect(await db.menuItem.count()).toBe(2);
  });

  it("prevents redirect loops", async () => {
    const editor = await makeUser("EDITOR");
    await saveRedirect(editor, null, { fromPath: "/a", toPath: "/b" });
    await expect(saveRedirect(editor, null, { fromPath: "/b", toPath: "/a" })).rejects.toBeInstanceOf(ValidationError);
    await expect(saveRedirect(editor, null, { fromPath: "/A/", toPath: "/c" })).rejects.toBeInstanceOf(ConflictError);
  });
});
