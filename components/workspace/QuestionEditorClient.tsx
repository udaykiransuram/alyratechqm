"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { PlusCircle, X } from "lucide-react";

import EditorLoadingState from "@/components/ui/editor-loading-state";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/use-toast";
import { TagItem } from "@/components/ui/multi-select-tags";
import { useBackNavigation } from "@/hooks/useReturnNavigation";
import { announceNavigationStart } from "@/lib/client/navigation-feedback";

const MatrixMatchConfigurator = dynamic(
  () =>
    import("@/components/MatrixMatchConfigurator").then((module) => module.default),
  {
    ssr: false,
    loading: () => <EditorLoadingState label="Loading matrix configurator" />,
  },
);

function QuestionMetadataSkeleton() {
  return (
    <Card className="app-surface overflow-hidden shadow-none">
      <CardHeader className="app-section-header">
        <CardTitle>Metadata</CardTitle>
      </CardHeader>
      <CardContent className="app-section-body space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-12 rounded" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-16 rounded" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-10 rounded" />
          <Skeleton className="h-16 w-full rounded-2xl" />
        </div>
      </CardContent>
    </Card>
  );
}

const RichTextEditor = dynamic(() => import("@/components/RichTextEditor"), {
  loading: () => <EditorLoadingState label="Loading editor" />,
});

const MetadataSelector = dynamic(
  () =>
    import("@/components/MetadataSelector").then(
      (module) => module.MetadataSelector,
    ),
  {
    loading: () => <QuestionMetadataSkeleton />,
  },
);

type QuestionType = "single" | "multiple" | "matrix-match" | "descriptive";

type SubjectWithTags = {
  _id: string;
  name: string;
  tags: TagItem[];
};

type ClassItem = {
  _id: string;
  name: string;
};

type QuestionEditorClientProps = {
  mode: "create" | "edit";
  questionId?: string;
  initialQuestion?: any | null;
  initialClasses: ClassItem[];
  initialSubjects: SubjectWithTags[];
  initialTags: TagItem[];
  initialMessage?: string | null;
};

function getQuestionTypeLabel(type: QuestionType) {
  switch (type) {
    case "single":
      return "Single choice";
    case "multiple":
      return "Multiple choice";
    case "matrix-match":
      return "Matrix match";
    default:
      return "Descriptive";
  }
}

