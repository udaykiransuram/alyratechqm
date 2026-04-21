export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { recordTenantAudit } from "@/lib/audit";
import { requireTenantSession } from "@/lib/api-auth";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import {
  isSupportedQuestionImportMimeType,
  parseTeacherMasterDocx,
} from "@/lib/question-import/docx";
import {
  isSupportedQuestionImportWorkbookMimeType,
  parseDiagnosticQuestionWorkbook,
} from "@/lib/question-import/xlsx";
import { deriveQuestionImportDraftStatus } from "@/lib/question-import/review";
import { storePublicImage } from "@/lib/server/public-image-storage";
import {
  applyWorkspaceQuestionImportMappings,
  serializeQuestionImportDraftRecord,
} from "@/lib/server/question-imports";
import { withRequestBudget } from "@/lib/server/request-governor";

const MAX_IMPORT_UPLOAD_SIZE_BYTES = 20 * 1024 * 1024;
const MAX_IMPORT_UPLOAD_SIZE_LABEL = "20 MB";

function hasDocxFileName(value: string) {
  return String(value || "").trim().toLowerCase().endsWith(".docx");
}

function hasXlsxFileName(value: string) {
  return String(value || "").trim().toLowerCase().endsWith(".xlsx");
}

function isSupportedQuestionImportFile(file: File) {
  return (
    isSupportedQuestionImportMimeType(file.type) ||
    isSupportedQuestionImportWorkbookMimeType(file.type) ||
    String(file.type || "").trim().toLowerCase() === "application/octet-stream" ||
    hasDocxFileName(file.name) ||
    hasXlsxFileName(file.name)
  );
}

export async function POST(req: NextRequest) {
  const auth = await requireTenantSession(req, {
    allowRoles: ["admin", "teacher"],
  });
  if (!auth.ok) {
    return auth.response;
  }

  return withRequestBudget(
    {
      request: req,
      policy: "questionImportCreate",
      schoolKey: auth.schoolKey,
      userId: auth.session.user.id,
    },
    async () => {
      const formData = await req.formData();
      const file = formData.get("file");

      if (!(file instanceof File)) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Upload a teacher-master DOCX or diagnostic XLSX file to start an import draft.",
          },
          { status: 400 },
        );
      }

      if (!isSupportedQuestionImportFile(file)) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Only teacher-master DOCX or diagnostic XLSX files are supported in this import flow.",
          },
          { status: 400 },
        );
      }

      if (file.size <= 0) {
        return NextResponse.json(
          {
            success: false,
            message: "The uploaded import file is empty.",
          },
          { status: 400 },
        );
      }

      if (file.size > MAX_IMPORT_UPLOAD_SIZE_BYTES) {
        return NextResponse.json(
          {
            success: false,
            message: `The uploaded import file is too large. Keep imports under ${MAX_IMPORT_UPLOAD_SIZE_LABEL}.`,
          },
          { status: 413 },
        );
      }

      try {
        await connectDB();
        const {
          QuestionImportDraft: QuestionImportDraftModel,
        } = await getTenantModels(auth.schoolKey, ["QuestionImportDraft"]);

        const buffer = Buffer.from(await file.arrayBuffer());
        const parsedPayload =
          hasXlsxFileName(file.name) ||
          isSupportedQuestionImportWorkbookMimeType(file.type)
            ? await parseDiagnosticQuestionWorkbook({
                buffer,
                fileName: file.name,
              })
            : await parseTeacherMasterDocx({
                buffer,
                storeImage: async ({
                  buffer: imageBuffer,
                  fileName,
                  sourcePath,
                }) =>
                  storePublicImage({
                    buffer: imageBuffer,
                    schoolKey: auth.schoolKey,
                    fileName,
                    mimeType: undefined,
                    relativeFolder: "question-imports",
                  }).then((storedImage) => ({
                    url: storedImage.url,
                    fileName:
                      storedImage.fileName ||
                      sourcePath.split("/").pop() ||
                      fileName,
                  })),
              });

    const payload = await applyWorkspaceQuestionImportMappings(
      auth.schoolKey,
      parsedPayload,
    );
    const status = deriveQuestionImportDraftStatus(payload);

    const draft = await QuestionImportDraftModel.create({
      status,
      sourceFile: {
        name: file.name,
        mimeType:
          file.type ||
          (hasXlsxFileName(file.name)
            ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
        size: file.size,
      },
      payload,
      createdBy: auth.session.user.id,
      updatedBy: auth.session.user.id,
    });

    await recordTenantAudit({
      schoolKey: auth.schoolKey,
      req,
      entityType: "questionImportDraft",
      entityId: String(draft?._id || ""),
      entityLabel: file.name,
      action: "create",
      summary: "Created a question import draft.",
      details: {
        status,
        questionCount: Array.isArray(payload.questions) ? payload.questions.length : 0,
        sectionCount: Array.isArray(payload.paperSections)
          ? payload.paperSections.length
          : 0,
        sourceFileName: file.name,
      },
    });

        return NextResponse.json(
          {
            success: true,
            draft: serializeQuestionImportDraftRecord(draft),
          },
          { status: 201 },
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to create the question import draft.";
        const normalizedMessage = message.toLowerCase();
        const isStorageConfigurationError =
          normalizedMessage.includes("vercel blob") ||
          normalizedMessage.includes("blob_read_write_token") ||
          normalizedMessage.includes("image uploads") ||
          normalizedMessage.includes("file uploads");

        return NextResponse.json(
          {
            success: false,
            message,
          },
          { status: isStorageConfigurationError ? 500 : 400 },
        );
      }
    },
  );
}
