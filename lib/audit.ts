import mongoose from "mongoose";
import { getServerSession } from "next-auth/next";
import type { NextRequest } from "next/server";

import { authOptions } from "@/lib/auth";
import { getTenantModels } from "@/lib/db-tenant";

export type AuditActorSnapshot = {
  id?: string;
  name?: string;
  email?: string;
  role?: string;
};

export async function resolveAuditActor(
  schoolKey: string,
  _req?: NextRequest,
): Promise<AuditActorSnapshot> {
  try {
    const session = await getServerSession(authOptions);
    const actorId = String(session?.user?.id || "").trim();
    const actorRole = String(session?.user?.role || "").trim();

    if (!actorId || !mongoose.Types.ObjectId.isValid(actorId)) {
      return {
        role: actorRole || undefined,
      };
    }

    const { User: UserModel } = await getTenantModels(schoolKey, ["User"]);
    const actor = await UserModel.findById(actorId)
      .select("name email role")
      .lean();

    return {
      id: actorId,
      name: String(actor?.name || session?.user?.name || "").trim() || undefined,
      email: String(actor?.email || session?.user?.email || "").trim() || undefined,
      role: String(actor?.role || actorRole || "").trim() || undefined,
    };
  } catch {
    return {};
  }
}

export async function recordTenantAudit({
  schoolKey,
  req,
  entityType,
  entityId,
  entityLabel,
  action,
  summary,
  details,
  actor,
}: {
  schoolKey: string;
  req?: NextRequest;
  entityType: string;
  entityId?: string | null;
  entityLabel?: string | null;
  action: string;
  summary: string;
  details?: Record<string, any> | null;
  actor?: AuditActorSnapshot | null;
}) {
  try {
    if (!schoolKey) return;

    const actorSnapshot = actor || (await resolveAuditActor(schoolKey, req));
    const { AuditLog: AuditLogModel } = await getTenantModels(schoolKey, [
      "AuditLog",
    ]);

    await AuditLogModel.create({
      entityType: String(entityType || "").trim(),
      entityId: entityId ? String(entityId).trim() : undefined,
      entityLabel: entityLabel ? String(entityLabel).trim() : undefined,
      action: String(action || "").trim(),
      summary: String(summary || "").trim(),
      details: details || undefined,
      actorId: actorSnapshot?.id,
      actorName: actorSnapshot?.name,
      actorEmail: actorSnapshot?.email,
      actorRole: actorSnapshot?.role,
      source: "api",
      ipAddress:
        req?.headers.get("x-forwarded-for") ||
        req?.headers.get("x-real-ip") ||
        undefined,
      userAgent: req?.headers.get("user-agent") || undefined,
    });
  } catch {
  }
}
