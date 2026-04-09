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
const StudentTestFullscreenGateView = dynamic(
  () => import("./StudentTestFullscreenGateView"),
);
const StudentTestActiveAttemptView = dynamic(
  () => import("./StudentTestActiveAttemptView"),
);

export type { StudentTestDetailResponse } from "./student-test-types";

type StudentTestPageClientProps = {
  paperId: string;
  initialData: StudentTestDetailResponse | null;
  initialLoadError?: string | null;
  returnToPath?: string;
};

function getBackLabel(href: string) {
  return href.startsWith("/student/courses/") ? "Back to Course" : "Back to Tests";
}

export default function StudentTestPageClient({
  paperId,
  initialData,
  initialLoadError = null,
  returnToPath = "/student/tests",
}: StudentTestPageClientProps) {
  const testsHref = returnToPath || "/student/tests";
  const backLabel = getBackLabel(testsHref);
  const runtime = useStudentTestRuntime({
    paperId,
    initialData,
    initialLoadError,
    returnToPath: testsHref,
  });

  if (runtime.loading) {
    return (
      <PageLoadingState
        title="Loading test"
        description="Preparing your test."
      />
    );
  }

  if (runtime.loadError || !runtime.paper) {
    return (
      <div className="app-student-page-shell">
        <PageHero
          className="app-learning-hero"
          eyebrow="Student Portal"
          title="Test"
          variant="overview"
          density="compact"
          description="We couldn't open this test right now."
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
        backLabel={backLabel}
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
        backLabel={backLabel}
        onStartAttempt={runtime.startAttempt}
      />
    );
  }

  return (
    <div ref={runtime.examContainerRef} className="min-h-[100dvh]">
      {runtime.isExamLocked ? (
        <StudentTestFullscreenGateView
          paperTitle={runtime.paper.title}
          testsHref={testsHref}
          backLabel={backLabel}
          actionError={runtime.actionError}
          connectionNotice={runtime.connectionNotice}
          recoveryNotice={runtime.recoveryNotice}
          onResumeFullscreen={runtime.resumeFullscreenLock}
        />
      ) : (
        <StudentTestActiveAttemptView
          dialogContainer={runtime.examContainerRef.current}
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
          isExamLocked={runtime.isExamLocked}
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
      )}
    </div>
  );
}
