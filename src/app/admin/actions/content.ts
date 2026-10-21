"use server";

import { redirect } from "next/navigation";
import { requireActor, requirePermission } from "@/lib/auth/session";
import { runAction } from "@/lib/safe-action";
import { refreshPublic } from "@/lib/revalidate";
import { TAGS } from "@/lib/cache-tags";
import type { ActionState } from "@/lib/action-state";
import type { WorkflowAction } from "@/server/services/helpers";
import * as pages from "@/server/services/pages";
import * as projects from "@/server/services/projects";
import * as content from "@/server/services/content";
import { ValidationError } from "@/server/errors";

// Server Actions for CMS content. Each re-authenticates, delegates to the
// service (which enforces permissions and validation) and refreshes caches.

const WORKFLOW: WorkflowAction[] = ["save", "submit", "publish", "unpublish", "revert_to_draft"];
const workflow = (a: unknown): WorkflowAction => (WORKFLOW.includes(a as WorkflowAction) ? (a as WorkflowAction) : "save");
const msg = (a: WorkflowAction) =>
  ({ save: "Saved.", submit: "Submitted for review.", publish: "Published.", unpublish: "Unpublished — no longer visible on the website.", revert_to_draft: "Reverted to draft." })[a];

// ───────── Pages ─────────
export async function createPageAction(input: unknown): Promise<ActionState<{ id: string }>> {
  return runAction(async () => {
    const page = await pages.createPage(await requireActor(), input);
    return { ok: true, data: { id: page!.id } };
  });
}

export async function savePageAction(id: string, input: unknown, action: unknown, publishAt?: string | null): Promise<ActionState> {
  return runAction(async () => {
    const a = workflow(action);
    const scheduled = publishAt ? new Date(publishAt) : null;
    if (scheduled && Number.isNaN(scheduled.getTime())) throw new ValidationError("Enter a valid publication date.", { publishAt: ["Enter a valid date and time."] });
    await pages.updatePage(await requireActor(), id, input, a, scheduled);
    // A URL change on a published page also creates a redirect.
    refreshPublic(TAGS.pages, TAGS.redirects);
    return { ok: true, message: msg(a) };
  });
}

export async function pageStatusAction(id: string, action: unknown): Promise<ActionState> {
  return runAction(async () => {
    const a = workflow(action);
    await pages.setPageStatus(await requireActor(), id, a);
    refreshPublic(TAGS.pages);
    return { ok: true, message: msg(a) };
  });
}

export async function deletePageAction(id: string): Promise<ActionState> {
  const result = await runAction(async () => {
    await pages.deletePage(await requireActor(), id);
    refreshPublic(TAGS.pages);
  });
  if (result?.ok) redirect("/admin/pages");
  return result;
}

export async function duplicatePageAction(id: string): Promise<ActionState<{ id: string }>> {
  const result = await runAction(async () => {
    const copy = await pages.duplicatePage(await requireActor(), id);
    return { ok: true, data: { id: copy.id } };
  });
  if (result?.ok && result.data) redirect(`/admin/pages/${result.data.id}`);
  return result;
}

export async function restoreRevisionAction(pageId: string, revisionId: string): Promise<ActionState> {
  return runAction(async () => {
    await pages.restoreRevision(await requireActor(), pageId, revisionId);
    refreshPublic(TAGS.pages);
    return { ok: true, message: "Revision restored." };
  });
}

// ───────── Projects ─────────
export async function createProjectAction(input: unknown): Promise<ActionState<{ id: string }>> {
  return runAction(async () => {
    const project = await projects.createProject(await requireActor(), input);
    return { ok: true, data: { id: project.id } };
  });
}

export async function saveProjectAction(id: string, input: unknown, action: unknown): Promise<ActionState<{ commercialChanged: boolean }>> {
  return runAction(async () => {
    const a = workflow(action);
    const result = await projects.updateProject(await requireActor(), id, input, a);
    // A URL change on a published project also creates a redirect.
    refreshPublic(TAGS.projects, TAGS.redirects);
    return {
      ok: true,
      message: result?.commercialChanged ? `${msg(a)} Commercial details changed and now await Sales approval.` : msg(a),
      data: { commercialChanged: !!result?.commercialChanged },
    };
  });
}

