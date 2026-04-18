import bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import { cache } from "react";

import { buildArchiveFilter, buildRestoreUpdate } from "@/lib/archive";
import type { StudentCourseSummary } from "@/lib/courses/types";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import { getSafeReturnToPath } from "@/lib/navigation/returnTo";
import { listStudentCoursesPage } from "@/lib/server/student-courses";
import { paperRequiresManualReview, paperSupportsOnlineDelivery } from "@/lib/student-tests";
import {
  buildSummerCrashDiagnosticHref,
  buildSummerCrashStudentReportHref,
  normalizeSummerCrashClassBandKey,
  normalizeSummerCrashNameKey,
  normalizeSummerCrashPhone,
  normalizeSummerCrashText,
} from "@/lib/summer-crash/shared";
import {
  deriveSummerCrashCourseAccessState,
  type SummerCrashCourseAccessState,
  type SummerCrashPaymentStatus,
} from "@/lib/summer-crash/course-access";
import {
  canAccessSummerCrashPortalTarget,
  getDefaultSummerCrashPortalAccessPolicy,
  SUMMER_CRASH_PORTAL_ACCESS_LOCK_MESSAGE,
  type SummerCrashPortalAccessPolicy,
  type SummerCrashPortalAccessTarget,
} from "@/lib/summer-crash/portal-access";
import { provisionTenant } from "@/lib/tenant-provision";
import {
  getDefaultStudentPassword,
  isUsingDefaultStudentPassword,
  validatePasswordInput,
} from "@/lib/user-credentials";
import SummerCrashCampaign, {
  type ISummerCrashCampaign,
  type ISummerCrashCampaignClassMapping,
} from "@/models/SummerCrashCampaign";
import SummerCrashEnrollment, {
  type SummerCrashEnrollmentDiagnosticStatus,
  type SummerCrashEnrollmentEntrySource,
} from "@/models/SummerCrashEnrollment";
import SummerCrashPayment from "@/models/SummerCrashPayment";
import School from "@/models/School";
import {
  SUMMER_CRASH_CURRENCY,
  SUMMER_CRASH_DEFAULT_CLASS_BANDS,
  SUMMER_CRASH_DISPLAY_NAME,
  SUMMER_CRASH_HOME_PATH,
  SUMMER_CRASH_PRICE,
  SUMMER_CRASH_SCHOOL_KEY,
  SUMMER_CRASH_SIGNIN_PATH,
  SUMMER_CRASH_SUPPORT_CONTACT,
  SUMMER_CRASH_WHATSAPP_GROUP_URL,
  isSummerCrashSchoolKey,
} from "@/lib/summer-crash/constants";

const SUMMER_CRASH_SUMMER_ID_PREFIX = "SC";
const SUMMER_CRASH_SUMMER_ID_MIN = 100000;
const SUMMER_CRASH_SUMMER_ID_MAX = 999999;

type SummerCrashQuestionPaperSummary = {
  _id: string;
  title: string;
  totalMarks: number;
  duration: number;
  classId: string;
  className: string;
  onlineEnabled: boolean;
  assignedSectionCount: number;
  supportsInstantResults: boolean;
  supportsOnlineDelivery: boolean;
  requiresManualReview: boolean;
  questionCount: number;
};

export type SummerCrashPublicClassBand = {
  classBand: string;
  className: string;
  diagnosticQuestionPaperId?: string;
};

export type SummerCrashLookupMatch = {
  studentName: string;
  guardianName: string;
  classBand: string;
  summerId: string;
  maskedSummerId: string;
};

export type SummerCrashDiagnosticState = {
  questionPaperId: string;
  title: string;
  duration: number;
  totalMarks: number;
  status: SummerCrashEnrollmentDiagnosticStatus;
  launchHref: string;
  reportHref: string;
  score: number | null;
  percent: number | null;
  available: boolean;
};

export const SUMMER_CRASH_COURSE_ACCESS_LOCK_MESSAGE =
  "Summer Crash Course lessons unlock after payment.";

export type SummerCrashStudentState = {
  title: string;
  supportContact: string;
  studentName: string;
  guardianName: string;
  classBand: string;
  summerId: string;
  requiresPasswordSetup: boolean;
  courseAccess: SummerCrashCourseAccessState;
  courses: StudentCourseSummary[];
  destinationHref: string;
  diagnostic: SummerCrashDiagnosticState | null;
};

type SummerCrashQuestionPaperDoc = {
  _id?: unknown;
  title?: unknown;
  totalMarks?: unknown;
  duration?: unknown;
  class?: { _id?: unknown; name?: unknown } | unknown;
  onlineEnabled?: unknown;
  assignedAcademicSections?: unknown[];
  sections?: unknown[];
};

type SummerCrashPaymentLookupContext = {
  _id?: unknown;
  summerId?: unknown;
  studentName?: unknown;
  phoneDigits?: unknown;
  phone?: unknown;
  classBand?: unknown;
};

function normalizeEntrySource(
  value: unknown,
): SummerCrashEnrollmentEntrySource {
  return String(value || "").trim() === "diagnostic"
    ? "diagnostic"
    : "direct_registration";
}

function buildDefaultSummerCrashClassMappings() {
  return SUMMER_CRASH_DEFAULT_CLASS_BANDS.map((classBand, index) => ({
    classBand,
    className: classBand,
    courseIds: [],
    diagnosticQuestionPaperId: undefined,
    sortOrder: index,
  }));
}

function sortSummerCrashClassMappings(
  mappings: ISummerCrashCampaignClassMapping[] | undefined,
) {
  return [...(Array.isArray(mappings) ? mappings : [])].sort((left, right) => {
    return Number(left?.sortOrder || 0) - Number(right?.sortOrder || 0);
  });
}

