export function buildTagReport({
  responses,
  paperSections,
  groupBy,
  isClassLevel,
  questionStats = {},
}: {
  responses: any[];
  paperSections: any[];
  groupBy: string[];
  isClassLevel?: boolean;
  questionStats?: Record<string, any>;
}) {
  function arraysEqual(a: number[], b: number[]) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();
    return sortedA.every((val, idx) => val === sortedB[idx]);
  }

  function getTagValue(tags: any[], type: string) {
    const tag = tags.find((t: any) => t.type?.name?.toLowerCase() === type.toLowerCase());
    return tag?.name || `Unknown ${type.charAt(0).toUpperCase() + type.slice(1)}`;
  }

  const stats: any = {};

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

        const ans = answerMap[sectionName]?.[String(question._id)];
        const attempted = ans && Array.isArray(ans.selectedOptions) && ans.selectedOptions.length > 0;
        const isCorrect = attempted && arraysEqual(ans.selectedOptions, question.answerIndexes || []);
        const questionIdStr = String(question._id);

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
          let key;
          if (group === 'section') key = sectionName;
          else if (group === 'tagtype') {
            key = (question.tags || [])
              .map((tag: any) => `${tag.type?.name || 'Other'}: ${tag.name || 'Unknown'}`)
              .join(', ');
          } else {
            key = getTagValue(question.tags, group);
          }

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
        if (attempted && Array.isArray(ans.selectedOptions)) {
          ans.selectedOptions.forEach((optIdx: number) => {
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