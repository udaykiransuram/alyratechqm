"use client";

import { useEffect, useState } from "react";
import QuestionPaperForm from "@/components/QuestionPaperForm";
import PageLoadingState from "@/components/ui/page-loading-state";

export default function CreateQuestionPaperPage() {
  const [initialData, setInitialData] = useState<any>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const copy = sessionStorage.getItem("questionPaperCopy");
    if (copy) {
      setInitialData(JSON.parse(copy));
      sessionStorage.removeItem("questionPaperCopy");
    }
    setHydrated(true);
  }, []);

  if (!hydrated) {
    return (
      <PageLoadingState
        title="Loading question paper builder"
        description="Preparing sections, question references, and paper settings."
      />
    );
  }

  return <QuestionPaperForm initialData={initialData} isEditMode={false} />;
}