export function normalizeSummerCrashClassMappings(
  mappings: ISummerCrashCampaignClassMapping[] | undefined,
) {
  const normalized = sortSummerCrashClassMappings(mappings)
    .map((mapping, index) => ({
      classBand: normalizeSummerCrashText(mapping?.classBand),
      className:
        normalizeSummerCrashText(mapping?.className) ||
        normalizeSummerCrashText(mapping?.classBand),
      courseIds: Array.from(
        new Set(
          (Array.isArray(mapping?.courseIds) ? mapping.courseIds : [])
            .map((courseId) => String(courseId || "").trim())
            .filter(Boolean),
        ),
      ),
      diagnosticQuestionPaperId:
        String(mapping?.diagnosticQuestionPaperId || "").trim() || undefined,
      sortOrder:
        Number.isFinite(Number(mapping?.sortOrder))
          ? Number(mapping?.sortOrder)
          : index,
    }))
    .filter((mapping) => mapping.classBand && mapping.className);

  return normalized.length > 0 ? normalized : buildDefaultSummerCrashClassMappings();
}

export function resolveSummerCrashClassMapping(
  campaign: Pick<ISummerCrashCampaign, "classMappings">,
  classBand: string,
) {
  const normalizedClassBand = normalizeSummerCrashClassBandKey(classBand);
  return normalizeSummerCrashClassMappings(campaign.classMappings).find(
    (mapping) =>
      normalizeSummerCrashClassBandKey(mapping.classBand) === normalizedClassBand,
  );
}

function filterCoursesBySummerCrashMapping(params: {
  campaign: Pick<ISummerCrashCampaign, "classMappings">;
  classBand: string;
  courses: StudentCourseSummary[];
}) {
  const mapping = resolveSummerCrashClassMapping(
    params.campaign,
    params.classBand,
  );
  if (!mapping || mapping.courseIds.length === 0) {
    return params.courses;
  }

  const allowedCourseIds = new Set(mapping.courseIds);
  return params.courses.filter((course) => allowedCourseIds.has(course._id));
}

async function generateUniqueSummerCrashId(UserModel: any) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = `${SUMMER_CRASH_SUMMER_ID_PREFIX}${randomInt(
      SUMMER_CRASH_SUMMER_ID_MIN,
      SUMMER_CRASH_SUMMER_ID_MAX + 1,
    )}`;
    const existing = await UserModel.findOne({
      role: "student",
      rollNumber: candidate,
      ...buildArchiveFilter(false),
    })
      .select("_id")
      .lean();
    if (!existing) {
      return candidate;
    }
  }

  throw new Error("We couldn't generate a Summer ID right now.");
}

export async function ensureSummerCrashSchoolProvisioned() {
  await connectDB();

  let school = await School.findOne({ key: SUMMER_CRASH_SCHOOL_KEY })
    .select("_id key displayName")
    .lean();

  if (!school) {
    try {
      await School.create({
        key: SUMMER_CRASH_SCHOOL_KEY,
        displayName: SUMMER_CRASH_DISPLAY_NAME,
      });
    } catch (error) {
      const duplicateKey =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: unknown }).code === 11000;
      if (!duplicateKey) {
        throw error;
      }
    }

    school = await School.findOne({ key: SUMMER_CRASH_SCHOOL_KEY })
      .select("_id key displayName")
      .lean();
  }

  await provisionTenant(SUMMER_CRASH_SCHOOL_KEY);

  return school;
}

export async function getOrCreateSummerCrashCampaign() {
  await ensureSummerCrashSchoolProvisioned();

  const legacyTitle = "Summer Crash Course";

  let campaign = await SummerCrashCampaign.findOne({
    summerSchoolKey: SUMMER_CRASH_SCHOOL_KEY,
  });

  if (!campaign) {
    try {
      campaign = await SummerCrashCampaign.create({
        isActive: true,
        title: SUMMER_CRASH_DISPLAY_NAME,
        summerSchoolKey: SUMMER_CRASH_SCHOOL_KEY,
        supportContact: SUMMER_CRASH_SUPPORT_CONTACT || undefined,
        price: SUMMER_CRASH_PRICE,
        currency: SUMMER_CRASH_CURRENCY,
        whatsappGroupUrl: SUMMER_CRASH_WHATSAPP_GROUP_URL || undefined,
        classMappings: buildDefaultSummerCrashClassMappings(),
      });
    } catch (error) {
      const duplicateKey =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: unknown }).code === 11000;
      if (!duplicateKey) {
        throw error;
      }

      campaign = await SummerCrashCampaign.findOne({
        summerSchoolKey: SUMMER_CRASH_SCHOOL_KEY,
      });
    }
  }

  if (!campaign) {
    throw new Error("We couldn't prepare the Summer Crash Course right now.");
  }

  if (
    String(campaign.title || "").trim().toLowerCase() ===
    legacyTitle.toLowerCase()
  ) {
    await SummerCrashCampaign.updateOne(
      { _id: campaign._id },
      { $set: { title: SUMMER_CRASH_DISPLAY_NAME } },
    );
    campaign = await SummerCrashCampaign.findById(campaign._id);
  }

  if (!campaign) {
    throw new Error("We couldn't prepare the Summer Crash Course right now.");
  }

  return campaign;
}

