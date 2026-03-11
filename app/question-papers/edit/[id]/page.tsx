import React from "react";
import { cookies, headers } from "next/headers";
import QuestionPaperForm from "@/components/QuestionPaperForm";
import { getSchoolKeyFromServerCookies } from "@/lib/server/school";

async function getQuestionPaper(id: string) {
  const cookieStore = cookies();
  const headerStore = headers();

  const schoolKey = getSchoolKeyFromServerCookies(cookieStore);
  const host =
    headerStore.get("x-forwarded-host") ||
    headerStore.get("host") ||
    "localhost:3000";
  const protocol = headerStore.get("x-forwarded-proto") || "http";
  const baseUrl = `${protocol}://${host}`;

  const res = await fetch(
    `${baseUrl}/api/question-papers/${id}${schoolKey ? `?school=${encodeURIComponent(schoolKey)}` : ""}`,
    {
      cache: "no-store",
      headers: {
        ...(schoolKey ? { "x-school-key": schoolKey } : {}),
      },
    },
  );

  if (!res.ok) {
    return null;
  }

  const data = await res.json();
  return data.paper;
}

export default async function EditQuestionPaperPage({
  params,
}: {
  params: { id: string };
}) {
  const rawData = await getQuestionPaper(params.id);

  if (!rawData) {
    return (
      <div className="app-page-shell px-4 py-6 sm:px-0">
        <div className="app-page-header">
          <h1 className="app-page-title">Edit Question Paper</h1>
          <p className="app-page-subtitle">The requested paper could not be loaded.</p>
        </div>
        <div className="app-empty-state">Question paper not found.</div>
      </div>
    );
  }

  const initialData = {
    _id: rawData._id,
    title: rawData.title ?? "",
    instructions: rawData.instructions ?? "",
    duration: rawData.duration ?? 60,
    passingMarks: rawData.passingMarks ?? 0,
    examDate: rawData.examDate ?? "",
    classId: rawData.class?._id ?? "",
    subjectId: rawData.subject?._id ?? "",
    assignedAcademicSectionIds: (rawData.assignedAcademicSections || []).map((section: any) =>
      String(section?._id || section),
    ),
    sections: (rawData.sections || []).map((section: any) => ({
      id: section._id || `section-${Math.random()}`,
      name: section.name ?? "",
      description: section.description ?? "",
      defaultMarks: section.marks ?? 1,
      defaultNegativeMarks:
        Array.isArray(section.questions) && section.questions.length > 0
          ? (section.questions[0].negativeMarks ?? 0)
          : 0,
      questions: (section.questions || []).map((question: any) => {
        const questionObj = typeof question.question === "object" ? question.question : {};
        return {
          question: questionObj,
          marks: question.marks ?? section.marks ?? 1,
          negativeMarks: question.negativeMarks ?? 0,
        };
      }),
    })),
  };

  return <QuestionPaperForm initialData={initialData} isEditMode={true} />;
}
