export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { recordTenantAudit } from "@/lib/audit";
import { requireTenantSession } from "@/lib/api-auth";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import { deriveQuestionImportDraftStatus } from "@/lib/question-import/review";
import {
  applyWorkspaceQuestionImportMappings,
  getWorkspaceQuestionImportDraft,
  serializeQuestionImportDraftRecord,
} from "@/lib/server/question-imports";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireTenantSession(req, {
    allowRoles: ["admin", "teacher"],
  });
  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;
  const draft = await getWorkspaceQuestionImportDraft(auth.schoolKey, id);
  if (!draft) {
    return NextResponse.json(
      {
        success: false,
        message: "The requested question import draft could not be found.",
      },
      { status: 404 },
    );
  }

  return NextResponse.json({
    success: true,
    draft,
  });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireTenantSession(req, {
    allowRoles: ["admin", "teacher"],
  });
  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;
  const body = await req.json().catch(() => null);

  if (!body || typeof body !== "object" || !("payload" in body)) {
    return NextResponse.json(
      {
        success: false,
        message: "A draft payload is required to save review changes.",
      },
      { status: 400 },
    );
  }

  await connectDB();
  const { QuestionImportDraft: QuestionImportDraftModel } = await getTenantModels(
    auth.schoolKey,
    ["QuestionImportDraft"],
  );

  const existingDraft = await QuestionImportDraftModel.findById(id).lean();
  if (!existingDraft) {
    return NextResponse.json(
      {
        success: false,
        message: "The requested question import draft could not be found.",
      },
      { status: 404 },
    );
  }

  if (String(existingDraft?.status || "") === "published") {
    return NextResponse.json(
      {
        success: false,
        message: "Published import drafts are read-only.",
      },
      { status: 409 },
    );
  }

  try {
    const nextPayload = await applyWorkspaceQuestionImportMappings(
      auth.schoolKey,
      JSON.parse(JSON.stringify(body.payload)),
    );
    const status = deriveQuestionImportDraftStatus(nextPayload);

    const updatedDraft = await QuestionImportDraftModel.findByIdAndUpdate(
      id,
      {
        $set: {
          payload: nextPayload,
          status,
          updatedBy: auth.session.user.id,
        },
      },
      { new: true },
    ).lean();

    await recordTenantAudit({
      schoolKey: auth.schoolKey,
      req,
      entityType: "questionImportDraft",
      entityId: id,
      entityLabel: String(existingDraft?.sourceFile?.name || ""),
      action: "update",
      summary: "Saved question import review changes.",
      details: {
        status,
      },
    });

    return NextResponse.json({
      success: true,
      draft: serializeQuestionImportDraftRecord(updatedDraft),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to save the question import draft.",
      },
      { status: 400 },
    );
  }
}
