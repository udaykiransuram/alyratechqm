"use client";

import { useEffect, useState } from "react";
import QuestionPaperForm from "@/components/QuestionPaperForm";
import { Spinner } from "@/components/ui/spinner";

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
      <div className="app-page-shell px-4 py-6 sm:px-0">
        <div className="app-surface app-surface-body">
          <div className="app-status-row justify-center">
            <Spinner />
            <span>Loading question paper builder...</span>
          </div>
        </div>
      </div>
    );
  }

  return <QuestionPaperForm initialData={initialData} isEditMode={false} />;
}