async function ensureSummerCrashClass(className: string) {
  const normalizedClassName = normalizeSummerCrashText(className);
  if (!normalizedClassName) {
    throw new Error("Class band is required.");
  }

  const { Class: ClassModel } = await getTenantModels(
    SUMMER_CRASH_SCHOOL_KEY,
    ["Class"],
  );

  let classDoc: {
    _id: unknown;
    name?: string;
  } | null = await ClassModel.findOne({
    name: normalizedClassName,
    ...buildArchiveFilter(false),
  })
    .select("_id name")
    .lean();

  if (!classDoc) {
    const archivedClass = await ClassModel.findOne({
      name: normalizedClassName,
      isArchived: true,
    }).select("_id name");

    if (archivedClass?._id) {
      classDoc = await ClassModel.findByIdAndUpdate(
        archivedClass._id,
        {
          ...buildRestoreUpdate(),
        },
        {
          new: true,
          runValidators: true,
        },
      )
        .select("_id name")
        .lean();
    }
  }

  if (!classDoc) {
    try {
      classDoc = await ClassModel.create({
        name: normalizedClassName,
      }).then((doc: any) => ({
        _id: doc._id,
        name: doc.name,
      }));
    } catch (error) {
      const duplicateKey =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: unknown }).code === 11000;
      if (!duplicateKey) {
        throw error;
      }

      classDoc = await ClassModel.findOne({
        name: normalizedClassName,
        ...buildArchiveFilter(false),
      })
        .select("_id name")
        .lean();
    }
  }

  if (!classDoc?._id) {
    throw new Error("We couldn't prepare the Summer Crash Course class.");
  }

  return classDoc;
}

async function findSummerCrashEnrollmentByStudentId(studentId: string) {
  return SummerCrashEnrollment.findOne({
    summerSchoolKey: SUMMER_CRASH_SCHOOL_KEY,
    summerStudentId: studentId,
    status: { $ne: "archived" },
  })
    .sort({ updatedAt: -1 })
    .lean();
}

async function loadSummerCrashQuestionPaperSummary(
  paperId: string,
): Promise<SummerCrashQuestionPaperSummary | null> {
  const normalizedPaperId = String(paperId || "").trim();
  if (!normalizedPaperId) {
    return null;
  }

  const { QuestionPaper: QuestionPaperModel } = await getTenantModels(
    SUMMER_CRASH_SCHOOL_KEY,
    ["QuestionPaper"],
  );

  const paper = (await QuestionPaperModel.findOne({
    _id: normalizedPaperId,
    ...buildArchiveFilter(false),
  })
    .select(
      "title totalMarks duration class onlineEnabled assignedAcademicSections sections",
    )
    .populate("class", "name")
    .populate({
      path: "sections.questions.question",
      select: "_id type options answerIndexes matrixOptions matrixAnswers",
    })
    .lean()) as SummerCrashQuestionPaperDoc | null;

  if (!paper?._id) {
    return null;
  }

  const classId = String(
    (paper.class as { _id?: unknown } | null | undefined)?._id ||
      paper.class ||
      "",
  ).trim();
  const className = normalizeSummerCrashText(
    (paper.class as { name?: unknown } | null | undefined)?.name,
  );
  const assignedSectionCount = Array.isArray(paper.assignedAcademicSections)
    ? paper.assignedAcademicSections.length
    : 0;
  const supportsOnlineDelivery = paperSupportsOnlineDelivery(paper);
  const requiresManualReview = paperRequiresManualReview(paper);
  const questionCount = Array.isArray(paper.sections)
    ? Number(
        paper.sections.reduce((sum, section: any) => {
          const count = Array.isArray(section?.questions)
            ? section.questions.length
            : 0;
          return sum + count;
        }, 0),
      )
    : 0;
  const supportsInstantResults =
    Boolean(paper.onlineEnabled) &&
    assignedSectionCount === 0 &&
    supportsOnlineDelivery &&
    !requiresManualReview;

  return {
    _id: String(paper._id),
    title: normalizeSummerCrashText(paper.title) || "Untitled Paper",
    totalMarks: Number(paper.totalMarks || 0),
    duration: Number(paper.duration || 0),
    classId,
    className,
    onlineEnabled: Boolean(paper.onlineEnabled),
    assignedSectionCount,
    supportsInstantResults,
    supportsOnlineDelivery,
    requiresManualReview,
    questionCount,
  };
}

async function resolveSummerCrashRegistrationDestination(params: {
  campaign: Pick<ISummerCrashCampaign, "classMappings">;
  classBand: string;
  entrySource: SummerCrashEnrollmentEntrySource;
}) {
  if (params.entrySource !== "diagnostic") {
    return SUMMER_CRASH_HOME_PATH;
  }

  const mapping = resolveSummerCrashClassMapping(
    params.campaign,
    params.classBand,
  );
  const diagnosticQuestionPaperId = String(
    mapping?.diagnosticQuestionPaperId || "",
  ).trim();

  if (!diagnosticQuestionPaperId) {
    throw new Error(
      "The free diagnostic test is not ready for this class band yet.",
    );
  }

  const paperSummary = await loadSummerCrashQuestionPaperSummary(
    diagnosticQuestionPaperId,
  );

  if (!paperSummary?.supportsInstantResults) {
    const issues: string[] = [];
    if (!paperSummary) {
      issues.push("paper not found");
    } else {
      if (!paperSummary.onlineEnabled) issues.push("online mode is off");
      if (paperSummary.assignedSectionCount > 0) {
        issues.push("assigned sections are set");
      }
      if (!paperSummary.supportsOnlineDelivery) {
        issues.push("unsupported question types");
      }
      if (paperSummary.requiresManualReview) {
        issues.push("manual review required");
      }
      if (paperSummary.questionCount === 0) {
        issues.push("paper has no questions");
      }
    }
    const detail = issues.length > 0 ? ` (${issues.join(", ")})` : "";
    throw new Error(
      `The free diagnostic test is not available for this class band right now.${detail}`,
    );
  }

  const expectedClassName = normalizeSummerCrashClassBandKey(
    mapping?.className || mapping?.classBand || "",
  );
  const paperClassName = normalizeSummerCrashClassBandKey(
    paperSummary.className,
  );

  if (expectedClassName && paperClassName && expectedClassName !== paperClassName) {
    throw new Error(
      "The selected free diagnostic test does not match this class band.",
    );
  }

  return buildSummerCrashDiagnosticHref(paperSummary._id);
}

