import { buildArchiveFilter } from "@/lib/archive";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import {
  getOrCreateSummerCrashCampaign,
  normalizeSummerCrashClassMappings,
} from "@/lib/server/summer-crash";
import { paperRequiresManualReview, paperSupportsOnlineDelivery } from "@/lib/student-tests";
import {
  normalizeSummerCrashClassBandKey,
  normalizeSummerCrashText,
} from "@/lib/summer-crash/shared";
import {
  SUMMER_CRASH_DEFAULT_CLASS_BANDS,
  SUMMER_CRASH_HOME_PATH,
  SUMMER_CRASH_PUBLIC_TESTS_PATH,
  SUMMER_CRASH_SCHOOL_KEY,
  isSummerCrashSchoolKey,
} from "@/lib/summer-crash/constants";
import SummerCrashEnrollment from "@/models/SummerCrashEnrollment";

const PUBLIC_TESTS_LEADS_PAGE_SIZE = 20;
const PUBLIC_TESTS_RESULTS_PAGE_SIZE = 20;

type QuestionPaperSummary = {
  _id: string;
  title: string;
  classId: string;
  className: string;
  duration: number;
  totalMarks: number;
  updatedAt: string | null;
};

export type WorkspacePublicTestPaperOption = QuestionPaperSummary;

export type WorkspacePublicTestClassBandCard = {
  classBand: string;
  className: string;
  diagnosticQuestionPaperId: string;
  mappedPaper: WorkspacePublicTestPaperOption | null;
  candidatePapers: WorkspacePublicTestPaperOption[];
  mappingStatus: "ready" | "missing" | "invalid";
};

export type WorkspacePublicTestsConfig = {
  title: string;
  supportContact: string;
  isActive: boolean;
  classBandCards: WorkspacePublicTestClassBandCard[];
};

export type WorkspacePublicTestLeadRow = {
  _id: string;
  studentName: string;
  guardianName: string;
  phone: string;
  classBand: string;
  status: string;
  entrySource: string;
  diagnosticStatus: string;
  joinedAt: string | null;
  firstAccessAt: string | null;
};

export type WorkspacePublicTestResultRow = {
  _id: string;
  studentName: string;
  guardianName: string;
  phone: string;
  classBand: string;
  paperTitle: string;
  diagnosticStatus: string;
  score: number | null;
  percent: number | null;
  startedAt: string | null;
  completedAt: string | null;
  workspaceReportHref: string;
  studentReportHref: string;
};

export type WorkspacePublicTestsPagedList<T> = {
  items: T[];
  total: number;
  page: number;
  pages: number;
  limit: number;
};

export type WorkspacePublicTestsPageData = {
  config: WorkspacePublicTestsConfig;
  leads: WorkspacePublicTestsPagedList<WorkspacePublicTestLeadRow>;
  results: WorkspacePublicTestsPagedList<WorkspacePublicTestResultRow>;
  stats: {
    totalRegistrations: number;
    totalDiagnosticStarted: number;
    totalDiagnosticSubmitted: number;
  };
  filters: {
    leadClassBand: string;
    resultClassBand: string;
  };
  classBandOptions: string[];
};

type QuestionPaperDoc = {
  _id?: unknown;
  title?: unknown;
  class?: { _id?: unknown; name?: unknown } | unknown;
  duration?: unknown;
  totalMarks?: unknown;
  updatedAt?: Date | string | null;
  onlineEnabled?: unknown;
  assignedAcademicSections?: unknown[];
  sections?: unknown[];
};

type CampaignClassDoc = {
  _id?: unknown;
  name?: unknown;
};

type WorkspacePublicTestsUpdateInput = {
  schoolKey: string;
  title?: string;
  supportContact?: string;
  isActive?: boolean;
  classMappings?: Array<{
    classBand: string;
    diagnosticQuestionPaperId?: string | null;
  }>;
};

function assertSummerPublicTestsSchoolKey(schoolKey: string) {
  if (!isSummerCrashSchoolKey(schoolKey)) {
    throw new Error("Summer public tests are only available in the Summer Crash workspace.");
  }
}

function normalizePositivePage(value: unknown, fallback = 1) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
}

function normalizeClassBandFilter(value: unknown) {
  const normalized = normalizeSummerCrashText(value);
  if (!normalized) {
    return "all";
  }

  const normalizedKey = normalizeSummerCrashClassBandKey(normalized);
  const matchedBand = SUMMER_CRASH_DEFAULT_CLASS_BANDS.find(
    (classBand) => normalizeSummerCrashClassBandKey(classBand) === normalizedKey,
  );

  return matchedBand || "all";
}

