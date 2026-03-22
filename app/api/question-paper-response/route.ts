import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";

import { hydrateResponsesWithStudents } from "@/lib/analytics/hydrateResponses";
import { buildArchiveFilter } from "@/lib/archive";
import { requireTenantSession } from "@/lib/api-auth";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import { normalizeMatrixSelections } from "@/lib/question-paper/grading";
import {
  findStudentsByRollNumber,
  normalizeRollNumber,
} from "@/lib/user-credentials";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

function resolveSchoolKey(req: NextRequest) {
  const url = new URL(req.url);
  const schoolFromHeader =
    req.headers.get("x-school-key") || req.headers.get("X-School-Key");
  const schoolFromQuery = url.searchParams.get("school");
  const schoolFromCookie = req.cookies?.get?.("schoolKey")?.value;
  return (schoolFromHeader || schoolFromQuery || schoolFromCookie || "")
    .toString()
    .trim();
}

function normalizeId(value: unknown) {
  return value ? String(value).trim() : "";
}

function normalizeDate(value: unknown, fallback?: Date) {
  if (!value) return fallback;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function normalizeSelectedOptions(value: unknown) {
  if (!Array.isArray(value)) return [] as number[];
  return Array.from(
    new Set(
      value
        .map((item) => Number(item))
        .filter((item) => Number.isInteger(item) && Number.isFinite(item)),
    ),
  );
}

function hasAnyMatrixSelection(value: unknown) {
  return normalizeMatrixSelections(value).some((row) => row.length > 0);
}

async function validateAcademicSection(
  AcademicSectionModel: any,
  classId: string,
  academicSectionId: string,
) {
  if (!academicSectionId) {
    return { ok: true, section: null } as const;
  }

  if (!mongoose.Types.ObjectId.isValid(academicSectionId)) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: "Invalid academicSectionId." },
        { status: 400 },
      ),
    } as const;
  }

  const section = await AcademicSectionModel.findOne({
    _id: academicSectionId,
    ...buildArchiveFilter(false),
  })
    .select("class isActive name")
    .lean();

  if (!section) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: "Academic section not found." },
        { status: 404 },
      ),
    } as const;
  }

  if ((section as any).isActive === false) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: "Academic section is inactive." },
        { status: 400 },
      ),
    } as const;
  }

  if (classId && String((section as any).class) !== String(classId)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          message: "Selected academic section does not belong to the student's class.",
        },
        { status: 400 },
      ),
    } as const;
  }

  return { ok: true, section } as const;
}

function matchesStudentPlacementForUpload(
  student: {
    class?: unknown;
    academicSection?: unknown;
  },
  classId: string,
  academicSectionId: string,
) {
  if (classId && String(student?.class || "") !== String(classId)) {
    return false;
  }

  if (
    academicSectionId &&
    String(student?.academicSection || "") !== String(academicSectionId)
  ) {
    return false;
  }

  return true;
}

