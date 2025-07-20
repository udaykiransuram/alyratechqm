import { notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { QuestionItem } from '@/components/question-items';
import { PaperSummary } from '@/components/PaperSummary';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FilePenLine, Printer } from 'lucide-react';

async function getQuestionPaper(id: string) {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const res = await fetch(`${apiUrl}/api/question-papers/${id}`, { cache: 'no-store' });
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
    <div className="container mx-auto max-w-full p-4 lg:p-6 bg-muted/20 min-h-screen">
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* --- Main Content (Left Side) --- */}
        <main className="flex-1 space-y-4 w-full">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold tracking-tight">{paper.title}</h1>
            <div className="flex items-center gap-2 print:hidden">
              <Button variant="outline" asChild>
                <Link href={`/question-paper/edit/${paper._id}`}>
                  <FilePenLine className="mr-2 h-4 w-4" /> Edit
                </Link>
              </Button>
              <Button variant="outline" onClick={() => window.print()}>
                <Printer className="mr-2 h-4 w-4" /> Print
              </Button>
            </div>
          </div>

          {paper.instructions && (
            <Card>
              <CardHeader><CardTitle>Instructions</CardTitle></CardHeader>
              <CardContent className="prose prose-sm max-w-none">
                <p>{paper.instructions}</p>
              </CardContent>
            </Card>
          )}

          {paper.sections.map((section: any, sectionIndex: number) => (
            <Card key={section._id}>
              <CardHeader>
                <CardTitle className="text-xl flex justify-between items-center">
                  <span>{`Section ${sectionIndex + 1}: ${section.name}`}</span>
                  <Badge variant="secondary">{section.marks} Marks</Badge>
                </CardTitle>
                {section.description && <p className="text-sm text-muted-foreground pt-2">{section.description}</p>}
              </CardHeader>
              <CardContent className="space-y-4">
                {section.questions.map((q: any, qIndex: number) => (
                  <div key={q.question._id} className="border rounded p-3 bg-background">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-semibold mb-2">Question {qIndex + 1}</p>
                        <QuestionItem
                          question={q.question}
                          readOnly
                          classes={[]} 
                          subjects={[]} 
                          allTags={[]} 
                          onSave={async () => {}} 
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
    </div>
  );
}