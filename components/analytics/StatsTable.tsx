import React from 'react';

import OptionTagsDisplay from './OptionTagsDisplay';
import { sortStatsRows, getGroupLabel } from './helpers';

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
    groupNode?: any,
  ) => void;
  handleOptionTagClick: (
    option: string,
    tag: string,
    isCorrect: boolean,
    students: { name: string; rollNumber: string }[],
  ) => void;
  selectedTags: { type: string; value: string }[];
  handleTagSelect: (tag: { type: string; value: string }) => void;
  sortConfig: { key: string; direction: 'asc' | 'desc' };
  setSortConfig: React.Dispatch<
    React.SetStateAction<{ key: string; direction: 'asc' | 'desc' }>
  >;
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
    key: 'correctStudents' | 'incorrectStudents' | 'unattemptedStudents',
  ) => {
    const groupNode = getGroupNode(row);
    let consolidatedStudents: { name: string; rollNumber: string; count: number }[] = [];

    if (Array.isArray(questionIds) && questionIds.length > 0) {
      const all: { name: string; rollNumber: string }[] = [];
      questionIds.forEach((question) => {
        if (question[key]) all.push(...question[key]);
      });

      const map = new Map<string, { name: string; rollNumber: string; count: number }>();
      all.forEach((student) => {
        const studentKey = `${student.rollNumber}|${student.name}`;
        if (!map.has(studentKey)) map.set(studentKey, { ...student, count: 1 });
        else map.get(studentKey)!.count += 1;
      });
      consolidatedStudents = Array.from(map.values());
    }

    if (consolidatedStudents.length === 0 && groupNode && Array.isArray(groupNode[key])) {
      const map = new Map<string, { name: string; rollNumber: string; count: number }>();
      (groupNode[key] as { name: string; rollNumber: string }[]).forEach((student) => {
        const studentKey = `${student.rollNumber}|${student.name}`;
        if (!map.has(studentKey)) map.set(studentKey, { ...student, count: 1 });
        else map.get(studentKey)!.count += 1;
      });
      consolidatedStudents = Array.from(map.values());
    }

    if (!Array.isArray(questionIds) || questionIds.length === 0) {
      return <span>{count}</span>;
    }

    return (
      <button
        type="button"
        onClick={() => handleOpenModal(title, questionIds, groupNode)}
        className="analytics-inline-link-button analytics-table-link-number"
        title="View students"
      >
        {count}
      </button>
    );
  };

  if (
    'correct' in stats &&
    'incorrect' in stats &&
    'unattempted' in stats &&
    Object.keys(stats).every((key) =>
      [
        'correct',
        'incorrect',
        'unattempted',
        'correctQuestionIds',
        'incorrectQuestionIds',
        'unattemptedQuestionIds',
        'tags',
        'optionTags',
      ].includes(key),
    )
  ) {
    return null;
  }

  const nonGroupKeys = new Set([
    'correct',
    'incorrect',
    'unattempted',
    'correctQuestionIds',
    'incorrectQuestionIds',
    'unattemptedQuestionIds',
    'tags',
    'optionTags',
    'correctStudents',
    'incorrectStudents',
    'unattemptedStudents',
  ]);

  const rows = Object.entries(stats)
    .filter(([key, value]) => typeof value === 'object' && value !== null && !nonGroupKeys.has(key))
    .map(([key, value]) => ({ key, ...value }));

  if (rows.length === 0) return null;

  const sortedRows = sortStatsRows(rows, sortConfig.key, sortConfig.direction);

  return (
    <>
      {sortedRows.map((row) => (
        <React.Fragment key={row.key}>
          <tr className="analytics-row">
            <td
              className="analytics-td analytics-table-group-cell"
              style={{ paddingLeft: `${level * 24 + 16}px` }}
            >
              {getGroupLabel(row.key, row, groupBy[level])}
            </td>
            {showTagsColumn ? (
              <td className="analytics-td-center">
                {row.tags && row.tags.length > 0 ? (
                  <div className="flex flex-wrap justify-center gap-2">
                    {row.tags.map((tag: any, index: number) => {
                      const isSelected = selectedTags.some(
                        (selected) => selected.type === tag.type && selected.value === tag.value,
                      );
                      return (
                        <button
                          key={`${tag.type}-${tag.value}-${index}`}
                          type="button"
                          className={`analytics-chip-button ${
                            isSelected
                              ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground'
                              : 'border-border/60 bg-background text-foreground hover:bg-accent hover:text-accent-foreground'
                          }`}
                          onClick={() => handleTagSelect(tag)}
                        >
                          {tag.type}: {tag.value}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </td>
            ) : null}
            <td className="analytics-td-center analytics-table-measure-cell font-medium text-emerald-600">
              {renderClickableNumber(
                row.correct,
                'Correct Questions',
                row.correctQuestionIds,
                row,
                'correctStudents',
              )}
            </td>
            <td className="analytics-td-center analytics-table-measure-cell font-medium text-rose-600">
              {renderClickableNumber(
                row.incorrect,
                'Incorrect Questions',
                row.incorrectQuestionIds,
                row,
                'incorrectStudents',
              )}
            </td>
            <td className="analytics-td-center analytics-table-measure-cell font-medium text-amber-600">
              {renderClickableNumber(
                row.unattempted,
                'Unattempted Questions',
                row.unattemptedQuestionIds,
                row,
                'unattemptedStudents',
              )}
            </td>
            {showOptionTagsColumn ? (
              <td className="analytics-td-center">
                <OptionTagsDisplay optionTags={row.optionTags} onTagClick={handleOptionTagClick} />
              </td>
            ) : null}
          </tr>
          <StatsTable
            stats={Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'key'))}
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
