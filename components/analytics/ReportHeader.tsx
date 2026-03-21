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
        <div className="analytics-toolbar-row gap-4">
          <div className="analytics-toolbar-copy">
            <h1 className="app-page-title">{title}</h1>
          </div>
          {actions ? (
            <div className="analytics-toolbar-actions">{actions}</div>
          ) : null}
        </div>
      </div>
      <div className="p-4 sm:p-5">
        <div
          className={`grid gap-3 ${items.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3"}`}
        >
          {items.map((item) => (
            <div key={item.label} className="analytics-data-card">
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
