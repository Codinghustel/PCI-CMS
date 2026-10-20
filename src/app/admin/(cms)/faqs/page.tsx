import { PageHeader } from "@/components/admin/page-header";
import { FaqManager } from "./faq-manager";
import { requirePermissionPage } from "@/lib/auth/session";
import { listFaqs } from "@/server/services/content";
import { can } from "@/lib/auth/permissions";

export default async function FaqsPage() {
  const actor = await requirePermissionPage("content.read");
  const faqs = await listFaqs();
  return (
    <>
      <PageHeader title="FAQs" description="Approved questions and answers. Shown by FAQ blocks (by category) and used as a knowledge source for the project finder." />
      <FaqManager faqs={faqs} canEdit={can(actor, "content.write")} />
    </>
  );
}
