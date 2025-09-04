'use client';

import React, { useEffect, useState, useRef } from 'react';
import { toPng } from 'html-to-image';
import LoadingState from '@/components/analytics/LoadingState';
import ErrorState from '@/components/analytics/ErrorState';
import ReportHeader from '@/components/analytics/ReportHeader';
import OptionTagModal from '@/components/analytics/OptionTagModal';
import StatsTable from '@/components/analytics/StatsTable';
import ChartView from '@/components/analytics/ChartView';
import { sortStatsRows } from '@/components/analytics/helpers';

export default function StudentTagReportPage({ params }: { params: { responseId: string } }) {
  const [stats, setStats] = useState<any>({});
  const [student, setStudent] = useState<string>('');
  const [rollNumber, setRollNumber] = useState<string>('');
  const [paper, setPaper] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [groupFields, setGroupFields] = useState<{ value: string; label: string }[]>([]);
  const [groupBy, setGroupBy] = useState<string[]>([]);
  const [classLevel, setClassLevel] = useState(false);

  const [modalData, setModalData] = useState<{
    isOpen: boolean;
    title: string;
    questionIds: any[];
    groupNode?: any;
  }>({
    isOpen: false,
    title: '',
    questionIds: [],
    groupNode: undefined,
  });

  const [optionTagModal, setOptionTagModal] = useState<{
    isOpen: boolean;
    option: string;
    tag: string;
    isCorrect: boolean;
    students: { name: string; rollNumber: string }[];
  } | null>(null);

  const [selectedTags, setSelectedTags] = useState<{ type: string; value: string }[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: '', direction: 'desc' });
  const [showTagsColumn, setShowTagsColumn] = useState<boolean>(false);
  const [showOptionTagsColumn, setShowOptionTagsColumn] = useState<boolean>(false);
  const [view, setView] = useState<'table' | 'charts'>('table');

  useEffect(() => {
    fetch(`/api/analytics/student-tag-report/${params.responseId}?groupFields=1`)
      .then(res => res.json())
      .then((data: any) => {
        setGroupFields(data.fields || []);
        setGroupBy(data.fields?.find((f: any) => f.value === "section") ? ["section"] : []);
      });
  }, [params.responseId]);

  useEffect(() => {
    setLoading(true);
    const searchParams = new URLSearchParams();
    searchParams.set('json', '1');
    if (groupBy.length) searchParams.set('groupBy', groupBy.join(','));
    if (classLevel) searchParams.set('classLevel', '1');
    fetch(`/api/analytics/student-tag-report/${params.responseId}?${searchParams.toString()}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setStats(data.stats || {});
          setStudent(data.student || '');
          setRollNumber(data.rollNumber || '');
          setPaper(data.paper || '');
        } else {
          setError(data.message || 'Failed to fetch tag report');
        }
      })
      .catch(() => setError('An unexpected network error occurred.'))
      .finally(() => setLoading(false));
  }, [params.responseId, groupBy, classLevel]);

  const handleOpenModal = (
    title: string,
    questionIds: any[],
    groupNode?: any
  ) => setModalData({ isOpen: true, title, questionIds, groupNode });

  const handleCloseModal = () => setModalData({ isOpen: false, title: '', questionIds: [], groupNode: undefined });

  const handleOptionTagClick = (option: string, tag: string, isCorrect: boolean, students: { name: string; rollNumber: string }[]) => {
    setOptionTagModal({ isOpen: true, option, tag, isCorrect, students });
  };

  const handleCloseOptionTagModal = () => setOptionTagModal(null);

  const tableRef = useRef<HTMLDivElement>(null);

  async function handleDownloadTableImage() {
    if (tableRef.current) {
      const dataUrl = await toPng(tableRef.current, { cacheBust: true });
      const link = document.createElement('a');
      link.download = 'analytics_table.png';
      link.href = dataUrl;
      link.click();
    }
  }

  function handleDownloadCSV() {
    const csvRows: any[] = [];

    function walk(node: any, groupPath: string[] = []) {
      if (!node || typeof node !== "object") return;

      // If this node has counts, add it to CSV (even if it has other object keys)
      if (
        node.correct !== undefined &&
        node.incorrect !== undefined &&
        node.unattempted !== undefined
      ) {
        csvRows.push({
          ...groupPath.reduce((acc, val, idx) => ({ ...acc, [`Group${idx + 1}`]: val }), {}),
          correct: node.correct,
          incorrect: node.incorrect,
          unattempted: node.unattempted,
        });
        // Don't return here! There might be nested groups, so keep walking.
      }

      // Walk children (skip meta fields)
      const rows = Object.entries(node)
        .filter(([key, value]) => typeof value === "object" && value !== null)
        .map(([key, value]) => ({ key, ...(value as Record<string, any>) }));

      const sortedRows = sortStatsRows(rows, sortConfig.key, sortConfig.direction);

      for (const row of sortedRows) {
        const childNode = node[row.key];
        walk(childNode, [...groupPath, row.key]);
      }
    }

    if (stats && typeof stats === "object" && Object.keys(stats).length > 0) {
      walk(stats, []);
    }

    const headers = [
      ...groupBy.map((g, idx) => `Group${idx + 1}`),
      "correct",
      "incorrect",
      "unattempted"
    ];
    const csvContentRows = [
      headers.join(","),
      ...csvRows.map(row => headers.map(h => row[h] ?? "").join(","))
    ];
    const csvContent = "data:text/csv;charset=utf-8," + csvContentRows.join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "analytics_table.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="bg-slate-50 min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <ReportHeader student={student} rollNumber={rollNumber} paper={paper} />
        <div className="bg-white rounded-lg shadow-md border border-slate-200/80 p-6">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">Report Controls</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <label className="font-semibold text-slate-700">Analysis Mode</label>
              <div className="mt-2 flex items-center gap-4 p-3 bg-slate-100 rounded-lg">
                <span className="text-slate-600">Single Student</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={classLevel} onChange={() => setClassLevel(v => !v)} className="sr-only peer" />
                  <div className="w-11 h-6 bg-slate-300 rounded-full peer peer-checked:bg-blue-600"></div>
                </label>
                <span className="text-slate-600">Class Level</span>
              </div>
            </div>
            <div>
              <label className="font-semibold text-slate-700">Group By (in order)</label>
              <p className="text-sm text-slate-500 mb-3">Select and drag fields to create a nested report.</p>
              <div className="p-4 border rounded-lg bg-slate-50/50 space-y-4">
                <div className="flex flex-wrap gap-2">
                  {groupFields.map(field => (
                    <div key={field.value}>
                      <input type="checkbox" id={`field-${field.value}`} checked={groupBy.includes(field.value)} onChange={() => setGroupBy(prev =>
                        prev.includes(field.value)
                          ? prev.filter(f => f !== field.value)
                          : [...prev, field.value]
                      )} className="hidden peer" />
                      <label htmlFor={`field-${field.value}`} className="inline-flex items-center justify-center px-3 py-1.5 text-sm text-slate-600 bg-white border border-slate-300 rounded-full cursor-pointer transition-colors hover:bg-slate-100 peer-checked:bg-blue-600 peer-checked:text-white peer-checked:border-blue-600">
                        {field.label}
                      </label>
                    </div>
                  ))}
                </div>
                {groupBy.length > 0 && (
                  <ul className="space-y-2">
                    {groupBy.map((fieldValue, idx) => {
                      const field = groupFields.find(f => f.value === fieldValue);
                      if (!field) return null;
                      return (
                        <li key={field.value} className="flex items-center justify-between p-2 bg-white border rounded-md shadow-sm">
                          <span className="font-medium text-slate-700">{idx + 1}. {field.label}</span>
                          <div className="flex items-center gap-1">
                            <button type="button" className="p-1 rounded-full text-slate-500 hover:bg-slate-200" disabled={idx === 0} onClick={() => {
                              setGroupBy(prev => {
                                const arr = [...prev];
                                [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
                                return arr;
                              });
                            }} title="Move up">
                              ▲
                            </button>
                            <button type="button" className="p-1 rounded-full text-slate-500 hover:bg-slate-200" disabled={idx === groupBy.length - 1} onClick={() => {
                              setGroupBy(prev => {
                                const arr = [...prev];
                                [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
                                return arr;
                              });
                            }} title="Move down">
                              ▼
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-6 mb-4">
            <label className="inline-flex items-center">
              <input
                type="checkbox"
                checked={showTagsColumn}
                onChange={() => setShowTagsColumn(v => !v)}
                className="form-checkbox"
              />
              <span className="ml-2 text-slate-700 font-medium">Show Tags Column</span>
            </label>
            <label className="inline-flex items-center">
              <input
                type="checkbox"
                checked={showOptionTagsColumn}
                onChange={() => setShowOptionTagsColumn(v => !v)}
                className="form-checkbox"
              />
              <span className="ml-2 text-slate-700 font-medium">Show Selected Option Tags Column</span>
            </label>
          </div>
        </div>
        <div className="flex justify-center bg-slate-200 p-1 rounded-lg max-w-xs mx-auto">
          <button
            onClick={() => setView('table')}
            className={`w-full px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
              view === 'table' ? 'bg-white text-blue-700 shadow' : 'text-slate-600 hover:bg-slate-300/50'
            }`}
          >
            Table View
          </button>
          <button
            onClick={() => setView('charts')}
            className={`w-full px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
              view === 'charts' ? 'bg-white text-blue-700 shadow' : 'text-slate-600 hover:bg-slate-300/50'
            }`}
          >
            Chart View
          </button>
        </div>
        {view === 'table' ? (
          <div className="bg-white rounded-lg shadow-md border border-slate-200/80 overflow-hidden">
            <div className="p-6 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-slate-800">Grouped Analytics</h2>
              <div className="flex gap-2">
                <button
                  onClick={handleDownloadTableImage}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-semibold shadow transition"
                  title="Download Table as Image"
                >
                  Download Table as Image
                </button>
                <button
                  onClick={handleDownloadCSV}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-semibold shadow transition"
                  title="Download Table as CSV"
                >
                  Download Table as CSV
                </button>
              </div>
            </div>
            {Object.keys(stats).length === 0 ? (
              <div className="text-slate-500 p-6 text-center">No tag data found for the selected criteria.</div>
            ) : (
              <div className="overflow-x-auto" ref={tableRef}>
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600 uppercase tracking-wider">Group / Tag</th>
                      {showTagsColumn && (
                        <th className="px-4 py-3 text-center font-semibold text-slate-600 uppercase tracking-wider">Tags</th>
                      )}
                      <th className="px-4 py-3 text-center font-semibold text-green-700 uppercase tracking-wider cursor-pointer select-none"
                        onClick={() => setSortConfig({ key: 'correct', direction: sortConfig.key === 'correct' && sortConfig.direction === 'asc' ? 'desc' : 'asc' })}>
                        Correct {sortConfig.key === 'correct' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                      </th>
                      <th className="px-4 py-3 text-center font-semibold text-red-700 uppercase tracking-wider cursor-pointer select-none"
                        onClick={() => setSortConfig({ key: 'incorrect', direction: sortConfig.key === 'incorrect' && sortConfig.direction === 'asc' ? 'desc' : 'asc' })}>
                        Incorrect {sortConfig.key === 'incorrect' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                      </th>
                      <th className="px-4 py-3 text-center font-semibold text-yellow-700 uppercase tracking-wider cursor-pointer select-none"
                        onClick={() => setSortConfig({ key: 'unattempted', direction: sortConfig.key === 'unattempted' && sortConfig.direction === 'asc' ? 'desc' : 'asc' })}>
                        Unattempted {sortConfig.key === 'unattempted' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                      </th>
                      {showOptionTagsColumn && (
                        <th className="px-4 py-3 text-center font-semibold text-slate-600 uppercase tracking-wider">Selected Option Tags</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    <StatsTable
                      stats={stats}
                      handleOpenModal={handleOpenModal}
                      handleOptionTagClick={handleOptionTagClick}
                      selectedTags={selectedTags}
                      handleTagSelect={(tag: { type: string; value: string }) =>
                        setSelectedTags(prev =>
                          prev.some(t => t.type === tag.type && t.value === tag.value)
                            ? prev.filter(t => !(t.type === tag.type && t.value === tag.value))
                            : [...prev, tag]
                        )
                      }
                      sortConfig={sortConfig}
                      setSortConfig={setSortConfig}
                      showTagsColumn={showTagsColumn}
                      showOptionTagsColumn={showOptionTagsColumn}
                      groupBy={groupBy}
                    />
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <ChartView stats={stats} groupBy={groupBy} />
        )}
        <QuestionListModal
          isOpen={modalData.isOpen}
          onClose={handleCloseModal}
          title={modalData.title}
          questionIds={modalData.questionIds}
          groupNode={modalData.groupNode}
        />
        <OptionTagModal
          isOpen={!!optionTagModal}
          onClose={handleCloseOptionTagModal}
          option={optionTagModal?.option || ""}
          tag={optionTagModal?.tag || ""}
          isCorrect={optionTagModal?.isCorrect || false}
          students={optionTagModal?.students || []}
        />
      </div>
    </div>
  );
}

const QuestionListModal = ({
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
}) => {
  if (!isOpen) return null;

  function getStudentCounts(key: "correctStudents" | "incorrectStudents" | "unattemptedStudents") {
    const all: { name: string; rollNumber: string }[] = [];
    questionIds.forEach(q => {
      if (q[key]) all.push(...q[key]);
    });
    const map = new Map<string, { name: string; rollNumber: string; count: number }>();
    all.forEach(s => {
      const k = `${s.rollNumber}|${s.name}`;
      if (!map.has(k)) map.set(k, { ...s, count: 1 });
      else map.get(k)!.count += 1;
    });
    return Array.from(map.values());
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
            <div className="font-semibold mb-2">Consolidated Stats for this Group:</div>
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
              </div>
              <div>
                <div className="font-semibold text-red-700 mb-1">Incorrect Students</div>
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
              </div>
              <div>
                <div className="font-semibold text-yellow-700 mb-1">Unattempted Students</div>
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
                    <ul className="list-disc list-inside text-xs text-slate-700">
                      {q.correctStudents?.length
                        ? q.correctStudents.map((s: { name: string; rollNumber: string }, i: number) => (
                            <li key={i}>{s.name} ({s.rollNumber})</li>
                          ))
                        : <li className="text-slate-400 italic">None</li>}
                    </ul>
                  </div>
                  <div>
                    <div className="font-semibold text-red-700 mb-1">Incorrect Students</div>
                    <ul className="list-disc list-inside text-xs text-slate-700">
                      {q.incorrectStudents?.length
                        ? q.incorrectStudents.map((s: { name: string; rollNumber: string }, i: number) => (
                            <li key={i}>{s.name} ({s.rollNumber})</li>
                          ))
                        : <li className="text-slate-400 italic">None</li>}
                    </ul>
                  </div>
                  <div>
                    <div className="font-semibold text-yellow-700 mb-1">Unattempted Students</div>
                    <ul className="list-disc list-inside text-xs text-slate-700">
                      {q.unattemptedStudents?.length
                        ? q.unattemptedStudents.map((s: { name: string; rollNumber: string }, i: number) => (
                            <li key={i}>{s.name} ({s.rollNumber})</li>
                          ))
                        : <li className="text-slate-400 italic">None</li>}
                    </ul>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};