function buildPaperSectionMap(paperDoc: any) {
  const sectionMap = new Map<
    string,
    {
      name: string;
      questions: Map<
        string,
        {
          questionId: string;
          type: string;
          optionCount: number;
          optionIndexes: Set<number>;
          matrixRowCount: number;
          matrixColumnIndexes: Set<number>;
        }
      >;
    }
  >();

  (Array.isArray(paperDoc?.sections) ? paperDoc.sections : []).forEach(
    (section: any) => {
      const questionMap = new Map();
      (Array.isArray(section?.questions) ? section.questions : []).forEach(
        (entry: any) => {
          const questionDoc = entry?.question || {};
          const questionId = normalizeId(questionDoc?._id || questionDoc);
          if (!questionId) return;
          const optionCount = Array.isArray(questionDoc?.options)
            ? questionDoc.options.length
            : 0;
          const matrixOptions = Array.isArray(questionDoc?.matrixOptions)
            ? questionDoc.matrixOptions
            : [];
          const matrixAnswers = normalizeMatrixSelections(questionDoc?.matrixAnswers);
          const matrixRows = matrixOptions
            .map((option: any) => String(option?.left || "").trim())
            .filter(Boolean);
          const matrixColumns = matrixOptions
            .map((option: any) => String(option?.right || "").trim())
            .filter(Boolean);
          const maxMatrixColumnIndex = matrixAnswers.reduce((max, row) => {
            const rowMax = Array.isArray(row) && row.length > 0 ? Math.max(...row) : -1;
            return Math.max(max, rowMax);
          }, -1);
          questionMap.set(questionId, {
            questionId,
            type: String(questionDoc?.type || "single").trim() || "single",
            optionCount,
            optionIndexes: new Set(
              Array.from({ length: optionCount }, (_value, index) => index),
            ),
            matrixRowCount: Math.max(matrixRows.length, matrixAnswers.length),
            matrixColumnIndexes: new Set(
              Array.from(
                {
                  length: Math.max(matrixColumns.length, maxMatrixColumnIndex + 1),
                },
                (_value, index) => index,
              ),
            ),
          });
        },
      );
      sectionMap.set(String(section?.name || "").trim(), {
        name: String(section?.name || "").trim(),
        questions: questionMap,
      });
    },
  );

  return sectionMap;
}

