"use client";

import dynamic from "next/dynamic";

import PageHero from "@/components/layout/PageHero";
import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import StudentPortalNav from "@/components/student/StudentPortalNav";
import { Button } from "@/components/ui/button";
import FeedbackNotice from "@/components/ui/feedback-notice";
import PageLoadingState from "@/components/ui/page-loading-state";

import type { StudentTestDetailResponse } from "./student-test-types";
import { useStudentTestRuntime } from "./useStudentTestRuntime";

const StudentTestLockedView = dynamic(
  () => import("./StudentTestLockedView"),
);
const StudentTestPreStartView = dynamic(
  () => import("./StudentTestPreStartView"),
);
const StudentTestActiveAttemptView = dynamic(
  () => import("./StudentTestActiveAttemptView"),
);

export type { StudentTestDetailResponse } from "./student-test-types";

type StudentTestPageClientProps = {
  paperId: string;
  initialData: StudentTestDetailResponse | null;
  initialLoadError?: string | null;
};

export default function StudentTestPageClient({
  paperId,
  initialData,
  initialLoadError = null,
}: StudentTestPageClientProps) {
  const testsHref = "/student/tests";
  const runtime = useStudentTestRuntime({
    paperId,
    initialData,
    initialLoadError,
  });

  if (runtime.loading) {
    return (
      <PageLoadingState
        title="Loading test"
        description="Preparing your exam."
      />
    );
  }

  if (runtime.loadError || !runtime.paper) {
    return (
      <div className="app-student-page-shell">
        <PageHero
          eyebrow="Student Portal"
          title="Test"
          variant="overview"
          description="We couldn't open this test right now. Return to your test list and try again."
          actions={
            <Button
              asChild
              variant="outline"
              size="lg"
              className="app-student-action-secondary"
            >
              <AppPrefetchLink href={testsHref}>
                Back to Tests
              </AppPrefetchLink>
            </Button>
          }
        >
          <StudentPortalNav />
        </PageHero>
        <FeedbackNotice variant="error">
          {runtime.loadError || "We couldn't load the requested online test."}
        </FeedbackNotice>
      </div>
    );
  }

  if (runtime.attemptLocked) {
    return (
      <StudentTestLockedView
        paper={runtime.paper}
        attempt={runtime.attempt}
        paperSubjects={runtime.paperSubjects}
        paperClassLabel={runtime.paperClassLabel}
        hasManualReviewQuestions={runtime.hasManualReviewQuestions}
        questionCount={runtime.questionList.length}
        testsHref={testsHref}
      />
    );
  }

  if (!runtime.attemptStarted) {
    return (
      <StudentTestPreStartView
        paper={runtime.paper}
        paperSubjects={runtime.paperSubjects}
        paperClassLabel={runtime.paperClassLabel}
        paperSubjectLabel={runtime.paperSubjectLabel}
        questionCount={runtime.questionList.length}
        hasManualReviewQuestions={runtime.hasManualReviewQuestions}
        testStatus={runtime.testStatus}
        isStarting={runtime.isStarting}
        actionError={runtime.actionError}
        testsHref={testsHref}
        onStartAttempt={runtime.startAttempt}
      />
    );
  }

  return (
    <StudentTestActiveAttemptView
      examContainerRef={runtime.examContainerRef}
      paper={runtime.paper}
      paperSubjects={runtime.paperSubjects}
      paperSubjectLabel={runtime.paperSubjectLabel}
      paperClassLabel={runtime.paperClassLabel}
      deadlineAt={runtime.deadlineAt}
      answeredCount={runtime.answeredCount}
      questionList={runtime.questionList}
      currentIndex={runtime.currentIndex}
      saveStatusLabel={runtime.saveStatusLabel}
      isSaving={runtime.isSaving}
      isSubmitting={runtime.isSubmitting}
      isFullscreen={runtime.isFullscreen}
      submitDialogOpen={runtime.submitDialogOpen}
      setSubmitDialogOpen={runtime.setSubmitDialogOpen}
      unansweredCount={runtime.unansweredCount}
      hasManualReviewQuestions={runtime.hasManualReviewQuestions}
      connectionNotice={runtime.connectionNotice}
      recoveryNotice={runtime.recoveryNotice}
      pendingSubmitRetry={runtime.pendingSubmitRetry}
      saveRetryPending={runtime.saveRetryPending}
      actionError={runtime.actionError}
      answeredQuestionIds={runtime.answeredQuestionIds}
      currentQuestion={runtime.currentQuestion}
      currentAnswer={runtime.currentAnswer}
      onSaveAttempt={runtime.saveAttempt}
      onToggleFullscreen={runtime.toggleFullscreen}
      onSubmitAttempt={runtime.submitAttempt}
      onJumpToQuestion={runtime.jumpToQuestion}
      onUpdateMultipleChoice={runtime.updateMultipleChoice}
      onUpdateSingleChoice={runtime.updateSingleChoice}
      onUpdateDescriptiveAnswer={runtime.updateDescriptiveAnswer}
      onUpdateMatrixSelection={runtime.updateMatrixSelection}
      onClearCurrentAnswer={runtime.clearCurrentAnswer}
    />
  );
}