async function buildSummerCrashDiagnosticState(params: {
  campaign: Pick<ISummerCrashCampaign, "classMappings">;
  classBand: string;
  enrollment: {
    diagnosticQuestionPaperId?: unknown;
    diagnosticResponseId?: unknown;
    diagnosticStatus?: unknown;
    diagnosticScore?: unknown;
    diagnosticPercent?: unknown;
  } | null;
}) {
  const mapping = resolveSummerCrashClassMapping(
    params.campaign,
    params.classBand,
  );
  const diagnosticQuestionPaperId = String(
    mapping?.diagnosticQuestionPaperId ||
      params.enrollment?.diagnosticQuestionPaperId ||
      "",
  ).trim();

  if (!diagnosticQuestionPaperId) {
    return null;
  }

  const paperSummary = await loadSummerCrashQuestionPaperSummary(
    diagnosticQuestionPaperId,
  );
  const diagnosticResponseId = String(
    params.enrollment?.diagnosticResponseId || "",
  ).trim();
  const score = Number(params.enrollment?.diagnosticScore);
  const percent = Number(params.enrollment?.diagnosticPercent);
  const status = String(
    params.enrollment?.diagnosticStatus || "registered",
  ).trim() as SummerCrashEnrollmentDiagnosticStatus;

  return {
    questionPaperId: diagnosticQuestionPaperId,
    title: paperSummary?.title || "Free Diagnostic Test",
    duration: Number(paperSummary?.duration || 0),
    totalMarks: Number(paperSummary?.totalMarks || 0),
    status:
      status === "started" || status === "submitted" ? status : "registered",
    launchHref: buildSummerCrashDiagnosticHref(diagnosticQuestionPaperId),
    reportHref: diagnosticResponseId
      ? buildSummerCrashStudentReportHref(diagnosticResponseId)
      : "",
    score: Number.isFinite(score) ? score : null,
    percent: Number.isFinite(percent) ? percent : null,
    available: Boolean(paperSummary?.supportsInstantResults),
  } satisfies SummerCrashDiagnosticState;
}

export async function getSummerCrashPublicConfig() {
  const campaign = await getOrCreateSummerCrashCampaign();

  return {
    isActive: Boolean(campaign.isActive),
    title: normalizeSummerCrashText(campaign.title) || SUMMER_CRASH_DISPLAY_NAME,
    supportContact:
      normalizeSummerCrashText(campaign.supportContact) ||
      SUMMER_CRASH_SUPPORT_CONTACT,
    price:
      typeof campaign.price === "number" ? campaign.price : SUMMER_CRASH_PRICE,
    currency: String(campaign.currency || SUMMER_CRASH_CURRENCY || "INR")
      .trim()
      .toUpperCase(),
    whatsappGroupUrl:
      normalizeSummerCrashText(campaign.whatsappGroupUrl) ||
      SUMMER_CRASH_WHATSAPP_GROUP_URL,
    classBands: normalizeSummerCrashClassMappings(campaign.classMappings).map(
      (mapping) => ({
        classBand: mapping.classBand,
        className: mapping.className,
        diagnosticQuestionPaperId: mapping.diagnosticQuestionPaperId,
      }),
    ) satisfies SummerCrashPublicClassBand[],
  };
}

export async function getSummerCrashCampaignForPayment() {
  const campaign = await getOrCreateSummerCrashCampaign();

  return {
    campaign,
    classBands: normalizeSummerCrashClassMappings(campaign.classMappings),
    price:
      typeof campaign.price === "number" ? campaign.price : SUMMER_CRASH_PRICE,
    currency: String(campaign.currency || SUMMER_CRASH_CURRENCY || "INR")
      .trim()
      .toUpperCase(),
    whatsappGroupUrl:
      normalizeSummerCrashText(campaign.whatsappGroupUrl) ||
      SUMMER_CRASH_WHATSAPP_GROUP_URL,
  };
}

function buildSummerCrashPaymentMatchQuery(params: {
  campaignId: unknown;
  enrollment: SummerCrashPaymentLookupContext | null;
}) {
  const conditions: Array<Record<string, unknown>> = [];
  const enrollmentId = String(params.enrollment?._id || "").trim();
  const summerId = String(params.enrollment?.summerId || "")
    .trim()
    .toUpperCase();
  const phoneDigits = normalizeSummerCrashPhone(
    params.enrollment?.phoneDigits || params.enrollment?.phone,
  );
  const classBandNormalized = normalizeSummerCrashClassBandKey(
    params.enrollment?.classBand,
  );
  const studentName = normalizeSummerCrashText(params.enrollment?.studentName);
  const studentNameNormalized = normalizeSummerCrashNameKey(studentName);

  if (enrollmentId) {
    conditions.push({ enrollmentId });
  }

  if (summerId) {
    conditions.push({ summerId });
  }

  if (phoneDigits && classBandNormalized && studentNameNormalized) {
    conditions.push({
      phoneDigits,
      classBandNormalized,
      studentNameNormalized,
    });
  }

  if (phoneDigits && classBandNormalized && studentName) {
    conditions.push({
      phoneDigits,
      classBandNormalized,
      studentName,
    });
  }

  const uniqueConditions = Array.from(
    new Map(conditions.map((condition) => [JSON.stringify(condition), condition])).values(),
  );

  if (uniqueConditions.length === 0) {
    return null;
  }

  const baseQuery = {
    campaignId: params.campaignId,
    summerSchoolKey: SUMMER_CRASH_SCHOOL_KEY,
  };

  if (uniqueConditions.length === 1) {
    return {
      ...baseQuery,
      ...uniqueConditions[0],
    };
  }

  return {
    ...baseQuery,
    $or: uniqueConditions,
  };
}

