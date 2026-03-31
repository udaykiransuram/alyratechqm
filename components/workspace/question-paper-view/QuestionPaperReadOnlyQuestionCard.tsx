import StaticContentRenderer from "@/components/StaticContentRenderer";
import QuestionTagList from "@/components/questions/QuestionTagList";
import { Badge } from "@/components/ui/badge";
import { getQuestionTypeLabel } from "@/lib/question-display";

type QuestionTagType = {
  name?: string | null;
};

type QuestionTag = {
  _id?: string;
  name?: string | null;
  type?: QuestionTagType | null;
};

type QuestionOption = {
  content?: string | null;
};

export type ReadOnlyPaperQuestion = {
  _id?: string;
  content?: string | null;
  type?: string | null;
  tags?: QuestionTag[] | null;
  options?: QuestionOption[] | null;
  answerIndexes?: number[] | null;
  createdAt?: string | Date | null;
};

type QuestionPaperReadOnlyQuestionCardProps = {
  questionNumber: number;
  marks: number;
  negativeMarks: number;
  question: ReadOnlyPaperQuestion;
};

export function QuestionPaperReadOnlyQuestionCard({
  questionNumber,
  marks,
  negativeMarks,
  question,
}: QuestionPaperReadOnlyQuestionCardProps) {
  const questionContent =
    typeof question.content === "string" ? question.content : "";
  const options = Array.isArray(question.options) ? question.options : [];
  const answerIndexes = Array.isArray(question.answerIndexes)
    ? question.answerIndexes
    : [];
  const tags = Array.isArray(question.tags) ? question.tags : [];
  const createdAtDate = question.createdAt ? new Date(question.createdAt) : null;
  const createdAtLabel =
    createdAtDate && !Number.isNaN(createdAtDate.getTime())
      ? createdAtDate.toLocaleDateString()
      : null;

  return (
    <article className="rounded-2xl border border-border/60 bg-muted/10 p-3">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <p className="text-sm font-semibold text-foreground">
          Question {questionNumber}
        </p>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{marks} Marks</Badge>
          <Badge variant="outline">{getQuestionTypeLabel(question.type || undefined)}</Badge>
          {negativeMarks > 0 ? (
            <Badge variant="destructive">{negativeMarks} Negative</Badge>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-border/50 bg-background/80 p-3">
        <StaticContentRenderer
          htmlContent={questionContent}
          className="mb-3 prose-base font-semibold text-foreground"
        />

        {options.length > 0 ? (
          <div className="space-y-2">
            {options.map((option, optionIndex) => {
              const isCorrect = answerIndexes.includes(optionIndex);
              const optionContent =
                typeof option?.content === "string" ? option.content : "";

              return (
                <div
                  key={optionIndex}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
                    isCorrect
                      ? "border-green-400 bg-green-50"
                      : "border-border bg-muted/60"
                  }`}
                >
                  <Badge
                    variant={isCorrect ? "default" : "outline"}
                    className={`min-w-[60px] px-2 py-1 text-xs font-semibold ${
                      isCorrect
                        ? "bg-green-600 text-white"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isCorrect ? "Correct" : `Option ${optionIndex + 1}`}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <StaticContentRenderer
                      htmlContent={optionContent}
                      className="prose-sm font-medium"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No options were configured for this question.
          </p>
        )}

        {tags.length > 0 || createdAtLabel ? (
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/50 pt-3">
            <QuestionTagList
              tags={tags.map((tag, tagIndex) => ({
                ...tag,
                _id: tag._id || `${tag.name || "tag"}-${tagIndex}`,
              }))}
              maxVisible={4}
              className="min-w-0"
              badgeClassName="px-2 py-1 text-xs"
              moreBadgeClassName="px-2 py-1 text-xs"
            />
            {createdAtLabel ? (
              <span className="text-xs text-muted-foreground">{createdAtLabel}</span>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