function serializeDate(value: unknown) {
  const date = value ? new Date(String(value)) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

function serializeQuestionPaperSummary(paper: QuestionPaperDoc) {
  const classId = String(
    (paper.class as { _id?: unknown } | null | undefined)?._id ||
      paper.class ||
      "",
  ).trim();
  const className = normalizeSummerCrashText(
    (paper.class as { name?: unknown } | null | undefined)?.name,
  );

  return {
    _id: String(paper._id || ""),
    title: normalizeSummerCrashText(paper.title) || "Untitled Paper",
    classId,
    className,
    duration: Number(paper.duration || 0),
    totalMarks: Number(paper.totalMarks || 0),
    updatedAt: serializeDate(paper.updatedAt),
  } satisfies QuestionPaperSummary;
}

async function loadCampaignClasses() {
  const campaign = await getOrCreateSummerCrashCampaign();
  const normalizedMappings = normalizeSummerCrashClassMappings(campaign.classMappings);
  const classNames = normalizedMappings
    .map((mapping) => normalizeSummerCrashText(mapping.className))
    .filter(Boolean);

  const { Class: ClassModel } = await getTenantModels(campaign.summerSchoolKey, [
    "Class",
  ]);
  const classDocs = (await ClassModel.find({
    name: { $in: classNames },
    ...buildArchiveFilter(false),
  })
    .select("_id name")
    .lean()) as CampaignClassDoc[];

  const classDocsByName = new Map<string, CampaignClassDoc[]>();
  for (const classDoc of classDocs) {
    const normalizedClassName = normalizeSummerCrashClassBandKey(classDoc.name);
    if (!normalizedClassName) {
      continue;
    }

    const existingDocs = classDocsByName.get(normalizedClassName) || [];
    existingDocs.push(classDoc);
    classDocsByName.set(normalizedClassName, existingDocs);
  }

  return {
    campaign,
    normalizedMappings,
    classDocsByName,
  };
}

async function loadEligibleDiagnosticPapersByClassId(classIds: string[]) {
  if (classIds.length === 0) {
    return new Map<string, WorkspacePublicTestPaperOption[]>();
  }

  const { QuestionPaper: QuestionPaperModel } = await getTenantModels(
    SUMMER_CRASH_SCHOOL_KEY,
    ["QuestionPaper"],
  );

  const papers = (await QuestionPaperModel.find({
    class: { $in: classIds },
    onlineEnabled: true,
    ...buildArchiveFilter(false),
  })
    .select(
      "title class duration totalMarks updatedAt onlineEnabled assignedAcademicSections sections",
    )
    .populate("class", "name")
    .populate({
      path: "sections.questions.question",
      select: "_id type options answerIndexes matrixOptions matrixAnswers",
    })
    .lean()) as QuestionPaperDoc[];

  const papersByClassId = new Map<string, WorkspacePublicTestPaperOption[]>();

  for (const paper of papers) {
    const assignedSections = Array.isArray(paper.assignedAcademicSections)
      ? paper.assignedAcademicSections.length
      : 0;

    if (
      !paper.onlineEnabled ||
      assignedSections > 0 ||
      !paperSupportsOnlineDelivery(paper) ||
      paperRequiresManualReview(paper)
    ) {
      continue;
    }

    const summary = serializeQuestionPaperSummary(paper);
    if (!summary._id || !summary.classId) {
      continue;
    }

    const existingPapers = papersByClassId.get(summary.classId) || [];
    existingPapers.push(summary);
    papersByClassId.set(summary.classId, existingPapers);
  }

  for (const [classId, papersForClass] of papersByClassId.entries()) {
    papersByClassId.set(
      classId,
      papersForClass.sort((left, right) => {
        const leftTime = left.updatedAt ? new Date(left.updatedAt).getTime() : 0;
        const rightTime = right.updatedAt ? new Date(right.updatedAt).getTime() : 0;
        if (leftTime !== rightTime) {
          return rightTime - leftTime;
        }
        return left.title.localeCompare(right.title);
      }),
    );
  }

  return papersByClassId;
}

async function validateDiagnosticQuestionPaperAssignment(params: {
  expectedClassName: string;
  paperId: string;
}) {
  const normalizedPaperId = String(params.paperId || "").trim();
  if (!normalizedPaperId) {
    return;
  }

  const { QuestionPaper: QuestionPaperModel } = await getTenantModels(
    SUMMER_CRASH_SCHOOL_KEY,
    ["QuestionPaper"],
  );

  const paper = (await QuestionPaperModel.findOne({
    _id: normalizedPaperId,
    ...buildArchiveFilter(false),
  })
    .select("title class onlineEnabled assignedAcademicSections sections")
    .populate("class", "name")
    .populate({
      path: "sections.questions.question",
      select: "_id type options answerIndexes matrixOptions matrixAnswers",
    })
    .lean()) as QuestionPaperDoc | null;

  if (!paper?._id) {
    throw new Error("The selected diagnostic paper could not be found.");
  }

  const paperClassName = normalizeSummerCrashText(
    (paper.class as { name?: unknown } | null | undefined)?.name,
  );

  if (
    normalizeSummerCrashClassBandKey(paperClassName) !==
    normalizeSummerCrashClassBandKey(params.expectedClassName)
  ) {
    throw new Error("The selected diagnostic paper does not match the class band.");
  }

  if (!paper.onlineEnabled) {
    throw new Error("The selected diagnostic paper must be online enabled.");
  }

  if (
    Array.isArray(paper.assignedAcademicSections) &&
    paper.assignedAcademicSections.length > 0
  ) {
    throw new Error(
      "The selected diagnostic paper must stay open to the full class with no assigned sections.",
    );
  }

  if (!paperSupportsOnlineDelivery(paper)) {
    throw new Error(
      "The selected diagnostic paper contains question types that are not supported online.",
    );
  }

  if (paperRequiresManualReview(paper)) {
    throw new Error(
      "The selected diagnostic paper requires manual review and cannot be used for instant public results.",
    );
  }
}

export async function getWorkspacePublicTestsConfig(
  schoolKey: string,
): Promise<WorkspacePublicTestsConfig> {
  assertSummerPublicTestsSchoolKey(schoolKey);
  await connectDB();

  const { campaign, normalizedMappings, classDocsByName } = await loadCampaignClasses();
  const classIds = Array.from(
    new Set(
      normalizedMappings.flatMap((mapping) =>
        (classDocsByName.get(
          normalizeSummerCrashClassBandKey(mapping.className),
        ) || [])
          .map((classDoc) => String(classDoc?._id || "").trim())
          .filter(Boolean),
      ),
    ),
  );
  const eligiblePapersByClassId = await loadEligibleDiagnosticPapersByClassId(
    classIds,
  );

  const classBandCards = normalizedMappings.map((mapping) => {
    const classDocs = classDocsByName.get(
      normalizeSummerCrashClassBandKey(mapping.className),
    ) || [];
    const candidatePapers = Array.from(
      new Map(
        classDocs
          .flatMap((classDoc) => {
            const classId = String(classDoc?._id || "").trim();
            return classId ? eligiblePapersByClassId.get(classId) || [] : [];
          })
          .map((paper) => [paper._id, paper]),
      ).values(),
    ).sort((left, right) => {
      const leftTime = left.updatedAt ? new Date(left.updatedAt).getTime() : 0;
      const rightTime = right.updatedAt ? new Date(right.updatedAt).getTime() : 0;
      if (leftTime !== rightTime) {
        return rightTime - leftTime;
      }
      return left.title.localeCompare(right.title);
    });
    const diagnosticQuestionPaperId = String(
      mapping.diagnosticQuestionPaperId || "",
    ).trim();
    const mappedPaper =
      candidatePapers.find((paper) => paper._id === diagnosticQuestionPaperId) ||
      null;
    const mappingStatus =
      !diagnosticQuestionPaperId
        ? "missing"
        : mappedPaper
          ? "ready"
          : "invalid";

    return {
      classBand: mapping.classBand,
      className: mapping.className,
      diagnosticQuestionPaperId,
      mappedPaper,
      candidatePapers,
      mappingStatus,
    } satisfies WorkspacePublicTestClassBandCard;
  });

  return {
    title: normalizeSummerCrashText(campaign.title),
    supportContact: normalizeSummerCrashText(campaign.supportContact),
    isActive: Boolean(campaign.isActive),
    classBandCards,
  };
}

export async function updateWorkspacePublicTestsConfig(
  input: WorkspacePublicTestsUpdateInput,
) {
  assertSummerPublicTestsSchoolKey(input.schoolKey);
  await connectDB();

  const campaign = await getOrCreateSummerCrashCampaign();
  const existingMappings = normalizeSummerCrashClassMappings(campaign.classMappings);
  const requestedMappings = Array.isArray(input.classMappings)
    ? input.classMappings
    : [];
  const requestedMappingsByClassBand = new Map(
    requestedMappings.map((mapping) => [
      normalizeSummerCrashClassBandKey(mapping.classBand),
      String(mapping.diagnosticQuestionPaperId || "").trim(),
    ]),
  );

  for (const existingMapping of existingMappings) {
    const requestedPaperId = requestedMappingsByClassBand.get(
      normalizeSummerCrashClassBandKey(existingMapping.classBand),
    );
    if (requestedPaperId) {
      await validateDiagnosticQuestionPaperAssignment({
        expectedClassName: existingMapping.className,
        paperId: requestedPaperId,
      });
    }
  }

  const nextMappings = existingMappings.map((mapping) => {
    const normalizedClassBand = normalizeSummerCrashClassBandKey(mapping.classBand);
    if (!requestedMappingsByClassBand.has(normalizedClassBand)) {
      return mapping;
    }

    const nextPaperId = requestedMappingsByClassBand.get(normalizedClassBand) || "";
    return {
      ...mapping,
      diagnosticQuestionPaperId: nextPaperId || undefined,
    };
  });

  campaign.title =
    normalizeSummerCrashText(input.title) || normalizeSummerCrashText(campaign.title);
  campaign.supportContact =
    normalizeSummerCrashText(input.supportContact) ||
    normalizeSummerCrashText(campaign.supportContact) ||
    undefined;
  if (typeof input.isActive === "boolean") {
    campaign.isActive = input.isActive;
  }
  campaign.classMappings = nextMappings as typeof campaign.classMappings;
  await campaign.save();

  return getWorkspacePublicTestsConfig(input.schoolKey);
}

export async function listWorkspacePublicTestLeads(params: {
  schoolKey: string;
  page?: number;
  limit?: number;
  classBand?: string;
}): Promise<WorkspacePublicTestsPagedList<WorkspacePublicTestLeadRow>> {
  assertSummerPublicTestsSchoolKey(params.schoolKey);
  await connectDB();

  const campaign = await getOrCreateSummerCrashCampaign();
  const requestedPage = normalizePositivePage(params.page, 1);
  const limit = Math.min(
    100,
    Math.max(1, Number(params.limit || PUBLIC_TESTS_LEADS_PAGE_SIZE)),
  );
  const classBandFilter = normalizeClassBandFilter(params.classBand);
  const query: Record<string, unknown> = {
    campaignId: campaign._id,
    status: { $ne: "archived" },
  };

  if (classBandFilter !== "all") {
    query.classBandNormalized = normalizeSummerCrashClassBandKey(classBandFilter);
  }

  const total = await SummerCrashEnrollment.countDocuments(query);
  const pages = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(requestedPage, pages);
  const rows = await SummerCrashEnrollment.find(query)
    .select(
      "studentName guardianName phone classBand status entrySource diagnosticStatus joinedAt firstAccessAt",
    )
    .sort({ joinedAt: -1, createdAt: -1, _id: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  return {
    items: rows.map((row) => ({
      _id: String(row._id || ""),
      studentName: normalizeSummerCrashText(row.studentName),
      guardianName: normalizeSummerCrashText(row.guardianName),
      phone: normalizeSummerCrashText(row.phone),
      classBand: normalizeSummerCrashText(row.classBand),
      status: normalizeSummerCrashText(row.status) || "registered",
      entrySource:
        normalizeSummerCrashText(row.entrySource) || "direct_registration",
      diagnosticStatus:
        normalizeSummerCrashText(row.diagnosticStatus) || "registered",
      joinedAt: serializeDate(row.joinedAt),
      firstAccessAt: serializeDate(row.firstAccessAt),
    })),
    total,
    page,
    pages,
    limit,
  };
}

export async function listWorkspacePublicTestResults(params: {
  schoolKey: string;
  page?: number;
  limit?: number;
  classBand?: string;
}): Promise<WorkspacePublicTestsPagedList<WorkspacePublicTestResultRow>> {
  assertSummerPublicTestsSchoolKey(params.schoolKey);
  await connectDB();

  const campaign = await getOrCreateSummerCrashCampaign();
  const requestedPage = normalizePositivePage(params.page, 1);
  const limit = Math.min(
    100,
    Math.max(1, Number(params.limit || PUBLIC_TESTS_RESULTS_PAGE_SIZE)),
  );
  const classBandFilter = normalizeClassBandFilter(params.classBand);
  const query: Record<string, unknown> = {
    campaignId: campaign._id,
    status: { $ne: "archived" },
    diagnosticStatus: { $in: ["started", "submitted"] },
  };

  if (classBandFilter !== "all") {
    query.classBandNormalized = normalizeSummerCrashClassBandKey(classBandFilter);
  }

  const total = await SummerCrashEnrollment.countDocuments(query);
  const pages = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(requestedPage, pages);
  const rows = await SummerCrashEnrollment.find(query)
    .select(
      [
        "studentName",
        "guardianName",
        "phone",
        "classBand",
        "diagnosticQuestionPaperId",
        "diagnosticStatus",
        "diagnosticResponseId",
        "diagnosticStartedAt",
        "diagnosticCompletedAt",
        "diagnosticScore",
        "diagnosticPercent",
      ].join(" "),
    )
    .sort({ diagnosticCompletedAt: -1, diagnosticStartedAt: -1, _id: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const paperIds = Array.from(
    new Set(
      rows
        .map((row) => String(row.diagnosticQuestionPaperId || "").trim())
        .filter(Boolean),
    ),
  );

  const paperTitleById = new Map<string, string>();

  if (paperIds.length > 0) {
    const { QuestionPaper: QuestionPaperModel } = await getTenantModels(
      params.schoolKey,
      ["QuestionPaper"],
    );
    const papers = (await QuestionPaperModel.find({
      _id: { $in: paperIds },
      ...buildArchiveFilter(false),
    })
      .select("title")
      .lean()) as Array<{ _id?: unknown; title?: unknown }>;

    for (const paper of papers) {
      paperTitleById.set(
        String(paper._id || ""),
        normalizeSummerCrashText(paper.title) || "Untitled Paper",
      );
    }
  }

  return {
    items: rows.map((row) => {
      const responseId = String(row.diagnosticResponseId || "").trim();
      return {
        _id: String(row._id || ""),
        studentName: normalizeSummerCrashText(row.studentName),
        guardianName: normalizeSummerCrashText(row.guardianName),
        phone: normalizeSummerCrashText(row.phone),
        classBand: normalizeSummerCrashText(row.classBand),
        paperTitle:
          paperTitleById.get(String(row.diagnosticQuestionPaperId || "").trim()) ||
          "Diagnostic Paper",
        diagnosticStatus: normalizeSummerCrashText(row.diagnosticStatus) || "started",
        score:
          Number.isFinite(Number(row.diagnosticScore))
            ? Number(row.diagnosticScore)
            : null,
        percent:
          Number.isFinite(Number(row.diagnosticPercent))
            ? Number(row.diagnosticPercent)
            : null,
        startedAt: serializeDate(row.diagnosticStartedAt),
        completedAt: serializeDate(row.diagnosticCompletedAt),
        workspaceReportHref: responseId
          ? `/workspace/analytics/student-tag-report/${encodeURIComponent(responseId)}`
          : "",
        studentReportHref: responseId
          ? `/student/reports/${encodeURIComponent(responseId)}?returnTo=${encodeURIComponent(SUMMER_CRASH_HOME_PATH)}`
          : "",
      } satisfies WorkspacePublicTestResultRow;
    }),
    total,
    page,
    pages,
    limit,
  };
}

export async function getWorkspacePublicTestsPageData(params: {
  schoolKey: string;
  leadPage?: number;
  resultPage?: number;
  leadClassBand?: string;
  resultClassBand?: string;
}) {
  assertSummerPublicTestsSchoolKey(params.schoolKey);

  const leadClassBand = normalizeClassBandFilter(params.leadClassBand);
  const resultClassBand = normalizeClassBandFilter(params.resultClassBand);
  const [config, leads, results, totalRegistrations, totalDiagnosticStarted, totalDiagnosticSubmitted] =
    await Promise.all([
      getWorkspacePublicTestsConfig(params.schoolKey),
      listWorkspacePublicTestLeads({
        schoolKey: params.schoolKey,
        page: params.leadPage,
        classBand: leadClassBand,
      }),
      listWorkspacePublicTestResults({
        schoolKey: params.schoolKey,
        page: params.resultPage,
        classBand: resultClassBand,
      }),
      SummerCrashEnrollment.countDocuments({
        summerSchoolKey: params.schoolKey,
        status: { $ne: "archived" },
      }),
      SummerCrashEnrollment.countDocuments({
        summerSchoolKey: params.schoolKey,
        status: { $ne: "archived" },
        diagnosticStatus: "started",
      }),
      SummerCrashEnrollment.countDocuments({
        summerSchoolKey: params.schoolKey,
        status: { $ne: "archived" },
        diagnosticStatus: "submitted",
      }),
    ]);

  return {
    config,
    leads,
    results,
    stats: {
      totalRegistrations,
      totalDiagnosticStarted,
      totalDiagnosticSubmitted,
    },
    filters: {
      leadClassBand,
      resultClassBand,
    },
    classBandOptions: ["all", ...SUMMER_CRASH_DEFAULT_CLASS_BANDS],
  } satisfies WorkspacePublicTestsPageData;
}
