"use client";

import { useState } from "react";

import QuestionPaperForm from "@/components/QuestionPaperForm";

type CreateQuestionPaperPageClientProps = {
  initialClasses: Array<{ _id: string; name: string }>;
  initialSubjects: Array<{ _id: string; name: string; tags: any[] }>;
  initialTags: Array<{ _id: string; name: string; type: { _id: string; name: string } }>;
  initialSections: Array<{
    _id: string;
    name: string;
    class?: { _id: string; name?: string } | string;
  }>;
  initialMessage?: string | null;
};

export default function CreateQuestionPaperPageClient({
  initialClasses,
  initialSubjects,
  initialTags,
  initialSections,
  initialMessage = null,
}: CreateQuestionPaperPageClientProps) {
  const [initialData] = useState<any>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    try {
      const copy = sessionStorage.getItem("questionPaperCopy");
      if (!copy) {
        return null;
      }

      sessionStorage.removeItem("questionPaperCopy");
      return JSON.parse(copy);
    } catch {
      return null;
    }
  });

  return (
    <QuestionPaperForm
      initialData={initialData}
      isEditMode={false}
      initialClasses={initialClasses}
      initialSubjects={initialSubjects}
      initialTags={initialTags}
      initialAcademicSections={initialSections}
      initialSupportDataLoaded
      initialSupportMessage={initialMessage}
    />
  );
}
