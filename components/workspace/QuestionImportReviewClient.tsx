"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Plus, Trash2 } from "lucide-react";

import RichTextEditor from "@/components/RichTextEditor";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import MultiSelectChecklist from "@/components/multi-select-checklist";
import { SearchableCommandSelect } from "@/components/ui/searchable-command-select";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/use-toast";
import {
  cloneQuestionImportPayload,
  deriveQuestionImportDraftStatus,
  getQuestionImportApprovalCounts,
  getQuestionMathFragmentsForQuestion,
  getQuestionWarningsForQuestion,
  isQuestionImportWarningCurrentlyBlocking,
  summarizeQuestionImportReviewState,
  syncQuestionImportMappings,
} from "@/lib/question-import/review";
import { getQuestionTypeLabel } from "@/lib/question-display";
import type { QuestionImportDraftRecord } from "@/lib/question-import/types";
import type {
  WorkspaceAcademicSectionItem,
  WorkspaceClassItem,
  WorkspaceSubjectItem,
} from "@/lib/workspace/support-types";
import { cn } from "@/lib/utils";

type ReviewTab = "paper" | "questions";

type QuestionImportReviewClientProps = {
  initialDraft: QuestionImportDraftRecord;
  classes: WorkspaceClassItem[];
  sections: WorkspaceAcademicSectionItem[];
  subjects: WorkspaceSubjectItem[];
};

type QuestionApprovalStatus =
  QuestionImportDraftRecord["payload"]["questions"][number]["approvalStatus"];

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

function parseNumberInput(value: string, fallback: number, minimum = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(minimum, parsed);
}

function getApprovalLabel(status: QuestionApprovalStatus) {
  switch (status) {
    case "approved":
      return "Approved";
    case "needs_fix":
      return "Needs Fix";
    case "excluded":
      return "Excluded";
    default:
      return "Pending Review";
  }
}

function getApprovalBadgeVariant(status: QuestionApprovalStatus) {
  switch (status) {
    case "approved":
      return "success" as const;
    case "needs_fix":
      return "warning" as const;
    case "excluded":
      return "secondary" as const;
    default:
      return "outline" as const;
  }
}

function getDraftStatusLabel(status: QuestionImportDraftRecord["status"]) {
  switch (status) {
    case "ready_to_publish":
      return "Ready to Publish";
    case "published":
      return "Published";
    case "failed":
      return "Failed";
    case "parsed":
      return "Parsed";
    case "uploaded":
      return "Uploaded";
    default:
      return "Needs Review";
  }
}

