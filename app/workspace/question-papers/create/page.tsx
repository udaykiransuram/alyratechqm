"use client";

import { useState } from "react";
import QuestionPaperForm from "@/components/QuestionPaperForm";

export default function CreateQuestionPaperPage() {
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

  return <QuestionPaperForm initialData={initialData} isEditMode={false} />;
}
