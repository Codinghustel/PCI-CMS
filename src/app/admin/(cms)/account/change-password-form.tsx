"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/admin/ui";
import { changePasswordAction } from "@/app/admin/actions/auth";

export function ChangePasswordForm() {
  const [v, setV] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [pending, start] = useTransition();
  return (
    <Card className="max-w-lg">
      <CardHeader><CardTitle className="text-base">Change password</CardTitle></CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await changePasswordAction(v);
              if (res?.ok) {
                toast.success(res.message ?? "Password changed");
                setV({ currentPassword: "", newPassword: "", confirmPassword: "" });
                setErrors({});
              } else if (res) {
                setErrors(res.fieldErrors ?? {});
                toast.error(res.message);
              }
            });
          }}
        >
          <FormField label="Current password" htmlFor="cp-cur" error={errors.currentPassword}><Input id="cp-cur" type="password" autoComplete="current-password" value={v.currentPassword} onChange={(e) => setV({ ...v, currentPassword: e.target.value })} /></FormField>
          <FormField label="New password" htmlFor="cp-new" error={errors.newPassword} help="At least 12 characters with upper- and lower-case letters and a number."><Input id="cp-new" type="password" autoComplete="new-password" value={v.newPassword} onChange={(e) => setV({ ...v, newPassword: e.target.value })} /></FormField>
          <FormField label="Confirm new password" htmlFor="cp-conf" error={errors.confirmPassword}><Input id="cp-conf" type="password" autoComplete="new-password" value={v.confirmPassword} onChange={(e) => setV({ ...v, confirmPassword: e.target.value })} /></FormField>
          <Button type="submit" disabled={pending}>{pending ? <Loader2 className="animate-spin" /> : null} Change password</Button>
        </form>
      </CardContent>
    </Card>
  );
}
