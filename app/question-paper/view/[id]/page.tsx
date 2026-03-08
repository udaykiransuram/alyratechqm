"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PaperSummary } from "@/components/PaperSummary";
import { PrintEditToolbar } from "@/components/PrintEditToolbar";
import QuestionItemClient from "@/components/QuestionItemClient";
import { QuestionPaperToolbar } from "@/components/QuestionPaperToolbar";
import { Spinner } from "@/components/ui/spinner";
import { ArrowLeft } from "lucide-react";

function getSchoolKey() {
  try {
    const m = document.cookie.match(/(?:^|; )schoolKey=([^;]+)/);
    return m && m[1] ? m[1] : "";
  } catch {
    return "";
  }
}

async function getQuestionPaper(id: string) {
  const schoolKey = getSchoolKey();
  const baseUrl = window.location.origin;
  const res = await fetch(`${baseUrl}/api/question-papers/${id}`, {
    cache: "no-store",
    headers: schoolKey ? { "x-school-key": schoolKey } : {},
  });

  let data: any = null;
  try {
    data = await res.json();
  } catch {}

  if (!res.ok || !data?.success) {
    throw new Error(data?.message || "Failed to load question paper.");
  }

  return data.paper;
}

export default function ViewQuestionPaperPage({
  params,
}: {
  params: { id: string };
}) {
  const [paper, setPaper] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [schoolKey, setSchoolKey] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setSchoolKey(getSchoolKey());
  }, []);

  useEffect(() => {
    const fetchPaper = async () => {
      if (!schoolKey) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const fetchedPaper = await getQuestionPaper(params.id);
        setPaper(fetchedPaper);
      } catch (err: any) {
        setError(err?.message || "Failed to load question paper.");
      } finally {
        setLoading(false);
      }
    };
    fetchPaper();
  }, [params.id, schoolKey]);

  if (!mounted) {
    return (
      <div className="app-page-shell px-4 py-6 sm:px-0">
        <div className="app-surface app-surface-body">
          <div className="app-status-row justify-center">
            <Spinner />
            <span>Loading question paper...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!schoolKey) {
    return (
      <div className="app-page-shell px-4 py-6 sm:px-0">
        <div className="app-page-header">
          <h1 className="app-page-title">No School Selected</h1>
          <p className="app-page-subtitle">Please select a school using the navbar to view this question paper.</p>
        </div>
        <div className="app-empty-state">A school context is required before this paper can be viewed.</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="app-page-shell px-4 py-6 sm:px-0">
        <div className="app-surface app-surface-body">
          <div className="app-status-row justify-center">
            <Spinner />
            <span>Loading question paper...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-page-shell px-4 py-6 sm:px-0">
        <div className="app-page-header-row">
          <div>
            <h1 className="app-page-title">Question Paper</h1>
            <p className="app-page-subtitle">The requested paper could not be loaded.</p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/question-paper">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Papers
            </Link>
          </Button>
        </div>
        <div className="app-feedback app-feedback-error text-center">{error}</div>
      </div>
    );
  }

  if (!paper) {
    return (
      <div className="app-page-shell px-4 py-6 sm:px-0">
        <div className="app-page-header-row">
          <div>
            <h1 className="app-page-title">Question Paper</h1>
            <p className="app-page-subtitle">This paper may not belong to the currently selected school.</p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/question-paper">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Papers
            </Link>
          </Button>
        </div>
        <div className="app-empty-state">Question paper not found.</div>
      </div>
    );
  }

  const summarySections = paper.sections.map((section: any) => ({
    id: section._id,
    name: section.name,
    questions: section.questions.map((question: any) => ({
      question: question.question,
      marks: question.marks,
      negativeMarks: question.negativeMarks,
    })),
  }));

  return (
    <div className="container py-6 space-y-6">
      <div className="app-page-header-row">
        <div>
          <h1 className="app-page-title">{paper.title}</h1>
          <p className="app-page-subtitle">Review paper details, sections, question composition, and scoring rules.</p>
        </div>
        <PrintEditToolbar paperId={paper._id} />
      </div>

      <QuestionPaperToolbar paper={paper} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px] items-start">
        <main className="min-w-0 space-y-6">
          {paper.instructions ? (
            <Card className="app-surface overflow-hidden">
              <CardHeader className="app-section-header">
                <CardTitle>Instructions</CardTitle>
              </CardHeader>
              <CardContent className="app-section-body prose prose-sm max-w-none dark:prose-invert">
                <p>{paper.instructions}</p>
              </CardContent>
            </Card>
          ) : null}

          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header">
              <CardTitle>Paper Details</CardTitle>
            </CardHeader>
            <CardContent className="app-section-body">
              <div className="app-detail-grid">
                <div className="app-detail-item">
                  <p className="app-detail-label">Class</p>
                  <div className="app-detail-value">{paper.class?.name || '-'}</div>
                </div>
                <div className="app-detail-item">
                  <p className="app-detail-label">Subject</p>
                  <div className="app-detail-value">{paper.subject?.name || '-'}</div>
                </div>
                <div className="app-detail-item">
                  <p className="app-detail-label">Duration</p>
                  <div className="app-detail-value">{paper.duration ?? '-'} min</div>
                </div>
                <div className="app-detail-item">
                  <p className="app-detail-label">Passing Marks</p>
                  <div className="app-detail-value">{paper.passingMarks ?? '-'}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {paper.sections.map((section: any, sectionIndex: number) => (
            <Card key={section._id || sectionIndex} className="app-surface overflow-hidden">
              <CardHeader className="app-section-header">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle className="text-lg">{`Section ${sectionIndex + 1}: ${section.name}`}</CardTitle>
                    {section.description ? (
                      <p className="mt-2 text-sm text-muted-foreground">{section.description}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{section.questions?.length || 0} Questions</Badge>
                    <Badge variant="secondary">{section.marks} Marks</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="app-section-body space-y-4">
                {section.questions.map((item: any, questionIndex: number) => (
                  <div
                    key={item.question._id || questionIndex}
                    className="rounded-xl border border-border/60 bg-muted/10 p-4"
                  >
                    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <p className="text-sm font-semibold text-foreground">Question {questionIndex + 1}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{item.marks} Marks</Badge>
                        {item.negativeMarks > 0 ? (
                          <Badge variant="destructive">{item.negativeMarks} Negative</Badge>
                        ) : null}
                      </div>
                    </div>
                    <QuestionItemClient
                      question={item.question}
                      readOnly
                      classes={[]}
                      subjects={[]}
                      allTags={[]}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </main>

        <aside className="space-y-4 xl:sticky xl:top-[calc(var(--app-header-height)+1.5rem)] xl:self-start print:hidden">
          <PaperSummary
            sections={summarySections}
            totalPaperMarks={paper.totalMarks}
            duration={paper.duration}
            passingMarks={paper.passingMarks}
            examDate={paper.examDate}
          />
        </aside>
      </div>
    </div>
  );
}
