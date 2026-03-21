import mongoose from "mongoose";
import { getServerSession, type Session } from "next-auth";
import type { NextRequest } from "next/server";

import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import CompanyAdmin from "@/models/CompanyAdmin";
import CompanyAuditLog from "@/models/CompanyAuditLog";

export type CompanyAuditActorSnapshot = {
  id?: string;
  name?: string;
  email?: string;
  role?: string;
};

export function buildCompanyAuditActorFromSession(
  session?: Session | null,
): CompanyAuditActorSnapshot {
  return {
    id: String(session?.user?.id || "").trim() || undefined,
    name: String(session?.user?.name || "").trim() || undefined,
    email: String(session?.user?.email || "").trim() || undefined,
    role: String(session?.user?.role || "").trim() || undefined,
  };
}

async function resolveCompanyAuditActor(): Promise<CompanyAuditActorSnapshot> {
  try {
    const session = await getServerSession(authOptions);
    const actor = buildCompanyAuditActorFromSession(session);

    if (!actor.id || !mongoose.Types.ObjectId.isValid(actor.id)) {
      return actor;
    }

    await connectDB();
    const companyAdmin = await CompanyAdmin.findById(actor.id)
      .select("name email")
      .lean();

    return {
      id: actor.id,
      name:
        String(companyAdmin?.name || actor.name || "").trim() || undefined,
      email:
        String(companyAdmin?.email || actor.email || "").trim() || undefined,
      role: actor.role,
    };
  } catch {
    return {};
  }
}

export async function recordCompanyAudit({
  schoolKey,
  req,
  entityType,
  entityId,
  entityLabel,
  action,
  summary,
  details,
  actor,
  source,
}: {
  schoolKey?: string | null;
  req?: NextRequest;
  entityType: string;
  entityId?: string | null;
  entityLabel?: string | null;
  action: string;
  summary: string;
  details?: Record<string, any> | null;
  actor?: CompanyAuditActorSnapshot | null;
  source?: string | null;
}) {
  try {
    await connectDB();

    const actorSnapshot = actor || (await resolveCompanyAuditActor());

    await CompanyAuditLog.create({
      schoolKey: schoolKey ? String(schoolKey).trim() : undefined,
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
      source: String(source || "api").trim() || "api",
      requestMethod: req?.method || undefined,
      requestPath: req?.nextUrl?.pathname || undefined,
      ipAddress:
        req?.headers.get("x-forwarded-for") ||
        req?.headers.get("x-real-ip") ||
        undefined,
      userAgent: req?.headers.get("user-agent") || undefined,
    });
  } catch {}
}
