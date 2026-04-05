"use client";

import { useMemo } from "react";

import PageHero from "@/components/layout/PageHero";
import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import FeedbackNotice from "@/components/ui/feedback-notice";
import {
  buildPaperQuestionLookup,
  evaluateQuestionAnswer,
} from "@/lib/question-paper/grading";

import type { StudentAttempt, StudentPaper } from "./student-test-types";

type StudentTestLockedViewProps = {
  paper: StudentPaper;
  attempt: StudentAttempt | null;
  paperSubjects: Array<{ _id: string; name: string }>;
  paperClassLabel: string;
  hasManualReviewQuestions: boolean;
  questionCount: number;
  testsHref: string;
  backLabel: string;
};

export default function StudentTestLockedView({
  paper,
  attempt,
  paperSubjects,
  paperClassLabel,
  hasManualReviewQuestions,
  questionCount,
  testsHref,
  backLabel,
}: StudentTestLockedViewProps) {
  const submittedAtLabel = attempt?.submittedAt
    ? new Date(attempt.submittedAt).toLocaleString()
    : "Not available";
  const submissionStatus =
    attempt?.status === "auto_submitted" ? "Auto submitted" : "Submitted";

  const submittedSubjectSummaries = useMemo(() => {
    const questionLookup = buildPaperQuestionLookup(paper);
    const answerMap = new Map<string, any>();

    (Array.isArray(attempt?.sectionAnswers) ? attempt.sectionAnswers : []).forEach(
      (sectionAnswer) => {
        const sectionName = String(sectionAnswer?.sectionName || "").trim();
        (Array.isArray(sectionAnswer?.answers) ? sectionAnswer.answers : []).forEach(
          (answer) => {
            const questionId = String(answer?.question || "").trim();
            if (!sectionName || !questionId) {
              return;
            }
            answerMap.set(`${sectionName}::${questionId}`, answer);
          },
        );
      },
    );

    const summaryMap = new Map<
      string,
      {
        _id: string;
        name: string;
        total: number;
        answered: number;
        correct: number;
        incorrect: number;
        unattempted: number;
        manualReviewPending: number;
        marksAwarded: number;
        maxMarks: number;
      }
    >();

    (Array.isArray(paper.sections) ? paper.sections : []).forEach((section) => {
      const sectionName = String(section?.name || "").trim();
      (Array.isArray(section?.questions) ? section.questions : []).forEach(
        (entry) => {
          const question = entry?.question;
          const questionId = String(question?._id || "").trim();
          if (!sectionName || !questionId) {
            return;
          }

          const fallbackSubject =
            paperSubjects.length === 1 ? paperSubjects[0] : null;
          const subject = question?.subject || fallbackSubject;
          const subjectId = String(subject?._id || "unknown-subject").trim();
          const subjectName =
            String(subject?.name || "").trim() || "Unknown Subject";
          const current = summaryMap.get(subjectId) || {
            _id: subjectId,
            name: subjectName,
            total: 0,
            answered: 0,
            correct: 0,
            incorrect: 0,
            unattempted: 0,
            manualReviewPending: 0,
            marksAwarded: 0,
            maxMarks: 0,
          };
          const evaluation = evaluateQuestionAnswer(
            questionLookup.get(`${sectionName}::${questionId}`),
            answerMap.get(`${sectionName}::${questionId}`),
          );

          current.total += 1;
          current.maxMarks += Number(entry?.marks || 0);

          if (evaluation.attempted) {
            current.answered += 1;
          } else {
            current.unattempted += 1;
          }

          if (
            evaluation.requiresManualReview &&
            evaluation.marksAwarded === null
          ) {
            current.manualReviewPending += 1;
          } else if (evaluation.attempted) {
            if (evaluation.isCorrect) {
              current.correct += 1;
            } else {
              current.incorrect += 1;
            }
          }

          if (evaluation.marksAwarded !== null) {
            current.marksAwarded += evaluation.marksAwarded;
          }

          summaryMap.set(subjectId, current);
        },
      );
    });

    return Array.from(summaryMap.values()).sort((left, right) =>
      left.name.localeCompare(right.name),
    );
  }, [attempt?.sectionAnswers, paper, paperSubjects]);

  return (
    <div className="app-student-page-shell">
      <PageHero
        eyebrow="Student Portal"
        title={paper.title}
        variant="overview"
        density="compact"
        description="Your attempt is locked. Review your submission summary."
        actions={
          <Button
            asChild
            variant="outline"
            size="lg"
            className="app-student-action-secondary"
          >
            <AppPrefetchLink href={testsHref}>
              {backLabel}
            </AppPrefetchLink>
          </Button>
        }
        meta={
          <>
            {paperSubjects.length > 0
              ? paperSubjects.map((subject) => (
                  <span key={subject._id} className="app-meta-chip">
                    {subject.name || subject._id}
                  </span>
                ))
              : null}
            {paperClassLabel ? (
              <span className="app-meta-chip">{paperClassLabel}</span>
            ) : null}
            <span className="app-meta-chip">{submissionStatus}</span>
          </>
        }
        stats={[
          {
            label: "Status",
            value: submissionStatus,
            meta: "Attempt closed",
          },
          {
            label: hasManualReviewQuestions ? "Auto-Graded Score" : "Score",
            value: `${attempt?.totalMarksAwarded ?? 0} / ${paper.totalMarks}`,
            meta: hasManualReviewQuestions
              ? "Manual review pending"
              : "Final score",
          },
          {
            label: "Questions",
            value: String(questionCount),
            meta: "Submitted",
          },
          {
            label: "Subjects",
            value: String(
              Math.max(
                paperSubjects.length,
                submittedSubjectSummaries.length,
                1,
              ),
            ),
            meta: "Breakdown",
          },
        ]}
      />

      <Card className="app-surface overflow-hidden">
        <CardHeader className="app-section-header">
          <CardTitle>Submission Summary</CardTitle>
        </CardHeader>
        <CardContent className="app-section-body">
          <div className="app-detail-grid app-exam-detail-grid">
            <div className="app-detail-item">
              <p className="app-detail-label">Status</p>
              <div className="app-detail-value">{submissionStatus}</div>
            </div>
            <div className="app-detail-item">
              <p className="app-detail-label">
                {hasManualReviewQuestions ? "Auto-Graded Score" : "Score"}
              </p>
              <div className="app-detail-value">
                {attempt?.totalMarksAwarded ?? 0} / {paper.totalMarks}
              </div>
            </div>
            <div className="app-detail-item">
              <p className="app-detail-label">Questions</p>
              <div className="app-detail-value">{questionCount}</div>
            </div>
            <div className="app-detail-item">
              <p className="app-detail-label">Submitted</p>
              <div className="app-detail-value">{submittedAtLabel}</div>
            </div>
          </div>

          {submittedSubjectSummaries.length > 1 ? (
            <div className="mt-5 space-y-2.5">
              <p className="app-title-sm">Subject Breakdown</p>
              <div className="app-exam-subject-breakdown-grid">
                {submittedSubjectSummaries.map((subject) => (
                  <div
                    key={subject._id}
                    className="app-exam-subject-breakdown-card"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="app-title-sm">{subject.name}</p>
                      <span className="app-meta-chip">
                        {subject.answered}/{subject.total} answered
                      </span>
                    </div>
                    <div className="app-exam-subject-breakdown-stats">
                      <div className="app-detail-item">
                        <p className="app-detail-label">Auto-graded marks</p>
                        <div className="app-detail-value">
                          {subject.marksAwarded} / {subject.maxMarks}
                        </div>
                      </div>
                      <div className="app-detail-item">
                        <p className="app-detail-label">Correct</p>
                        <div className="app-detail-value">{subject.correct}</div>
                      </div>
                      <div className="app-detail-item">
                        <p className="app-detail-label">Incorrect</p>
                        <div className="app-detail-value">
                          {subject.incorrect}
                        </div>
                      </div>
                      <div className="app-detail-item">
                        <p className="app-detail-label">Unattempted</p>
                        <div className="app-detail-value">
                          {subject.unattempted}
                        </div>
                      </div>
                    </div>
                    {subject.manualReviewPending > 0 ? (
                      <p className="mt-3 text-xs font-medium text-amber-700">
                        {subject.manualReviewPending} descriptive response
                        {subject.manualReviewPending === 1 ? "" : "s"} pending
                        review.
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {hasManualReviewQuestions ? (
            <FeedbackNotice variant="info">
              Descriptive answer review is pending.
            </FeedbackNotice>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