async function resolveSummerCrashCourseAccessState(params: {
  campaign: Pick<ISummerCrashCampaign, "_id" | "price" | "currency">;
  enrollment: SummerCrashPaymentLookupContext | null;
}) {
  const baseAccess = deriveSummerCrashCourseAccessState({
    price: params.campaign.price,
    currency: params.campaign.currency,
  });

  if (!baseAccess.requiresPayment) {
    return baseAccess;
  }

  const paymentQuery = buildSummerCrashPaymentMatchQuery({
    campaignId: params.campaign._id,
    enrollment: params.enrollment,
  });

  if (!paymentQuery) {
    return baseAccess;
  }

  const payments = await SummerCrashPayment.find(paymentQuery)
    .select("status")
    .sort({ updatedAt: -1, createdAt: -1 })
    .lean();

  return deriveSummerCrashCourseAccessState({
    price: params.campaign.price,
    currency: params.campaign.currency,
    paymentStatuses: payments.map((payment) => payment?.status),
  });
}

export async function getSummerCrashCourseAccessForStudent(params: {
  schoolKey: string;
  studentId: string;
}) {
  if (!isSummerCrashSchoolKey(params.schoolKey)) {
    throw new Error("Summer Crash Course access is only available for summer accounts.");
  }

  const campaign = await getOrCreateSummerCrashCampaign();
  const enrollment = await findSummerCrashEnrollmentByStudentId(params.studentId);
  const courseAccess = await resolveSummerCrashCourseAccessState({
    campaign,
    enrollment,
  });

  return {
    campaign,
    enrollment,
    courseAccess,
  };
}

type SummerCrashPortalAccessEnrollment = {
  _id?: unknown;
  summerId?: unknown;
  studentName?: unknown;
  phoneDigits?: unknown;
  phone?: unknown;
  classBand?: unknown;
  diagnosticQuestionPaperId?: unknown;
  diagnosticResponseId?: unknown;
} | null;

export type SummerCrashPortalAccessCheck = {
  policy: SummerCrashPortalAccessPolicy;
  allowed: boolean;
  message: string | null;
};

const getSummerCrashPortalAccessPolicyCached = cache(
  async (
    schoolKey: string,
    studentId: string,
  ): Promise<SummerCrashPortalAccessPolicy> => {
    const normalizedSchoolKey = String(schoolKey || "").trim();
    const normalizedStudentId = String(studentId || "").trim();

    if (
      !normalizedStudentId ||
      !isSummerCrashSchoolKey(normalizedSchoolKey)
    ) {
      return getDefaultSummerCrashPortalAccessPolicy();
    }

    const campaign = await getOrCreateSummerCrashCampaign();
    const enrollment = (await SummerCrashEnrollment.findOne({
      summerSchoolKey: SUMMER_CRASH_SCHOOL_KEY,
      summerStudentId: normalizedStudentId,
      status: { $ne: "archived" },
    })
      .select(
        "_id summerId studentName phoneDigits phone classBand diagnosticQuestionPaperId diagnosticResponseId",
      )
      .sort({ updatedAt: -1 })
      .lean()) as SummerCrashPortalAccessEnrollment;

    const courseAccess = await resolveSummerCrashCourseAccessState({
      campaign,
      enrollment,
    });

    const classBand = normalizeSummerCrashText(enrollment?.classBand);
    const mapping = classBand
      ? resolveSummerCrashClassMapping(campaign, classBand)
      : null;
    const allowedDiagnosticPaperId =
      String(
        enrollment?.diagnosticQuestionPaperId ||
          mapping?.diagnosticQuestionPaperId ||
          "",
      ).trim() || null;
    const allowedDiagnosticResponseId =
      String(enrollment?.diagnosticResponseId || "").trim() || null;

    return {
      applies: true,
      isUnlocked: courseAccess.isUnlocked,
      requiresPayment: courseAccess.requiresPayment,
      allowedDiagnosticPaperId,
      allowedDiagnosticResponseId,
      redirectHref: SUMMER_CRASH_HOME_PATH,
    };
  },
);

export async function getSummerCrashPortalAccessPolicy(params: {
  schoolKey: string;
  studentId: string;
}) {
  return getSummerCrashPortalAccessPolicyCached(
    String(params.schoolKey || "").trim(),
    String(params.studentId || "").trim(),
  );
}

function buildSummerCrashPortalAccessCheck(params: {
  policy: SummerCrashPortalAccessPolicy;
  target: SummerCrashPortalAccessTarget;
}): SummerCrashPortalAccessCheck {
  const allowed = canAccessSummerCrashPortalTarget(params.policy, params.target);

  return {
    policy: params.policy,
    allowed,
    message: allowed ? null : SUMMER_CRASH_PORTAL_ACCESS_LOCK_MESSAGE,
  };
}

