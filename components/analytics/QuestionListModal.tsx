import React, { useState } from "react";

export default function QuestionListModal({
  isOpen,
  onClose,
  title,
  questionIds,
  groupNode,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  questionIds: any[];
  groupNode?: any;
}) {
  if (!isOpen) return null;

  const [showNames, setShowNames] = useState(false);

  function getStudentCounts(key: "correctStudents" | "incorrectStudents" | "unattemptedStudents") {
    // Primary: build from per-question arrays
    const all: { name: string; rollNumber: string }[] = [];
    questionIds.forEach(q => {
      if (Array.isArray(q[key])) all.push(...q[key]);
    });
    const map = new Map<string, { name: string; rollNumber: string; count: number }>();
    all.forEach(s => {
      const k = `${s.rollNumber}|${s.name}`;
      if (!map.has(k)) map.set(k, { ...s, count: 1 });
      else map.get(k)!.count += 1;
    });
    let result = Array.from(map.values());
    // Fallback for compact mode: use group-level aggregated lists if per-question arrays are absent
    if (result.length === 0 && groupNode && Array.isArray(groupNode[key])) {
      const aggMap = new Map<string, { name: string; rollNumber: string; count: number }>();
      (groupNode[key] as { name: string; rollNumber: string }[]).forEach(s => {
        const k = `${s.rollNumber}|${s.name}`;
        // We do not know per-question frequency in compact mode; default count=1 per student
        if (!aggMap.has(k)) aggMap.set(k, { ...s, count: 1 });
      });
      result = Array.from(aggMap.values());
    }
    return result;
  }

  const correctStudents = getStudentCounts("correctStudents");
  const incorrectStudents = getStudentCounts("incorrectStudents");
  const unattemptedStudents = getStudentCounts("unattemptedStudents");

  const correctCount = correctStudents.reduce((sum, s) => sum + s.count, 0);
  const incorrectCount = incorrectStudents.reduce((sum, s) => sum + s.count, 0);
  const unattemptedCount = unattemptedStudents.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center border-b border-slate-200 p-4">
          <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-500 hover:bg-slate-200 focus:outline-none"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4 max-h-[70vh] overflow-y-auto">
          <div className="mb-4 p-3 bg-slate-100 rounded-lg border">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold">Consolidated Stats for this Group</div>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={showNames}
                  onChange={() => setShowNames(v => !v)}
                  className="form-checkbox"
                />
                <span>Show names</span>
              </label>
            </div>
            <div className="flex flex-wrap gap-4 text-xs mb-2">
              <span className="bg-green-100 text-green-700 px-2 py-1 rounded">
                Correct: {correctCount}
              </span>
              <span className="bg-red-100 text-red-700 px-2 py-1 rounded">
                Incorrect: {incorrectCount}
              </span>
              <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded">
                Unattempted: {unattemptedCount}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div>
                <div className="font-semibold text-green-700 mb-1">Correct Students</div>
                {showNames ? (
                  <ul className="list-disc list-inside text-xs text-slate-700">
                    {correctStudents.length
                      ? correctStudents.map((s, i) => (
                          <li key={i}>
                            {s.name} ({s.rollNumber})
                            <span className="ml-2 text-slate-500">×{s.count}</span>
                          </li>
                        ))
                      : <li className="text-slate-400 italic">None</li>}
                  </ul>
                ) : (
                  <div className="text-xs text-slate-500 italic">Names hidden. Enable "Show names" to view.</div>
                )}
              </div>
              <div>
                <div className="font-semibold text-red-700 mb-1">Incorrect Students</div>
                {showNames ? (
                  <ul className="list-disc list-inside text-xs text-slate-700">
                    {incorrectStudents.length
                      ? incorrectStudents.map((s, i) => (
                          <li key={i}>
                            {s.name} ({s.rollNumber})
                            <span className="ml-2 text-slate-500">×{s.count}</span>
                          </li>
                        ))
                      : <li className="text-slate-400 italic">None</li>}
                  </ul>
                ) : (
                  <div className="text-xs text-slate-500 italic">Names hidden. Enable "Show names" to view.</div>
                )}
              </div>
              <div>
                <div className="font-semibold text-yellow-700 mb-1">Unattempted Students</div>
                {showNames ? (
                  <ul className="list-disc list-inside text-xs text-slate-700">
                    {unattemptedStudents.length
                      ? unattemptedStudents.map((s, i) => (
                          <li key={i}>
                            {s.name} ({s.rollNumber})
                            <span className="ml-2 text-slate-500">×{s.count}</span>
                          </li>
                        ))
                      : <li className="text-slate-400 italic">None</li>}
                  </ul>
                ) : (
                  <div className="text-xs text-slate-500 italic">Names hidden. Enable "Show names" to view.</div>
                )}
              </div>
            </div>
          </div>
          <ul className="space-y-4">
            {questionIds.map(q => (
              <li key={q.id} className="border rounded-md p-3 bg-slate-50">
                <a
                  href={`/questions/view/${q.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-blue-700 hover:underline"
                >
                  {q.section && <span className="font-semibold mr-2">{q.section}:</span>}
                  Question {q.number ?? '-'}
                </a>
                <div className="mt-2 flex flex-wrap gap-4 text-xs">
                  <span className="bg-green-100 text-green-700 px-2 py-1 rounded">
                    Correct: {q.correctCount ?? 0}
                  </span>
                  <span className="bg-red-100 text-red-700 px-2 py-1 rounded">
                    Incorrect: {q.incorrectCount ?? 0}
                  </span>
                  <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded">
                    Unattempted: {q.unattemptedCount ?? 0}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
                  <div>
                    <div className="font-semibold text-green-700 mb-1">Correct Students</div>
                    {showNames ? (
                      <ul className="list-disc list-inside text-xs text-slate-700">
                        {q.correctStudents?.length
                          ? q.correctStudents.map((s: { name: string; rollNumber: string }, i: number) => (
                              <li key={i}>{s.name} ({s.rollNumber})</li>
                            ))
                          : <li className="text-slate-400 italic">None</li>}
                      </ul>
                    ) : (
                      <div className="text-xs text-slate-500 italic">Names hidden.</div>
                    )}
                  </div>
                  <div>
                    <div className="font-semibold text-red-700 mb-1">Incorrect Students</div>
                    {showNames ? (
                      <ul className="list-disc list-inside text-xs text-slate-700">
                        {q.incorrectStudents?.length
                          ? q.incorrectStudents.map((s: { name: string; rollNumber: string }, i: number) => (
                              <li key={i}>{s.name} ({s.rollNumber})</li>
                            ))
                          : <li className="text-slate-400 italic">None</li>}
                      </ul>
                    ) : (
                      <div className="text-xs text-slate-500 italic">Names hidden.</div>
                    )}
                  </div>
                  <div>
                    <div className="font-semibold text-yellow-700 mb-1">Unattempted Students</div>
                    {showNames ? (
                      <ul className="list-disc list-inside text-xs text-slate-700">
                        {q.unattemptedStudents?.length
                          ? q.unattemptedStudents.map((s: { name: string; rollNumber: string }, i: number) => (
                              <li key={i}>{s.name} ({s.rollNumber})</li>
                            ))
                          : <li className="text-slate-400 italic">None</li>}
                      </ul>
                    ) : (
                      <div className="text-xs text-slate-500 italic">Names hidden.</div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}