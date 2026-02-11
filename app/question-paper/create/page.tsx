"use client";
import { useEffect, useState } from "react";
import QuestionPaperForm from "@/components/QuestionPaperForm";

export default function CreateQuestionPaperPage() {
  const [initialData, setInitialData] = useState<any>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Only run on client
    const copy = sessionStorage.getItem("questionPaperCopy");
    if (copy) {
      setInitialData(JSON.parse(copy));
      sessionStorage.removeItem("questionPaperCopy");
    }
    setHydrated(true);
  }, []);

  // Prevent rendering until hydration is complete
  if (!hydrated) return null;

  return <QuestionPaperForm initialData={initialData} isEditMode={false} />;
}