export async function assertSummerCrashStudentPageAccess(params: {
  schoolKey: string;
  studentId: string;
  target: SummerCrashPortalAccessTarget;
}) {
  const policy = await getSummerCrashPortalAccessPolicy({
    schoolKey: params.schoolKey,
    studentId: params.studentId,
  });

  return buildSummerCrashPortalAccessCheck({
    policy,
    target: params.target,
  });
}

export async function assertSummerCrashStudentApiAccess(params: {
  schoolKey: string;
  studentId: string;
  target: SummerCrashPortalAccessTarget;
}) {
  const policy = await getSummerCrashPortalAccessPolicy({
    schoolKey: params.schoolKey,
    studentId: params.studentId,
  });

  return buildSummerCrashPortalAccessCheck({
    policy,
    target: params.target,
  });
}

export async function registerSummerCrashStudent(input: {
  studentName: string;
  guardianName: string;
  phone: string;
  classBand: string;
  sourceSchoolName?: string;
  entrySource?: SummerCrashEnrollmentEntrySource;
}) {
  const studentName = normalizeSummerCrashText(input.studentName);
  const guardianName = normalizeSummerCrashText(input.guardianName);
  const phoneDigits = normalizeSummerCrashPhone(input.phone);
  const classBand = normalizeSummerCrashText(input.classBand);
  const sourceSchoolName = normalizeSummerCrashText(input.sourceSchoolName);
  const entrySource = normalizeEntrySource(input.entrySource);

  if (!studentName) {
    throw new Error("Student name is required.");
  }

  if (!guardianName) {
    throw new Error("Guardian name is required.");
  }

  if (phoneDigits.length < 10) {
    throw new Error("Enter a valid phone or WhatsApp number.");
  }

  if (!classBand) {
    throw new Error("Choose a class band to continue.");
  }

  const campaign = await getOrCreateSummerCrashCampaign();
  if (!campaign.isActive) {
    throw new Error("Summer Crash Course registrations are not open right now.");
  }

  const classMapping = resolveSummerCrashClassMapping(campaign, classBand);
  if (!classMapping) {
    throw new Error("This class band is not available for the Summer Crash Course.");
  }

  const classDoc = await ensureSummerCrashClass(classMapping.className);
  const { User: UserModel } = await getTenantModels(SUMMER_CRASH_SCHOOL_KEY, [
    "User",
  ]);

  const studentNameNormalized = normalizeSummerCrashNameKey(studentName);
  const classBandNormalized = normalizeSummerCrashClassBandKey(classBand);
  const existingEnrollment = await SummerCrashEnrollment.findOne({
    campaignId: campaign._id,
    phoneDigits,
    studentNameNormalized,
    classBandNormalized,
  }).lean();

  const defaultPassword = getDefaultStudentPassword(phoneDigits);
  if (!defaultPassword) {
    throw new Error("We couldn't create the account without a valid phone number.");
  }

  let summerId = String(existingEnrollment?.summerId || "").trim().toUpperCase();
  let studentRecord: any =
    existingEnrollment?.summerStudentId
      ? await UserModel.findById(existingEnrollment.summerStudentId).select(
          "_id name fatherName mobileNumber passwordHash rollNumber class role",
        )
      : null;

  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  if (!studentRecord) {
    summerId = summerId || (await generateUniqueSummerCrashId(UserModel));
    studentRecord = await UserModel.create({
      name: studentName,
      fatherName: guardianName,
      mobileNumber: phoneDigits,
      passwordHash,
      role: "student",
      class: classDoc._id,
      rollNumber: summerId,
      enrolledAt: new Date(),
    });
  } else {
    summerId =
      String(studentRecord.rollNumber || "").trim().toUpperCase() || summerId;
    await UserModel.updateOne(
      {
        _id: studentRecord._id,
      },
      {
        $set: {
          name: studentName,
          fatherName: guardianName,
          mobileNumber: phoneDigits,
          class: classDoc._id,
          passwordHash,
        },
      },
    );
    studentRecord = await UserModel.findById(studentRecord._id).select(
      "_id name fatherName mobileNumber passwordHash rollNumber class role",
    );
  }

  if (!studentRecord?._id || !summerId) {
    throw new Error("We couldn't prepare the Summer Crash Course account.");
  }

  const requiresPasswordSetup = false;

  const nextEnrollmentPatch: Record<string, unknown> = {
    summerSchoolKey: SUMMER_CRASH_SCHOOL_KEY,
    summerStudentId: studentRecord._id,
    summerId,
    studentName,
    studentNameNormalized,
    guardianName,
    phone: phoneDigits,
    phoneDigits,
    classBand,
    classBandNormalized,
    sourceSchoolName: sourceSchoolName || undefined,
    status: "active",
  };

  if (!existingEnrollment?.entrySource) {
    nextEnrollmentPatch.entrySource = entrySource;
  }

  if (
    entrySource === "diagnostic" &&
    !String(existingEnrollment?.diagnosticStatus || "").trim()
  ) {
    nextEnrollmentPatch.diagnosticStatus = "registered";
  }

  if (
    entrySource === "diagnostic" &&
    String(classMapping.diagnosticQuestionPaperId || "").trim()
  ) {
    nextEnrollmentPatch.diagnosticQuestionPaperId = String(
      classMapping.diagnosticQuestionPaperId,
    ).trim();
  }

  const updatedEnrollment = await SummerCrashEnrollment.findOneAndUpdate(
    {
      campaignId: campaign._id,
      phoneDigits,
      studentNameNormalized,
      classBandNormalized,
    },
    {
      $set: nextEnrollmentPatch,
      $setOnInsert: {
        joinedAt: new Date(),
      },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
    },
  ).lean();

  const destinationHref = await resolveSummerCrashRegistrationDestination({
    campaign,
    classBand,
    entrySource,
  });

  return {
    campaignTitle:
      normalizeSummerCrashText(campaign.title) || SUMMER_CRASH_DISPLAY_NAME,
    supportContact:
      normalizeSummerCrashText(campaign.supportContact) ||
      SUMMER_CRASH_SUPPORT_CONTACT,
    studentName,
    guardianName,
    classBand,
    sourceSchoolName,
    summerId,
    studentId: String(studentRecord._id),
    autoSignInAllowed: true,
    bootstrapPassword: defaultPassword,
    signInPath: SUMMER_CRASH_SIGNIN_PATH,
    destinationHref,
    entrySource,
    enrollment: updatedEnrollment,
  };
}

