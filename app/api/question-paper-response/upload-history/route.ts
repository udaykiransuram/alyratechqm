import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";

import { resolveAuditActor, recordTenantAudit } from "@/lib/audit";
import { requireTenantSession } from "@/lib/api-auth";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";

export const dynamic = "force-dynamic";

const MAX_STORED_RESULTS = 500;

function normalizeObjectId(value: unknown) {
  const nextValue = String(value || "").trim();
  return mongoose.Types.ObjectId.isValid(nextValue) ? nextValue : "";
}

export async function GET(req: NextRequest) {
  const auth = await requireTenantSession(req, {
    allowRoles: ["admin", "teacher"],
  });
  if (!auth.ok) {
    return auth.response;
  }
  const schoolKey = auth.schoolKey;

  await connectDB();

  try {
    const { ResponseUploadHistory: ResponseUploadHistoryModel } =
      await getTenantModels(schoolKey, ["ResponseUploadHistory"]);

    const url = new URL(req.url);
    const paperId = normalizeObjectId(url.searchParams.get("paperId"));
    const academicSectionId = normalizeObjectId(
      url.searchParams.get("academicSectionId"),
    );
    const limitParam = Number(url.searchParams.get("limit") || "10");
    const limit = Math.min(Math.max(Number.isFinite(limitParam) ? limitParam : 10, 1), 50);

    const query: Record<string, any> = {};
    if (paperId) query.paper = paperId;
    if (academicSectionId) query.academicSection = academicSectionId;

    const histories = await ResponseUploadHistoryModel.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate({ path: "paper", select: "title" })
      .populate({ path: "academicSection", select: "name" })
      .lean();

    return NextResponse.json({ success: true, histories });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to load upload history." },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireTenantSession(req, {
    allowRoles: ["admin", "teacher"],
  });
  if (!auth.ok) {
    return auth.response;
  }
  const schoolKey = auth.schoolKey;

  await connectDB();

  try {
    const {
      ResponseUploadHistory: ResponseUploadHistoryModel,
      QuestionPaper: QuestionPaperModel,
      AcademicSection: AcademicSectionModel,
    } = await getTenantModels(schoolKey, [
      "ResponseUploadHistory",
      "QuestionPaper",
      "AcademicSection",
    ]);

    const body = await req.json();
    const paperId = normalizeObjectId(body?.paperId ?? body?.paper);
    const academicSectionId = normalizeObjectId(
      body?.academicSectionId ?? body?.academicSection,
    );

    if (!paperId) {
      return NextResponse.json(
        { success: false, message: "paperId is required." },
        { status: 400 },
      );
    }

    const paper = await QuestionPaperModel.findById(paperId)
      .select("title")
      .lean();
    if (!paper) {
      return NextResponse.json(
        { success: false, message: "Question paper not found." },
        { status: 404 },
      );
    }

    let academicSection: any = null;
    if (academicSectionId) {
      academicSection = await AcademicSectionModel.findById(academicSectionId)
        .select("name")
        .lean();
      if (!academicSection) {
        return NextResponse.json(
          { success: false, message: "Academic section not found." },
          { status: 404 },
        );
      }
    }

    const actor = await resolveAuditActor(schoolKey, req);
    const incomingResults = Array.isArray(body?.results) ? body.results : [];
    const results = incomingResults.slice(0, MAX_STORED_RESULTS).map((result: any) => ({
      row: Number(result?.row || 0),
      candidateId: String(result?.candidateId || "").trim() || undefined,
      candidateName: String(result?.candidateName || "").trim() || undefined,
      status:
        result?.status === "updated" ||
        result?.status === "skipped" ||
        result?.status === "failed"
          ? result.status
          : "created",
      message: String(result?.message || "").trim() || undefined,
      responseId: normalizeObjectId(result?.responseId) || undefined,
    }));

    const totalRows = Math.max(Number(body?.totalRows || results.length || 0), 0);
    const successCount = Math.max(Number(body?.successCount || 0), 0);
    const failureCount = Math.max(Number(body?.failureCount || 0), 0);
    const skippedCount = Math.max(Number(body?.skippedCount || 0), 0);
    const createdCount = Math.max(Number(body?.createdCount || 0), 0);
    const updatedCount = Math.max(Number(body?.updatedCount || 0), 0);
    const validationIssueCount = Math.max(Number(body?.validationIssueCount || 0), 0);
    const duplicateRowCount = Math.max(Number(body?.duplicateRowCount || 0), 0);

    const status =
      successCount > 0 && failureCount > 0
        ? "partial"
        : successCount > 0
          ? "completed"
          : "failed";

    const history = await ResponseUploadHistoryModel.create({
      paper: paperId,
      academicSection: academicSectionId || undefined,
      fileName: String(body?.fileName || "").trim() || undefined,
      uploadMode:
        body?.uploadMode === "overwrite_existing"
          ? "overwrite_existing"
          : "skip_existing",
      status,
      totalRows,
      successCount,
      failureCount,
      skippedCount,
      createdCount,
      updatedCount,
      validationIssueCount,
      duplicateRowCount,
      resultsTruncated: incomingResults.length > MAX_STORED_RESULTS,
      results,
      summary: String(body?.summary || "").trim() || undefined,
      initiatedBy: actor?.id && mongoose.Types.ObjectId.isValid(actor.id) ? actor.id : undefined,
      initiatedByName: actor?.name,
      initiatedByRole: actor?.role,
      startedAt: body?.startedAt ? new Date(body.startedAt) : undefined,
      completedAt: body?.completedAt ? new Date(body.completedAt) : new Date(),
    });

    await recordTenantAudit({
      schoolKey,
      req,
      entityType: "response_upload_history",
      entityId: String(history._id),
      entityLabel: `${paper.title}`,
      action: "logged",
      summary: `Logged response upload batch for ${paper.title}.`,
      details: {
        paperId,
        paperTitle: paper.title,
        academicSectionId: academicSectionId || null,
        academicSectionName: academicSection?.name || null,
        uploadMode: history.uploadMode,
        status,
        totalRows,
        successCount,
        failureCount,
        skippedCount,
        createdCount,
        updatedCount,
        validationIssueCount,
        duplicateRowCount,
      },
      actor,
    });

    return NextResponse.json({ success: true, history }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error?.message || "Failed to save upload history." },
      { status: 500 },
    );
  }
}
