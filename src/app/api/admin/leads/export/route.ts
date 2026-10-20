import { connection } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { jsonError } from "@/lib/http";
import { exportLeadsCsv } from "@/server/services/leads";

/** GET /api/admin/leads/export?formType=&crmStatus=&q=&from=&to= — CSV download (leads.export). */
export async function GET(request: Request) {
  await connection();
  try {
    const actor = await requirePermission("leads.export");
    const url = new URL(request.url);
    const date = (v: string | null) => (v && !Number.isNaN(Date.parse(v)) ? new Date(v) : undefined);
    const csv = await exportLeadsCsv(actor, {
      formType: url.searchParams.get("formType") || undefined,
      crmStatus: url.searchParams.get("crmStatus") || undefined,
      q: url.searchParams.get("q") || undefined,
      from: date(url.searchParams.get("from")),
      to: date(url.searchParams.get("to")),
    });
    return new Response(`﻿${csv}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="pci-leads-${new Date().toISOString().slice(0, 10)}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return jsonError(e);
  }
}
