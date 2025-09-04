import React from "react";
import OptionTagsDisplay from "./OptionTagsDisplay";
import { sortStatsRows, getGroupLabel } from "./helpers";

type StatsNode = {
  correct: number;
  incorrect: number;
  unattempted: number;
  correctQuestionIds?: { id: string; number?: number; section?: string }[];
  incorrectQuestionIds?: { id: string; number?: number; section?: string }[];
  unattemptedQuestionIds?: { id: string; number?: number; section?: string }[];
  tags?: { type: string; value: string }[];
  optionTags?: any[];
  [key: string]: any;
};

export default function StatsTable({
  stats,
  level = 0,
  handleOpenModal,
  handleOptionTagClick,
  selectedTags,
  handleTagSelect,
  sortConfig,
  setSortConfig,
  showTagsColumn,
  showOptionTagsColumn,
  groupBy,
  parentNode,
}: {
  stats: StatsNode | Record<string, any>;
  level?: number;
  handleOpenModal: (
    title: string,
    questionIds: { id: string; number?: number; section?: string }[],
    groupNode?: any
  ) => void;
  handleOptionTagClick: (option: string, tag: string, isCorrect: boolean, students: { name: string; rollNumber: string }[]) => void;
  selectedTags: { type: string; value: string }[];
  handleTagSelect: (tag: { type: string; value: string }) => void;
  sortConfig: { key: string; direction: 'asc' | 'desc' };
  setSortConfig: React.Dispatch<React.SetStateAction<{ key: string; direction: 'asc' | 'desc' }>>;
  showTagsColumn: boolean;
  showOptionTagsColumn: boolean;
  groupBy: string[];
  parentNode?: any;
}) {
  const getGroupNode = (row: any) => {
    if (parentNode && row.key in parentNode) return parentNode[row.key];
    if (stats && row.key in stats) return stats[row.key];
    return row;
  };

  const renderClickableNumber = (
    count: number,
    title: string,
    questionIds: any[] | undefined,
    row: any,
    key: "correctStudents" | "incorrectStudents" | "unattemptedStudents"
  ) => {
    const groupNode = getGroupNode(row);
    if (!questionIds || questionIds.length === 0) return <span>{count}</span>;
    const allStudents: { name: string; rollNumber: string }[] = [];
    questionIds.forEach(q => {
      if (q[key]) allStudents.push(...q[key]);
    });
    const studentMap = new Map<string, { name: string; rollNumber: string; count: number }>();
    allStudents.forEach(s => {
      const k = `${s.rollNumber}|${s.name}`;
      if (!studentMap.has(k)) studentMap.set(k, { ...s, count: 1 });
      else studentMap.get(k)!.count += 1;
    });
    const consolidatedStudents = Array.from(studentMap.values());
    return (
      <span className="group relative">
        <button
          type="button"
          onClick={() => handleOpenModal(title, questionIds, groupNode)}
          className="underline decoration-dotted hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
        >
          {count}
        </button>
        {consolidatedStudents.length > 0 && (
          <div className="absolute left-1/2 z-10 hidden group-hover:block bg-white border border-slate-300 shadow-lg rounded-lg p-3 min-w-[200px] -translate-x-1/2 mt-2">
            <div className="font-semibold mb-1">{title.replace("Questions", "Students")}:</div>
            <ul className="max-h-32 overflow-y-auto text-xs">
              {consolidatedStudents.map((s, i) => (
                <li key={i}>
                  {s.name} <span className="text-slate-400">({s.rollNumber})</span>
                  <span className="ml-2 text-slate-500">×{s.count}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </span>
    );
  };

  if (
    "correct" in stats &&
    "incorrect" in stats &&
    "unattempted" in stats &&
    Object.keys(stats).every(
      k => ["correct", "incorrect", "unattempted", "correctQuestionIds", "incorrectQuestionIds", "unattemptedQuestionIds", "tags", "optionTags"].includes(k)
    )
  ) {
    return null;
  }

  const rows = Object.entries(stats)
    .filter(([key, value]) => typeof value === "object" && value !== null)
    .map(([key, value]) => ({ key, ...value }));

  if (rows.length === 0) return null;

  const sortedRows = sortStatsRows(rows, sortConfig.key, sortConfig.direction);

  return (
    <>
      {sortedRows.map(row => (
        <React.Fragment key={row.key}>
          <tr className="bg-white hover:bg-slate-50/50 transition-colors">
            <td
              className="px-4 py-3 border-b border-slate-200"
              style={{ paddingLeft: `${level * 24 + 16}px` }}
            >
              {getGroupLabel(row.key, row, groupBy[level])}
            </td>
            {showTagsColumn && (
              <td className="px-4 py-3 border-b border-slate-200 text-center">
                {row.tags && row.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-2 justify-center">
                    {row.tags.map((tag: any, idx: number) => {
                      const isSelected = selectedTags.some(
                        t => t.type === tag.type && t.value === tag.value
                      );
                      return (
                        <button
                          key={tag.type + tag.value + idx}
                          type="button"
                          className={`px-2 py-1 rounded-full text-xs border ${
                            isSelected
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-slate-100 text-slate-700 border-slate-300 hover:bg-blue-100"
                          }`}
                          onClick={() => handleTagSelect(tag)}
                        >
                          {tag.type}: {tag.value}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <span>-</span>
                )}
              </td>
            )}
            <td className="px-4 py-3 border-b border-slate-200 text-green-600 font-medium text-center group relative">
              <span>
                {renderClickableNumber(
                  row.correct,
                  "Correct Questions",
                  row.correctQuestionIds,
                  row,
                  "correctStudents"
                )}
              </span>
            </td>
            <td className="px-4 py-3 border-b border-slate-200 text-red-600 font-medium text-center">
              {renderClickableNumber(
                row.incorrect,
                "Incorrect Questions",
                row.incorrectQuestionIds,
                row,
                "incorrectStudents"
              )}
            </td>
            <td className="px-4 py-3 border-b border-slate-200 text-yellow-600 font-medium text-center group relative">
              <span>
                {renderClickableNumber(
                  row.unattempted,
                  "Unattempted Questions",
                  row.unattemptedQuestionIds,
                  row,
                  "unattemptedStudents"
                )}
              </span>
            </td>
            {showOptionTagsColumn && (
              <td className="px-4 py-3 border-b border-slate-200 text-center">
                <OptionTagsDisplay optionTags={row.optionTags} onTagClick={handleOptionTagClick} />
              </td>
            )}
          </tr>
          <StatsTable
            stats={Object.fromEntries(Object.entries(row).filter(([k]) => k !== 'key'))}
            level={level + 1}
            handleOpenModal={handleOpenModal}
            handleOptionTagClick={handleOptionTagClick}
            selectedTags={selectedTags}
            handleTagSelect={handleTagSelect}
            sortConfig={sortConfig}
            setSortConfig={setSortConfig}
            showTagsColumn={showTagsColumn}
            showOptionTagsColumn={showOptionTagsColumn}
            groupBy={groupBy}
            parentNode={stats}
          />
        </React.Fragment>
      ))}
    </>
  );
}