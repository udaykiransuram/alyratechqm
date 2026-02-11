'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function QuestionPaperResponsesPage({ params }: { params: { id: string } }) {
  const [responses, setResponses] = useState<any[]>([]);
  const [classes, setClasses] = useState<{ _id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/question-paper-response?paper=${params.id}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setResponses(data.responses);
        } else {
          setError(data.message || 'Failed to fetch responses');
        }
      })
      .catch(() => setError('An unexpected network error occurred.'))
      .finally(() => setLoading(false));
  }, [params.id]);

  useEffect(() => {
    fetch('/api/classes')
      .then(res => res.json())
      .then(data => {
        if (data.success) setClasses(data.classes);
      });
  }, []);

  if (loading) {
    return (
      <div className="container p-6 space-y-6">
        <Skeleton className="h-12 w-1/2" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="container p-4 sm:p-6 lg:p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800">Student Responses</h1>
          <p className="text-slate-500 mt-1">Review submissions for this question paper.</p>
        </header>

        {responses.length === 0 ? (
          <Card className="text-center p-12">
            <p className="text-slate-500">No responses found for this paper yet.</p>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Responses</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Roll Number</TableHead>
                    <TableHead>Submitted At</TableHead>
                    <TableHead>Total Marks</TableHead>
                    <TableHead>Tag Analytics</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {responses.map((resp) => (
                    <TableRow key={resp._id}>
                      <TableCell>{resp.student?.name || 'Anonymous Student'}</TableCell>
                      <TableCell>{resp.student?.rollNumber || 'N/A'}</TableCell>
                      <TableCell>
                        {resp.submittedAt ? new Date(resp.submittedAt).toLocaleString() : 'Not submitted'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{resp.totalMarksAwarded}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/analytics/student-tag-report/${resp._id}`}>
                            View Tag Analytics
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}