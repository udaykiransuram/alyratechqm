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
    academicSections?: ReportFilterOption[];
    subjects?: ReportFilterOption[];
  };
};

type ReportDataPayload = {
  stats?: any;
  paper?: string;
};

export type ClassTagReportPageBootstrap = {
  groupFields: GroupField[];
  classOptions: ReportFilterOption[];
  academicSectionOptions: ReportFilterOption[];
  subjectOptions: ReportFilterOption[];
  groupBy: string[];
  selectedClassId: string;
  selectedAcademicSectionId: string;
  selectedSubjectId: string;
  stats: any;
  paperTitle: string;
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
        ? String(payload.message || "Failed to load analytics.")
        : "Failed to load analytics.",
    );
  }

  return payload as T;
}

type ClassTagReportPageBootstrapParams = {
  paperId: string;
  requestedClassId?: string;
  requestedAcademicSectionId?: string;
  requestedSubjectId?: string;
};

export async function getClassTagReportPageBootstrap({
  paperId,
  requestedClassId = "all",
  requestedAcademicSectionId = "all",
  requestedSubjectId = "all",
}: ClassTagReportPageBootstrapParams): Promise<ClassTagReportPageBootstrap> {
  const normalizedPaperId = String(paperId || "").trim();
  if (!normalizedPaperId) {
    return {
      groupFields: [],
      classOptions: [],
      academicSectionOptions: [],
      subjectOptions: [],
      groupBy: [],
      selectedClassId: "all",
      selectedAcademicSectionId: "all",
      selectedSubjectId: "all",
      stats: {},
      paperTitle: "",
      error: "Report not found.",
    };
  }

  try {
    const setupSearchParams = new URLSearchParams();
    setupSearchParams.set("groupFields", "1");
    if (requestedClassId !== "all") {
      setupSearchParams.set("classId", requestedClassId);
    }
    if (requestedSubjectId !== "all") {
      setupSearchParams.set("subjectId", requestedSubjectId);
    }

    const provisionalGroupBy = [...DEFAULT_BOOTSTRAP_GROUP_BY];
    const initialReportSearchParams = new URLSearchParams();
    initialReportSearchParams.set("json", "1");
    initialReportSearchParams.set("groupBy", provisionalGroupBy.join(","));
    if (requestedClassId !== "all") {
      initialReportSearchParams.set("classId", requestedClassId);
    }
    if (requestedAcademicSectionId !== "all") {
      initialReportSearchParams.set(
        "academicSectionId",
        requestedAcademicSectionId,
      );
    }
    if (requestedSubjectId !== "all") {
      initialReportSearchParams.set("subjectId", requestedSubjectId);
    }

    const [setup, initialReport] = await Promise.all([
      fetchInternalJson<ReportSetupPayload>(
        `/api/analytics/class-tag-report/${normalizedPaperId}?${setupSearchParams.toString()}`,
      ),
      fetchInternalJson<ReportDataPayload>(
        `/api/analytics/class-tag-report/${normalizedPaperId}?${initialReportSearchParams.toString()}`,
      ),
    ]);

    const groupFields = Array.isArray(setup?.fields) ? setup.fields : [];
    const classOptions = Array.isArray(setup?.filters?.classes)
      ? setup.filters.classes
      : [];
    const academicSectionOptions = Array.isArray(setup?.filters?.academicSections)
      ? setup.filters.academicSections
      : [];
    const subjectOptions = Array.isArray(setup?.filters?.subjects)
      ? setup.filters.subjects
      : [];

    if (groupFields.length === 0) {
      throw new Error("No analytics fields are available for this paper yet.");
    }

    const groupBy = reconcileAnalyticsGroupBy([], groupFields, {
      requiredFieldValues:
        requestedSubjectId === "all" && subjectOptions.length > 1
          ? ["subject"]
          : [],
    });
    const selectedClassId =
      requestedClassId !== "all" &&
      classOptions.some((option) => option.value === requestedClassId)
        ? requestedClassId
        : "all";
    const selectedAcademicSectionId =
      requestedAcademicSectionId !== "all" &&
      academicSectionOptions.some(
        (option) => option.value === requestedAcademicSectionId,
      )
        ? requestedAcademicSectionId
        : "all";
    const selectedSubjectId =
      requestedSubjectId !== "all" &&
      subjectOptions.some((option) => option.value === requestedSubjectId)
        ? requestedSubjectId
        : "all";
    const needsReportRefetch =
      !areStringArraysEqual(groupBy, provisionalGroupBy) ||
      selectedClassId !== requestedClassId ||
      selectedAcademicSectionId !== requestedAcademicSectionId ||
      selectedSubjectId !== requestedSubjectId;

    let report = initialReport;

    if (needsReportRefetch) {
      const reportSearchParams = new URLSearchParams();
      reportSearchParams.set("json", "1");
      if (groupBy.length > 0) {
        reportSearchParams.set("groupBy", groupBy.join(","));
      }
      if (selectedClassId !== "all") {
        reportSearchParams.set("classId", selectedClassId);
      }
      if (selectedAcademicSectionId !== "all") {
        reportSearchParams.set("academicSectionId", selectedAcademicSectionId);
      }
      if (selectedSubjectId !== "all") {
        reportSearchParams.set("subjectId", selectedSubjectId);
      }

      report = await fetchInternalJson<ReportDataPayload>(
        `/api/analytics/class-tag-report/${normalizedPaperId}?${reportSearchParams.toString()}`,
      );
    }

    return {
      groupFields,
      classOptions,
      academicSectionOptions,
      subjectOptions,
      groupBy,
      selectedClassId,
      selectedAcademicSectionId,
      selectedSubjectId,
      stats: report?.stats || {},
      paperTitle: String(report?.paper || ""),
      error: null,
    };
  } catch (error) {
    return {
      groupFields: [],
      classOptions: [],
      academicSectionOptions: [],
      subjectOptions: [],
      groupBy: [],
      selectedClassId: "all",
      selectedAcademicSectionId: "all",
      selectedSubjectId: "all",
      stats: {},
      paperTitle: "",
      error:
        error instanceof Error ? error.message : "Failed to load analytics.",
    };
  }
}
