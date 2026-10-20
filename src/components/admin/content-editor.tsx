"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { FieldRenderer } from "@/components/admin/field-renderer";
import { ConfirmAction, ErrorSummary } from "@/components/admin/ui";
import { useEditorAction, WorkflowBar } from "@/components/admin/workflow";
import { deleteContentAction } from "@/app/admin/actions/content";
import type { ActionState } from "@/lib/action-state";
import type { FieldDef } from "@/lib/fields";
import type { PublishStatusValue } from "@/lib/content-labels";

type Value = Record<string, unknown>;

/** Generic workflow editor for field-defined content types. */
export function ContentEditor({
  id,
  status,
  publishedAt,
  fields,
  initial,
  save,
  deleteKind,
  liveHref,
  canEdit = true,
  transform,
  aside,
}: {
  id: string | null;
  status: PublishStatusValue | "NEW";
  publishedAt?: string | null;
  fields: FieldDef[];
  initial: Value;
  save: (id: string | null, input: unknown, action: unknown) => Promise<ActionState<{ id: string }>>;
  deleteKind?: "update" | "location" | "article" | "vacancy";
  liveHref?: string;
  canEdit?: boolean;
  /** Adjust the payload before saving (e.g. empty strings → null). */
  transform?: (v: Value) => Value;
  aside?: React.ReactNode;
}) {
  const router = useRouter();
  const [value, setValue] = useState<Value>(initial);
  const { state, errors, pending, pendingAction, run } = useEditorAction<{ id: string }>();
  return (
    <>
      <WorkflowBar
        status={status}
        publishedAt={publishedAt}
        pending={pending}
        pendingAction={pendingAction}
        canEdit={canEdit}
        liveHref={liveHref}
        onAction={(a) => run(a, () => save(id, transform ? transform(value) : value, a), (res) => {
          if (!id && res?.ok && res.data?.id) router.replace(`${window.location.pathname.replace(/\/new$/, "")}/${res.data.id}`);
        })}
      />
      <div className="mb-4"><ErrorSummary state={state} /></div>
      <div className={aside ? "grid gap-6 lg:grid-cols-3" : ""}>
        <Card className={aside ? "lg:col-span-2" : ""}>
          <CardContent className="p-5">
            <fieldset disabled={!canEdit}>
              <FieldRenderer fields={fields} value={value} onChange={setValue} errors={errors} />
            </fieldset>
          </CardContent>
        </Card>
        {aside ? <div className="space-y-4">{aside}</div> : null}
      </div>
      {id && deleteKind && canEdit ? (
        <div className="mt-6 rounded-lg border border-destructive/30 p-4">
          <ConfirmAction action={() => deleteContentAction(deleteKind, id)} title="Delete permanently?" description="This cannot be undone. Consider unpublishing instead." confirmLabel="Delete">
            <Trash2 /> Delete
          </ConfirmAction>
        </div>
      ) : null}
    </>
  );
}
