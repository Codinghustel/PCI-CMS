import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { GUIDE_SECTIONS } from "@/lib/guide";
import { PERMISSIONS, ROLE_LABELS } from "@/lib/auth/permissions";
import { SECTION_DEFINITIONS } from "@/lib/sections/registry";
import { SETTINGS_GROUPS } from "@/lib/settings";

// Keeps the in-app user guide (src/lib/guide.ts) honest: every screen, button,
// tab and label it mentions must exist in the code, and every topic's access
// badge must match the permission the linked screen actually requires.

const SRC = path.resolve(import.meta.dirname, "../../src");
const CMS = path.join(SRC, "app/admin/(cms)");

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
}
const uiSource = walk(SRC)
  .filter((f) => /\.(tsx?|mts)$/.test(f) && !f.includes(`${path.sep}generated${path.sep}`) && !f.endsWith("guide.ts"))
  .map((f) => fs.readFileSync(f, "utf8"))
  .join("\n");
const guideText = JSON.stringify(GUIDE_SECTIONS);

function pageFile(href: string): string | null {
  const route = href.split(/[?#]/)[0].replace(/^\/admin\/?/, "");
  const file = path.join(CMS, route, "page.tsx");
  return fs.existsSync(file) ? file : null;
}

describe("user guide accuracy", () => {
  it("only references real permissions", () => {
    for (const s of GUIDE_SECTIONS) for (const p of s.permissions ?? []) expect(PERMISSIONS, `${s.id}: ${p}`).toContain(p);
  });

  it("links only to existing CMS screens", () => {
    for (const s of GUIDE_SECTIONS) for (const l of s.links ?? []) expect(pageFile(l.href), `${s.id} → ${l.href}`).not.toBeNull();
  });

  it("declares, for every link, exactly the permission the linked screen requires", () => {
    for (const s of GUIDE_SECTIONS) {
      for (const l of s.links ?? []) {
        const source = fs.readFileSync(pageFile(l.href)!, "utf8");
        const required = source.match(/requirePermissionPage\("([\w.]+)"\)/)?.[1];
        expect(l.permission, `${s.id} → ${l.href} requires ${required ?? "only sign-in"}`).toBe(required);
      }
    }
  });

  it("quotes button, tab and status labels that exist in the UI", () => {
    const labels = [
      "Save draft", "Submit for review", "Publish", "Unpublish", "Update", "Preview", "View live", "Duplicate",
      "New page", "Add block", "Needs attention", "Settings & SEO", "History", "Introduction", "Schedule publication", "Hide from search engines",
      "New project", "Create project", "Basics", "Floor plans & downloads", "VR tours", "Commercial", "Compliance & SEO",
      "Feature on the homepage", "Require an enquiry form", "Awaiting approval", "Approve", "Reject",
      "New update", "Add update", "Replace file", "No alt text", "Save menu", "Permanent (301)",
      "Publish theme", "Discard changes", "Reset to PCI defaults", "Save settings", "Test connection", "Deliver pending leads now",
      "Re-send to Bitrix24", "Export CSV", "New user", "Save changes", "Reset to defaults", "Compare roles",
      "Sign out", "My account",
    ];
    for (const label of labels) {
      expect(guideText.includes(label), `guide should mention "${label}" (or remove it from this list)`).toBe(true);
      expect(uiSource.includes(label), `UI label "${label}" quoted in the guide was not found in the code`).toBe(true);
    }
  });

  it("names page-builder blocks, settings tabs and roles exactly as the CMS does", () => {
    const blocks = ["Hero banner", "Text", "Image and text", "Statistics", "Image gallery", "Video", "Projects showcase", "FAQs", "Enquiry form", "Pay My Installment"];
    const defined = SECTION_DEFINITIONS.map((d) => d.label);
    for (const b of blocks) expect(defined, b).toContain(b);

    const settingsTerms = GUIDE_SECTIONS.find((s) => s.id === "settings")!.terms!.map((t) => t.term);
    expect(settingsTerms).toEqual(SETTINGS_GROUPS.map((g) => g.label));

    const roleTerms = GUIDE_SECTIONS.find((s) => s.id === "roles")!.terms!.map((t) => t.term);
    expect(roleTerms).toEqual(Object.values(ROLE_LABELS));
  });
});
