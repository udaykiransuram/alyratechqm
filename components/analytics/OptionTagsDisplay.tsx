const OptionTagsDisplay = ({
  optionTags,
  onTagClick,
}: {
  optionTags: any[];
  onTagClick: (
    option: string,
    tag: string,
    isCorrect: boolean,
    students: { name: string; rollNumber: string }[],
  ) => void;
}) => {
  if (!Array.isArray(optionTags) || optionTags.length === 0) {
    return <span className="text-sm text-muted-foreground">-</span>;
  }

  const grouped: Record<
    string,
    { option: string; tag: string; isCorrect: boolean; students: { name: string; rollNumber: string }[] }
  > = {};

  optionTags.forEach((opt: any) => {
    const key = `${opt.option}|${opt.tag}|${opt.isCorrect}`;
    if (!grouped[key]) {
      grouped[key] = {
        option: opt.option,
        tag: opt.tag,
        isCorrect: opt.isCorrect,
        students: [],
      };
    }
    if (opt.student?.name) {
      grouped[key].students.push(opt.student);
    }
  });

  const correctTags = Object.values(grouped).filter((item) => item.isCorrect);
  const incorrectTags = Object.values(grouped).filter((item) => !item.isCorrect);

  const renderGroup = (
    label: string,
    items: typeof correctTags,
    tone: 'success' | 'danger',
  ) => {
    if (items.length === 0) return null;

    const classes =
      tone === 'success'
        ? 'analytics-chip-button-success'
        : 'analytics-chip-button-danger';

    return (
      <div className="flex flex-wrap items-start justify-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </span>
        {items.map((item, index) => (
          <button
            key={`${label}-${index}`}
            type="button"
            className={`analytics-chip-button ${classes}`}
            onClick={() => onTagClick(item.option, item.tag, item.isCorrect, item.students)}
          >
            <span>
              {item.option}: {item.tag}
            </span>
            {item.students.length > 0 ? <span>×{item.students.length}</span> : null}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center justify-center gap-2">
      {renderGroup('Correct', correctTags, 'success')}
      {renderGroup('Incorrect', incorrectTags, 'danger')}
    </div>
  );
};

export default OptionTagsDisplay;