export async function lookupSummerCrashIdsByPhone(phone: string) {
  const phoneDigits = normalizeSummerCrashPhone(phone);
  if (phoneDigits.length < 10) {
    throw new Error("Enter a valid phone or WhatsApp number.");
  }

  const campaign = await getOrCreateSummerCrashCampaign();
  const matches = await SummerCrashEnrollment.find({
    campaignId: campaign._id,
    phoneDigits,
    status: { $ne: "archived" },
  })
    .select("studentName guardianName classBand summerId")
    .sort({ studentName: 1, classBand: 1, createdAt: 1 })
    .lean();

  if (!Array.isArray(matches) || matches.length === 0) {
    throw new Error(
      "We couldn't find any Summer Crash Course students for that phone number.",
    );
  }

  return {
    title: normalizeSummerCrashText(campaign.title) || SUMMER_CRASH_DISPLAY_NAME,
    supportContact:
      normalizeSummerCrashText(campaign.supportContact) ||
      SUMMER_CRASH_SUPPORT_CONTACT,
    matches: (Array.isArray(matches) ? matches : []).map((match) => {
      const summerId = String(match?.summerId || "").trim().toUpperCase();
      return {
        studentName: normalizeSummerCrashText(match?.studentName),
        guardianName: normalizeSummerCrashText(match?.guardianName),
        classBand: normalizeSummerCrashText(match?.classBand),
        summerId,
        maskedSummerId:
          summerId.length <= 4
            ? summerId
            : `${summerId.slice(0, 2)}••${summerId.slice(-2)}`,
      };
    }) satisfies SummerCrashLookupMatch[],
  };
}

export async function getSummerCrashStudentState(params: {
  schoolKey: string;
  studentId: string;
  studentPlacement: {
    classId?: string | null;
    academicSectionId?: string | null;
  };
}) {
  if (!isSummerCrashSchoolKey(params.schoolKey)) {
    throw new Error("Summer Crash Course access is only available for summer accounts.");
  }

  const { campaign, enrollment, courseAccess } =
    await getSummerCrashCourseAccessForStudent({
      schoolKey: params.schoolKey,
      studentId: params.studentId,
    });
  const { User: UserModel } = await getTenantModels(params.schoolKey, ["User"]);
  const studentRecord = await UserModel.findById(params.studentId).select(
    "name fatherName mobileNumber passwordHash rollNumber role",
  );

  if (!studentRecord || String(studentRecord.role || "") !== "student") {
    throw new Error("Summer Crash Course student account not found.");
  }

  const classBand = normalizeSummerCrashText(enrollment?.classBand);
  const requiresPasswordSetup = false;
  const courseList = courseAccess.isUnlocked
    ? await listStudentCoursesPage({
        schoolKey: params.schoolKey,
        studentId: params.studentId,
        studentPlacement: params.studentPlacement,
        page: 1,
        limit: 60,
        includeOptions: false,
      })
    : null;
  const courses = !courseList
    ? []
    : classBand
      ? filterCoursesBySummerCrashMapping({
          campaign,
          classBand,
          courses: courseList.items,
        })
      : courseList.items;
  const diagnostic = classBand
    ? await buildSummerCrashDiagnosticState({
        campaign,
        classBand,
        enrollment,
      })
    : null;

  if (enrollment?._id && !enrollment.firstAccessAt) {
    await SummerCrashEnrollment.updateOne(
      {
        _id: enrollment._id,
        firstAccessAt: null,
      },
      {
        $set: {
          firstAccessAt: new Date(),
          status: "active",
        },
      },
    ).catch(() => undefined);
  }

  return {
    title: normalizeSummerCrashText(campaign.title) || SUMMER_CRASH_DISPLAY_NAME,
    supportContact:
      normalizeSummerCrashText(campaign.supportContact) ||
      SUMMER_CRASH_SUPPORT_CONTACT,
    studentName: normalizeSummerCrashText(studentRecord.name),
    guardianName:
      normalizeSummerCrashText(enrollment?.guardianName) ||
      normalizeSummerCrashText(studentRecord.fatherName),
    classBand: classBand || normalizeSummerCrashText(enrollment?.classBand),
    summerId:
      String(enrollment?.summerId || studentRecord.rollNumber || "")
        .trim()
        .toUpperCase(),
    requiresPasswordSetup,
    courseAccess,
    courses,
    destinationHref: SUMMER_CRASH_HOME_PATH,
    diagnostic,
  } satisfies SummerCrashStudentState;
}