function validateAndNormalizeSectionAnswers(
  sectionAnswers: any,
  paperSectionMap: ReturnType<typeof buildPaperSectionMap>,
) {
  const issues: string[] = [];
  const normalizedSections: any[] = [];
  let totalAnswerCount = 0;

  if (!Array.isArray(sectionAnswers) || sectionAnswers.length === 0) {
    return {
      ok: false,
      issues: ["At least one section answer is required."],
      sectionAnswers: [],
      totalAnswerCount: 0,
    };
  }

  const seenQuestionIds = new Set<string>();

  sectionAnswers.forEach((sectionAnswer: any, sectionIndex: number) => {
    const sectionName = String(sectionAnswer?.sectionName || "").trim();
    if (!sectionName) {
      issues.push(`Section ${sectionIndex + 1}: sectionName is required.`);
      return;
    }

    const paperSection = paperSectionMap.get(sectionName);
    if (!paperSection) {
      issues.push(`Section ${sectionName}: not found in the question paper.`);
      return;
    }

    if (!Array.isArray(sectionAnswer?.answers)) {
      issues.push(`Section ${sectionName}: answers must be an array.`);
      return;
    }

    const normalizedAnswers: any[] = [];

    sectionAnswer.answers.forEach((answer: any, answerIndex: number) => {
      const questionId = normalizeId(answer?.question);
      if (!questionId) {
        issues.push(`Section ${sectionName}: answer ${answerIndex + 1} is missing a question.`);
        return;
      }

      if (seenQuestionIds.has(`${sectionName}:${questionId}`)) {
        issues.push(`Section ${sectionName}: question ${questionId} is duplicated.`);
        return;
      }

      const questionMeta = paperSection.questions.get(questionId);
      if (!questionMeta) {
        issues.push(`Section ${sectionName}: question ${questionId} does not belong to this paper section.`);
        return;
      }

      const selectedOptions = normalizeSelectedOptions(answer?.selectedOptions);
      const rawMatrixSelections = Array.isArray(answer?.matrixSelections)
        ? answer.matrixSelections
        : [];
      const matrixSelections = normalizeMatrixSelections(rawMatrixSelections, {
        rowCount: questionMeta.matrixRowCount,
      });
      const answerText = String(answer?.answerText || "").trim();
      const marksAwarded =
        typeof answer?.marksAwarded === "number" && Number.isFinite(answer.marksAwarded)
          ? Number(answer.marksAwarded)
          : undefined;
      const hasMatrixSelections = hasAnyMatrixSelection(matrixSelections);

      if (selectedOptions.length === 0 && !answerText && !hasMatrixSelections) {
        return;
      }

      if ((questionMeta.type === "single" || questionMeta.type === "multiple") && hasMatrixSelections) {
        issues.push(`Section ${sectionName}: question ${questionId} cannot store matrix selections.`);
        return;
      }

      if (questionMeta.type === "single" && selectedOptions.length > 1) {
        issues.push(`Section ${sectionName}: question ${questionId} accepts only one selected option.`);
        return;
      }

      if ((questionMeta.type === "single" || questionMeta.type === "multiple") && selectedOptions.length > 0) {
        const invalidOption = selectedOptions.find(
          (optionIndex) => !questionMeta.optionIndexes.has(optionIndex),
        );
        if (invalidOption !== undefined) {
          issues.push(
            `Section ${sectionName}: question ${questionId} has invalid selected option index ${invalidOption}.`,
          );
          return;
        }
      }

      if (questionMeta.type === "descriptive" && selectedOptions.length > 0) {
        issues.push(`Section ${sectionName}: descriptive question ${questionId} cannot store selected options.`);
        return;
      }

      if (questionMeta.type === "descriptive" && hasMatrixSelections) {
        issues.push(`Section ${sectionName}: descriptive question ${questionId} cannot store matrix selections.`);
        return;
      }

      if (questionMeta.type === "matrix-match") {
        if (selectedOptions.length > 0) {
          issues.push(`Section ${sectionName}: matrix match question ${questionId} cannot store selected options.`);
          return;
        }

        if (answerText) {
          issues.push(`Section ${sectionName}: matrix match question ${questionId} cannot store text answers.`);
          return;
        }

        const extraAnsweredRows = rawMatrixSelections
          .slice(questionMeta.matrixRowCount)
          .some((row: unknown) => normalizeSelectedOptions(row).length > 0);
        if (extraAnsweredRows) {
          issues.push(`Section ${sectionName}: question ${questionId} has answers for unknown matrix rows.`);
          return;
        }

        const invalidOption = matrixSelections
          .flat()
          .find((optionIndex) => !questionMeta.matrixColumnIndexes.has(optionIndex));
        if (invalidOption !== undefined) {
          issues.push(
            `Section ${sectionName}: question ${questionId} has invalid matrix option index ${invalidOption}.`,
          );
          return;
        }
      }

      seenQuestionIds.add(`${sectionName}:${questionId}`);
      normalizedAnswers.push({
        question: questionId,
        selectedOptions,
        ...(hasMatrixSelections ? { matrixSelections } : {}),
        ...(answerText ? { answerText } : {}),
        ...(typeof marksAwarded === "number" ? { marksAwarded } : {}),
      });
    });

    if (normalizedAnswers.length > 0) {
      totalAnswerCount += normalizedAnswers.length;
      normalizedSections.push({
        sectionName,
        answers: normalizedAnswers,
      });
    }
  });

  if (totalAnswerCount === 0) {
    issues.push("No valid answers found in the upload payload.");
  }

  return {
    ok: issues.length === 0,
    issues,
    sectionAnswers: normalizedSections,
    totalAnswerCount,
  };
}

