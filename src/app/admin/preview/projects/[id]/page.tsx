import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProjectDetail } from "@/components/site/project-detail";
import { requirePermissionPage } from "@/lib/auth/session";
import { loadProjectView } from "@/server/public-data";
import { getSettings } from "@/server/services/site";

export const metadata: Metadata = { title: "Preview", robots: { index: false, follow: false } };

export default async function PreviewProject({ params }: { params: Promise<{ id: string }> }) {
  await requirePermissionPage("content.read");
  const { id } = await params;
  const [project, settings] = await Promise.all([loadProjectView({ id }, true), getSettings()]);
  if (!project) notFound();
  return (
    <main>
      {!project.commercial.approved ? (
        <p className="bg-sky-100 px-4 pt-12 pb-2 text-center text-sm text-sky-900">Commercial details (price, payment plan, handover) are hidden until approved by Sales.</p>
      ) : null}
      <ProjectDetail project={project} settings={settings} />
    </main>
  );
}
