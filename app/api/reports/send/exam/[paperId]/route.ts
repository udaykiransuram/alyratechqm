import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import { syncExamRuntimeMongoProjectionsForPaperWithCooldown } from "@/lib/exam-runtime-sync-cache";
import { resolvePaperSubjectIds } from "@/lib/question-paper/subjects";
import {
  isSectionInScope,
  normalizeScopeId,
  resolveTeacherPaperScope,
} from "@/lib/question-paper/access";
import ReportDispatchJob from "@/models/ReportDispatchJob";
import { requireTenantSession } from "@/lib/api-auth";
import {
  enqueueReportDispatchJobs,
  scheduleReportDispatchWorker,
} from "@/lib/reports/dispatchQueue";
import { getTrustedInternalOrigin } from "@/lib/security/internal-origin";
import { withRequestBudget } from "@/lib/server/request-governor";

function normalizeMobileNumber(input: string): string {
  const digits = String(input || "").replace(/\D/g, "");
  if (/^[1-9]\d{9,14}$/.test(digits)) {
    if (digits.length === 10) return `91${digits}`;
    return digits;
  }
  return digits;
}

function toIdString(value: any) {
  return String(value?._id || value || "");
}

function hasExplicitSectionAccess(user: any, sectionId: string) {
  if (!sectionId) return false;
  if (user?.hasAllSections) return true;
  return Array.isArray(user?.academicSectionIds)
    ? user.academicSectionIds.some(
        (candidate: any) => toIdString(candidate) === sectionId,
      )
    : false;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ paperId: string }> },
) {
  const auth = await requireTenantSession(req, {
    allowRoles: ["admin", "teacher"],
  });
  if (!auth.ok) return auth.response;
  const { paperId } = await params;
  return withRequestBudget(
    {
      request: req,
      policy: "reportDispatchSend",
      schoolKey: auth.schoolKey,
      userId: auth.session.user.id,
      scopeId: `${auth.schoolKey}:${paperId}`,
    },
    async () => {
      await connectDB();
      const { schoolKey } = auth;
      const requestCookies = req.headers.get("cookie") || "";

      if (!process.env.WHATSAPP_ACCESS_TOKEN) {
        return NextResponse.json(
          {
            success: false,
            message:
              "WhatsApp is not configured: WHATSAPP_ACCESS_TOKEN missing in environment",
          },
          { status: 500 },
        );
      }
      if (!process.env.WHATSAPP_PHONE_NUMBER_ID) {
        return NextResponse.json(
          {
            success: false,
            message:
              "WhatsApp is not configured: WHATSAPP_PHONE_NUMBER_ID missing in environment",
          },
          { status: 500 },
        );
      }

  const academicSectionId =
    new URL(req.url).searchParams.get("academicSectionId")?.trim() || "";
  if (
    academicSectionId &&
    !mongoose.Types.ObjectId.isValid(academicSectionId)
  ) {
    return NextResponse.json(
      { success: false, message: "Invalid academicSectionId" },
      { status: 400 },
    );
  }

  const {
    QuestionPaperResponse: QPRModel,
    User: UserModel,
    AcademicSection: AcademicSectionModel,
    QuestionPaper: QuestionPaperModel,
    Class: ClassModel,
  } = await getTenantModels(schoolKey, [
    "QuestionPaperResponse",
    "User",
    "AcademicSection",
    "QuestionPaper",
    "Class",
  ]);

  const paper = await QuestionPaperModel.findById(paperId)
    .select("title class subject subjectIds assignedAcademicSections")
    .populate({ path: "class", model: ClassModel, select: "name" })
    .lean();

  if (!paper || (Array.isArray(paper) && paper.length === 0)) {
    return NextResponse.json(
      { success: false, message: "Question paper not found" },
      { status: 404 },
    );
  }

  const paperObj: any = Array.isArray(paper) ? paper[0] : paper;
  const paperClassId = toIdString(paperObj.class);
  const paperClassName = String(paperObj?.class?.name || "");
  const paperSubjectIds = resolvePaperSubjectIds(paperObj);
  const assignedPaperSectionIds = Array.isArray(paperObj?.assignedAcademicSections)
    ? paperObj.assignedAcademicSections
        .map((section: any) => normalizeScopeId(section))
        .filter(Boolean)
    : [];

  let teacherScope: ReturnType<typeof resolveTeacherPaperScope> | null = null;
  if (auth.session.user.role === "teacher") {
    const scopedUser = await UserModel.findById(auth.session.user.id)
      .select(
        "hasAllClasses classIds hasAllSubjects subjectIds hasAllSections academicSectionIds",
      )
      .lean();
    teacherScope = resolveTeacherPaperScope(
      scopedUser,
      normalizeScopeId(paperClassId),
      paperSubjectIds,
      assignedPaperSectionIds,
    );
    if (
      !teacherScope.hasClassAccess ||
      !teacherScope.hasSubjectAccess ||
      !teacherScope.hasSectionAccess
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "You do not have access to dispatch reports for this paper.",
        },
        { status: 403 },
      );
    }
  }

  if (!paperClassId || !mongoose.Types.ObjectId.isValid(paperClassId)) {
    return NextResponse.json(
      { success: false, message: "Paper class is invalid or missing" },
      { status: 400 },
    );
  }

  await syncExamRuntimeMongoProjectionsForPaperWithCooldown(
    schoolKey,
    paperId,
    { minIntervalMs: 60_000 },
  ).catch(
    (error) => {
      console.error(
        "Failed to sync exam runtime attempts into Mongo projections before report dispatch:",
        error,
      );
      return new Map<string, string>();
    },
  );

  const paperClassObjectId = new mongoose.Types.ObjectId(paperClassId);
  const paperSubjectObjectIds = paperSubjectIds
    .filter((subjectId) => mongoose.Types.ObjectId.isValid(subjectId))
    .map((subjectId) => new mongoose.Types.ObjectId(subjectId));

  const responseQuery: Record<string, any> = { paper: paperId };
  let academicSectionName = "";
  let selectedAcademicSectionDoc: any = null;

  if (academicSectionId) {
    selectedAcademicSectionDoc = await AcademicSectionModel.findById(
      academicSectionId,
    )
      .select("name class")
      .lean();
    if (!selectedAcademicSectionDoc) {
      return NextResponse.json(
        { success: false, message: "Academic section not found" },
        { status: 404 },
      );
    }
    if (toIdString(selectedAcademicSectionDoc.class) !== paperClassId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Selected class section does not belong to this paper's class",
        },
        { status: 400 },
      );
    }
    if (
      teacherScope &&
      !isSectionInScope(academicSectionId, teacherScope.allowedSectionIds)
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "You do not have access to dispatch reports for the selected section.",
        },
        { status: 403 },
      );
    }
    academicSectionName = selectedAcademicSectionDoc.name || "";
    const matchingStudentIds = await UserModel.find({
      role: "student",
      academicSection: new mongoose.Types.ObjectId(academicSectionId),
    })
      .select("_id")
      .lean();
    responseQuery.student = {
      $in: matchingStudentIds.map((student: any) => student._id),
    };
  } else if (teacherScope && teacherScope.allowedSectionIds !== null) {
    const scopedStudents = await UserModel.find({
      role: "student",
      academicSection: {
        $in: teacherScope.allowedSectionIds
          .filter((id) => mongoose.Types.ObjectId.isValid(id))
          .map((id) => new mongoose.Types.ObjectId(id)),
      },
    })
      .select("_id")
      .lean();
    responseQuery.student = {
      $in: scopedStudents.map((student: any) => student._id),
    };
  }

  const responses = await QPRModel.find(responseQuery).select("_id").lean();

  if (!responses.length) {
    return NextResponse.json(
      {
        success: false,
        message: academicSectionName
          ? `No responses found for ${academicSectionName}.`
          : "No responses found for this paper.",
      },
      { status: 404 },
    );
  }

  let studentQueued = 0;
  let studentAlreadyQueued = 0;
  const studentFailures: string[] = [];
  const queuedJobIds = new Set<string>();
  const baseUrl = getTrustedInternalOrigin();

  for (const response of responses as any[]) {
    try {
      const res = await fetch(
        `${baseUrl}/api/reports/send/student/${response._id}?school=${encodeURIComponent(schoolKey)}&triggerWorker=0`,
        {
          method: "POST",
          headers: {
            "x-school-key": schoolKey,
            ...(requestCookies ? { cookie: requestCookies } : {}),
          },
        },
      );
      const data = await res.json();
      if (res.ok && data?.success) {
        if (data?.deliveryStatus === "queued" && data?.jobId) {
          queuedJobIds.add(String(data.jobId));
        }
        if (data?.message === "Report already queued")
          studentAlreadyQueued += 1;
        else studentQueued += 1;
      } else {
        studentFailures.push(String(response._id));
      }
    } catch {
      studentFailures.push(String(response._id));
    }
  }

  const assignedAcademicSectionIds = Array.isArray(
    paperObj?.assignedAcademicSections,
  )
    ? paperObj.assignedAcademicSections
        .map((section: any) => toIdString(section))
        .filter(Boolean)
    : [];

  let paperSectionDocs: any[] = [];
  if (selectedAcademicSectionDoc) {
    paperSectionDocs = [selectedAcademicSectionDoc];
  } else if (assignedAcademicSectionIds.length > 0) {
    paperSectionDocs = await AcademicSectionModel.find({
      _id: {
        $in: assignedAcademicSectionIds.map(
          (id: string) => new mongoose.Types.ObjectId(id),
        ),
      },
    })
      .select("name class")
      .sort({ name: 1 })
      .lean();
  } else {
    paperSectionDocs = await AcademicSectionModel.find({
      class: paperClassObjectId,
    })
      .select("name class")
      .sort({ name: 1 })
      .lean();
  }

  if (teacherScope && teacherScope.allowedSectionIds !== null) {
    paperSectionDocs = paperSectionDocs.filter((sectionDoc) =>
      isSectionInScope(toIdString(sectionDoc?._id), teacherScope!.allowedSectionIds),
    );
  }

  const recipientQuery: Record<string, any> = {
    role: { $in: ["teacher", "admin"] },
    mobileNumber: { $exists: true, $ne: "" },
    $and: [
      {
        $or: [{ hasAllClasses: true }, { classIds: paperClassObjectId }],
      },
    ],
  };

  if (paperSubjectObjectIds.length > 0) {
    recipientQuery.$and.push({
      $or: [
        { hasAllSubjects: true },
        { subjectIds: { $in: paperSubjectObjectIds } },
      ],
    });
  }

  if (academicSectionId) {
    recipientQuery.$and.push({
      $or: [
        { hasAllSections: true },
        { academicSectionIds: new mongoose.Types.ObjectId(academicSectionId) },
      ],
    });
  }
  if (teacherScope && teacherScope.allowedSectionIds !== null) {
    const allowedSectionObjectIds = teacherScope.allowedSectionIds
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));
    recipientQuery.$and.push({
      $or: [
        { hasAllSections: true },
        { academicSectionIds: { $in: allowedSectionObjectIds } },
      ],
    });
  }

  const recipients = await UserModel.find(recipientQuery)
    .select(
      "name role mobileNumber academicSectionIds hasAllSections classIds subjectIds hasAllClasses hasAllSubjects",
    )
    .lean();

  let teacherQueued = 0;
  let teacherAlreadyQueued = 0;
  let adminQueued = 0;
  let adminAlreadyQueued = 0;
  const recipientFailures: string[] = [];

  for (const recipient of recipients as any[]) {
    const normalizedMobile = normalizeMobileNumber(
      recipient?.mobileNumber || "",
    );
    if (!normalizedMobile) {
      recipientFailures.push(
        `${recipient?.role || "user"}:${recipient?._id || "unknown"}`,
      );
      continue;
    }

    let scopes: any[] = [];

    if (selectedAcademicSectionDoc) {
      if (hasExplicitSectionAccess(recipient, academicSectionId)) {
        scopes = [selectedAcademicSectionDoc];
      }
    } else if (paperSectionDocs.length === 0) {
      scopes = [null];
    } else if (recipient?.hasAllSections) {
      scopes = [...paperSectionDocs];
    } else {
      const allowedSectionIds = new Set(
        Array.isArray(recipient?.academicSectionIds)
          ? recipient.academicSectionIds.map((sectionId: any) =>
              toIdString(sectionId),
            )
          : [],
      );
      scopes = paperSectionDocs.filter((sectionDoc) =>
        allowedSectionIds.has(toIdString(sectionDoc?._id)),
      );
    }

    if (scopes.length === 0) {
      continue;
    }

    for (const scope of scopes) {
      const isTeacher = recipient.role === "teacher";
      const queuedField = isTeacher ? "teacherQueued" : "adminQueued";
      const alreadyField = isTeacher
        ? "teacherAlreadyQueued"
        : "adminAlreadyQueued";
      const dedupeQuery: Record<string, any> = {
        schoolKey,
        type: recipient.role,
        student: recipient._id,
        paperId: paperObj._id,
        status: { $in: ["queued", "processing"] },
      };

      if (scope?._id) {
        dedupeQuery.academicSection = scope._id;
      } else {
        dedupeQuery.$or = [
          { academicSection: { $exists: false } },
          { academicSection: null },
        ];
      }

      const existingQueued =
        await ReportDispatchJob.findOne(dedupeQuery).lean();
      if (existingQueued) {
        if (existingQueued.status === "queued" && existingQueued._id) {
          queuedJobIds.add(String(existingQueued._id));
        }
        if (alreadyField === "teacherAlreadyQueued") teacherAlreadyQueued += 1;
        else adminAlreadyQueued += 1;
        continue;
      }

      const queuedJob = await ReportDispatchJob.create({
        schoolKey,
        type: recipient.role,
        student: recipient._id,
        studentName: recipient?.name || undefined,
        paperId: paperObj._id,
        paperTitle: paperObj?.title || undefined,
        classId: paperClassObjectId,
        className: paperClassName || undefined,
        academicSection: scope?._id || undefined,
        academicSectionName: scope?.name || undefined,
        status: "queued",
        mobileNumber: normalizedMobile,
        attempts: 0,
        maxAttempts: 3,
        nextRetryAt: new Date(),
      });
      queuedJobIds.add(String(queuedJob._id));

      if (queuedField === "teacherQueued") teacherQueued += 1;
      else adminQueued += 1;
    }
  }

  const queued = studentQueued + teacherQueued + adminQueued;
  const alreadyQueued =
    studentAlreadyQueued + teacherAlreadyQueued + adminAlreadyQueued;
  const failedCount = studentFailures.length + recipientFailures.length;
  let workerResult = null;

  if (queuedJobIds.size > 0) {
    await enqueueReportDispatchJobs({
      schoolKey,
      jobIds: Array.from(queuedJobIds),
    }).catch(() => null);
    scheduleReportDispatchWorker({
      schoolKey,
      jobIds: Array.from(queuedJobIds),
    });
    workerResult = {
      queued: true,
      jobCount: queuedJobIds.size,
    };
  }

      return NextResponse.json({
        success: queued > 0 || alreadyQueued > 0,
        queued,
        alreadyQueued,
        studentQueued,
        studentAlreadyQueued,
        teacherQueued,
        teacherAlreadyQueued,
        adminQueued,
        adminAlreadyQueued,
        failedCount,
        failedResponseIds: studentFailures,
        failedRecipients: recipientFailures,
        academicSection: academicSectionName || undefined,
        worker: workerResult,
      });
    },
  );
}
