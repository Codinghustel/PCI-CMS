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
import type { IntegrationStatus } from "@/server/services/integrations";
import { IntegrationsPanel } from "./integrations-panel";

type Serialized<T> = T extends Date ? string : T extends object ? { [K in keyof T]: Serialized<T[K]> } : T;

export function SettingsForm({ initial, status, initialTab }: { initial: SiteSettings; status: Serialized<IntegrationStatus>; initialTab?: string }) {
  const [value, setValue] = useState<Record<string, Record<string, unknown>>>(initial as unknown as Record<string, Record<string, unknown>>);
  const { state, errors, pending, run } = useEditorAction();
  const tabs = SETTINGS_GROUPS.map((g) => g.key) as string[];
  const save = () => run("save", () => saveSettingsAction(value));

  const fieldsFor = (key: string) => (SETTINGS_GROUPS.find((g) => g.key === key)!.fields as unknown as FieldDef[]);
  const renderGroup = (key: string) => (
    <FieldRenderer fields={fieldsFor(key)} value={value[key]} onChange={(v) => setValue((s) => ({ ...s, [key]: v }))} errors={scopedErrors(errors, key)} />
  );

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-4">
        <ErrorSummary state={state} />
        <Button className="ms-auto" disabled={pending} onClick={save}>
          {pending ? <Loader2 className="animate-spin" /> : <Save />} Save settings
        </Button>
      </div>
      <Tabs defaultValue={initialTab && tabs.includes(initialTab) ? initialTab : "general"}>
        <TabsList className="flex h-auto flex-wrap">
          {SETTINGS_GROUPS.map((g) => <TabsTrigger key={g.key} value={g.key}>{g.label}</TabsTrigger>)}
        </TabsList>
        {SETTINGS_GROUPS.map((g) => (
          <TabsContent key={g.key} value={g.key} className="mt-4">
            {g.key === "integrations" ? (
              <IntegrationsPanel status={status} options={renderGroup("integrations")} />
            ) : (
              <Card>
                <CardContent className="p-5">{renderGroup(g.key)}</CardContent>
              </Card>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </>
  );
}
