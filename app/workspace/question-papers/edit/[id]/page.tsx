"use client";

import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";

import PageHero from "@/components/layout/PageHero";
import QuestionPaperForm from "@/components/QuestionPaperForm";
import { Button } from "@/components/ui/button";
import PageLoadingState from "@/components/ui/page-loading-state";
import { useBackNavigation } from "@/hooks/useReturnNavigation";
import {
  fetchApiJson,
  peekCachedApiJson,
  resolveClientSchoolKey,
} from "@/lib/client/api";

const EDIT_PAGE_CACHE_TTL_MS = 60_000;

function buildQuestionPaperInitialData(rawData: any) {
  return {
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
    assignedAcademicSectionIds: (rawData.assignedAcademicSections || []).map(
      (section: any) => String(section?._id || section),
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
        const questionObj =
          typeof question.question === "object" ? question.question : {};
        return {
          question: questionObj,
          marks: question.marks ?? section.marks ?? 1,
          negativeMarks: question.negativeMarks ?? 0,
        };
      }),
    })),
  };
}

export default function EditQuestionPaperPage({
  params,
}: {
  params: { id: string };
}) {
  const id = params.id || "";
  const { navigateBack } = useBackNavigation(
    id ? `/workspace/question-papers/view/${id}` : "/workspace/question-papers",
  );
  const cachedPaperResponse = id
    ? peekCachedApiJson<{ paper?: any }>(`/api/question-papers/${id}`, {
        clientCacheTtlMs: EDIT_PAGE_CACHE_TTL_MS,
      })
    : null;
  const [initialData, setInitialData] = useState<any>(() =>
    cachedPaperResponse?.paper
      ? buildQuestionPaperInitialData(cachedPaperResponse.paper)
      : null,
  );
  const [loading, setLoading] = useState(() => !cachedPaperResponse?.paper);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadPaper() {
      const schoolKey = resolveClientSchoolKey();
      if (!schoolKey) {
        if (mounted) {
          setLoading(false);
          setError("Please select a school in the navbar first.");
        }
        return;
      }

      try {
        setLoading(!cachedPaperResponse?.paper);
        const data = await fetchApiJson<{ paper?: any }>(
          `/api/question-papers/${id}`,
          {
            cache: "no-store",
            schoolKey,
            fallbackMessage: "Failed to load question paper.",
            clientCacheTtlMs: EDIT_PAGE_CACHE_TTL_MS,
            preferClientCache: true,
          },
        );

        if (!mounted) {
          return;
        }

        if (!data.paper) {
          throw new Error("Question paper not found.");
        }

        setInitialData(buildQuestionPaperInitialData(data.paper));
        setError(null);
      } catch (loadError: any) {
        if (mounted && !cachedPaperResponse?.paper) {
          setError(loadError?.message || "Failed to load question paper.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    if (id) {
      void loadPaper();
    } else {
      setLoading(false);
      setError("Question paper not found.");
    }

    return () => {
      mounted = false;
    };
  }, [cachedPaperResponse?.paper, id]);

  if (loading && !initialData) {
    return (
      <PageLoadingState
        title="Loading question paper editor"
        description="Preparing the paper structure, questions, and schedule settings."
      />
    );
  }

  if (error && !initialData) {
    return (
      <div className="app-page-shell max-w-[88rem] px-4 py-5 sm:px-0">
        <PageHero
          eyebrow="Assessments"
          title="Edit Question Paper"
          description={error}
          actions={
            <Button variant="outline" onClick={navigateBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          }
        />
        <div className="app-empty-state">Question paper not found.</div>
      </div>
    );
  }

  if (!initialData) {
    return (
      <div className="app-page-shell max-w-[88rem] px-4 py-5 sm:px-0">
        <PageHero
          eyebrow="Assessments"
          title="Edit Question Paper"
          description="The requested paper could not be loaded."
          actions={
            <Button variant="outline" onClick={navigateBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          }
        />
        <div className="app-empty-state">Question paper not found.</div>
      </div>
    );
  }

  return <QuestionPaperForm initialData={initialData} isEditMode={true} />;
}