export default function QuestionEditorClient({
  mode,
  questionId,
  initialQuestion = null,
  initialClasses,
  initialSubjects,
  initialTags,
  initialMessage = null,
}: QuestionEditorClientProps) {
  const isEditMode = mode === "edit";
  const router = useRouter();
  const { navigateBack } = useBackNavigation("/workspace/questions");
  const { toast } = useToast();

  const [type, setType] = useState<QuestionType>(
    (initialQuestion?.type as QuestionType) || "single",
  );
  const [classId, setClassId] = useState(String(initialQuestion?.class?._id || ""));
  const [subjectId, setSubjectId] = useState(String(initialQuestion?.subject?._id || ""));
  const [selectedTags, setSelectedTags] = useState<TagItem[]>(
    Array.isArray(initialQuestion?.tags) ? initialQuestion.tags : [],
  );
  const [options, setOptions] = useState<{ content: string | null }[]>(
    Array.isArray(initialQuestion?.options) && initialQuestion.options.length > 0
      ? initialQuestion.options
      : [{ content: "" }],
  );
  const [answerIndexes, setAnswerIndexes] = useState<number[]>(
    Array.isArray(initialQuestion?.answerIndexes) ? initialQuestion.answerIndexes : [],
  );
  const [content, setContent] = useState<string | null>(initialQuestion?.content || "");
  const [explanation, setExplanation] = useState<string | null>(
    initialQuestion?.explanation || "",
  );
  const [marks, setMarks] = useState<number>(Number(initialQuestion?.marks) || 1);
  const [loading, setLoading] = useState(false);
  const [resetCounter, setResetCounter] = useState(0);
  const [matrixRows, setMatrixRows] = useState<string[]>(
    initialQuestion?.type === "matrix-match"
      ? (initialQuestion.matrixOptions || []).map(
          (option: { left?: string }) => option.left || "",
        )
      : [""],
  );
  const [matrixCols, setMatrixCols] = useState<string[]>(
    initialQuestion?.type === "matrix-match"
      ? (initialQuestion.matrixOptions || []).map(
          (option: { right?: string }) => option.right || "",
        )
      : [""],
  );
  const [matrixAnswers, setMatrixAnswers] = useState<number[][]>(
    Array.isArray(initialQuestion?.matrixAnswers)
      ? initialQuestion.matrixAnswers
      : [],
  );

  const recommendedTagIds = useMemo(() => {
    if (!subjectId) return [];
    const selectedSubject = initialSubjects.find((subject) => subject._id === subjectId);
    return selectedSubject ? selectedSubject.tags.map((tag) => tag._id) : [];
  }, [initialSubjects, subjectId]);

  const handleClassChange = (value: string) => {
    setClassId(value);
    setSubjectId("");
    setSelectedTags([]);
  };

  const handleAddOption = () => {
    if (options.length >= 5) {
      toast({
        title: "Limit Reached",
        description: "You can add a maximum of 5 options.",
        variant: "destructive",
      });
      return;
    }

    setOptions((currentOptions) => [...currentOptions, { content: "" }]);
  };

  const handleToggleAnswer = (index: number) => {
    setAnswerIndexes((currentAnswers) =>
      currentAnswers.includes(index)
        ? currentAnswers.filter((item) => item !== index)
        : [...currentAnswers, index],
    );
  };

  const handleRemoveOption = (index: number) => {
    if (options.length <= 1) {
      toast({
        title: "Cannot Remove",
        description: "At least one option is required.",
        variant: "destructive",
      });
      return;
    }

    const nextOptions = options.filter((_, optionIndex) => optionIndex !== index);
    setOptions(nextOptions);
    setAnswerIndexes((currentAnswers) =>
      currentAnswers
        .filter((item) => item !== index)
        .map((item) => (item > index ? item - 1 : item)),
    );
  };

  const handleOptionChange = (index: number, value: string | null) => {
    setOptions((currentOptions) =>
      currentOptions.map((option, optionIndex) =>
        optionIndex === index ? { ...option, content: value } : option,
      ),
    );
  };

  const handleMarksChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = parseInt(event.target.value, 10);
    setMarks(Number.isNaN(nextValue) ? 1 : Math.max(1, nextValue));
  };

  const buildQuestionPayload = () => {
    const payload: Record<string, unknown> = {
      subject: subjectId,
      class: classId,
      tags: selectedTags.map((tag) => tag._id),
      content,
      explanation: explanation || undefined,
      marks,
      type,
    };

    if (type === "matrix-match") {
      const filteredRows = matrixRows.filter((row) => row.trim() !== "");
      const filteredCols = matrixCols.filter((col) => col.trim() !== "");

      if (
        !isEditMode &&
        (filteredRows.length !== matrixRows.length ||
          filteredCols.length !== matrixCols.length)
      ) {
        throw new Error("All matrix rows and columns must be filled in.");
      }

      const maxLength = Math.max(
        isEditMode ? matrixRows.length : filteredRows.length,
        isEditMode ? matrixCols.length : filteredCols.length,
      );
      const sourceRows = isEditMode ? matrixRows : filteredRows;
      const sourceCols = isEditMode ? matrixCols : filteredCols;

      payload.matrixOptions = Array.from({ length: maxLength }, (_, index) => ({
        left: sourceRows[index] || "",
        right: sourceCols[index] || "",
      }));
      payload.matrixAnswers = isEditMode
        ? matrixAnswers
        : matrixAnswers
            .slice(0, filteredRows.length)
            .map((rowAnswers) =>
              rowAnswers.filter((columnIndex) => columnIndex < filteredCols.length),
            );
      return payload;
    }

    if (type === "single" || type === "multiple") {
      payload.options = options;
      payload.answerIndexes = answerIndexes;
    }

    return payload;
  };

  const resetCreateState = () => {
    setContent("");
    setExplanation("");
    setOptions([{ content: "" }]);
    setAnswerIndexes([]);
    setSelectedTags([]);
    setSubjectId("");
    setClassId("");
    setMarks(1);
    setType("single");
    setMatrixRows([""]);
    setMatrixCols([""]);
    setMatrixAnswers([]);
    setResetCounter((currentValue) => currentValue + 1);
  };

  const handleSave = async () => {
    if (!content || content === "<p></p>") {
      toast({
        title: "Validation Error",
        description: "Question content cannot be empty.",
        variant: "destructive",
      });
      return;
    }

    if (!subjectId) {
      toast({
        title: "Validation Error",
        description: "Please select a subject.",
        variant: "destructive",
      });
      return;
    }

    if (!classId) {
      toast({
        title: "Validation Error",
        description: "Please select a class.",
        variant: "destructive",
      });
      return;
    }

    if (!marks || marks < 1) {
      toast({
        title: "Validation Error",
        description: "Marks must be at least 1.",
        variant: "destructive",
      });
      return;
    }

    let questionData: Record<string, unknown>;
    try {
      questionData = buildQuestionPayload();
    } catch (error: any) {
      toast({
        title: "Validation Error",
        description: error?.message || "Please review the question details.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        isEditMode ? `/api/questions/${questionId}` : "/api/questions",
        {
          method: isEditMode ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(questionData),
        },
      );
      const data = await response.json();

      if (!data.success) {
        throw new Error(
          data.message ||
            (isEditMode ? "Failed to update question." : "Failed to save question."),
        );
      }

      if (!isEditMode && subjectId && selectedTags.length > 0) {
        try {
          await fetch(`/api/subjects/${subjectId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tags: selectedTags.map((tag) => tag._id),
            }),
          });
        } catch {
          toast({
            title: "Warning",
            description: "Question created, but failed to update subject tags.",
            variant: "destructive",
          });
        }
      }

      toast({
        title: isEditMode ? "Question Updated!" : "Question Created!",
        description: isEditMode
          ? "Your changes have been saved."
          : "Your new question has been saved successfully.",
      });

      if (isEditMode) {
        navigateBack();
        return;
      }

      resetCreateState();
      announceNavigationStart("/workspace/question-papers/create");
      router.push("/workspace/question-papers/create");
    } catch (error: any) {
      toast({
        title: isEditMode ? "Error Updating Question" : "Error Saving Question",
        description:
          error?.message ||
          (isEditMode
            ? "Could not update the question. Please check your connection."
            : "Could not save the question. Please check your connection."),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (isEditMode && !initialQuestion) {
    return <div className="app-empty-state">Question not found.</div>;
  }

  return (
    <div className="space-y-3.5 sm:space-y-4">
      {initialMessage ? (
        <div className="app-feedback app-feedback-info">{initialMessage}</div>
      ) : null}

      <div className="app-editor-grid app-editor-grid-composer">
        <div className="app-editor-main">
          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header">
              <div className="space-y-1">
                  <CardTitle>Question Content</CardTitle>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Write the prompt exactly as learners should see it.
                  </p>
                </div>
              </CardHeader>
            <CardContent className="app-section-body">
              <RichTextEditor
                key={`${resetCounter}-content`}
                initialContent={content}
                onChange={setContent}
              />
            </CardContent>
          </Card>

          {type === "single" || type === "multiple" ? (
            <Card className="app-surface overflow-hidden">
              <CardHeader className="app-section-header">
                <div className="space-y-1">
                  <CardTitle>Answer Options</CardTitle>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Add clear options and mark the correct answer set before saving.
                  </p>
                </div>
              </CardHeader>
              <CardContent className="app-section-body space-y-2.5">
                {options.map((option, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 rounded-[1.15rem] border border-border/60 bg-[hsl(var(--app-surface-1)/0.92)] p-2 sm:p-2.5"
                  >
                    <div className="pt-2">
                      <Checkbox
                        id={`option-${index}`}
                        checked={answerIndexes.includes(index)}
                        onCheckedChange={() => handleToggleAnswer(index)}
                      />
                    </div>
                    <div className="flex-1">
                      <Label htmlFor={`option-${index}`} className="sr-only">
                        Option {index + 1}
                      </Label>
                      <RichTextEditor
                        key={`${resetCounter}-option-${index}`}
                        initialContent={option.content}
                        onChange={(value) => handleOptionChange(index, value)}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveOption(index)}
                      className="mt-1 text-muted-foreground hover:text-destructive"
                      aria-label="Remove option"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
              <CardFooter className="app-section-body border-t border-border/60 pt-3">
                <Button variant="outline" onClick={handleAddOption} className="app-button-inline w-full">
                  <PlusCircle className="h-4 w-4" />
                  Add Option
                </Button>
              </CardFooter>
            </Card>
          ) : null}

          {type === "matrix-match" ? (
            <Card className="app-surface overflow-hidden">
              <CardHeader className="app-section-header">
                <div className="space-y-1">
                  <CardTitle>Matrix Configuration</CardTitle>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Define the row-column matching structure for a cleaner evaluation flow.
                  </p>
                </div>
              </CardHeader>
              <CardContent className="app-section-body">
                <MatrixMatchConfigurator
                  rows={matrixRows}
                  setRows={setMatrixRows}
                  cols={matrixCols}
                  setCols={setMatrixCols}
                  answers={matrixAnswers}
                  setAnswers={setMatrixAnswers}
                />
              </CardContent>
            </Card>
          ) : null}

          {type === "descriptive" ? (
            <Card className="app-surface overflow-hidden">
              <CardHeader className="app-section-header">
                <div className="space-y-1">
                  <CardTitle>Written Response</CardTitle>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Descriptive questions do not need options, but they still benefit from clear explanation and metadata.
                  </p>
                </div>
              </CardHeader>
              <CardContent className="app-section-body" />
            </Card>
          ) : null}

          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header">
              <div className="space-y-1">
                  <CardTitle>Explanation</CardTitle>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Capture the reasoning or marking guidance that should travel with this question.
                  </p>
                </div>
              </CardHeader>
            <CardContent className="app-section-body">
              <RichTextEditor
                key={`${resetCounter}-explanation`}
                initialContent={explanation}
                onChange={setExplanation}
              />
            </CardContent>
          </Card>
        </div>

        <aside className="app-editor-aside app-editor-aside-sticky">
          <MetadataSelector
            classes={initialClasses}
            classId={classId}
            setClassId={handleClassChange}
            subjects={initialSubjects}
            subjectId={subjectId}
            setSubjectId={setSubjectId}
            subjectsLoading={false}
            allTags={initialTags}
            selectedTags={selectedTags}
            setSelectedTags={setSelectedTags}
            recommendedTagIds={recommendedTagIds}
            initialDataLoading={false}
            resetCounter={resetCounter}
            toast={toast}
            onCreateNewTag={async () => null}
          />

          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header">
              <div className="space-y-1">
                  <CardTitle>Question Setup</CardTitle>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Set the marks and response model before saving.
                  </p>
                </div>
              </CardHeader>
            <CardContent className="app-section-body space-y-3.5">
              <div className="app-field-group">
                <Label htmlFor="marks-input" className="app-field-label">
                  Marks <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="marks-input"
                  type="number"
                  min={1}
                  value={marks}
                  onChange={handleMarksChange}
                  placeholder="Enter marks for this question"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label className="app-field-label">Question Type</Label>
                {isEditMode ? (
                  <div className="rounded-xl border border-border/60 bg-muted/10 px-3 py-2 text-sm font-medium text-foreground">
                    {getQuestionTypeLabel(type)}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={type === "single" ? "default" : "outline"}
                      onClick={() => setType("single")}
                      size="sm"
                      className="min-h-9 min-w-[7.25rem] flex-1 px-3 sm:flex-none"
                    >
                      Single
                    </Button>
                    <Button
                      variant={type === "multiple" ? "default" : "outline"}
                      onClick={() => setType("multiple")}
                      size="sm"
                      className="min-h-9 min-w-[7.25rem] flex-1 px-3 sm:flex-none"
                    >
                      Multiple
                    </Button>
                    <Button
                      variant={type === "matrix-match" ? "default" : "outline"}
                      onClick={() => setType("matrix-match")}
                      size="sm"
                      className="min-h-9 min-w-[7.25rem] flex-1 px-3 sm:flex-none"
                    >
                      Matrix
                    </Button>
                    <Button
                      variant={type === "descriptive" ? "default" : "outline"}
                      onClick={() => setType("descriptive")}
                      size="sm"
                      className="min-h-9 min-w-[7.25rem] flex-1 px-3 sm:flex-none"
                    >
                      Descriptive
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header">
              <div className="space-y-1">
                  <CardTitle>Actions</CardTitle>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Save once the content, answer logic, and metadata are ready.
                  </p>
                </div>
              </CardHeader>
              <CardContent className="app-section-body">
                <Button size="lg" className="w-full" disabled={loading} onClick={handleSave}>
                {loading ? (
                  <Spinner />
                ) : isEditMode ? (
                  "Update Question"
                ) : (
                  "Save Question"
                )}
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
