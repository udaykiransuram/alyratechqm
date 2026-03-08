type ReportHeaderProps = {
  student?: string;
  rollNumber?: string;
  paper: string;
  variant?: 'student' | 'class';
};

const ReportHeader = ({
  student = '',
  rollNumber = '',
  paper,
  variant = 'student',
}: ReportHeaderProps) => {
  const isClass = variant === 'class';
  const title = isClass ? 'Class Analytics Report' : 'Student Analytics Report';
  const subtitle = isClass
    ? 'Explore class-wide performance patterns by grouped tags and answer trends.'
    : 'Review the student’s tag-level performance, gaps, and remedial priorities.';

  const items = isClass
    ? [
        { label: 'Report Scope', value: 'Class Level' },
        { label: 'Paper', value: paper || '-' },
      ]
    : [
        { label: 'Student', value: student || '-' },
        { label: 'Roll Number', value: rollNumber || '-' },
        { label: 'Paper', value: paper || '-' },
      ];

  return (
    <div className="analytics-card overflow-hidden">
      <div className="analytics-card-header">
        <h1 className="app-page-title">{title}</h1>
        <p className="app-page-subtitle">{subtitle}</p>
      </div>
      <div className="p-6">
        <div className={`grid gap-4 ${items.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
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
