import bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import { unstable_cache } from "next/cache";
import { cache } from "react";

import { buildArchiveFilter, buildRestoreUpdate } from "@/lib/archive";
import type { StudentCourseSummary } from "@/lib/courses/types";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import { getSafeReturnToPath } from "@/lib/navigation/returnTo";
import { listStudentCoursesPage } from "@/lib/server/student-courses";
import {
  buildSummerCrashDiagnosticHref,
  buildSummerCrashStudentReportHref,
  normalizeSummerCrashClassBandKey,
  normalizeSummerCrashNameKey,
  normalizeSummerCrashPhone,
  normalizeSummerCrashText,
  resolveSummerCrashPostRegistrationHref,
  resolveSummerCrashSupportHref,
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
import {
  getCachedSummerCrashPortalAccessPolicy,
  invalidateSummerCrashPortalAccessPolicyCache,
  setCachedSummerCrashPortalAccessPolicy,
} from "@/lib/server/summer-crash-access-cache";
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

export const SUMMER_CRASH_PUBLIC_CONFIG_CACHE_TAG =
  "summer-crash:public-config";

type SummerCrashQuestionPaperSummary = {
  _id: string;
  title: string;
  totalMarks: number;
  duration: number;
  classId: string;
  className: string;
};

export type SummerCrashPublicClassBand = {
  classBand: string;
  className: string;
  diagnosticQuestionPaperId?: string;
};

export type SummerCrashPublicConfig = {
  isActive: boolean;
  title: string;
  supportContact: string;
  supportHref: string;
  price: number;
  currency: string;
  whatsappGroupUrl: string;
  classBands: SummerCrashPublicClassBand[];
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
  supportHref: string;
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

type SummerCrashDiagnosticSnapshot = {
  responseId: string | null;
  score: number | null;
};

type SummerCrashDiagnosticEnrollmentContext = {
  _id?: unknown;
  diagnosticResponseId?: unknown;
  diagnosticScore?: unknown;
  diagnosticStatus?: unknown;
} | null;

type SummerCrashPortalPolicyInput = {
  schoolKey: string;
  studentId: string;
};

type SummerCrashCourseDoc = {
  _id?: unknown;
  title?: unknown;
  summary?: unknown;
  class?: { _id?: unknown; name?: unknown } | unknown;
  subjectIds?: Array<{ _id?: unknown; name?: unknown } | unknown> | unknown;
  assignedAcademicSections?:
    | Array<
        | { _id?: unknown; name?: unknown; class?: { _id?: unknown; name?: unknown } | unknown }
        | unknown
      >
    | unknown;
  publishedAt?: unknown;
  updatedAt?: unknown;
  blocks?: Array<{ type?: unknown; required?: unknown } | unknown> | unknown;
  coverImageUrl?: unknown;
  coverImageAltText?: unknown;
  startsAt?: unknown;
  dueAt?: unknown;
  completionBadgeLabel?: unknown;
  enforceSequentialProgress?: unknown;
  allowNotes?: unknown;
  allowBookmarks?: unknown;
  isTemplate?: unknown;
};

type SummerCrashCourseProgressDoc = {
  course?: unknown;
  status?: unknown;
  completionPercent?: unknown;
  lastViewedBlockId?: unknown;
  completedAssessmentPaperIds?: unknown;
};

type SummerCrashResponseDoc = {
  _id?: unknown;
  totalMarksAwarded?: unknown;
};

function normalizeEntrySource(
  value: unknown,
): SummerCrashEnrollmentEntrySource {
  return String(value || "").trim() === "diagnostic"
    ? "diagnostic"
    : "direct_registration";
}

function toSummerCrashId(value: unknown) {
  if (!value) {
    return "";
  }
  if (
    typeof value === "object" &&
    value !== null &&
    "_id" in (value as Record<string, unknown>)
  ) {
    return String((value as Record<string, unknown>)._id || "").trim();
  }
  return String(value || "").trim();
}

function toSummerCrashIsoDate(value: unknown) {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function resolveSummerCrashAvailabilityStatus(params: {
  startsAt: string | null;
  dueAt: string | null;
  completed: boolean;
}) {
  if (params.completed) {
    return "completed" as const;
  }

  const now = Date.now();
  const startsAt = params.startsAt ? Date.parse(params.startsAt) : NaN;
  if (Number.isFinite(startsAt) && startsAt > now) {
    return "upcoming" as const;
  }

  const dueAt = params.dueAt ? Date.parse(params.dueAt) : NaN;
  if (Number.isFinite(dueAt) && dueAt < now) {
    return "overdue" as const;
  }

  return "active" as const;
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

export async function ensureSummerCrashSchoolProvisioned(options?: {
  ensureTenantProvisioned?: boolean;
}) {
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

  if (options?.ensureTenantProvisioned !== false) {
    await provisionTenant(SUMMER_CRASH_SCHOOL_KEY);
  }

  return school;
}

async function getOrCreateSummerCrashCampaignUncached(options?: {
  ensureTenantProvisioned?: boolean;
}) {
  await ensureSummerCrashSchoolProvisioned({
    ensureTenantProvisioned: options?.ensureTenantProvisioned,
  });

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

const getOrCreateSummerCrashCampaignCached = cache(async () => {
  return getOrCreateSummerCrashCampaignUncached({
    ensureTenantProvisioned: true,
  });
});

export async function getOrCreateSummerCrashCampaign(options?: {
  ensureTenantProvisioned?: boolean;
}) {
  if (options?.ensureTenantProvisioned === false) {
    return getOrCreateSummerCrashCampaignUncached({
      ensureTenantProvisioned: false,
    });
  }

  return getOrCreateSummerCrashCampaignCached();
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
    .select("title totalMarks duration class")
    .populate("class", "name")
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
  return {
    _id: String(paper._id),
    title: normalizeSummerCrashText(paper.title) || "Untitled Paper",
    totalMarks: Number(paper.totalMarks || 0),
    duration: Number(paper.duration || 0),
    classId,
    className,
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
  return buildSummerCrashDiagnosticHref(diagnosticQuestionPaperId);
}

async function findLatestSummerCrashDiagnosticSubmission(params: {
  schoolKey: string;
  studentId: string;
  paperId: string;
}): Promise<SummerCrashDiagnosticSnapshot> {
  const normalizedPaperId = String(params.paperId || "").trim();
  if (!normalizedPaperId) {
    return {
      responseId: null,
      score: null,
    };
  }

  const { QuestionPaperResponse: QuestionPaperResponseModel } = await getTenantModels(
    params.schoolKey,
    ["QuestionPaperResponse"],
  );
  const response = (await QuestionPaperResponseModel.findOne({
    paper: normalizedPaperId,
    student: params.studentId,
    status: { $in: ["submitted", "auto_submitted"] },
  })
    .select("_id totalMarksAwarded submittedAt updatedAt createdAt")
    .sort({ submittedAt: -1, updatedAt: -1, createdAt: -1 })
    .lean()) as SummerCrashResponseDoc | null;

  if (!response?._id) {
    return {
      responseId: null,
      score: null,
    };
  }

  const numericScore = Number(response.totalMarksAwarded);
  return {
    responseId: String(response._id),
    score: Number.isFinite(numericScore) ? numericScore : null,
  };
}

async function resolveSummerCrashDiagnosticSnapshot(params: {
  schoolKey: string;
  studentId: string;
  diagnosticPaperId: string;
  enrollment: SummerCrashDiagnosticEnrollmentContext;
}): Promise<SummerCrashDiagnosticSnapshot> {
  const enrollmentResponseId = String(
    params.enrollment?.diagnosticResponseId || "",
  ).trim();
  const enrollmentScore = Number(params.enrollment?.diagnosticScore);
  if (enrollmentResponseId) {
    return {
      responseId: enrollmentResponseId,
      score: Number.isFinite(enrollmentScore) ? enrollmentScore : null,
    };
  }

  const fallback = await findLatestSummerCrashDiagnosticSubmission({
    schoolKey: params.schoolKey,
    studentId: params.studentId,
    paperId: params.diagnosticPaperId,
  });
  if (!fallback.responseId) {
    return {
      responseId: null,
      score: Number.isFinite(enrollmentScore) ? enrollmentScore : null,
    };
  }

  if (params.enrollment?._id) {
    const update: Record<string, unknown> = {
      diagnosticResponseId: fallback.responseId,
      diagnosticQuestionPaperId: params.diagnosticPaperId,
      diagnosticStatus: "submitted",
    };
    if (fallback.score !== null) {
      update.diagnosticScore = fallback.score;
    }

    const backfillResult = await SummerCrashEnrollment.updateOne(
      {
        _id: params.enrollment._id,
      },
      {
        $set: update,
      },
    ).catch(() => null);
    if (backfillResult && (backfillResult.modifiedCount > 0 || backfillResult.matchedCount > 0)) {
      invalidateSummerCrashPortalPolicyForStudent({
        schoolKey: params.schoolKey,
        studentId: params.studentId,
      });
    }
  }

  return fallback;
}

async function buildSummerCrashDiagnosticState(params: {
  schoolKey: string;
  studentId: string;
  campaign: Pick<ISummerCrashCampaign, "classMappings">;
  classBand: string;
  enrollment: {
    _id?: unknown;
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
  const snapshot = await resolveSummerCrashDiagnosticSnapshot({
    schoolKey: params.schoolKey,
    studentId: params.studentId,
    diagnosticPaperId: diagnosticQuestionPaperId,
    enrollment: params.enrollment,
  });
  const score = Number(params.enrollment?.diagnosticScore ?? snapshot.score);
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
    reportHref: snapshot.responseId
      ? buildSummerCrashStudentReportHref(snapshot.responseId)
      : "",
    score: Number.isFinite(score) ? score : null,
    percent: Number.isFinite(percent) ? percent : null,
    available: Boolean(paperSummary?._id),
  } satisfies SummerCrashDiagnosticState;
}

function normalizeSummerCrashPublicConfigFromCampaign(
  campaign: Pick<
    ISummerCrashCampaign,
    | "isActive"
    | "title"
    | "supportContact"
    | "price"
    | "currency"
    | "whatsappGroupUrl"
    | "classMappings"
  >,
): SummerCrashPublicConfig {
  const supportContact =
    normalizeSummerCrashText(campaign.supportContact) ||
    SUMMER_CRASH_SUPPORT_CONTACT;
  const whatsappGroupUrl =
    normalizeSummerCrashText(campaign.whatsappGroupUrl) ||
    SUMMER_CRASH_WHATSAPP_GROUP_URL;

  return {
    isActive: Boolean(campaign.isActive),
    title: normalizeSummerCrashText(campaign.title) || SUMMER_CRASH_DISPLAY_NAME,
    supportContact,
    supportHref: resolveSummerCrashSupportHref({
      supportContact,
      whatsappGroupUrl,
    }),
    price:
      typeof campaign.price === "number" ? campaign.price : SUMMER_CRASH_PRICE,
    currency: String(campaign.currency || SUMMER_CRASH_CURRENCY || "INR")
      .trim()
      .toUpperCase(),
    whatsappGroupUrl,
    classBands: normalizeSummerCrashClassMappings(campaign.classMappings).map(
      (mapping) => ({
        classBand: mapping.classBand,
        className: mapping.className,
        diagnosticQuestionPaperId: mapping.diagnosticQuestionPaperId,
      }),
    ) satisfies SummerCrashPublicClassBand[],
  } satisfies SummerCrashPublicConfig;
}

function buildSummerCrashDefaultPublicConfig() {
  return normalizeSummerCrashPublicConfigFromCampaign({
    isActive: true,
    title: SUMMER_CRASH_DISPLAY_NAME,
    supportContact: SUMMER_CRASH_SUPPORT_CONTACT || undefined,
    price: SUMMER_CRASH_PRICE,
    currency: SUMMER_CRASH_CURRENCY,
    whatsappGroupUrl: SUMMER_CRASH_WHATSAPP_GROUP_URL || undefined,
    classMappings: buildDefaultSummerCrashClassMappings(),
  });
}

const getSummerCrashPublicConfigCached = unstable_cache(
  async () => {
    try {
      await connectDB();

      const existingCampaign = (await SummerCrashCampaign.findOne({
        summerSchoolKey: SUMMER_CRASH_SCHOOL_KEY,
      })
        .select(
          "isActive title supportContact price currency whatsappGroupUrl classMappings",
        )
        .lean()) as Pick<
        ISummerCrashCampaign,
        | "isActive"
        | "title"
        | "supportContact"
        | "price"
        | "currency"
        | "whatsappGroupUrl"
        | "classMappings"
      > | null;

      if (existingCampaign) {
        return normalizeSummerCrashPublicConfigFromCampaign(existingCampaign);
      }

      // Public reads should not force tenant provisioning on every request.
      // Bootstrap only when campaign is missing.
      const campaign = await getOrCreateSummerCrashCampaign({
        ensureTenantProvisioned: false,
      });
      return normalizeSummerCrashPublicConfigFromCampaign(campaign);
    } catch {
      return buildSummerCrashDefaultPublicConfig();
    }
  },
  ["summer-crash-public-config"],
  {
    revalidate: 300,
    tags: [SUMMER_CRASH_PUBLIC_CONFIG_CACHE_TAG],
  },
);

export async function getSummerCrashPublicConfig() {
  return getSummerCrashPublicConfigCached();
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

  const baseQuery = {
    campaignId: params.campaignId,
    summerSchoolKey: SUMMER_CRASH_SCHOOL_KEY,
  };

  if (enrollmentId) {
    return {
      ...baseQuery,
      enrollmentId,
    };
  }

  if (summerId) {
    return {
      ...baseQuery,
      summerId,
    };
  }

  const conditions: Array<Record<string, unknown>> = [];

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

  const [latestPayment, paidPayment] = await Promise.all([
    SummerCrashPayment.findOne(paymentQuery)
      .select("status")
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean(),
    SummerCrashPayment.findOne({
      ...paymentQuery,
      status: "paid",
    })
      .select("_id")
      .lean(),
  ]);

  const latestStatus = String(latestPayment?.status || "").trim();
  const paymentStatuses: SummerCrashPaymentStatus[] = [];
  if (latestStatus === "pending" || latestStatus === "paid" || latestStatus === "failed") {
    paymentStatuses.push(latestStatus);
  }
  if (paidPayment?._id && !paymentStatuses.includes("paid")) {
    paymentStatuses.push("paid");
  }

  return deriveSummerCrashCourseAccessState({
    price: params.campaign.price,
    currency: params.campaign.currency,
    paymentStatuses,
  });
}

async function getSummerCrashPortalAccessPolicyUncached(
  input: SummerCrashPortalPolicyInput,
): Promise<SummerCrashPortalAccessPolicy> {
  const normalizedSchoolKey = String(input.schoolKey || "").trim();
  const normalizedStudentId = String(input.studentId || "").trim();

  if (!normalizedStudentId || !isSummerCrashSchoolKey(normalizedSchoolKey)) {
    return getDefaultSummerCrashPortalAccessPolicy();
  }

  const campaign = await getOrCreateSummerCrashCampaign();
  const enrollment = (await SummerCrashEnrollment.findOne({
    summerSchoolKey: SUMMER_CRASH_SCHOOL_KEY,
    summerStudentId: normalizedStudentId,
    status: { $ne: "archived" },
  })
    .select(
      "_id summerId studentName phoneDigits phone classBand diagnosticQuestionPaperId diagnosticResponseId diagnosticStatus diagnosticScore",
    )
    .sort({ updatedAt: -1, createdAt: -1 })
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
  const diagnosticSnapshot = await resolveSummerCrashDiagnosticSnapshot({
    schoolKey: normalizedSchoolKey,
    studentId: normalizedStudentId,
    diagnosticPaperId: allowedDiagnosticPaperId || "",
    enrollment,
  });

  return {
    applies: true,
    isUnlocked: courseAccess.isUnlocked,
    requiresPayment: courseAccess.requiresPayment,
    allowedDiagnosticPaperId,
    allowedDiagnosticResponseId: diagnosticSnapshot.responseId,
    redirectHref: SUMMER_CRASH_HOME_PATH,
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
  diagnosticStatus?: unknown;
  diagnosticScore?: unknown;
} | null;

export type SummerCrashPortalAccessCheck = {
  policy: SummerCrashPortalAccessPolicy;
  allowed: boolean;
  message: string | null;
};

export function invalidateSummerCrashPortalPolicyForStudent(params: {
  schoolKey: string;
  studentId: string;
}) {
  const schoolKey = String(params.schoolKey || "").trim();
  const studentId = String(params.studentId || "").trim();
  if (!schoolKey || !studentId) {
    return;
  }
  invalidateSummerCrashPortalAccessPolicyCache({
    schoolKey,
    studentId,
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

export async function getSummerCrashPortalAccessPolicy(params: {
  schoolKey: string;
  studentId: string;
}) {
  const schoolKey = String(params.schoolKey || "").trim();
  const studentId = String(params.studentId || "").trim();

  if (!schoolKey || !studentId) {
    return getDefaultSummerCrashPortalAccessPolicy();
  }
  if (!isSummerCrashSchoolKey(schoolKey)) {
    return getDefaultSummerCrashPortalAccessPolicy();
  }

  const cachedPolicy = getCachedSummerCrashPortalAccessPolicy({
    schoolKey,
    studentId,
  });
  if (cachedPolicy) {
    return cachedPolicy;
  }

  const policy = await getSummerCrashPortalAccessPolicyUncached({
    schoolKey,
    studentId,
  });
  setCachedSummerCrashPortalAccessPolicy({
    schoolKey,
    studentId,
    policy,
  });
  return policy;
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
  password: string;
  entrySource?: SummerCrashEnrollmentEntrySource;
}) {
  const studentName = normalizeSummerCrashText(input.studentName);
  const guardianName = normalizeSummerCrashText(input.guardianName);
  const phoneDigits = normalizeSummerCrashPhone(input.phone);
  const classBand = normalizeSummerCrashText(input.classBand);
  const sourceSchoolName = normalizeSummerCrashText(input.sourceSchoolName);
  const password = String(input.password || "");
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

  if (!password.trim()) {
    throw new Error("Create a password to continue.");
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

  if (password === defaultPassword) {
    throw new Error("Choose a password that is different from the phone number digits.");
  }

  const passwordValidation = validatePasswordInput({
    role: "student",
    mobileNumber: phoneDigits,
    password,
  });
  if (!passwordValidation.ok) {
    throw new Error(passwordValidation.message);
  }

  let summerId = String(existingEnrollment?.summerId || "").trim().toUpperCase();
  let studentRecord: any =
    existingEnrollment?.summerStudentId
      ? await UserModel.findById(existingEnrollment.summerStudentId).select(
          "_id name fatherName mobileNumber passwordHash rollNumber class role",
        )
      : null;
  const hasExistingStudentRecord = Boolean(studentRecord?._id);
  let usesDefaultPassword = !hasExistingStudentRecord;
  let autoSignInAllowed = true;

  if (!studentRecord) {
    const passwordHash = await bcrypt.hash(password, 10);
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
    const existingMobileNumber = String(studentRecord.mobileNumber || "").trim();
    usesDefaultPassword = await isUsingDefaultStudentPassword({
      mobileNumber: existingMobileNumber,
      passwordHash: studentRecord.passwordHash,
    });
    const nextStudentUpdate: Record<string, unknown> = {
      name: studentName,
      fatherName: guardianName,
      mobileNumber: phoneDigits,
      class: classDoc._id,
    };

    if (usesDefaultPassword) {
      nextStudentUpdate.passwordHash = await bcrypt.hash(password, 10);
    } else {
      autoSignInAllowed = await bcrypt
        .compare(password, String(studentRecord.passwordHash || ""))
        .catch(() => false);
    }

    await UserModel.updateOne(
      {
        _id: studentRecord._id,
      },
      {
        $set: nextStudentUpdate,
      },
    );
    studentRecord = await UserModel.findById(studentRecord._id).select(
      "_id name fatherName mobileNumber passwordHash rollNumber class role",
    );
  }

  if (!studentRecord?._id || !summerId) {
    throw new Error("We couldn't prepare the Summer Crash Course account.");
  }

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
  const nextDestinationHref = resolveSummerCrashPostRegistrationHref({
    destinationHref,
    entrySource,
  });
  invalidateSummerCrashPortalPolicyForStudent({
    schoolKey: SUMMER_CRASH_SCHOOL_KEY,
    studentId: String(studentRecord._id),
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
    autoSignInAllowed,
    signInPassword: autoSignInAllowed ? password : "",
    signInPath: SUMMER_CRASH_SIGNIN_PATH,
    destinationHref: nextDestinationHref,
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

function normalizeSummerCrashCourseProgressStatus(value: unknown) {
  const normalized = String(value || "").trim();
  if (normalized === "completed") {
    return "completed" as const;
  }
  if (normalized === "in_progress") {
    return "in_progress" as const;
  }
  return "not_started" as const;
}

function mapSummerCrashClassSummary(value: unknown) {
  const id = toSummerCrashId(value);
  if (!id) {
    return null;
  }

  return {
    _id: id,
    name:
      normalizeSummerCrashText(
        (value as { name?: unknown } | null | undefined)?.name,
      ) || id,
  };
}

function mapSummerCrashSubjectSummaries(value: unknown) {
  const items = Array.isArray(value) ? value : [];
  return items
    .map((item) => {
      const id = toSummerCrashId(item);
      if (!id) {
        return null;
      }
      return {
        _id: id,
        name:
          normalizeSummerCrashText(
            (item as { name?: unknown } | null | undefined)?.name,
          ) || id,
      };
    })
    .filter(
      (
        subject,
      ): subject is {
        _id: string;
        name: string;
      } => Boolean(subject),
    );
}

function mapSummerCrashSectionSummaries(value: unknown) {
  const items = Array.isArray(value) ? value : [];
  return items
    .map((item) => {
      const id = toSummerCrashId(item);
      if (!id) {
        return null;
      }

      const classValue =
        (item as { class?: unknown } | null | undefined)?.class || null;
      return {
        _id: id,
        name:
          normalizeSummerCrashText(
            (item as { name?: unknown } | null | undefined)?.name,
          ) || id,
        class: mapSummerCrashClassSummary(classValue),
      };
    })
    .filter(
      (
        section,
      ): section is {
        _id: string;
        name: string;
        class: { _id: string; name: string } | null;
      } => Boolean(section),
    );
}

async function loadSummerCrashMappedCourseSummaries(params: {
  schoolKey: string;
  studentId: string;
  mappedCourseIds: string[];
}) {
  const courseIds = Array.from(
    new Set(params.mappedCourseIds.map((id) => String(id || "").trim()).filter(Boolean)),
  );
  if (courseIds.length === 0) {
    return [] as StudentCourseSummary[];
  }

  const { Course: CourseModel, CourseProgress: CourseProgressModel } =
    await getTenantModels(params.schoolKey, ["Course", "CourseProgress"]);
  const [courseDocs, progressDocs] = await Promise.all([
    CourseModel.find({
      _id: { $in: courseIds },
      status: "published",
      ...buildArchiveFilter(false),
    })
      .select(
        "title summary class subjectIds assignedAcademicSections publishedAt updatedAt blocks coverImageUrl coverImageAltText startsAt dueAt completionBadgeLabel enforceSequentialProgress allowNotes allowBookmarks isTemplate",
      )
      .populate("class", "name")
      .populate("subjectIds", "name")
      .populate({
        path: "assignedAcademicSections",
        select: "name class",
        populate: {
          path: "class",
          select: "name",
        },
      })
      .lean() as Promise<SummerCrashCourseDoc[]>,
    CourseProgressModel.find({
      student: params.studentId,
      course: { $in: courseIds },
    })
      .select("course status completionPercent lastViewedBlockId completedAssessmentPaperIds")
      .lean() as Promise<SummerCrashCourseProgressDoc[]>,
  ]);

  const progressByCourseId = new Map(
    progressDocs.map((progress) => [toSummerCrashId(progress.course), progress]),
  );
  const courseById = new Map(
    courseDocs.map((course) => [toSummerCrashId(course._id), course]),
  );

  const summaries: StudentCourseSummary[] = [];
  courseIds.forEach((courseId) => {
    const course = courseById.get(courseId);
    if (!course) {
      return;
    }

    const progress = progressByCourseId.get(courseId);
    const status = normalizeSummerCrashCourseProgressStatus(progress?.status);
    const startsAt = toSummerCrashIsoDate(course.startsAt);
    const dueAt = toSummerCrashIsoDate(course.dueAt);
    const blocks = Array.isArray(course.blocks) ? course.blocks : [];
    const assessmentCount = blocks.filter(
      (block) =>
        String((block as { type?: unknown } | null | undefined)?.type || "") ===
        "assessment",
    ).length;
    const requiredAssessmentCount = blocks.filter(
      (block) =>
        String((block as { type?: unknown } | null | undefined)?.type || "") ===
          "assessment" &&
        (block as { required?: unknown } | null | undefined)?.required !== false,
    ).length;
    const completedAssessmentCount = Array.isArray(progress?.completedAssessmentPaperIds)
      ? progress.completedAssessmentPaperIds.length
      : 0;
    const numericCompletion = Number(progress?.completionPercent);
    const completionPercent = Number.isFinite(numericCompletion)
      ? Math.max(0, Math.min(100, numericCompletion))
      : 0;

    const summary: StudentCourseSummary = {
      _id: courseId,
      title: normalizeSummerCrashText(course.title) || "Untitled Course",
      summary: normalizeSummerCrashText(course.summary),
      class: mapSummerCrashClassSummary(course.class),
      subjects: mapSummerCrashSubjectSummaries(course.subjectIds),
      assignedAcademicSections: mapSummerCrashSectionSummaries(
        course.assignedAcademicSections,
      ),
      status,
      availabilityStatus: resolveSummerCrashAvailabilityStatus({
        startsAt,
        dueAt,
        completed: status === "completed",
      }),
      publishedAt: toSummerCrashIsoDate(course.publishedAt),
      updatedAt: toSummerCrashIsoDate(course.updatedAt),
      blockCount: blocks.length,
      assessmentCount,
      requiredAssessmentCount,
      completedAssessmentCount,
      completionPercent,
      lastViewedBlockId: String(progress?.lastViewedBlockId || "").trim() || null,
      metadata: {
        coverImageUrl: normalizeSummerCrashText(course.coverImageUrl) || undefined,
        coverImageAltText:
          normalizeSummerCrashText(course.coverImageAltText) || undefined,
        startsAt,
        dueAt,
        completionBadgeLabel:
          normalizeSummerCrashText(course.completionBadgeLabel) || undefined,
        enforceSequentialProgress: Boolean(course.enforceSequentialProgress),
        allowNotes: typeof course.allowNotes === "boolean" ? course.allowNotes : true,
        allowBookmarks:
          typeof course.allowBookmarks === "boolean" ? course.allowBookmarks : true,
        isTemplate: Boolean(course.isTemplate),
      },
    };

    summaries.push(summary);
  });

  return summaries;
}

export async function getSummerCrashStudentState(params: {
  schoolKey: string;
  studentId: string;
  studentPlacement: {
    classId?: string | null;
    academicSectionId?: string | null;
  };
  includeCourses?: boolean;
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
  const requiresPasswordSetup = await isUsingDefaultStudentPassword({
    mobileNumber: studentRecord.mobileNumber,
    passwordHash: studentRecord.passwordHash,
  });
  const includeCourses = params.includeCourses !== false;
  const classMapping = classBand
    ? resolveSummerCrashClassMapping(campaign, classBand)
    : null;
  const mappedCourseIds = Array.isArray(classMapping?.courseIds)
    ? classMapping!.courseIds
    : [];
  let courses: StudentCourseSummary[] = [];
  if (includeCourses && courseAccess.isUnlocked) {
    if (mappedCourseIds.length > 0) {
      courses = await loadSummerCrashMappedCourseSummaries({
        schoolKey: params.schoolKey,
        studentId: params.studentId,
        mappedCourseIds,
      });
    } else {
      const courseList = await listStudentCoursesPage({
        schoolKey: params.schoolKey,
        studentId: params.studentId,
        studentPlacement: params.studentPlacement,
        page: 1,
        limit: 60,
        includeOptions: false,
      });
      courses = classBand
        ? filterCoursesBySummerCrashMapping({
            campaign,
            classBand,
            courses: courseList.items,
          })
        : courseList.items;
    }
  }
  const diagnostic = classBand
    ? await buildSummerCrashDiagnosticState({
        schoolKey: params.schoolKey,
        studentId: params.studentId,
        campaign,
        classBand,
        enrollment,
      })
    : null;

  if (enrollment?._id) {
    if (requiresPasswordSetup) {
      await SummerCrashEnrollment.updateOne(
        {
          _id: enrollment._id,
          status: { $ne: "setup_pending" },
        },
        {
          $set: {
            status: "setup_pending",
          },
        },
      ).catch(() => undefined);
    } else if (!enrollment.firstAccessAt || enrollment.status !== "active") {
      await SummerCrashEnrollment.updateOne(
        {
          _id: enrollment._id,
        },
        {
          $set: {
            firstAccessAt: enrollment.firstAccessAt || new Date(),
            status: "active",
          },
        },
      ).catch(() => undefined);
    }
  }

  return {
    title: normalizeSummerCrashText(campaign.title) || SUMMER_CRASH_DISPLAY_NAME,
    supportContact:
      normalizeSummerCrashText(campaign.supportContact) ||
      SUMMER_CRASH_SUPPORT_CONTACT,
    supportHref: resolveSummerCrashSupportHref({
      supportContact:
        normalizeSummerCrashText(campaign.supportContact) ||
        SUMMER_CRASH_SUPPORT_CONTACT,
      whatsappGroupUrl:
        normalizeSummerCrashText(campaign.whatsappGroupUrl) ||
        SUMMER_CRASH_WHATSAPP_GROUP_URL,
    }),
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
  invalidateSummerCrashPortalPolicyForStudent({
    schoolKey: params.schoolKey,
    studentId: params.studentId,
  });

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
    enrollment.diagnosticQuestionPaperId ||
      mapping?.diagnosticQuestionPaperId ||
      "",
  ).trim();

  if (!diagnosticQuestionPaperId || diagnosticQuestionPaperId !== params.paperId) {
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

  const updateResult = await SummerCrashEnrollment.updateOne(
    {
      _id: enrollment._id,
    },
    {
      $set: update,
    },
  ).catch(() => null);
  if (updateResult && (updateResult.modifiedCount > 0 || updateResult.matchedCount > 0)) {
    invalidateSummerCrashPortalPolicyForStudent({
      schoolKey: params.schoolKey,
      studentId: params.studentId,
    });
  }
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
    enrollment.diagnosticQuestionPaperId ||
      mapping?.diagnosticQuestionPaperId ||
      "",
  ).trim();

  if (!diagnosticQuestionPaperId || diagnosticQuestionPaperId !== params.paperId) {
    return;
  }

  const paperSummary = await loadSummerCrashQuestionPaperSummary(params.paperId);
  const paperTotalMarks = Number(paperSummary?.totalMarks || 0);

  const numericScore = Number(params.score);
  const diagnosticScore = Number.isFinite(numericScore) ? numericScore : null;
  const diagnosticPercent =
    diagnosticScore !== null && paperTotalMarks > 0
      ? Number(
          Math.max(
            0,
            Math.min(100, (diagnosticScore / paperTotalMarks) * 100),
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

  const updateResult = await SummerCrashEnrollment.updateOne(
    {
      _id: enrollment._id,
    },
    {
      $set: update,
    },
  ).catch(() => null);
  if (updateResult && (updateResult.modifiedCount > 0 || updateResult.matchedCount > 0)) {
    invalidateSummerCrashPortalPolicyForStudent({
      schoolKey: params.schoolKey,
      studentId: params.studentId,
    });
  }
}
