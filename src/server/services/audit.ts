import type { Prisma } from "@/generated/prisma/client";
import { db, type Tx } from "@/server/db";
import type { Actor } from "@/lib/auth/permissions";

export interface AuditEntry {
  action: string; // e.g. "page.publish"
  entityType: string; // e.g. "Page"
  entityId?: string | null;
  summary: string;
  metadata?: Prisma.InputJsonValue;
}

/** Records an audit event. Never include passwords, tokens or personal data in metadata. */
export async function audit(actor: Pick<Actor, "id"> | null, entry: AuditEntry, tx: Tx | typeof db = db) {
  await tx.auditLog.create({
    data: {
      actorId: actor?.id ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      summary: entry.summary.slice(0, 500),
      metadata: entry.metadata,
    },
  });
}

export async function listAuditLogs(params: { page: number; pageSize: number; entityType?: string; q?: string }) {
  const where: Prisma.AuditLogWhereInput = {
    ...(params.entityType ? { entityType: params.entityType } : {}),
    ...(params.q
      ? {
          OR: [
            { summary: { contains: params.q, mode: "insensitive" } },
            { action: { contains: params.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      include: { actor: { select: { name: true, email: true } } },
    }),
    db.auditLog.count({ where }),
  ]);
  return { items, total };
}