export async function completeSummerCrashSetup(params: {
  schoolKey: string;
  studentId: string;
  studentPlacement: {
    classId?: string | null;
    academicSectionId?: string | null;
  };
  newPassword: string;
  nextDestinationHref?: string | null;
}) {
  if (!isSummerCrashSchoolKey(params.schoolKey)) {
    throw new Error("Summer Crash Course setup is only available for summer accounts.");
  }

  const newPassword = String(params.newPassword || "");
  await connectDB();
  const { User: UserModel } = await getTenantModels(params.schoolKey, ["User"]);
  const studentRecord = await UserModel.findById(params.studentId).select(
    "mobileNumber passwordHash role",
  );

  if (!studentRecord || String(studentRecord.role || "") !== "student") {
    throw new Error("Student account not found.");
  }

  const defaultPassword = getDefaultStudentPassword(studentRecord.mobileNumber);
  const usesDefaultPassword = await isUsingDefaultStudentPassword({
    mobileNumber: studentRecord.mobileNumber,
    passwordHash: studentRecord.passwordHash,
  });

  if (!usesDefaultPassword) {
    const existingState = await getSummerCrashStudentState(params);
    const safeNextDestination = getSafeReturnToPath(params.nextDestinationHref);
    return {
      ...existingState,
      destinationHref: safeNextDestination || existingState.destinationHref,
    };
  }

  if (defaultPassword && newPassword === defaultPassword) {
    throw new Error("Choose a new password that is different from the phone digits.");
  }

  const passwordValidation = validatePasswordInput({
    role: "student",
    mobileNumber: studentRecord.mobileNumber,
    password: newPassword,
  });
  if (!passwordValidation.ok) {
    throw new Error(passwordValidation.message);
  }

  studentRecord.passwordHash = await bcrypt.hash(newPassword, 10);
  await studentRecord.save();

  await SummerCrashEnrollment.updateMany(
    {
      summerSchoolKey: params.schoolKey,
      summerStudentId: params.studentId,
      status: { $in: ["registered", "setup_pending"] },
    },
    {
      $set: {
        status: "active",
        firstAccessAt: new Date(),
      },
    },
  ).catch(() => undefined);

  const state = await getSummerCrashStudentState(params);
  const safeNextDestination = getSafeReturnToPath(params.nextDestinationHref);
  return {
    ...state,
    destinationHref: safeNextDestination || state.destinationHref,
  };
}

export async function recordSummerCrashDiagnosticStarted(params: {
  schoolKey: string;
  studentId: string;
  paperId: string;
}) {
  if (!isSummerCrashSchoolKey(params.schoolKey)) {
    return;
  }

  const campaign = await getOrCreateSummerCrashCampaign();
  const enrollment = await findSummerCrashEnrollmentByStudentId(params.studentId);
  if (!enrollment) {
    return;
  }

  const classBand = normalizeSummerCrashText(enrollment.classBand);
  const mapping = resolveSummerCrashClassMapping(campaign, classBand);
  const diagnosticQuestionPaperId = String(
    mapping?.diagnosticQuestionPaperId || "",
  ).trim();

  if (!diagnosticQuestionPaperId || diagnosticQuestionPaperId !== params.paperId) {
    return;
  }

  const paperSummary = await loadSummerCrashQuestionPaperSummary(params.paperId);
  if (!paperSummary?.supportsInstantResults) {
    return;
  }

  const update: Record<string, unknown> = {
    diagnosticQuestionPaperId: params.paperId,
    diagnosticStartedAt: enrollment.diagnosticStartedAt || new Date(),
  };

  if (enrollment.diagnosticStatus !== "submitted") {
    update.diagnosticStatus = "started";
  }

  if (!enrollment.entrySource) {
    update.entrySource = "diagnostic";
  }

  await SummerCrashEnrollment.updateOne(
    {
      _id: enrollment._id,
    },
    {
      $set: update,
    },
  ).catch(() => undefined);
}

export async function recordSummerCrashDiagnosticSubmitted(params: {
  schoolKey: string;
  studentId: string;
  paperId: string;
  responseId?: string | null;
  score?: number | null;
}) {
  if (!isSummerCrashSchoolKey(params.schoolKey)) {
    return;
  }

  const campaign = await getOrCreateSummerCrashCampaign();
  const enrollment = await findSummerCrashEnrollmentByStudentId(params.studentId);
  if (!enrollment) {
    return;
  }

  const classBand = normalizeSummerCrashText(enrollment.classBand);
  const mapping = resolveSummerCrashClassMapping(campaign, classBand);
  const diagnosticQuestionPaperId = String(
    mapping?.diagnosticQuestionPaperId || "",
  ).trim();

  if (!diagnosticQuestionPaperId || diagnosticQuestionPaperId !== params.paperId) {
    return;
  }

  const paperSummary = await loadSummerCrashQuestionPaperSummary(params.paperId);
  if (!paperSummary?.supportsInstantResults) {
    return;
  }

  const numericScore = Number(params.score);
  const diagnosticScore = Number.isFinite(numericScore) ? numericScore : null;
  const diagnosticPercent =
    diagnosticScore !== null && paperSummary.totalMarks > 0
      ? Number(
          Math.max(
            0,
            Math.min(100, (diagnosticScore / paperSummary.totalMarks) * 100),
          ).toFixed(2),
        )
      : null;

  const update: Record<string, unknown> = {
    diagnosticQuestionPaperId: params.paperId,
    diagnosticStatus: "submitted",
    diagnosticStartedAt: enrollment.diagnosticStartedAt || new Date(),
    diagnosticCompletedAt: new Date(),
    diagnosticResponseId: String(params.responseId || "").trim() || null,
    diagnosticScore,
    diagnosticPercent,
  };

  if (!enrollment.entrySource) {
    update.entrySource = "diagnostic";
  }

  await SummerCrashEnrollment.updateOne(
    {
      _id: enrollment._id,
    },
    {
      $set: update,
    },
  ).catch(() => undefined);
}
