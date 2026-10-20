"use client";

import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FieldRenderer } from "@/components/admin/field-renderer";
import { ErrorSummary, scopedErrors } from "@/components/admin/ui";
import { useEditorAction } from "@/components/admin/workflow";
import { saveSettingsAction } from "@/app/admin/actions/site";
import { SETTINGS_GROUPS, type SiteSettings } from "@/lib/settings";
import type { FieldDef } from "@/lib/fields";

export function SettingsForm({ initial }: { initial: SiteSettings }) {
  const [value, setValue] = useState<Record<string, Record<string, unknown>>>(initial as unknown as Record<string, Record<string, unknown>>);
  const { state, errors, pending, run } = useEditorAction();
  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-4">
        <ErrorSummary state={state} />
        <Button className="ms-auto" disabled={pending} onClick={() => run("save", () => saveSettingsAction(value))}>
          {pending ? <Loader2 className="animate-spin" /> : <Save />} Save settings
        </Button>
      </div>
      <Tabs defaultValue="general">
        <TabsList className="flex h-auto flex-wrap">
          {SETTINGS_GROUPS.map((g) => <TabsTrigger key={g.key} value={g.key}>{g.label}</TabsTrigger>)}
        </TabsList>
        {SETTINGS_GROUPS.map((g) => (
          <TabsContent key={g.key} value={g.key} className="mt-4">
            <Card>
              <CardContent className="p-5">
                <FieldRenderer
                  fields={g.fields as unknown as FieldDef[]}
                  value={value[g.key]}
                  onChange={(v) => setValue((s) => ({ ...s, [g.key]: v }))}
                  errors={scopedErrors(errors, g.key)}
                />
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </>
  );
}
