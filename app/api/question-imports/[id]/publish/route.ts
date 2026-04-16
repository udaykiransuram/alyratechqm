export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

import { recordTenantAudit } from "@/lib/audit";
import { requireTenantSession } from "@/lib/api-auth";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import { publishQuestionImportDraft } from "@/lib/question-import/publish";
import {
  getWorkspaceQuestionImportDraft,
  serializeQuestionImportDraftRecord,
} from "@/lib/server/question-imports";
import { withRequestBudget } from "@/lib/server/request-governor";

export async function POST(
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

  return withRequestBudget(
    {
      request: req,
      policy: "questionImportPublish",
      schoolKey: auth.schoolKey,
      userId: auth.session.user.id,
      scopeId: `${auth.schoolKey}:${id}`,
    },
    async () => {
      await connectDB();
      const {
        QuestionImportDraft: QuestionImportDraftModel,
      } = await getTenantModels(auth.schoolKey, ["QuestionImportDraft"]);

      const draft = await QuestionImportDraftModel.findById(id).lean();
      if (!draft) {
        return NextResponse.json(
          {
            success: false,
            message: "The requested question import draft could not be found.",
          },
          { status: 404 },
        );
      }

      const serializedDraft =
        (await getWorkspaceQuestionImportDraft(auth.schoolKey, id)) ||
        serializeQuestionImportDraftRecord(draft);
      if (
        serializedDraft.status === "published" &&
        serializedDraft.publishedPaperId
      ) {
        return NextResponse.json({
          success: true,
          alreadyPublished: true,
          questionIds: serializedDraft.publishedQuestionIds || [],
          paperId: serializedDraft.publishedPaperId,
          draft: serializedDraft,
        });
      }

      try {
        const result = await publishQuestionImportDraft({
          schoolKey: auth.schoolKey,
          actorId: auth.session.user.id,
          viewerRole: auth.session.user.role === "admin" ? "admin" : "teacher",
          draft: serializedDraft,
        });

        const updatedDraft = await QuestionImportDraftModel.findById(id).lean();

        await recordTenantAudit({
          schoolKey: auth.schoolKey,
          req,
          entityType: "questionImportDraft",
          entityId: id,
          entityLabel: String(draft?.sourceFile?.name || ""),
          action: "publish",
          summary: "Published questions and a draft paper from an import review.",
          details: {
            paperId: result.paperId,
            questionIds: result.questionIds,
            questionCount: result.questionIds.length,
          },
        });

        revalidatePath("/workspace/questions");
        revalidatePath("/workspace/question-papers");
        revalidatePath(`/workspace/upload/${id}`);

        return NextResponse.json({
          success: true,
          questionIds: result.questionIds,
          paperId: result.paperId,
          draft: updatedDraft
            ? serializeQuestionImportDraftRecord(updatedDraft)
            : null,
        });
      } catch (error) {
        return NextResponse.json(
          {
            success: false,
            message:
              error instanceof Error
                ? error.message
                : "Failed to publish the question import draft.",
          },
          { status: 400 },
        );
      }
    },
  );
}
