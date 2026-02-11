'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, CheckCircle, Info } from 'lucide-react';

// Updated interface for more accurate typing
interface Question {
  _id: string;
  content: string;
  type: 'single' | 'multiple' | 'matrix-match';
  tags?: { _id: string; name: string; type?: { name: string } }[];
  subjects?: { _id: string; name: string; code?: string }[];
  options?: { content: string }[];
  answerIndexes?: number[];
  explanation?: string;
  marks?: number;
  class?: { _id: string; name: string };
  subject?: { _id: string; name: string; code?: string };
}

export default function ViewQuestionPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();

  const [question, setQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/questions/${id}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.question) {
          setQuestion(data.question as Question);
        } else {
          setError(data.message || "Question not found.");
        }
      })
      .catch(() => setError("Network error loading question data."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-muted/20">
        <Spinner /> <span className="ml-2 text-muted-foreground">Loading question details...</span>
      </div>
    );
  }

  if (error || !question) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-muted/20">
        <Card className="p-8 text-center shadow-lg">
          <p className="text-red-600 mb-4 font-semibold">{error || "Question not found."}</p>
          <Button variant="outline" onClick={() => router.push('/questions')}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Questions
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="bg-muted/20 min-h-screen">
      <div className="container py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">View Question</h1>
            <p className="text-muted-foreground">Detailed view of a single question and its properties.</p>
          </div>
          <Button variant="outline" onClick={() => router.push('/questions')}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Main Content: Question, Options, Explanation */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Question</CardTitle>
              </CardHeader>
              <CardContent className="prose max-w-none" dangerouslySetInnerHTML={{ __html: question.content }} />
            </Card>

            {question.options && question.options.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Options</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {question.options.map((opt, idx) => {
                      const isAnswer = question.answerIndexes?.includes(idx);
                      return (
                        <li
                          key={idx}
                          className={`flex items-start p-3 rounded-md border ${isAnswer ? 'border-green-200 bg-green-50' : 'bg-background'}`}
                        >
                          {isAnswer && <CheckCircle className="h-5 w-5 text-green-600 mr-3 mt-0.5 flex-shrink-0" />}
                          <div
                            className={`prose prose-sm max-w-none ${isAnswer ? 'text-green-800 font-semibold' : ''}`}
                            dangerouslySetInnerHTML={{ __html: opt.content || '' }}
                          />
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>
            )}

            {question.explanation && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Info className="h-5 w-5 mr-2 text-blue-600" />
                    Explanation
                  </CardTitle>
                </CardHeader>
                <CardContent className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: question.explanation }} />
              </Card>
            )}
          </div>

          {/* Sidebar: Metadata */}
          <aside className="lg:col-span-1 space-y-6 lg:sticky lg:top-8">
            <Card>
              <CardHeader>
                <CardTitle>Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type</span>
                  <Badge variant="secondary" className="capitalize">{question.type}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Marks</span>
                  <span className="font-medium">{question.marks ?? '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subject</span>
                  <span className="font-medium text-right">{question.subject?.name || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Class</span>
                  <span className="font-medium">{question.class?.name || '-'}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tags</CardTitle>
                <CardDescription>Associated tags and their types.</CardDescription>
              </CardHeader>
              <CardContent>
                {question.tags && question.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {question.tags.map(tag => (
                      <Badge key={tag._id} variant="outline">
                        {tag.name}
                        {tag.type?.name && <span className="ml-1.5 opacity-60">[{tag.type.name}]</span>}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No tags assigned.</p>
                )}
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  );
}