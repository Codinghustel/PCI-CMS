import { PageHeader } from "@/components/admin/page-header";
import { NewProjectForm } from "./new-project-form";
import { requirePermissionPage } from "@/lib/auth/session";

export default async function NewProjectPage() {
  await requirePermissionPage("content.writeOwn");
  return (
    <>
      <PageHeader title="New project" description="Start with the essentials — you can add media, facts and commercial details next." back={{ href: "/admin/projects", label: "Projects" }} />
      <NewProjectForm />
    </>
  );
}
