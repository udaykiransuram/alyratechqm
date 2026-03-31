import { formatQuestionTagTypeLabel } from '@/lib/question-display';

interface Tag {
  _id: string;
  name: string;
  type?: { name: string };
}

interface QuestionInPaper {
  question: {
    tags?: Tag[];
  };
  marks: number;
  negativeMarks: number;
}

interface Section {
  id: string;
  name: string;
  questions: QuestionInPaper[];
}

export function SectionTagSummary({ section }: { section: Section }) {
  const tagTypeCounts: Record<string, Record<string, number>> = {};

  section.questions.forEach(q => {
    (q.question.tags ?? []).forEach(tag => {
      const type = tag.type?.name || 'Other';
      if (!tagTypeCounts[type]) tagTypeCounts[type] = {};
      tagTypeCounts[type][tag.name] = (tagTypeCounts[type][tag.name] || 0) + 1;
    });
  });

  if (Object.keys(tagTypeCounts).length === 0) {
    return null; // Return nothing if there are no tags
  }

  const sortedTagTypes = Object.entries(tagTypeCounts).sort(([typeA], [typeB]) =>
    formatQuestionTagTypeLabel(typeA).localeCompare(formatQuestionTagTypeLabel(typeB)),
  );

  return (
    <div className="app-section-tag-summary">
      {sortedTagTypes.map(([type, tags]) => {
        const sortedTags = Object.entries(tags).sort(
          ([nameA, countA], [nameB, countB]) => countB - countA || nameA.localeCompare(nameB),
        );
        const tagCountLabel = `${sortedTags.length} ${
          sortedTags.length === 1 ? 'tag' : 'tags'
        }`;

        return (
          <div key={type} className="app-section-tag-row">
            <div className="app-section-tag-row-header">
              <span className="app-section-tag-type">
                {formatQuestionTagTypeLabel(type)}
              </span>
              <span className="app-section-tag-count">{tagCountLabel}</span>
            </div>
            <div className="app-section-tag-chip-list">
              {sortedTags.map(([name, count]) => (
                <span key={name} className="app-section-tag-chip">
                  {name}
                  <span className="app-section-tag-chip-count">
                    {count}
                  </span>
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