function getDraftStatusVariant(status: QuestionImportDraftRecord["status"]) {
  switch (status) {
    case "ready_to_publish":
      return "success" as const;
    case "published":
      return "success" as const;
    case "failed":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
}

function createEmptyOption(key: string) {
  return {
    id: `${key.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    key,
    contentHtml: "",
  };
}

function createEmptyCustomTag() {
  return {
    type: "",
    value: "",
  };
}

function optionKeyForIndex(index: number) {
  return "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[index] || `Option ${index + 1}`;
}

function sectionBelongsToClass(
  section: WorkspaceAcademicSectionItem,
  classId?: string,
) {
  if (!classId) {
    return true;
  }

  if (section.class && typeof section.class === "object") {
    return normalizeText(section.class._id) === classId;
  }

  return normalizeText(section.class) === classId;
}

function buildIssueMessages(
  draft: QuestionImportDraftRecord,
  reviewState: ReturnType<typeof summarizeQuestionImportReviewState>,
) {
  const messages: string[] = [];

  if (!normalizeText(draft.payload.paper.classId)) {
    messages.push("Map the imported class before publish.");
  }
  if (!normalizeText(draft.payload.paper.examDate)) {
    messages.push("Set the paper exam date before publish.");
  }
  if (reviewState.missingSubjectMappings.length > 0) {
    messages.push("Resolve every subject token mapping or allow approved creation.");
  }
  if (reviewState.questionsMissingSubjectToken.length > 0) {
    messages.push("Every included question needs a subject token before publish.");
  }
  if (reviewState.requiresSelectedAcademicSections) {
    messages.push(
      "Choose at least one class section or switch the paper back to all sections.",
    );
  }
  if (reviewState.unapprovedQuestions.length > 0) {
    messages.push("Approve or exclude every included question.");
  }
  if (reviewState.blockingWarnings.length > 0) {
    messages.push("Resolve the remaining blocking validation issues.");
  }
  if (reviewState.unmappedMathFragments.length > 0) {
    messages.push("Review the remaining unmapped math expressions.");
  }

  return Array.from(new Set(messages));
}

function ReviewSummaryBadge({
  label,
  value,
  variant = "outline",
}: {
  label: string;
  value: string;
  variant?: "outline" | "success" | "warning" | "destructive" | "secondary";
}) {
  const toneClass =
    variant === "success"
      ? "app-import-summary-card-success"
      : variant === "warning" || variant === "destructive"
        ? "app-import-summary-card-warning"
        : "";

  return (
    <div className={cn("app-import-summary-card", toneClass)}>
      <p className="app-import-summary-label">{label}</p>
      <p className="app-import-summary-value">{value}</p>
    </div>
  );
}

export default function QuestionImportReviewClient({
  initialDraft,
  classes,
  sections,
  subjects,
}: QuestionImportReviewClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const hasInitialQuestions =
    Array.isArray(initialDraft.payload.questions) &&
    initialDraft.payload.questions.length > 0;
  const [draft, setDraft] = useState<QuestionImportDraftRecord>(() => ({
    ...initialDraft,
    payload: syncQuestionImportMappings(initialDraft.payload),
  }));
  const [activeTab, setActiveTab] = useState<ReviewTab>(
    hasInitialQuestions ? "questions" : "paper",
  );
  const [activeSectionId, setActiveSectionId] = useState(
    initialDraft.payload.paperSections[0]?.id || "",
  );
  const [activeQuestionId, setActiveQuestionId] = useState(
    initialDraft.payload.questions[0]?.id || "",
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const reviewState = summarizeQuestionImportReviewState(draft.payload);
  const payload = reviewState.payload;
  const questions = payload.questions;
  const sectionsInDraft = payload.paperSections;
  const approvalCounts = getQuestionImportApprovalCounts(questions);
  const issueMessages = buildIssueMessages(draft, reviewState);
  const availableAcademicSections = sections.filter((section) =>
    sectionBelongsToClass(section, payload.paper.classId),
  );
  const academicSectionAssignmentMode =
    payload.paper.academicSectionAssignmentMode === "selected"
      ? "selected"
      : "all";
  const selectedAcademicSectionIds = Array.isArray(
    payload.paper.assignedAcademicSectionIds,
  )
    ? payload.paper.assignedAcademicSectionIds.filter((sectionId) =>
        normalizeText(sectionId),
      )
    : [];
  const importedAcademicSectionTokens = Array.isArray(
    payload.paper.academicSectionTokens,
  )
    ? payload.paper.academicSectionTokens.filter((token) => normalizeText(token))
    : [];
  const selectedSection =
    sectionsInDraft.find((section) => section.id === activeSectionId) ||
    sectionsInDraft[0] ||
    null;
  const selectedQuestion =
    questions.find((question) => question.id === activeQuestionId) ||
    questions[0] ||
    null;
  const selectedQuestionWarnings = selectedQuestion
    ? getQuestionWarningsForQuestion(payload, selectedQuestion.id)
    : [];
  const selectedQuestionMathFragments = selectedQuestion
    ? getQuestionMathFragmentsForQuestion(payload, selectedQuestion.id)
    : [];

  useEffect(() => {
    if (
      activeSectionId &&
      sectionsInDraft.some((section) => section.id === activeSectionId)
    ) {
      return;
    }

    setActiveSectionId(sectionsInDraft[0]?.id || "");
  }, [activeSectionId, sectionsInDraft]);

  useEffect(() => {
    if (activeQuestionId && questions.some((question) => question.id === activeQuestionId)) {
      return;
    }

    setActiveQuestionId(questions[0]?.id || "");
  }, [activeQuestionId, questions]);

  function updateDraftPayload(
    updater: (payload: QuestionImportDraftRecord["payload"]) => void,
  ) {
    setDraft((currentDraft) => {
      const nextPayload = cloneQuestionImportPayload(currentDraft.payload);
      updater(nextPayload);
      const syncedPayload = syncQuestionImportMappings(nextPayload);

      return {
        ...currentDraft,
        payload: syncedPayload,
        status: deriveQuestionImportDraftStatus(syncedPayload),
      };
    });
    setHasUnsavedChanges(true);
  }

  function updateQuestion(
    questionId: string,
    updater: (
      question: QuestionImportDraftRecord["payload"]["questions"][number],
    ) => void,
  ) {
    updateDraftPayload((nextPayload) => {
      const question = nextPayload.questions.find((item) => item.id === questionId);
      if (!question) {
        return;
      }

      updater(question);
    });
  }

  function updateSection(
    sectionId: string,
    updater: (
      section: QuestionImportDraftRecord["payload"]["paperSections"][number],
    ) => void,
  ) {
    updateDraftPayload((nextPayload) => {
      const section = nextPayload.paperSections.find((item) => item.id === sectionId);
      if (!section) {
        return;
      }

      updater(section);
    });
  }

  function resolveWarning(warningId: string) {
    updateDraftPayload((nextPayload) => {
      [...nextPayload.errors, ...nextPayload.warnings].forEach((warning) => {
        if (warning.id !== warningId) {
          return;
        }

        warning.blocking = false;
        warning.severity = "info";
        if (!warning.message.startsWith("Resolved during review:")) {
          warning.message = `Resolved during review: ${warning.message}`;
        }
      });
    });
  }

  function resolveMathFragment(fragmentId: string) {
    updateDraftPayload((nextPayload) => {
      const fragment = nextPayload.mathFragments.find((item) => item.id === fragmentId);
      if (!fragment) {
        return;
      }

      fragment.mappingStatus = "resolved_by_reviewer";
      fragment.warning = undefined;

      [...nextPayload.errors, ...nextPayload.warnings].forEach((warning) => {
        if (
          warning.path === fragment.path &&
          (warning.code === "unmapped_math" ||
            warning.code === "review_math_mapping")
        ) {
          warning.blocking = false;
          warning.severity = "info";
          if (!warning.message.startsWith("Resolved during review:")) {
            warning.message = `Resolved during review: ${warning.message}`;
          }
        }
      });
    });
  }

  async function saveDraft(showSuccessToast = true) {
    setIsSaving(true);

    try {
      const response = await fetch(`/api/question-imports/${draft._id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          payload: draft.payload,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success || !data?.draft) {
        throw new Error(data?.message || "Failed to save the import review.");
      }

      setDraft(data.draft);
      setHasUnsavedChanges(false);

      if (showSuccessToast) {
        toast({
          title: "Review saved",
          description: "The import draft was updated successfully.",
        });
      }

      return data.draft as QuestionImportDraftRecord;
    } catch (error) {
      toast({
        title: "Save failed",
        description:
          error instanceof Error
            ? error.message
            : "Failed to save the import draft.",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePublish() {
    if (!window.confirm("Publish the approved questions and create the draft paper now?")) {
      return;
    }

    setIsPublishing(true);

    try {
      const latestDraft = hasUnsavedChanges ? await saveDraft(false) : draft;
      if (!latestDraft) {
        return;
      }

      const response = await fetch(`/api/question-imports/${draft._id}/publish`, {
        method: "POST",
        credentials: "same-origin",
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Failed to publish the import draft.");
      }

      if (data?.draft) {
        setDraft(data.draft);
        setHasUnsavedChanges(false);
      }

      toast({
        title: data?.alreadyPublished ? "Already published" : "Import published",
        description:
          data?.alreadyPublished
            ? "This import draft was already published."
            : "The approved questions were added and the draft paper was created.",
      });

      if (data?.paperId) {
        router.push(`/workspace/question-papers/view/${data.paperId}`);
        return;
      }

      router.refresh();
    } catch (error) {
      toast({
        title: "Publish failed",
        description:
          error instanceof Error
            ? error.message
            : "Failed to publish the import draft.",
        variant: "destructive",
      });
    } finally {
      setIsPublishing(false);
    }
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <Card className="app-surface overflow-hidden shadow-none">
        <CardContent className="app-surface-body space-y-4">
          <div className="app-import-toolbar">
            <div className="app-import-toolbar-copy">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={getDraftStatusVariant(draft.status)}>
                  {getDraftStatusLabel(draft.status)}
                </Badge>
                {hasUnsavedChanges ? (
                  <Badge variant="warning">Unsaved changes</Badge>
                ) : null}
                <Badge variant="outline">{draft.sourceFile.name}</Badge>
              </div>
              <div>
                <h2 className="app-title-md">Import review and approval</h2>
                <p className="app-copy-muted">
                  Review the parsed paper, clean up questions, approve what
                  should publish, and create the draft paper only when the
                  review is clear.
                </p>
              </div>
            </div>
            <div className="app-import-toolbar-actions">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="app-import-action-button"
                onClick={() => void saveDraft(true)}
                disabled={isSaving || isPublishing || !hasUnsavedChanges}
              >
                {isSaving ? <Spinner className="h-4 w-4" /> : null}
                Save changes
              </Button>
              <Button
                type="button"
                size="sm"
                className="app-import-action-button-primary"
                onClick={() => void handlePublish()}
                disabled={
                  isSaving ||
                  isPublishing ||
                  reviewState.status !== "ready_to_publish"
                }
              >
                {isPublishing ? <Spinner className="h-4 w-4" /> : null}
                Publish draft
              </Button>
            </div>
          </div>

          <div className="app-import-summary-grid">
            <ReviewSummaryBadge
              label="Questions"
              value={String(questions.length)}
              variant="outline"
            />
            <ReviewSummaryBadge
              label="Approved"
              value={String(approvalCounts.approved)}
              variant="success"
            />
            <ReviewSummaryBadge
              label="Needs Fix"
              value={String(approvalCounts.needs_fix)}
              variant={approvalCounts.needs_fix > 0 ? "warning" : "outline"}
            />
            <ReviewSummaryBadge
              label="Blocking issues"
              value={String(
                reviewState.blockingWarnings.length +
                  reviewState.unmappedMathFragments.length +
                  reviewState.questionsMissingSubjectToken.length +
                  reviewState.missingSubjectMappings.length,
              )}
              variant={
                reviewState.status === "ready_to_publish"
                  ? "success"
                  : "warning"
              }
            />
          </div>

          {issueMessages.length > 0 ? (
            <Alert className="border-warning/40 bg-warning/6">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Still needs review</AlertTitle>
              <AlertDescription>
                <ul className="space-y-1">
                  {issueMessages.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="border-emerald-500/30 bg-emerald-500/5 text-emerald-900 dark:text-emerald-200">
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Ready for publish</AlertTitle>
              <AlertDescription>
                Every included question is approved and the current draft is
                clear to publish.
              </AlertDescription>
            </Alert>
          )}

          <div className="app-import-inline-actions">
            <Button
              type="button"
              variant={activeTab === "paper" ? "default" : "outline"}
              size="sm"
              className={
                activeTab === "paper"
                  ? "app-import-action-button-primary"
                  : "app-import-action-button"
              }
              onClick={() => setActiveTab("paper")}
            >
              Paper setup
            </Button>
            <Button
              type="button"
              variant={activeTab === "questions" ? "default" : "outline"}
              size="sm"
              className={
                activeTab === "questions"
                  ? "app-import-action-button-primary"
                  : "app-import-action-button"
              }
              onClick={() => setActiveTab("questions")}
            >
              Question review
            </Button>
          </div>
        </CardContent>
      </Card>

      {activeTab === "paper" ? (
        <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-4">
            <Card className="app-surface overflow-hidden shadow-none">
              <CardHeader className="app-section-header">
                <CardTitle>Subject mappings</CardTitle>
                <CardDescription>
                  Match every imported subject token to an existing subject or
                  explicitly allow creation during publish.
                </CardDescription>
              </CardHeader>
              <CardContent className="app-section-body space-y-4">
                {payload.mappings.subjects.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No subject tokens were detected in this DOCX import.
                  </p>
                ) : (
                  payload.mappings.subjects.map((mapping) => (
                    <div
                      key={mapping.token}
                      className="app-import-nested-card space-y-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{mapping.token}</Badge>
                        {!normalizeText(mapping.subjectId) &&
                        mapping.createIfMissing !== true ? (
                          <Badge variant="warning">Unmapped</Badge>
                        ) : null}
                      </div>
                      <SearchableCommandSelect
                        value={mapping.subjectId || ""}
                        options={subjects.map((subject) => ({
                          value: subject._id,
                          label: subject.name,
                        }))}
                        onValueChange={(value) =>
                          updateDraftPayload((nextPayload) => {
                            const targetMapping = nextPayload.mappings.subjects.find(
                              (item) => item.token === mapping.token,
                            );
                            if (!targetMapping) {
                              return;
                            }
                            targetMapping.subjectId = value || undefined;
                            if (value) {
                              targetMapping.createIfMissing = false;
                            }
                          })
                        }
                        placeholder="Select a subject"
                        searchPlaceholder="Search subjects..."
                        emptyText="No subjects found."
                        onClear={() =>
                          updateDraftPayload((nextPayload) => {
                            const targetMapping = nextPayload.mappings.subjects.find(
                              (item) => item.token === mapping.token,
                            );
                            if (!targetMapping) {
                              return;
                            }
                            targetMapping.subjectId = undefined;
                          })
                        }
                        showCloseAction
                      />
                      <label className="flex items-start gap-2.5 text-[13px] leading-5 text-muted-foreground">
                        <Checkbox
                          checked={mapping.createIfMissing === true}
                          onCheckedChange={(checked) =>
                            updateDraftPayload((nextPayload) => {
                              const targetMapping = nextPayload.mappings.subjects.find(
                                (item) => item.token === mapping.token,
                              );
                              if (!targetMapping) {
                                return;
                              }
                              targetMapping.createIfMissing = Boolean(checked);
                              if (checked) {
                                targetMapping.subjectId = undefined;
                              }
                            })
                          }
                        />
                        Create this subject during publish if it does not exist
                      </label>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="app-surface overflow-hidden shadow-none">
              <CardHeader className="app-section-header">
                <CardTitle>Assigned class sections</CardTitle>
                <CardDescription>
                  Choose specific sections for this imported paper, or leave it
                  on all sections for the selected class.
                </CardDescription>
              </CardHeader>
              <CardContent className="app-section-body space-y-4">
                <div className="app-import-toggle-grid">
                  <Button
                    type="button"
                    variant={
                      academicSectionAssignmentMode === "all"
                        ? "default"
                        : "outline"
                    }
                    size="sm"
                    className={
                      academicSectionAssignmentMode === "all"
                        ? "app-import-action-button-primary justify-start"
                        : "app-import-toggle-button"
                    }
                    onClick={() =>
                      updateDraftPayload((nextPayload) => {
                        nextPayload.paper.academicSectionAssignmentMode = "all";
                      })
                    }
                  >
                    All sections
                  </Button>
                  <Button
                    type="button"
                    variant={
                      academicSectionAssignmentMode === "selected"
                        ? "default"
                        : "outline"
                    }
                    size="sm"
                    className={
                      academicSectionAssignmentMode === "selected"
                        ? "app-import-action-button-primary justify-start"
                        : "app-import-toggle-button"
                    }
                    disabled={!payload.paper.classId}
                    onClick={() =>
                      updateDraftPayload((nextPayload) => {
                        nextPayload.paper.academicSectionAssignmentMode =
                          "selected";
                      })
                    }
                  >
                    Choose sections
                  </Button>
                </div>

                {!payload.paper.classId ? (
                  <div className="app-import-note-card border-dashed bg-[hsl(var(--app-surface-1)/0.88)]">
                    Select the paper class first. After that, you can assign
                    this import to any active school sections in that class.
                  </div>
                ) : academicSectionAssignmentMode === "selected" ? (
                  <MultiSelectChecklist
                    items={availableAcademicSections.map((section) => ({
                      id: section._id,
                      label: (
                        <span className="flex flex-col gap-0.5">
                          <span className="font-medium text-foreground">
                            {section.name}
                          </span>
                          {section.description ? (
                            <span className="text-xs text-muted-foreground">
                              {section.description}
                            </span>
                          ) : null}
                        </span>
                      ),
                    }))}
                    selectedIds={selectedAcademicSectionIds}
                    onChange={(ids) =>
                      updateDraftPayload((nextPayload) => {
                        nextPayload.paper.academicSectionAssignmentMode =
                          "selected";
                        nextPayload.paper.assignedAcademicSectionIds = ids;
                      })
                    }
                    countLabel="sections selected"
                    emptyContent="No active sections exist for the selected class yet."
                    helperText={
                      selectedAcademicSectionIds.length > 0
                        ? "Only the selected sections will be assigned when this paper is published."
                        : "Choose one or more sections, or switch back to All sections."
                    }
                  />
                ) : (
                  <div className="app-import-nested-card">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="success">All sections</Badge>
                      <p className="text-sm font-medium text-foreground">
                        This paper will be assigned to every active section in
                        the selected class.
                      </p>
                    </div>
                  </div>
                )}

                {importedAcademicSectionTokens.length > 0 ? (
                  <div className="app-import-nested-card space-y-2">
                    <div className="space-y-1">
                      <Label className="app-field-label">
                        Imported section hints
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        These came from the DOCX for reference only. You can
                        still assign any sections from this school.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {importedAcademicSectionTokens.map((token) => (
                        <Badge key={token} variant="outline">
                          {token}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card className="app-surface overflow-hidden shadow-none">
              <CardHeader className="app-section-header">
                <CardTitle>Paper sections</CardTitle>
                <CardDescription>
                  Review the parsed paper sections before you publish the draft
                  paper.
                </CardDescription>
              </CardHeader>
              <CardContent className="app-section-body space-y-3">
                {sectionsInDraft.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setActiveSectionId(section.id)}
                    className={cn(
                      "app-import-select-card",
                      activeSectionId === section.id &&
                        "app-import-select-card-active",
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="app-import-select-card-title">{section.name}</p>
                      <Badge variant="outline">
                        {section.defaultMarks} mark default
                      </Badge>
                    </div>
                    <p className="app-import-select-card-meta">
                      {Array.isArray(questions)
                        ? questions.filter((question) => question.sectionId === section.id).length
                        : 0}{" "}
                      questions
                    </p>
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="app-surface overflow-hidden shadow-none">
              <CardHeader className="app-section-header">
                <CardTitle>Paper metadata</CardTitle>
                <CardDescription>
                  Confirm the imported paper details that will be used when the
                  draft paper is created.
                </CardDescription>
              </CardHeader>
              <CardContent className="app-section-body space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="app-field-group">
                    <Label className="app-field-label">Paper title</Label>
                    <Input
                      value={payload.paper.title}
                      onChange={(event) =>
                        updateDraftPayload((nextPayload) => {
                          nextPayload.paper.title = event.target.value;
                        })
                      }
                      placeholder="Assessment title"
                    />
                  </div>
                  <div className="app-field-group">
                    <Label className="app-field-label">Imported class token</Label>
                    <Input
                      value={payload.paper.classToken || ""}
                      onChange={(event) =>
                        updateDraftPayload((nextPayload) => {
                          nextPayload.paper.classToken = event.target.value;
                        })
                      }
                      placeholder="Class 7"
                    />
                  </div>
                  <div className="app-field-group">
                    <Label className="app-field-label">Map to class</Label>
                    <SearchableCommandSelect
                      value={payload.paper.classId || ""}
                      options={classes.map((classItem) => ({
                        value: classItem._id,
                        label: classItem.name,
                      }))}
                      onValueChange={(value) =>
                        updateDraftPayload((nextPayload) => {
                          nextPayload.paper.classId = value || "";
                          nextPayload.paper.academicSectionAssignmentMode = "all";
                          nextPayload.paper.assignedAcademicSectionIds = [];
                        })
                      }
                      placeholder="Select a class"
                      searchPlaceholder="Search classes..."
                      emptyText="No classes found."
                      onClear={() =>
                        updateDraftPayload((nextPayload) => {
                          nextPayload.paper.classId = "";
                        })
                      }
                      showCloseAction
                    />
                  </div>
                  <div className="app-field-group">
                    <Label className="app-field-label">Exam date</Label>
                    <Input
                      type="date"
                      value={payload.paper.examDate || ""}
                      onChange={(event) =>
                        updateDraftPayload((nextPayload) => {
                          nextPayload.paper.examDate = event.target.value;
                        })
                      }
                    />
                  </div>
                  <div className="app-field-group">
                    <Label className="app-field-label">Duration (minutes)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={String(payload.paper.durationMinutes || 60)}
                      onChange={(event) =>
                        updateDraftPayload((nextPayload) => {
                          nextPayload.paper.durationMinutes = parseNumberInput(
                            event.target.value,
                            nextPayload.paper.durationMinutes || 60,
                            1,
                          );
                        })
                      }
                    />
                  </div>
                  <div className="app-field-group">
                    <Label className="app-field-label">Passing marks</Label>
                    <Input
                      type="number"
                      min={0}
                      value={String(payload.paper.passingMarks || 0)}
                      onChange={(event) =>
                        updateDraftPayload((nextPayload) => {
                          nextPayload.paper.passingMarks = parseNumberInput(
                            event.target.value,
                            nextPayload.paper.passingMarks || 0,
                            0,
                          );
                        })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="app-field-label">Paper instructions</Label>
                  <RichTextEditor
                    editorKey={`paper-instructions-${draft._id}`}
                    initialContent={payload.paper.instructionsHtml}
                    onChange={(value) =>
                      updateDraftPayload((nextPayload) => {
                        nextPayload.paper.instructionsHtml = value;
                      })
                    }
                    compact
                  />
                </div>
              </CardContent>
            </Card>

            {selectedSection ? (
              <Card className="app-surface overflow-hidden shadow-none">
                <CardHeader className="app-section-header">
                  <CardTitle>Section review</CardTitle>
                  <CardDescription>
                    Polish the selected section details before the paper is
                    created.
                  </CardDescription>
                </CardHeader>
                <CardContent className="app-section-body space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="app-field-group">
                      <Label className="app-field-label">Section name</Label>
                      <Input
                        value={selectedSection.name}
                        onChange={(event) =>
                          updateSection(selectedSection.id, (section) => {
                            section.name = event.target.value;
                          })
                        }
                        placeholder="Section name"
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="app-field-group">
                        <Label className="app-field-label">Default marks</Label>
                        <Input
                          type="number"
                          min={1}
                          value={String(selectedSection.defaultMarks || 1)}
                          onChange={(event) =>
                            updateSection(selectedSection.id, (section) => {
                              section.defaultMarks = parseNumberInput(
                                event.target.value,
                                section.defaultMarks || 1,
                                1,
                              );
                            })
                          }
                        />
                      </div>
                      <div className="app-field-group">
                        <Label className="app-field-label">
                          Default negative marks
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          value={String(selectedSection.defaultNegativeMarks || 0)}
                          onChange={(event) =>
                            updateSection(selectedSection.id, (section) => {
                              section.defaultNegativeMarks = parseNumberInput(
                                event.target.value,
                                section.defaultNegativeMarks || 0,
                                0,
                              );
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="app-field-label">Section description</Label>
                    <RichTextEditor
                      editorKey={`section-description-${selectedSection.id}`}
                      initialContent={selectedSection.descriptionHtml}
                      onChange={(value) =>
                        updateSection(selectedSection.id, (section) => {
                          section.descriptionHtml = value;
                        })
                      }
                      compact
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="app-field-label">Section instructions</Label>
                    <RichTextEditor
                      editorKey={`section-instructions-${selectedSection.id}`}
                      initialContent={selectedSection.instructionsHtml}
                      onChange={(value) =>
                        updateSection(selectedSection.id, (section) => {
                          section.instructionsHtml = value;
                        })
                      }
                      compact
                    />
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-4">
            <Card className="app-surface overflow-hidden shadow-none">
              <CardHeader className="app-section-header">
                <CardTitle>Question queue</CardTitle>
                <CardDescription>
                  Open each question, fix what needs attention, then approve or
                  exclude it before publish.
                </CardDescription>
              </CardHeader>
              <CardContent className="app-section-body space-y-3">
                {questions.map((question, index) => {
                  const questionWarnings = getQuestionWarningsForQuestion(
                    payload,
                    question.id,
                  );
                  const activeBlockingWarnings = questionWarnings.filter((warning) =>
                    isQuestionImportWarningCurrentlyBlocking(payload, warning),
                  );
                  const hasMissingSubjectToken = !normalizeText(
                    question.subjectToken,
                  );

                  return (
                    <button
                      key={question.id}
                      type="button"
                      onClick={() => setActiveQuestionId(question.id)}
                      className={cn(
                        "app-import-select-card",
                        activeQuestionId === question.id &&
                          "app-import-select-card-active",
                      )}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <p className="app-import-select-card-title">
                            Q{index + 1}
                          </p>
                          <Badge variant={getApprovalBadgeVariant(question.approvalStatus)}>
                            {getApprovalLabel(question.approvalStatus)}
                          </Badge>
                          <Badge variant="outline">
                            {getQuestionTypeLabel(question.type)}
                          </Badge>
                        </div>
                        <span className="text-[12px] leading-5 text-muted-foreground">
                          {question.marks} mark{question.marks === 1 ? "" : "s"}
                        </span>
                      </div>
                      <p className="app-import-select-card-meta">
                        Subject token: {question.subjectToken || "Not set"}
                      </p>
                      {activeBlockingWarnings.length > 0 || hasMissingSubjectToken ? (
                        <p className="app-import-select-card-warning">
                          {activeBlockingWarnings.length +
                            (hasMissingSubjectToken ? 1 : 0)}{" "}
                          blocking issue
                          {activeBlockingWarnings.length +
                            (hasMissingSubjectToken ? 1 : 0) ===
                          1
                            ? ""
                            : "s"}
                        </p>
                      ) : null}
                    </button>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            {selectedQuestion ? (
              <>
                <Card className="app-surface overflow-hidden shadow-none">
                  <CardHeader className="app-section-header">
                    <div className="app-import-toolbar">
                      <div>
                        <CardTitle>Question editor</CardTitle>
                        <CardDescription>
                          Review this question in a create-style editor before
                          it enters the question bank.
                        </CardDescription>
                      </div>
                      <div className="app-import-inline-actions">
                        <Button
                          type="button"
                          variant={
                            selectedQuestion.approvalStatus === "approved"
                              ? "default"
                              : "outline"
                          }
                          size="sm"
                          className={
                            selectedQuestion.approvalStatus === "approved"
                              ? "app-import-action-button-primary"
                              : "app-import-action-button"
                          }
                          onClick={() =>
                            updateQuestion(selectedQuestion.id, (question) => {
                              question.approvalStatus = "approved";
                            })
                          }
                        >
                          Approve
                        </Button>
                        <Button
                          type="button"
                          variant={
                            selectedQuestion.approvalStatus === "needs_fix"
                              ? "default"
                              : "outline"
                          }
                          size="sm"
                          className={
                            selectedQuestion.approvalStatus === "needs_fix"
                              ? "app-import-action-button-primary"
                              : "app-import-action-button"
                          }
                          onClick={() =>
                            updateQuestion(selectedQuestion.id, (question) => {
                              question.approvalStatus = "needs_fix";
                            })
                          }
                        >
                          Needs fix
                        </Button>
                        <Button
                          type="button"
                          variant={
                            selectedQuestion.approvalStatus === "excluded"
                              ? "secondary"
                              : "outline"
                          }
                          size="sm"
                          className={
                            selectedQuestion.approvalStatus === "excluded"
                              ? "app-import-action-button"
                              : "app-import-action-button"
                          }
                          onClick={() =>
                            updateQuestion(selectedQuestion.id, (question) => {
                              question.approvalStatus = "excluded";
                            })
                          }
                        >
                          Exclude
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="app-section-body space-y-5">
                    {!normalizeText(selectedQuestion.subjectToken) ? (
                      <Alert className="border-warning/40 bg-warning/6">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Subject token missing</AlertTitle>
                        <AlertDescription>
                          This question needs a subject token before it can be
                          approved and published.
                        </AlertDescription>
                      </Alert>
                    ) : null}

                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <div className="app-field-group">
                        <Label className="app-field-label">Question label</Label>
                        <Input
                          value={selectedQuestion.numberLabel}
                          onChange={(event) =>
                            updateQuestion(selectedQuestion.id, (question) => {
                              question.numberLabel = event.target.value;
                            })
                          }
                        />
                      </div>
                      <div className="app-field-group">
                        <Label className="app-field-label">Question type</Label>
                        <select
                          value={selectedQuestion.type}
                          onChange={(event) =>
                            updateQuestion(selectedQuestion.id, (question) => {
                              question.type = event.target.value as
                                | "single"
                                | "multiple"
                                | "descriptive";
                              if (question.type === "descriptive") {
                                question.options = [];
                                question.answerIndexes = [];
                              } else if (question.options.length === 0) {
                                question.options = [
                                  createEmptyOption("A"),
                                  createEmptyOption("B"),
                                ];
                              } else if (
                                question.type === "single" &&
                                question.answerIndexes.length > 1
                              ) {
                                question.answerIndexes = question.answerIndexes.slice(
                                  0,
                                  1,
                                );
                              }
                            })
                          }
                          className="app-import-native-select"
                        >
                          <option value="single">Single choice</option>
                          <option value="multiple">Multiple choice</option>
                          <option value="descriptive">Descriptive</option>
                        </select>
                      </div>
                      <div className="app-field-group">
                        <Label className="app-field-label">Subject token</Label>
                        <Input
                          value={selectedQuestion.subjectToken || ""}
                          onChange={(event) =>
                            updateQuestion(selectedQuestion.id, (question) => {
                              question.subjectToken = event.target.value;
                            })
                          }
                          placeholder="Mathematics"
                        />
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="app-field-group">
                          <Label className="app-field-label">Marks</Label>
                          <Input
                            type="number"
                            min={1}
                            value={String(selectedQuestion.marks || 1)}
                            onChange={(event) =>
                              updateQuestion(selectedQuestion.id, (question) => {
                                question.marks = parseNumberInput(
                                  event.target.value,
                                  question.marks || 1,
                                  1,
                                );
                              })
                            }
                          />
                        </div>
                        <div className="app-field-group">
                          <Label className="app-field-label">Negative</Label>
                          <Input
                            type="number"
                            min={0}
                            value={String(selectedQuestion.negativeMarks || 0)}
                            onChange={(event) =>
                              updateQuestion(selectedQuestion.id, (question) => {
                                question.negativeMarks = parseNumberInput(
                                  event.target.value,
                                  question.negativeMarks || 0,
                                  0,
                                );
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="app-field-label">Question stem</Label>
                      <RichTextEditor
                        editorKey={`question-content-${selectedQuestion.id}`}
                        initialContent={selectedQuestion.contentHtml}
                        onChange={(value) =>
                          updateQuestion(selectedQuestion.id, (question) => {
                            question.contentHtml = value;
                          })
                        }
                      />
                    </div>

                    {selectedQuestion.type === "single" ||
                    selectedQuestion.type === "multiple" ? (
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <h3 className="text-sm font-semibold text-foreground">
                              Options and answers
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              Keep at least two options and mark the correct
                              answer choices.
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="app-import-action-button"
                            onClick={() =>
                              updateQuestion(selectedQuestion.id, (question) => {
                                if (question.options.length >= 5) {
                                  return;
                                }
                                question.options.push(
                                  createEmptyOption(
                                    optionKeyForIndex(question.options.length),
                                  ),
                                );
                              })
                            }
                            disabled={selectedQuestion.options.length >= 5}
                          >
                            <Plus className="h-4 w-4" />
                            Add option
                          </Button>
                        </div>

                        <div className="space-y-4">
                          {selectedQuestion.options.map((option, index) => (
                            <div
                              key={option.id}
                              className="app-import-nested-card space-y-3"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-3">
                                  <Badge variant="outline">
                                    {optionKeyForIndex(index)}
                                  </Badge>
                                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Checkbox
                                      checked={selectedQuestion.answerIndexes.includes(index)}
                                      onCheckedChange={(checked) =>
                                        updateQuestion(selectedQuestion.id, (question) => {
                                          const nextAnswers = new Set(
                                            question.answerIndexes,
                                          );
                                          if (checked) {
                                            if (question.type === "single") {
                                              question.answerIndexes = [index];
                                              return;
                                            }
                                            nextAnswers.add(index);
                                          } else {
                                            nextAnswers.delete(index);
                                          }
                                          question.answerIndexes = Array.from(
                                            nextAnswers,
                                          ).sort((left, right) => left - right);
                                        })
                                      }
                                    />
                                    Correct answer
                                  </label>
                                </div>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="app-import-action-button text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                                  onClick={() =>
                                    updateQuestion(selectedQuestion.id, (question) => {
                                      if (question.options.length <= 2) {
                                        return;
                                      }

                                      question.options = question.options.filter(
                                        (_, optionIndex) => optionIndex !== index,
                                      );
                                      question.answerIndexes = question.answerIndexes
                                        .filter((answerIndex) => answerIndex !== index)
                                        .map((answerIndex) =>
                                          answerIndex > index
                                            ? answerIndex - 1
                                            : answerIndex,
                                        );
                                    })
                                  }
                                  disabled={selectedQuestion.options.length <= 2}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Remove
                                </Button>
                              </div>
                              <RichTextEditor
                                editorKey={`question-option-${selectedQuestion.id}-${option.id}`}
                                initialContent={option.contentHtml}
                                onChange={(value) =>
                                  updateQuestion(selectedQuestion.id, (question) => {
                                    const nextOption = question.options.find(
                                      (item) => item.id === option.id,
                                    );
                                    if (!nextOption) {
                                      return;
                                    }
                                    nextOption.contentHtml = value;
                                  })
                                }
                                compact
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="space-y-2">
                      <Label className="app-field-label">Explanation</Label>
                      <RichTextEditor
                        editorKey={`question-explanation-${selectedQuestion.id}`}
                        initialContent={selectedQuestion.explanationHtml}
                        onChange={(value) =>
                          updateQuestion(selectedQuestion.id, (question) => {
                            question.explanationHtml = value;
                          })
                        }
                        compact
                      />
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="app-field-group">
                        <Label className="app-field-label">Difficulty</Label>
                        <Input
                          value={selectedQuestion.metadata.difficulty || ""}
                          onChange={(event) =>
                            updateQuestion(selectedQuestion.id, (question) => {
                              question.metadata.difficulty = event.target.value;
                            })
                          }
                          placeholder="easy"
                        />
                      </div>
                      <div className="app-field-group">
                        <Label className="app-field-label">Topic</Label>
                        <Input
                          value={selectedQuestion.metadata.topic || ""}
                          onChange={(event) =>
                            updateQuestion(selectedQuestion.id, (question) => {
                              question.metadata.topic = event.target.value;
                            })
                          }
                          placeholder="Whole Numbers"
                        />
                      </div>
                      <div className="app-field-group">
                        <Label className="app-field-label">Template ID</Label>
                        <Input
                          value={selectedQuestion.metadata.templateId || ""}
                          onChange={(event) =>
                            updateQuestion(selectedQuestion.id, (question) => {
                              question.metadata.templateId = event.target.value;
                            })
                          }
                          placeholder="temp_successor_v1"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-semibold text-foreground">
                            Custom tags
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            Add optional metadata as tag type and value pairs.
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="app-import-action-button"
                          onClick={() =>
                            updateQuestion(selectedQuestion.id, (question) => {
                              question.metadata.customTags.push(createEmptyCustomTag());
                            })
                          }
                        >
                          <Plus className="h-4 w-4" />
                          Add tag
                        </Button>
                      </div>
                      {selectedQuestion.metadata.customTags.length === 0 ? (
                        <div className="app-import-note-card border-dashed">
                          No extra tags added for this question.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {selectedQuestion.metadata.customTags.map((tag, index) => (
                            <div
                              key={`${selectedQuestion.id}-tag-${index}`}
                              className="app-import-nested-card grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
                            >
                              <Input
                                value={tag.type}
                                onChange={(event) =>
                                  updateQuestion(selectedQuestion.id, (question) => {
                                    question.metadata.customTags[index].type =
                                      event.target.value;
                                  })
                                }
                                placeholder="tag type"
                              />
                              <Input
                                value={tag.value}
                                onChange={(event) =>
                                  updateQuestion(selectedQuestion.id, (question) => {
                                    question.metadata.customTags[index].value =
                                      event.target.value;
                                  })
                                }
                                placeholder="tag value"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="app-import-action-button text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                                onClick={() =>
                                  updateQuestion(selectedQuestion.id, (question) => {
                                    question.metadata.customTags =
                                      question.metadata.customTags.filter(
                                        (_, tagIndex) => tagIndex !== index,
                                      );
                                  })
                                }
                              >
                                <Trash2 className="h-4 w-4" />
                                Remove
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <div className="grid gap-4 xl:grid-cols-2">
                  <Card className="app-surface overflow-hidden shadow-none">
                    <CardHeader className="app-section-header">
                      <CardTitle>Warnings</CardTitle>
                      <CardDescription>
                        These issues came from the parser. Once the current
                        draft content is fixed, the blocking ones will stop
                        preventing publish.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="app-section-body space-y-3">
                      {selectedQuestionWarnings.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No parser warnings were attached to this question.
                        </p>
                      ) : (
                        selectedQuestionWarnings.map((warning) => {
                          const isBlocking = isQuestionImportWarningCurrentlyBlocking(
                            payload,
                            warning,
                          );

                          return (
                            <div
                              key={warning.id}
                              className="app-import-nested-card"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge
                                  variant={isBlocking ? "warning" : "outline"}
                                >
                                  {isBlocking ? "Blocking" : "Resolved"}
                                </Badge>
                                <Badge variant="outline">{warning.code}</Badge>
                              </div>
                              <p className="mt-2 text-sm text-foreground">
                                {warning.message}
                              </p>
                              {warning.blocking ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="mt-3 app-import-action-button"
                                  onClick={() => resolveWarning(warning.id)}
                                >
                                  Mark resolved
                                </Button>
                              ) : null}
                            </div>
                          );
                        })
                      )}
                    </CardContent>
                  </Card>

                  <Card className="app-surface overflow-hidden shadow-none">
                    <CardHeader className="app-section-header">
                      <CardTitle>Math review</CardTitle>
                      <CardDescription>
                        Check the extracted math fragments and confirm anything
                        that needed manual cleanup in the editor.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="app-section-body space-y-3">
                      {selectedQuestionMathFragments.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No math fragments were extracted for this question.
                        </p>
                      ) : (
                        selectedQuestionMathFragments.map((fragment) => (
                          <div
                            key={fragment.id}
                            className="app-import-nested-card"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge
                                variant={
                                  fragment.mappingStatus === "mapped"
                                    ? "success"
                                    : fragment.mappingStatus === "resolved_by_reviewer"
                                      ? "outline"
                                      : "warning"
                                }
                              >
                                {fragment.mappingStatus}
                              </Badge>
                              <Badge variant="outline">{fragment.sourceFormat}</Badge>
                            </div>
                            <div className="mt-3 space-y-2 text-sm">
                              <div>
                                <p className="font-medium text-foreground">Raw</p>
                                <pre className="mt-1 overflow-x-auto rounded-[var(--app-radius-sm)] bg-[hsl(var(--app-surface-2)/0.7)] px-3 py-2 text-xs text-foreground">
                                  {fragment.rawSource}
                                </pre>
                              </div>
                              <div>
                                <p className="font-medium text-foreground">
                                  Normalized LaTeX
                                </p>
                                <pre className="mt-1 overflow-x-auto rounded-[var(--app-radius-sm)] bg-[hsl(var(--app-surface-2)/0.7)] px-3 py-2 text-xs text-foreground">
                                  {fragment.normalizedLatex || "Not available"}
                                </pre>
                              </div>
                              {fragment.warning ? (
                                <p className="text-[12px] leading-5 text-amber-700 dark:text-amber-300">
                                  {fragment.warning}
                                </p>
                              ) : null}
                            </div>
                            {fragment.mappingStatus === "unmapped" ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="mt-3 app-import-action-button"
                                onClick={() => resolveMathFragment(fragment.id)}
                              >
                                Confirm resolved
                              </Button>
                            ) : null}
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                </div>
              </>
            ) : (
              <Card className="app-surface overflow-hidden shadow-none">
                <CardContent className="app-surface-body">
                  <p className="text-sm text-muted-foreground">
                    No parsed questions are available in this draft.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
