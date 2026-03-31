import { Badge } from "@/components/ui/badge";
import { formatQuestionTagLabel, type QuestionDisplayTag } from "@/lib/question-display";
import { cn } from "@/lib/utils";

type QuestionTagListProps = {
  tags?: QuestionDisplayTag[] | null;
  maxVisible?: number;
  showType?: boolean;
  className?: string;
  badgeClassName?: string;
  moreBadgeClassName?: string;
};

function normalizeTags(tags: QuestionDisplayTag[] | null | undefined) {
  return (Array.isArray(tags) ? tags : [])
    .map((tag, index) => ({
      id: String(tag?._id || `tag-${index}`),
      tag,
    }))
    .filter((entry) => formatQuestionTagLabel(entry.tag) !== "-");
}

export default function QuestionTagList({
  tags,
  maxVisible,
  showType = true,
  className,
  badgeClassName,
  moreBadgeClassName,
}: QuestionTagListProps) {
  const normalizedTags = normalizeTags(tags).map((entry) => ({
    ...entry,
    label: formatQuestionTagLabel(entry.tag, { showType }),
  }));

  if (normalizedTags.length === 0) {
    return null;
  }

  const visibleTags =
    typeof maxVisible === "number" && maxVisible >= 0
      ? normalizedTags.slice(0, maxVisible)
      : normalizedTags;
  const hiddenCount = normalizedTags.length - visibleTags.length;

  return (
    <div className={cn("flex min-w-0 flex-wrap gap-2", className)}>
      {visibleTags.map((tag) => (
        <Badge
          key={tag.id}
          variant="secondary"
          className={cn("font-normal", badgeClassName)}
          title={tag.label}
        >
          {tag.label}
        </Badge>
      ))}
      {hiddenCount > 0 ? (
        <Badge
          variant="outline"
          className={cn("font-normal", moreBadgeClassName)}
          title={`${hiddenCount} more tag${hiddenCount === 1 ? "" : "s"}`}
        >
          +{hiddenCount} more
        </Badge>
      ) : null}
    </div>
  );
}
