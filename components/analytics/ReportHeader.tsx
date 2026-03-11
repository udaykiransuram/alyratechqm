import type { ReactNode } from "react";

type ReportHeaderProps = {
  student?: string;
  rollNumber?: string;
  paper: string;
  variant?: "student" | "class";
  actions?: ReactNode;
};

const ReportHeader = ({
  student = "",
  rollNumber = "",
  paper,
  variant = "student",
  actions,
}: ReportHeaderProps) => {
  const isClass = variant === "class";
  const title = isClass ? "Class Analytics Report" : "Student Analytics Report";
  const subtitle = isClass
    ? "Class performance overview"
    : "Student performance overview";

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
      <div className="analytics-card-header border-l-4 border-primary bg-gradient-to-r from-primary/5 to-transparent">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h1 className="app-page-title">{title}</h1>
            <p className="app-page-subtitle">{subtitle}</p>
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      </div>
      <div className="p-4 sm:p-5">
        <div
          className={`grid gap-4 ${items.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3"}`}
        >
          {items.map((item) => (
            <div key={item.label} className="app-detail-item">
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
