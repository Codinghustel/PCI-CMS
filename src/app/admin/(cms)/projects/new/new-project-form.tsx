"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/admin/ui";
import { createProjectAction } from "@/app/admin/actions/content";
import {
  CONSTRUCTION_STATUSES,
  CONSTRUCTION_STATUS_LABELS,
  MARKETS,
  MARKET_LABELS,
  PROJECT_CATEGORIES,
  PROJECT_CATEGORY_LABELS,
} from "@/lib/content-labels";

const selectCls = "h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm";

export function NewProjectForm() {
  const router = useRouter();
  const [v, setV] = useState({ name: "", category: "RESIDENTIAL", constructionStatus: "ONGOING", market: "PAKISTAN", city: "" });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [pending, start] = useTransition();
  const set = (k: keyof typeof v, value: string) => setV((s) => ({ ...s, [k]: value }));
  return (
    <Card className="max-w-2xl">
      <CardContent className="p-6">
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await createProjectAction(v);
              if (res?.ok && res.data) {
                toast.success("Project created");
                router.push(`/admin/projects/${res.data.id}`);
              } else if (res && !res.ok) {
                setErrors(res.fieldErrors ?? {});
                toast.error(res.message);
              }
            });
          }}
        >
          <FormField label="Project name" htmlFor="np-name" required error={errors.name} className="sm:col-span-2">
            <Input id="np-name" value={v.name} onChange={(e) => set("name", e.target.value)} autoFocus />
          </FormField>
          <FormField label="Category" htmlFor="np-cat" required error={errors.category}>
            <select id="np-cat" className={selectCls} value={v.category} onChange={(e) => set("category", e.target.value)}>
              {PROJECT_CATEGORIES.map((c) => <option key={c} value={c}>{PROJECT_CATEGORY_LABELS[c]}</option>)}
            </select>
          </FormField>
          <FormField label="Construction status" htmlFor="np-status" required error={errors.constructionStatus}>
            <select id="np-status" className={selectCls} value={v.constructionStatus} onChange={(e) => set("constructionStatus", e.target.value)}>
              {CONSTRUCTION_STATUSES.map((c) => <option key={c} value={c}>{CONSTRUCTION_STATUS_LABELS[c]}</option>)}
            </select>
          </FormField>
          <FormField label="Country / market" htmlFor="np-market" required error={errors.market}>
            <select id="np-market" className={selectCls} value={v.market} onChange={(e) => set("market", e.target.value)}>
              {MARKETS.map((m) => <option key={m} value={m}>{MARKET_LABELS[m]}</option>)}
            </select>
          </FormField>
          <FormField label="City" htmlFor="np-city" required error={errors.city}>
            <Input id="np-city" value={v.city} onChange={(e) => set("city", e.target.value)} />
          </FormField>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={pending}>{pending ? <Loader2 className="animate-spin" /> : null} Create project</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
