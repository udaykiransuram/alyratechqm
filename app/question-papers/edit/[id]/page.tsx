import React from "react";
import { cookies, headers } from "next/headers";
import PageHero from "@/components/layout/PageHero";
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
  const requestCookieHeader = headerStore.get("cookie") || "";

  const res = await fetch(
    `${baseUrl}/api/question-papers/${id}${schoolKey ? `?school=${encodeURIComponent(schoolKey)}` : ""}`,
    {
      cache: "no-store",
      headers: {
        ...(requestCookieHeader ? { cookie: requestCookieHeader } : {}),
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
      <div className="app-page-shell max-w-[88rem] px-4 py-5 sm:px-0">
        <PageHero
          eyebrow="Assessments"
          title="Edit Question Paper"
          description="The requested paper could not be loaded."
        />
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
    onlineEnabled: Boolean(rawData.onlineEnabled),
    onlineStartsAt: rawData.onlineStartsAt ?? "",
    onlineEndsAt: rawData.onlineEndsAt ?? "",
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
