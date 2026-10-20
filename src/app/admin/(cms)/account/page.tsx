import { PageHeader } from "@/components/admin/page-header";
import { ChangePasswordForm } from "./change-password-form";
import { requireActorPage } from "@/lib/auth/session";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/auth/permissions";

export default async function AccountPage() {
  const actor = await requireActorPage();
  return (
    <>
      <PageHeader title="My account" description={`${actor.email} · ${ROLE_LABELS[actor.role]} — ${ROLE_DESCRIPTIONS[actor.role]}`} />
      <ChangePasswordForm />
    </>
  );
}
