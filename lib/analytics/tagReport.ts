import {
  buildPaperQuestionLookup,
  evaluateQuestionAnswer,
} from "@/lib/question-paper/grading";

export function buildTagReport({
  responses,
  paperSections,
  groupBy,
  isClassLevel,
  questionStats = {},
  filters = {},
}: {
  responses: any[];
  paperSections: any[];
  groupBy: string[];
  isClassLevel?: boolean;
  questionStats?: Record<string, any>;
  filters?: {
    classId?: string;
    subjectId?: string;
  };
}) {
  function getTagValue(tags: any[], type: string) {
    const tag = tags.find((t: any) => t.type?.name?.toLowerCase() === type.toLowerCase());
    return tag?.name || `Unknown ${type.charAt(0).toUpperCase() + type.slice(1)}`;
  }

  function getQuestionClassId(question: any) {
    return String(question?.class?._id || question?.class || "");
  }

  function getQuestionSubjectId(question: any) {
    return String(question?.subject?._id || question?.subject || "");
  }

  function getGroupKey(question: any, group: string, sectionName: string) {
    if (group === 'section') return sectionName;
    if (group === 'class') return question?.class?.name || 'Unknown Class';
    if (group === 'subject') return question?.subject?.name || 'Unknown Subject';
    if (group === 'tagtype') {
      return (question.tags || [])
        .map((tag: any) => `${tag.type?.name || 'Other'}: ${tag.name || 'Unknown'}`)
        .join(', ');
    }
    return getTagValue(question.tags || [], group);
  }

  const stats: any = {};
  const questionLookup = buildPaperQuestionLookup({ sections: paperSections });

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
      let questionNumber = 1;

      for (const qWrap of questions) {
        const question = qWrap.question;
        if (!question || !question.tags || !question._id) continue;

        const questionClassId = getQuestionClassId(question);
        const questionSubjectId = getQuestionSubjectId(question);
        if (filters.classId && questionClassId !== filters.classId) continue;
        if (filters.subjectId && questionSubjectId !== filters.subjectId) continue;

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
          number: questionNumber,
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
          const key = getGroupKey(question, group, sectionName);

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
            const tagsForOption = (question.tags || []).filter(
              (tag: any) => tag.type?.name?.toLowerCase() === optionTagType
            );
            const isOptionCorrect = (question.answerIndexes || []).includes(optIdx);
            tagsForOption.forEach((tag: any) => {
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

        pointer.tags = (question.tags || []).map((tag: any) => ({
          type: tag.type?.name || 'Unknown',
          value: tag.name
        }));

        questionNumber++;
      }
    }
  }

  return stats;
}