async function resolveStudentDocument({
  bodyStudent,
  paperDoc,
  UserModel,
  AcademicSectionModel,
}: {
  bodyStudent: any;
  paperDoc: any;
  UserModel: any;
  AcademicSectionModel: any;
}) {
  const paperClassId = normalizeId(paperDoc?.class?._id || paperDoc?.class);
  const assignedAcademicSectionIds = new Set(
    (Array.isArray(paperDoc?.assignedAcademicSections)
      ? paperDoc.assignedAcademicSections
      : []
    )
      .map((section: any) => normalizeId(section?._id || section))
      .filter(Boolean),
  );

  let studentDoc: any = null;
  let studentCreated = false;

  if (
    typeof bodyStudent === "string" ||
    (bodyStudent && bodyStudent._id && !bodyStudent.rollNumber)
  ) {
    const studentId =
      typeof bodyStudent === "string" ? bodyStudent : bodyStudent._id;
    studentDoc = await UserModel.findOne({
      _id: studentId,
      ...buildArchiveFilter(false),
    });
    if (!studentDoc) {
      return {
        ok: false,
        response: NextResponse.json(
          { success: false, message: "Student not found." },
          { status: 404 },
        ),
      } as const;
    }
  } else if (bodyStudent && bodyStudent.rollNumber) {
    const requestedRollNumber = normalizeRollNumber(bodyStudent.rollNumber);
    const classId = normalizeId(
      bodyStudent.class ?? bodyStudent.classId ?? paperClassId,
    );
    const academicSectionId = normalizeId(
      bodyStudent.academicSection ??
        bodyStudent.academicSectionId ??
        bodyStudent.sectionId ??
        bodyStudent.section,
    );

    const sectionValidation = await validateAcademicSection(
      AcademicSectionModel,
      classId,
      academicSectionId,
    );
    if (!sectionValidation.ok) {
      return sectionValidation;
    }

    if (!requestedRollNumber) {
      return {
        ok: false,
        response: NextResponse.json(
          { success: false, message: "Student roll number is required." },
          { status: 400 },
        ),
      } as const;
    }

    const matchingStudents = await findStudentsByRollNumber(
      UserModel,
      requestedRollNumber,
      { limit: 10 },
    );
    const compatibleStudents = matchingStudents.filter((candidate: any) =>
      matchesStudentPlacementForUpload(
        candidate,
        classId,
        academicSectionId,
      ),
    );

    if (compatibleStudents.length > 1) {
      return {
        ok: false,
        response: NextResponse.json(
          {
            success: false,
            message: `Multiple active students already use roll number "${requestedRollNumber}". Resolve duplicate student usernames before uploading more responses for this roll number.`,
          },
          { status: 409 },
        ),
      } as const;
    }

    if (compatibleStudents.length === 1) {
      studentDoc = compatibleStudents[0];
    } else if (matchingStudents.length > 0) {
      return {
        ok: false,
        response: NextResponse.json(
          {
            success: false,
            message: `Roll number "${requestedRollNumber}" already belongs to another active student in this school. Update the existing student record or choose a different roll number before uploading.`,
          },
          { status: 409 },
        ),
      } as const;
    }

    if (!studentDoc) {
      const mobileNumber = String(
        bodyStudent.mobileNumber ??
          bodyStudent.phone ??
          bodyStudent.contactNumber ??
          requestedRollNumber ??
          "",
      ).trim();

      if (!mobileNumber) {
        return {
          ok: false,
          response: NextResponse.json(
            {
              success: false,
              message:
                "Student mobileNumber is required when creating a new student from a response upload.",
            },
            { status: 400 },
          ),
        } as const;
      }

      studentDoc = await UserModel.create({
        name: String(bodyStudent.name || requestedRollNumber || "Student").trim(),
        mobileNumber,
        passwordHash: await bcrypt.hash(requestedRollNumber, 10),
        rollNumber: requestedRollNumber,
        class: classId || undefined,
        academicSection: academicSectionId || undefined,
        role: "student",
        enrolledAt: new Date(),
      });
      studentCreated = true;
    }
  } else {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: "Student information is required." },
        { status: 400 },
      ),
    } as const;
  }

  if (String(studentDoc?.role || "") !== "student") {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: "Responses can only be uploaded for student users." },
        { status: 400 },
      ),
    } as const;
  }

  const studentClassId = normalizeId(studentDoc?.class);
  if (paperClassId && studentClassId !== paperClassId) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          message: "Selected student does not belong to this paper's class.",
        },
        { status: 400 },
      ),
    } as const;
  }

  const studentAcademicSectionId = normalizeId(studentDoc?.academicSection);
  if (assignedAcademicSectionIds.size > 0) {
    if (!studentAcademicSectionId) {
      return {
        ok: false,
        response: NextResponse.json(
          {
            success: false,
            message:
              "This paper is assigned to specific class sections. The student must belong to one of them.",
          },
          { status: 400 },
        ),
      } as const;
    }

    if (!assignedAcademicSectionIds.has(studentAcademicSectionId)) {
      return {
        ok: false,
        response: NextResponse.json(
          {
            success: false,
            message:
              "Student academic section is not assigned to this paper.",
          },
          { status: 400 },
        ),
      } as const;
    }
  }

  return {
    ok: true,
    studentDoc,
    studentCreated,
  } as const;
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const auth = await requireTenantSession(req, {
      allowRoles: ["admin", "teacher"],
    });
    if (!auth.ok) return auth.response;
    const schoolKey = auth.schoolKey as string;

    const {
      QuestionPaperResponse: QPRModel,
      QuestionPaper: QPModel,
      Question: QuestionModel,
      User: UserModel,
      AcademicSection: AcademicSectionModel,
      Class: ClassModel,
      Subject: SubjectModel,
    } = await getTenantModels(schoolKey, [
      "QuestionPaperResponse",
      "QuestionPaper",
      "Question",
      "User",
      "AcademicSection",
      "Class",
      "Subject",
    ]);

    const body = await req.json();
    const paperId = normalizeId(body?.paper);
    const uploadMode =
      body?.uploadMode === "overwrite_existing"
        ? "overwrite_existing"
        : "skip_existing";

    const paperDoc = await QPModel.findOne({
      _id: paperId,
      ...buildArchiveFilter(false),
    })
      .populate({ path: "class", model: ClassModel, select: "name" })
      .populate({ path: "subject", model: SubjectModel, select: "name" })
      .populate({
        path: "assignedAcademicSections",
        model: AcademicSectionModel,
        select: "name class isActive",
      })
      .populate({
        path: "sections.questions.question",
        model: QuestionModel,
        select: "options answerIndexes type content matrixOptions matrixAnswers",
      })
      .lean();

    if (!paperDoc) {
      return NextResponse.json(
        { success: false, message: "Invalid question paper." },
        { status: 400 },
      );
    }

    const studentResolution = await resolveStudentDocument({
      bodyStudent: body?.student,
      paperDoc,
      UserModel,
      AcademicSectionModel,
    });
    if (!studentResolution.ok) {
      return studentResolution.response;
    }

    const normalizedStartedAt = normalizeDate(body?.startedAt, new Date());
    const normalizedSubmittedAt = normalizeDate(body?.submittedAt, undefined);
    const normalizedTotalMarksAwarded =
      typeof body?.totalMarksAwarded === "number" &&
      Number.isFinite(body.totalMarksAwarded)
        ? Number(body.totalMarksAwarded)
        : undefined;

    const paperSectionMap = buildPaperSectionMap(paperDoc);
    const normalizedSectionAnswers = validateAndNormalizeSectionAnswers(
      body?.sectionAnswers,
      paperSectionMap,
    );

    if (!normalizedSectionAnswers.ok) {
      return NextResponse.json(
        {
          success: false,
          message: normalizedSectionAnswers.issues[0] || "Invalid response payload.",
          issues: normalizedSectionAnswers.issues,
        },
        { status: 400 },
      );
    }

    const existingResponse = await QPRModel.findOne({
      paper: paperId,
      student: studentResolution.studentDoc._id,
    });

    if (existingResponse && uploadMode === "skip_existing") {
      return NextResponse.json({
        success: true,
        response: existingResponse,
        responseAction: "skipped",
        studentCreated: studentResolution.studentCreated,
        message: "Skipped existing response for this student and paper.",
      });
    }

    if (existingResponse) {
      existingResponse.sectionAnswers = normalizedSectionAnswers.sectionAnswers;
      existingResponse.startedAt = normalizedStartedAt || existingResponse.startedAt;
      existingResponse.submittedAt = normalizedSubmittedAt || existingResponse.submittedAt;
      existingResponse.status = normalizedSubmittedAt
        ? "submitted"
        : "submitted";
      existingResponse.lastSavedAt = new Date();
      if (typeof normalizedTotalMarksAwarded === "number") {
        existingResponse.totalMarksAwarded = normalizedTotalMarksAwarded;
      }
      await existingResponse.save();

      return NextResponse.json({
        success: true,
        response: existingResponse,
        responseAction: "updated",
        studentCreated: studentResolution.studentCreated,
        message: "Updated existing response for this student and paper.",
      });
    }

    const response = await QPRModel.create({
      paper: paperId,
      student: studentResolution.studentDoc._id,
      sectionAnswers: normalizedSectionAnswers.sectionAnswers,
      startedAt: normalizedStartedAt,
      submittedAt: normalizedSubmittedAt,
      status: "submitted",
      lastSavedAt: new Date(),
      totalMarksAwarded: normalizedTotalMarksAwarded,
    });

    return NextResponse.json(
      {
        success: true,
        response,
        responseAction: "created",
        studentCreated: studentResolution.studentCreated,
        message: "Response uploaded successfully.",
      },
      { status: 201 },
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Server error" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  await connectDB();

  try {
    const auth = await requireTenantSession(req, {
      allowRoles: ["admin", "teacher"],
    });
    if (!auth.ok) return auth.response;
    const schoolKey = auth.schoolKey as string;

    const {
      QuestionPaperResponse: QPRModel,
      QuestionPaper: QPModel,
      User: UserModel,
      AcademicSection: AcademicSectionModel,
      Subject: SubjectModel,
      Class: ClassModel,
    } = await getTenantModels(schoolKey, [
      "QuestionPaperResponse",
      "QuestionPaper",
      "User",
      "AcademicSection",
      "Subject",
      "Class",
    ]);

    const url = req.nextUrl;
    const paperId = url.searchParams.get("paper");
    const studentId = url.searchParams.get("student");
    const academicSectionId =
      url.searchParams.get("academicSectionId")?.trim() || "";
    const summaryMode = url.searchParams.get("summary") === "1";
    const limitParam = Number(url.searchParams.get("limit") || "40");
    const limit = Math.min(
      100,
      Math.max(Number.isFinite(limitParam) ? Math.floor(limitParam) : 40, 1),
    );
    const pageParam = Number(url.searchParams.get("page") || "1");

    if (!paperId && !studentId) {
      return NextResponse.json(
        { success: false, message: "Paper ID or Student ID is required" },
        { status: 400 },
      );
    }

    if (academicSectionId && !mongoose.Types.ObjectId.isValid(academicSectionId)) {
      return NextResponse.json(
        { success: false, message: "Invalid academicSectionId." },
        { status: 400 },
      );
    }

    if (studentId) {
      const responses = await QPRModel.find({ student: studentId })
        .populate({
          path: "paper",
          model: QPModel,
          select: "title subject class assignedAcademicSections",
          populate: [
            { path: "subject", model: SubjectModel, select: "name" },
            { path: "class", model: ClassModel, select: "name" },
            {
              path: "assignedAcademicSections",
              model: AcademicSectionModel,
              select: "name class",
              populate: { path: "class", model: ClassModel, select: "name" },
            },
          ],
        })
        .lean();

      responses.sort((a: any, b: any) => {
        const aDate = a.submittedAt
          ? new Date(a.submittedAt).getTime()
          : new Date(a.startedAt || a.createdAt).getTime();
        const bDate = b.submittedAt
          ? new Date(b.submittedAt).getTime()
          : new Date(b.startedAt || b.createdAt).getTime();
        return bDate - aDate;
      });

      return NextResponse.json({ success: true, responses });
    }

    const paper = await QPModel.findById(paperId)
      .select(
        summaryMode
          ? "class assignedAcademicSections"
          : "class assignedAcademicSections sections.name sections.questions.question",
      )
      .populate({
        path: "assignedAcademicSections",
        model: AcademicSectionModel,
        select: "name class",
      })
      .lean();

    if (!paper) {
      return NextResponse.json(
        { success: false, message: "Question paper not found" },
        { status: 404 },
      );
    }

    const resolvedAcademicSections = Array.isArray((paper as any).assignedAcademicSections)
      ? (paper as any).assignedAcademicSections
          .map((section: any) => ({
            id: String(section?._id || ""),
            name: String(section?.name || ""),
          }))
          .filter((section: any) => section.id)
      : [];

    const academicSections =
      resolvedAcademicSections.length > 0
        ? resolvedAcademicSections
        : (paper as any).class
          ? await AcademicSectionModel.find({
              class: (paper as any).class,
              isActive: true,
              ...buildArchiveFilter(false),
            })
              .select("name")
              .sort({ name: 1 })
              .lean()
              .then((sections: any[]) =>
                sections.map((section: any) => ({
                  id: String(section?._id || ""),
                  name: String(section?.name || ""),
                })),
              )
          : [];

    if (summaryMode) {
      let filteredStudentIds: any[] | null = null;
      if (academicSectionId) {
        const studentsInSection = await UserModel.find({
          role: "student",
          academicSection: new mongoose.Types.ObjectId(academicSectionId),
        })
          .select("_id")
          .lean();
        filteredStudentIds = studentsInSection.map((student: any) => student._id);
      }

      const responseQuery: any = { paper: paperId };
      if (filteredStudentIds) {
        responseQuery.student = { $in: filteredStudentIds };
      }

      const totalCount = await QPRModel.countDocuments(responseQuery);
      const pages = Math.max(1, Math.ceil(totalCount / limit));
      const page = Math.min(
        Math.max(Number.isFinite(pageParam) ? Math.floor(pageParam) : 1, 1),
        pages,
      );
      const skip = (page - 1) * limit;

      const responses = await QPRModel.find(responseQuery)
        .select("student submittedAt totalMarksAwarded createdAt")
        .sort({ submittedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const hydratedResponses = await hydrateResponsesWithStudents({
        responses,
        UserModel,
        AcademicSectionModel,
        ClassModel,
        studentSelect: "name rollNumber academicSection",
      });

      return NextResponse.json({
        success: true,
        responses: hydratedResponses,
        total: totalCount,
        page,
        pages,
        limit,
        academicSections,
      });
    }

    const questionInfoMap = new Map<string, number>();
    if (!Array.isArray((paper as any).sections)) {
      return NextResponse.json({ success: true, responses: [] });
    }

    (paper as any).sections.forEach((section: any) => {
      let questionInSectionCounter = 1;
      section.questions.forEach((question: any) => {
        questionInfoMap.set(String(question.question), questionInSectionCounter);
        questionInSectionCounter += 1;
      });
    });

    const responses = await QPRModel.find({ paper: paperId }).lean();

    const hydratedResponses = await hydrateResponsesWithStudents({
      responses,
      UserModel,
      AcademicSectionModel,
      ClassModel,
      studentSelect: "name rollNumber academicSection",
    });

    const augmentedResponses = hydratedResponses.map((response: any) => ({
      ...response,
      sectionAnswers: (response.sectionAnswers || []).map((sectionAnswer: any) => ({
        ...sectionAnswer,
        answers: (sectionAnswer.answers || []).map((answer: any) => ({
          ...answer,
          questionNumber: questionInfoMap.get(String(answer.question)) ?? "N/A",
        })),
      })),
    }));

    return NextResponse.json({ success: true, responses: augmentedResponses });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 },
    );
  }
}
