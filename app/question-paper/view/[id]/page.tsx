import { notFound } from 'next/navigation';
import { cookies, headers } from 'next/headers';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PaperSummary } from '@/components/PaperSummary';
import { PrintEditToolbar } from '@/components/PrintEditToolbar';
import QuestionItemClient from '@/components/QuestionItemClient';
import { Button } from '@/components/ui/button';
import { QuestionPaperToolbar } from "@/components/QuestionPaperToolbar";

async function getQuestionPaper(id: string) {
  try {
    // Build absolute URL for server-side fetch and forward tenant key
    const schoolKey = cookies().get('schoolKey')?.value || '';
    const qs = schoolKey ? `?school=${encodeURIComponent(schoolKey)}` : '';
    const hdrs = headers();
    const proto = hdrs.get('x-forwarded-proto') ?? 'http';
    const host = hdrs.get('host') ?? 'localhost:3000';
    const baseUrl = `${proto}://${host}`;
    const res = await fetch(`${baseUrl}/api/question-papers/${id}${qs}`, {
      cache: 'no-store',
      headers: schoolKey ? { 'x-school-key': schoolKey } : {}
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.paper;
  } catch (error) {
    console.error("Failed to fetch question paper:", error);
    return null;
  }
}

export default async function ViewQuestionPaperPage({ params }: { params: { id: string } }) {
  const paper = await getQuestionPaper(params.id);

  if (!paper) {
    notFound();
  }

  const summarySections = paper.sections.map((s: any) => ({
    id: s._id,
    name: s.name,
    questions: s.questions.map((q: any) => ({
      question: q.question,
      marks: q.marks,
      negativeMarks: q.negativeMarks,
    })),
  }));

  return (
    <div className="container p-4 lg:p-6 bg-muted/20 min-h-screen">
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* --- Main Content (Left Side) --- */}
        <main className="flex-1 space-y-4 w-full">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold tracking-tight">{paper.title}</h1>
          </div>

          {/* Toolbar: Edit & Make a Copy */}
          <QuestionPaperToolbar paper={paper} />

          {paper.instructions && (
            <Card>
              <CardHeader><CardTitle>Instructions</CardTitle></CardHeader>
              <CardContent className="prose prose-sm max-w-none">
                <p>{paper.instructions}</p>
              </CardContent>
            </Card>
          )}

          {paper.sections.map((section: any, sectionIndex: number) => (
            <Card key={section._id || sectionIndex}>
              <CardHeader>
                <CardTitle className="text-xl flex justify-between items-center">
                  <span>{`Section ${sectionIndex + 1}: ${section.name}`}</span>
                  <Badge variant="secondary">{section.marks} Marks</Badge>
                </CardTitle>
                {section.description && <p className="text-sm text-muted-foreground pt-2">{section.description}</p>}
              </CardHeader>
              <CardContent className="space-y-4">
                {section.questions.map((q: any, qIndex: number) => (
                  <div key={q.question._id || qIndex} className="border rounded p-3 bg-background">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-semibold mb-2">Question {qIndex + 1}</p>
                        <QuestionItemClient
                          question={q.question}
                          readOnly
                          classes={[]}
                          subjects={[]}
                          allTags={[]}
                        />
                      </div>
                      <div className="text-right ml-4">
                        <Badge variant="outline">{q.marks} Marks</Badge>
                        {q.negativeMarks > 0 && (
                          <Badge variant="destructive" className="mt-1 block">
                            {q.negativeMarks} Negative
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </main>

        {/* --- Sidebar (Right Side) --- */}
        <aside className="w-full lg:w-[380px] lg:sticky lg:top-6 space-y-4 print:hidden">
          <PaperSummary
            sections={summarySections}
            totalPaperMarks={paper.totalMarks}
            duration={paper.duration}
            passingMarks={paper.passingMarks}
            examDate={paper.examDate}
          />
        </aside>
      </div>
      {/* Place PrintEditToolbar here, outside Server Component tree */}
      <PrintEditToolbar paperId={paper._id} />
    </div>
  );
}
