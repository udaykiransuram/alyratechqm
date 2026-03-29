"use client";

import dynamic from "next/dynamic";

export const AnalyticsChartView = dynamic(
  () => import("@/components/analytics/ChartView"),
  {
    ssr: false,
    loading: () => (
      <div className="analytics-card analytics-card-body">
        <p className="text-sm text-muted-foreground">Loading charts...</p>
      </div>
    ),
  },
);

export const AnalyticsExportControls = dynamic(
  () => import("@/components/analytics/AnalyticsExportControls"),
  {
    ssr: false,
    loading: () => (
      <div className="h-9 w-full rounded-xl border border-border/60 bg-muted/30 sm:w-56" />
    ),
  },
);

export const AnalyticsSearchableCommandSelect = dynamic(
  () =>
    import("@/components/ui/searchable-command-select").then(
      (module) => module.SearchableCommandSelect,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-11 rounded-xl border border-border/60 bg-muted/30" />
    ),
  },
);

export const AnalyticsQuestionListModal = dynamic(
  () => import("@/components/analytics/QuestionListModal"),
  {
    ssr: false,
    loading: () => null,
  },
);

export const AnalyticsOptionTagModal = dynamic(
  () => import("@/components/analytics/OptionTagModal"),
  {
    ssr: false,
    loading: () => null,
  },
);

export const AnalyticsClassBenchmarkPanel = dynamic(
  () => import("@/components/analytics/ClassBenchmarkPanel"),
  {
    ssr: false,
    loading: () => (
      <div className="analytics-card analytics-card-body">
        <p className="text-sm text-muted-foreground">
          Loading benchmark view...
        </p>
      </div>
    ),
  },
);

export const AnalyticsClassTagReportSetupControls = dynamic(
  () =>
    import(
      "@/components/analytics/class-report/ClassTagReportSetupControls"
    ),
  {
    ssr: false,
    loading: () => (
      <div className="analytics-card analytics-card-body">
        <p className="text-sm text-muted-foreground">Loading setup controls...</p>
      </div>
    ),
  },
);

export const AnalyticsStudentTagReportSetupControls = dynamic(
  () =>
    import(
      "@/components/analytics/student-report/StudentTagReportSetupControls"
    ),
  {
    ssr: false,
    loading: () => (
      <div className="analytics-card analytics-card-body">
        <p className="text-sm text-muted-foreground">Loading setup controls...</p>
      </div>
    ),
  },
);
