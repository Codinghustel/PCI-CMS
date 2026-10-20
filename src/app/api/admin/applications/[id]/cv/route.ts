import { connection } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { jsonError } from "@/lib/http";
import { downloadApplicationCv } from "@/server/services/applications";

/** GET /api/admin/applications/:id/cv — private CV download (applications.read). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await connection();
  try {
    const { id } = await params;
    const actor = await requirePermission("applications.read");
    const { data, name } = await downloadApplicationCv(actor, id);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${name.replace(/"/g, "")}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return jsonError(e);
  }
}
