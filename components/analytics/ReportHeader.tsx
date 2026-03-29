import type { ReactNode } from "react";

type ReportHeaderProps = {
  student?: string;
  rollNumber?: string;
  paper: string;
  variant?: "student" | "class";
  actions?: ReactNode;
  summaryBadges?: string[];
};

const ReportHeader = ({
  student = "",
  rollNumber = "",
  paper,
  variant = "student",
  actions,
  summaryBadges = [],
}: ReportHeaderProps) => {
  const isClass = variant === "class";
  const title = isClass ? "Class Analytics Report" : "Student Analytics Report";
  const description = isClass
    ? "Overall-first reporting with grouped drill-down, filters, and export-ready tables."
    : "Review grouped student performance with comparison, filters, and export-ready tables.";

  const items = isClass
    ? [
        { label: "Report Scope", value: "Class Level" },
        { label: "Paper", value: paper || "-" },
      ]
    : [
        { label: "Student", value: student || "-" },
        { label: "Roll Number", value: rollNumber || "-" },
        { label: "Paper", value: paper || "-" },
      ];

  return (
    <div className="analytics-card overflow-hidden">
      <div className="analytics-card-header analytics-card-header-highlight">
        <div className="analytics-toolbar-row gap-4">
          <div className="analytics-toolbar-copy">
            <h1 className="app-page-title">{title}</h1>
            <p className="analytics-card-description">{description}</p>
          </div>
          {actions ? (
            <div className="analytics-toolbar-actions">{actions}</div>
          ) : null}
        </div>
        {summaryBadges.length > 0 ? (
          <div className="analytics-toolbar-meta analytics-toolbar-meta-start">
            {summaryBadges.map((badge, index) => (
              <span
                key={`${badge}-${index}`}
                className="analytics-toolbar-chip analytics-toolbar-chip-muted"
              >
                {badge}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <div className="px-4 py-3.5 sm:px-5 sm:py-4">
        <div
          className={`grid gap-2.5 ${items.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3"}`}
        >
          {items.map((item) => (
            <div key={item.label} className="analytics-data-card-compact">
              <p className="app-detail-label">{item.label}</p>
              <p className="app-detail-value break-words">{item.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ReportHeader;
