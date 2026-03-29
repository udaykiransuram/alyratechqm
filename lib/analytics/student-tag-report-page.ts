import { headers } from "next/headers";

import { reconcileAnalyticsGroupBy } from "@/lib/analytics/group-by";
import { getTrustedInternalOrigin } from "@/lib/security/internal-origin";

type ReportFilterOption = {
  value: string;
  label: string;
};

type GroupField = {
  value: string;
  label: string;
};

type ReportSetupPayload = {
  fields?: GroupField[];
  filters?: {
    classes?: ReportFilterOption[];
    subjects?: ReportFilterOption[];
    academicSections?: ReportFilterOption[];
  };
};

type ReportDataPayload = {
  stats?: any;
  student?: string;
  rollNumber?: string;
  paper?: string;
};

export type StudentTagReportPageBootstrap = {
  groupFields: GroupField[];
  groupBy: string[];
  classOptions: ReportFilterOption[];
  subjectOptions: ReportFilterOption[];
  academicSectionOptions: ReportFilterOption[];
  stats: any;
  classStatsCompare: any;
  student: string;
  rollNumber: string;
  paper: string;
  error: string | null;
};

const DEFAULT_BOOTSTRAP_GROUP_BY = ["section", "class", "subject"] as const;

function areStringArraysEqual(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

async function fetchInternalJson<T>(path: string): Promise<T> {
  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get("cookie") || "";

  const response = await fetch(`${getTrustedInternalOrigin()}${path}`, {
    method: "GET",
    cache: "no-store",
    headers: cookieHeader
      ? {
          cookie: cookieHeader,
        }
      : undefined,
  });

  const payload = (await response.json().catch(() => null)) as
    | T
    | { message?: string }
    | null;

  if (!response.ok) {
    throw new Error(
      payload && typeof payload === "object" && "message" in payload
        ? String(payload.message || "Failed to load report.")
        : "Failed to load report.",
    );
  }

  return payload as T;
}

function buildAnalyticsPath(responseId: string, groupBy: string[], classLevel = false) {
  const searchParams = new URLSearchParams();
  searchParams.set("json", "1");

  if (groupBy.length > 0) {
    searchParams.set("groupBy", groupBy.join(","));
  }

  if (classLevel) {
    searchParams.set("classLevel", "1");
  }

  return `/api/analytics/student-tag-report/${responseId}?${searchParams.toString()}`;
}

export async function getStudentTagReportPageBootstrap(params: {
  responseId: string;
  portalMode?: "admin" | "student";
}): Promise<StudentTagReportPageBootstrap> {
  const responseId = String(params.responseId || "").trim();
  const isStudentPortal = params.portalMode === "student";

  if (!responseId) {
    return {
      groupFields: [],
      groupBy: [],
      classOptions: [],
      subjectOptions: [],
      academicSectionOptions: [],
      stats: {},
      classStatsCompare: {},
      student: "",
      rollNumber: "",
      paper: "",
      error: "Report not found.",
    };
  }

  try {
    const provisionalGroupBy = [...DEFAULT_BOOTSTRAP_GROUP_BY];
    const setupPromise = fetchInternalJson<ReportSetupPayload>(
      `/api/analytics/student-tag-report/${responseId}?groupFields=1`,
    );
    const reportPromise = fetchInternalJson<ReportDataPayload>(
      buildAnalyticsPath(responseId, provisionalGroupBy),
    );
    const classComparePromise = !isStudentPortal
      ? fetchInternalJson<ReportDataPayload>(
          buildAnalyticsPath(responseId, provisionalGroupBy, true),
        ).catch(() => null)
      : Promise.resolve(null);
    const [setup, initialReport, initialClassCompare] = await Promise.all([
      setupPromise,
      reportPromise,
      classComparePromise,
    ]);

    const groupFields = Array.isArray(setup?.fields) ? setup.fields : [];
    if (groupFields.length === 0) {
      throw new Error("No analytics fields are available for this response yet.");
    }

    const groupBy = reconcileAnalyticsGroupBy([], groupFields, {
      requiredFieldValues:
        Array.isArray(setup?.filters?.subjects) && setup.filters.subjects.length > 1
          ? ["subject"]
          : [],
    });
    const needsReportRefetch = !areStringArraysEqual(groupBy, provisionalGroupBy);
    const [report, classCompare] = needsReportRefetch
      ? await Promise.all([
          fetchInternalJson<ReportDataPayload>(
            buildAnalyticsPath(responseId, groupBy),
          ),
          !isStudentPortal
            ? fetchInternalJson<ReportDataPayload>(
                buildAnalyticsPath(responseId, groupBy, true),
              ).catch(() => null)
            : Promise.resolve(null),
        ])
      : [initialReport, initialClassCompare];

    return {
      groupFields,
      groupBy,
      classOptions: Array.isArray(setup?.filters?.classes)
        ? setup.filters.classes
        : [],
      subjectOptions: Array.isArray(setup?.filters?.subjects)
        ? setup.filters.subjects
        : [],
      academicSectionOptions: Array.isArray(setup?.filters?.academicSections)
        ? setup.filters.academicSections
        : [],
      stats: report?.stats || {},
      classStatsCompare: classCompare?.stats || {},
      student: String(report?.student || ""),
      rollNumber: String(report?.rollNumber || ""),
      paper: String(report?.paper || ""),
      error: null,
    };
  } catch (error) {
    return {
      groupFields: [],
      groupBy: [],
      classOptions: [],
      subjectOptions: [],
      academicSectionOptions: [],
      stats: {},
      classStatsCompare: {},
      student: "",
      rollNumber: "",
      paper: "",
      error:
        error instanceof Error ? error.message : "Failed to load report.",
    };
  }
}
