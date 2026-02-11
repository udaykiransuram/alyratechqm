import React from 'react';
import QuestionPaperForm from '@/components/QuestionPaperForm';

// Helper function to fetch data
async function getQuestionPaper(id: string) {
  const res = await fetch(`http://localhost:3000/api/question-papers/${id}`, { cache: 'no-store' });
  if (!res.ok) {
    return null;
  }
  const data = await res.json();
  return data.paper;
}

export default async function EditQuestionPaperPage({ params }: { params: { id: string } }) {
  const rawData = await getQuestionPaper(params.id);

  if (!rawData) {
    return <div>Question paper not found.</div>;
  }

  // Defensive mapping for sections/questions
  const initialData = {
    _id: rawData._id, // <-- Add this line!
    title: rawData.title ?? '',
    instructions: rawData.instructions ?? '',
    duration: rawData.duration ?? 60,
    passingMarks: rawData.passingMarks ?? 0,
    examDate: rawData.examDate ?? '',
    classId: rawData.class?._id ?? '',
    subjectId: rawData.subject?._id ?? '',
    sections: (rawData.sections || []).map((section: any) => ({
      id: section._id || `section-${Math.random()}`,
      name: section.name ?? '',
      description: section.description ?? '',
      defaultMarks: section.marks ?? 1,
      defaultNegativeMarks:
        Array.isArray(section.questions) && section.questions.length > 0
          ? section.questions[0].negativeMarks ?? 0
          : 0,
      questions: (section.questions || []).map((q: any) => {
        const questionObj = typeof q.question === 'object' ? q.question : {};
        return {
          question: questionObj,
          marks: q.marks ?? section.marks ?? 1,
          negativeMarks: q.negativeMarks ?? 0,
        };
      }),
    })),
  };

  return <QuestionPaperForm initialData={initialData} isEditMode={true} />;
}