export async function projectStatusAction(id: string, action: unknown): Promise<ActionState> {
  return runAction(async () => {
    const a = workflow(action);
    await projects.setProjectStatus(await requireActor(), id, a);
    refreshPublic(TAGS.projects);
    return { ok: true, message: msg(a) };
  });
}

export async function reviewCommercialAction(id: string, input: unknown): Promise<ActionState> {
  return runAction(async () => {
    await projects.reviewCommercial(await requirePermission("projects.approveCommercial"), id, input);
    refreshPublic(TAGS.projects);
    return { ok: true, message: "Commercial review recorded." };
  });
}

export async function deleteProjectAction(id: string): Promise<ActionState> {
  const result = await runAction(async () => {
    await projects.deleteProject(await requireActor(), id);
    refreshPublic(TAGS.projects, TAGS.updates);
  });
  if (result?.ok) redirect("/admin/projects");
  return result;
}

export async function duplicateProjectAction(id: string): Promise<ActionState<{ id: string }>> {
  const result = await runAction(async () => {
    const copy = await projects.duplicateProject(await requireActor(), id);
    return { ok: true, data: { id: copy.id } };
  });
  if (result?.ok && result.data) redirect(`/admin/projects/${result.data.id}`);
  return result;
}

// ───────── Updates, locations, articles, vacancies, FAQs ─────────
type Saver = (actor: Awaited<ReturnType<typeof requireActor>>, id: string | null, input: unknown, action?: WorkflowAction) => Promise<{ id: string } | undefined>;

function makeSave(save: Saver, tag: (typeof TAGS)[keyof typeof TAGS], base: string) {
  return async (id: string | null, input: unknown, action: unknown): Promise<ActionState<{ id: string }>> => {
    const a = workflow(action);
    const result = await runAction(async () => {
      const item = await save(await requireActor(), id, input, a);
      refreshPublic(tag);
      return { ok: true, message: msg(a), data: { id: item!.id } };
    });
    if (result?.ok && !id && result.data) redirect(`${base}/${result.data.id}`);
    return result;
  };
}

const saveUpdate = makeSave(content.saveProjectUpdate, TAGS.updates, "/admin/updates");
const saveLocation = makeSave(content.saveLocation, TAGS.locations, "/admin/locations");
const saveArticle = makeSave(content.saveArticle, TAGS.articles, "/admin/articles");
const saveVacancy = makeSave(content.saveVacancy, TAGS.vacancies, "/admin/vacancies");

export async function saveUpdateAction(id: string | null, input: unknown, action: unknown) {
  return saveUpdate(id, input, action);
}
export async function saveLocationAction(id: string | null, input: unknown, action: unknown) {
  return saveLocation(id, input, action);
}
export async function saveArticleAction(id: string | null, input: unknown, action: unknown) {
  return saveArticle(id, input, action);
}
export async function saveVacancyAction(id: string | null, input: unknown, action: unknown) {
  return saveVacancy(id, input, action);
}

const deleters = {
  update: { fn: content.deleteProjectUpdate, tag: TAGS.updates, back: "/admin/updates" },
  location: { fn: content.deleteLocation, tag: TAGS.locations, back: "/admin/locations" },
  article: { fn: content.deleteArticle, tag: TAGS.articles, back: "/admin/articles" },
  vacancy: { fn: content.deleteVacancy, tag: TAGS.vacancies, back: "/admin/vacancies" },
} as const;

export async function deleteContentAction(kind: keyof typeof deleters, id: string): Promise<ActionState> {
  const d = deleters[kind];
  if (!d) return { ok: false, message: "Unknown content type." };
  const result = await runAction(async () => {
    await d.fn(await requireActor(), id);
    refreshPublic(d.tag);
  });
  if (result?.ok) redirect(d.back);
  return result;
}

export async function saveFaqAction(id: string | null, input: unknown): Promise<ActionState> {
  return runAction(async () => {
    await content.saveFaq(await requireActor(), id, input);
    refreshPublic(TAGS.faqs);
    return { ok: true, message: "FAQ saved." };
  });
}

export async function deleteFaqAction(id: string): Promise<ActionState> {
  return runAction(async () => {
    await content.deleteFaq(await requireActor(), id);
    refreshPublic(TAGS.faqs);
    return { ok: true, message: "FAQ deleted." };
  });
}
