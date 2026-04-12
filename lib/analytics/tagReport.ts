import {
  buildPaperQuestionLookup,
  evaluateQuestionAnswer,
} from "@/lib/question-paper/grading";
import {
  resolveAnalyticsTags,
  type AnalyticsResolvedTag,
  type AnalyticsTagLookup,
} from "@/lib/analytics/tag-resolution";
import {
  analyticsTagValuesMatchFilters,
  buildAnalyticsTagValuesByType,
  type AnalyticsTagFilter,
} from "@/lib/analytics/tag-filters";

export function buildTagReport({
  responses,
  paperSections,
  groupBy,
  isClassLevel,
  questionStats = {},
  filters = {},
  tagLookup,
}: {
  responses: any[];
  paperSections: any[];
  groupBy: string[];
  isClassLevel?: boolean;
  questionStats?: Record<string, any>;
  filters?: {
    classId?: string;
    subjectId?: string;
    subjectIds?: string[];
    tagFilters?: AnalyticsTagFilter[];
    paperDefaultSubject?: {
      _id: string;
      name: string;
    } | null;
  };
  tagLookup?: AnalyticsTagLookup;
}) {
  function getQuestionTags(question: any) {
    return resolveAnalyticsTags(question?.tags || [], tagLookup);
  }

  function getTagValue(tags: AnalyticsResolvedTag[], type: string) {
    const tag = tags.find(
      (candidate) =>
        candidate.type?.name?.toLowerCase() === type.toLowerCase(),
    );
    return tag?.name || `Unknown ${type.charAt(0).toUpperCase() + type.slice(1)}`;
  }

  function getQuestionClassId(question: any) {
    return String(question?.class?._id || question?.class || "");
  }

  function getQuestionSubjectId(question: any) {
    const subject = getResolvedQuestionSubject(question);
    return String(subject?._id || subject || "");
  }

  function getResolvedQuestionSubject(question: any) {
    return question?.subject || filters.paperDefaultSubject || null;
  }

  function getGroupKey(
    question: any,
    tags: AnalyticsResolvedTag[],
    group: string,
    sectionName: string,
  ) {
    if (group === 'section') return sectionName;
    if (group === 'class') return question?.class?.name || 'Unknown Class';
    if (group === 'subject') {
      const subject = getResolvedQuestionSubject(question);
      return subject?.name || 'Unknown Subject';
    }
    if (group === 'tagtype') {
      if (tags.length === 0) {
        return 'No Tags';
      }
      return tags
        .map((tag: AnalyticsResolvedTag) => `${tag.type?.name || 'Other'}: ${tag.name || 'Unknown'}`)
        .sort((left, right) => left.localeCompare(right))
        .join(', ');
    }
    return getTagValue(tags, group);
  }

  const stats: any = {};
  const questionLookup = buildPaperQuestionLookup({ sections: paperSections });
  const questionNumbersByKey = new Map<string, number>();
  (Array.isArray(paperSections) ? paperSections : []).forEach((paperSection: any) => {
    const sectionName = String(paperSection?.name || "");
    let questionNumber = 1;
    (Array.isArray(paperSection?.questions) ? paperSection.questions : []).forEach(
      (qWrap: any) => {
        const questionId = String(qWrap?.question?._id || qWrap?.question || "");
        if (sectionName && questionId) {
          questionNumbersByKey.set(`${sectionName}::${questionId}`, questionNumber);
        }
        questionNumber += 1;
      },
    );
  });
  const allowedSubjectIdSet = new Set(
    (Array.isArray(filters.subjectIds) ? filters.subjectIds : [])
      .map((value) => String(value || "").trim())
      .filter(Boolean),
  );

  for (const response of responses) {
    const answerMap: Record<string, Record<string, any>> = {};
    (response.sectionAnswers || []).forEach((section: any) => {
      answerMap[section.sectionName] = {};
      (section.answers || []).forEach((ans: any) => {
        answerMap[section.sectionName][String(ans.question?._id || ans.question)] = ans;
      });
    });

    for (const paperSection of paperSections) {
      const sectionName = paperSection.name;
      const questions = paperSection.questions || [];

      for (const qWrap of questions) {
        const question = qWrap.question;
        if (!question || !question._id) continue;
        const questionTags = getQuestionTags(question);
        const questionTagsByType = buildAnalyticsTagValuesByType(
          questionTags.map((tag) => ({
            type: tag.type?.name || "",
            value: tag.name,
          })),
        );

        const questionClassId = getQuestionClassId(question);
        const questionSubjectId = getQuestionSubjectId(question);
        if (filters.classId && questionClassId !== filters.classId) continue;
        if (
          allowedSubjectIdSet.size > 0 &&
          !allowedSubjectIdSet.has(questionSubjectId)
        ) {
          continue;
        }
        if (filters.subjectId && questionSubjectId !== filters.subjectId) continue;
        if (
          Array.isArray(filters.tagFilters) &&
          filters.tagFilters.length > 0 &&
          !analyticsTagValuesMatchFilters(
            questionTagsByType,
            filters.tagFilters,
          )
        ) {
          continue;
        }

        const ans = answerMap[sectionName]?.[String(question._id)];
        const questionIdStr = String(question._id);
        const evaluation = evaluateQuestionAnswer(
          questionLookup.get(`${sectionName}::${questionIdStr}`),
          ans,
        );
        const attempted = evaluation.attempted;
        const isCorrect = evaluation.isCorrect;

        // Compose question object for frontend
        const questionObj = {
          id: questionIdStr,
          number:
            questionNumbersByKey.get(`${sectionName}::${questionIdStr}`) ??
            undefined,
          section: sectionName,
          ...(isClassLevel && questionStats[questionIdStr]
            ? {
                correctCount: questionStats[questionIdStr].correct,
                incorrectCount: questionStats[questionIdStr].incorrect,
                unattemptedCount: questionStats[questionIdStr].unattempted,
                correctStudents: questionStats[questionIdStr].correctStudents,
                incorrectStudents: questionStats[questionIdStr].incorrectStudents,
                unattemptedStudents: questionStats[questionIdStr].unattemptedStudents,
              }
            : {})
        };

        let pointer = stats;
        for (let i = 0; i < groupBy.length; i++) {
          const group = groupBy[i];
          const key = getGroupKey(question, questionTags, group, sectionName);

          if (!pointer[key]) pointer[key] = i === groupBy.length - 1
            ? { 
                correct: 0, 
                incorrect: 0, 
                unattempted: 0, 
                optionTags: [],
                correctQuestionIds: [],
                incorrectQuestionIds: [],
                unattemptedQuestionIds: [],
                tags: []
              }
            : {};
          pointer = pointer[key];
        }

        if (!attempted) {
          pointer.unattempted += 1;
          pointer.unattemptedQuestionIds ??= [];
          pointer.unattemptedQuestionIds.push(questionObj);
        } else if (isCorrect) {
          pointer.correct += 1;
          pointer.correctQuestionIds ??= [];
          pointer.correctQuestionIds.push(questionObj);
        } else {
          pointer.incorrect += 1;
          pointer.incorrectQuestionIds ??= [];
          pointer.incorrectQuestionIds.push(questionObj);
        }

        // --- Option tags with student info ---
        if (attempted && evaluation.selectedOptions.length > 0) {
          evaluation.selectedOptions.forEach((optIdx: number) => {
            const optionTagType = `option ${String.fromCharCode(97 + optIdx)}`;
            const tagsForOption = questionTags.filter(
              (tag: AnalyticsResolvedTag) =>
                tag.type?.name?.toLowerCase() === optionTagType,
            );
            const isOptionCorrect = (question.answerIndexes || []).includes(optIdx);
            tagsForOption.forEach((tag: AnalyticsResolvedTag) => {
              pointer.optionTags ??= [];
              pointer.optionTags.push({
                option: optionTagType,
                tag: tag.name,
                isCorrect: isOptionCorrect,
                student: isClassLevel && response.student
                  ? {
                      name: response.student.name,
                      rollNumber: response.student.rollNumber
                    }
                  : undefined
              });
            });
          });
        }

        pointer.tags = questionTags.map((tag: AnalyticsResolvedTag) => ({
          type: tag.type?.name || 'Unknown',
          value: tag.name
        }));
      }
    }
  }

  return stats;
}
