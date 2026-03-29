import Link from 'next/link';
import React, { useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

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
  const [showNames, setShowNames] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const questionReturnTo = useMemo(() => {
    const query = searchParams?.toString();
    if (!pathname) return '/workspace/questions';
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams]);

  const getQuestionHref = (questionId?: string | number) => {
    if (!questionId) return '/workspace/questions';
    const params = new URLSearchParams();
    if (questionReturnTo) params.set('returnTo', questionReturnTo);
    const questionPath = `/workspace/questions/view/${encodeURIComponent(String(questionId))}`;
    return params.size > 0 ? `${questionPath}?${params.toString()}` : questionPath;
  };

  function getStudentCounts(key: 'correctStudents' | 'incorrectStudents' | 'unattemptedStudents') {
    const all: { name: string; rollNumber: string }[] = [];
    questionIds.forEach((question) => {
      if (Array.isArray(question[key])) all.push(...question[key]);
    });

    const map = new Map<string, { name: string; rollNumber: string; count: number }>();
    all.forEach((student) => {
      const mapKey = `${student.rollNumber}|${student.name}`;
      if (!map.has(mapKey)) map.set(mapKey, { ...student, count: 1 });
      else map.get(mapKey)!.count += 1;
    });

    let result = Array.from(map.values());
    if (result.length === 0 && groupNode && Array.isArray(groupNode[key])) {
      const aggregateMap = new Map<string, { name: string; rollNumber: string; count: number }>();
      (groupNode[key] as { name: string; rollNumber: string }[]).forEach((student) => {
        const mapKey = `${student.rollNumber}|${student.name}`;
        if (!aggregateMap.has(mapKey)) aggregateMap.set(mapKey, { ...student, count: 1 });
      });
      result = Array.from(aggregateMap.values());
    }
    return result;
  }

  const correctStudents = getStudentCounts('correctStudents');
  const incorrectStudents = getStudentCounts('incorrectStudents');
  const unattemptedStudents = getStudentCounts('unattemptedStudents');

  const correctCount = correctStudents.reduce((sum, student) => sum + student.count, 0);
  const incorrectCount = incorrectStudents.reduce((sum, student) => sum + student.count, 0);
  const unattemptedCount = unattemptedStudents.reduce((sum, student) => sum + student.count, 0);

  const renderStudentList = (
    label: string,
    students: { name: string; rollNumber: string; count?: number }[],
    tone: 'success' | 'danger' | 'warning',
  ) => {
    const titleClass =
      tone === 'success'
        ? 'text-emerald-700'
        : tone === 'danger'
          ? 'text-rose-700'
          : 'text-amber-700';

    return (
      <div className="space-y-2">
        <div className={`text-sm font-semibold ${titleClass}`}>{label}</div>
        {showNames ? (
          students.length > 0 ? (
            <ul className="analytics-dialog-list text-xs text-foreground">
              {students.map((student, index) => (
                <li
                  key={`${student.rollNumber}-${student.name}-${index}`}
                  className="analytics-dialog-list-item text-xs"
                >
                  <span>{student.name} ({student.rollNumber})</span>
                  {'count' in student && student.count ? (
                    <span className="text-muted-foreground">×{student.count}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-xs italic text-muted-foreground">None</div>
          )
        ) : (
          <div className="text-xs italic text-muted-foreground">
            Names hidden. Enable the Show names option to view.
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader className="text-left">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Review the question list and consolidated student counts for this selected group.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[72vh] space-y-4 overflow-y-auto pr-1">
          <div className="analytics-dialog-panel">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Consolidated Stats</p>
                <p className="text-sm text-muted-foreground">
                  Aggregate the question-level student lists across the current group.
                </p>
              </div>
              <label className="analytics-checkbox-card">
                <input
                  type="checkbox"
                  checked={showNames}
                  onChange={() => setShowNames((value) => !value)}
                  className="analytics-inline-check"
                />
                <span>Show names</span>
              </label>
            </div>

            <div className="analytics-dialog-stat-strip text-xs">
              <span className="analytics-badge analytics-badge-success">Correct: {correctCount}</span>
              <span className="analytics-badge analytics-badge-danger">Incorrect: {incorrectCount}</span>
              <span className="analytics-badge analytics-badge-warning">Unattempted: {unattemptedCount}</span>
            </div>

            <div className="analytics-dialog-grid">
              {renderStudentList('Correct Students', correctStudents, 'success')}
              {renderStudentList('Incorrect Students', incorrectStudents, 'danger')}
              {renderStudentList('Unattempted Students', unattemptedStudents, 'warning')}
            </div>
          </div>

          <div className="space-y-4">
            {questionIds.map((question) => (
              <div key={question.id} className="analytics-dialog-question-card">
                <div className="analytics-card-body space-y-4">
                  <div className="space-y-2">
                    <Link
                      href={getQuestionHref(question.id)}
                      onClick={onClose}
                      className="inline-flex items-center gap-2 text-sm font-semibold text-primary underline-offset-4 hover:underline"
                    >
                      {question.section ? <span className="text-muted-foreground">{question.section}:</span> : null}
                      <span>Question {question.number ?? '-'}</span>
                    </Link>
                    <div className="analytics-dialog-stat-strip text-xs">
                      <span className="analytics-badge analytics-badge-success">
                        Correct: {question.correctCount ?? 0}
                      </span>
                      <span className="analytics-badge analytics-badge-danger">
                        Incorrect: {question.incorrectCount ?? 0}
                      </span>
                      <span className="analytics-badge analytics-badge-warning">
                        Unattempted: {question.unattemptedCount ?? 0}
                      </span>
                    </div>
                  </div>

                  <div className="analytics-dialog-grid">
                    {renderStudentList('Correct Students', question.correctStudents ?? [], 'success')}
                    {renderStudentList('Incorrect Students', question.incorrectStudents ?? [], 'danger')}
                    {renderStudentList('Unattempted Students', question.unattemptedStudents ?? [], 'warning')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
