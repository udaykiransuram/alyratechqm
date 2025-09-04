const OptionTagsDisplay = ({
  optionTags,
  onTagClick,
}: {
  optionTags: any[];
  onTagClick: (option: string, tag: string, isCorrect: boolean, students: { name: string; rollNumber: string }[]) => void;
}) => {
  if (!Array.isArray(optionTags) || optionTags.length === 0) {
    return <span className="text-slate-400 italic">-</span>;
  }

  const grouped: Record<string, { option: string; tag: string; isCorrect: boolean; students: { name: string; rollNumber: string }[] }> = {};
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
    if (opt.student && opt.student.name) {
      grouped[key].students.push(opt.student);
    }
  });

  const correctTags = Object.values(grouped).filter(o => o.isCorrect);
  const incorrectTags = Object.values(grouped).filter(o => !o.isCorrect);

  return (
    <div className="flex flex-col items-center justify-center gap-2">
      {correctTags.length > 0 && (
        <div>
          <span className="font-semibold text-green-700 mr-2">Correct:</span>
          {correctTags.map((opt, idx) => (
            <button
              key={'c' + idx}
              type="button"
              className="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full mr-2 mb-1 hover:bg-green-200 focus:outline-none"
              onClick={() => onTagClick(opt.option, opt.tag, true, opt.students)}
            >
              {opt.option}: {opt.tag}
              {opt.students.length > 0 && (
                <span className="ml-2 font-bold">×{opt.students.length}</span>
              )}
            </button>
          ))}
        </div>
      )}
      {incorrectTags.length > 0 && (
        <div>
          <span className="font-semibold text-red-700 mr-2">Incorrect:</span>
          {incorrectTags.map((opt, idx) => (
            <button
              key={'i' + idx}
              type="button"
              className="inline-block bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full mr-2 mb-1 hover:bg-red-200 focus:outline-none"
              onClick={() => onTagClick(opt.option, opt.tag, false, opt.students)}
            >
              {opt.option}: {opt.tag}
              {opt.students.length > 0 && (
                <span className="ml-2 font-bold">×{opt.students.length}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default OptionTagsDisplay;