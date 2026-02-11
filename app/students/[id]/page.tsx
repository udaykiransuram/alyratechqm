"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ClassItem { _id: string; name: string }
interface UserItem {
  _id: string;
  name: string;
  email?: string;
  role: string;
  class?: string;
  rollNumber?: string;
  enrolledAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface AttemptItem {
  _id: string;
  paper?: {
    _id: string;
    title?: string;
    subject?: { name?: string } | string;
    class?: { name?: string } | string;
  };
  student?: string;
  startedAt?: string;
  submittedAt?: string;
  totalMarksAwarded?: number;
  sectionAnswers?: Array<{
    sectionName: string;
    answers: Array<{ marksAwarded?: number }>
  }>;
}

export default function StudentDetailPage() {
  const params = useParams();
  const id = (params?.id as string) || "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<UserItem | null>(null);
  const [classes, setClasses] = useState<ClassItem[]>([]);

  // Attempts state
  const [attempts, setAttempts] = useState<AttemptItem[]>([]);
  const [attemptsError, setAttemptsError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const [uRes, cRes, aRes] = await Promise.all([
          fetch('/api/users/' + id),
          fetch('/api/classes'),
          fetch('/api/question-paper-response?student=' + id),
        ]);
        const uJson = await uRes.json();
        const cJson = await cRes.json();
        const aJson = await aRes.json();
        if (!mounted) return;
        if (!uJson.success) throw new Error(uJson.message || 'Failed to load user');
        if (!cJson.success) throw new Error(cJson.message || 'Failed to load classes');
        if (!aJson.success) throw new Error(aJson.message || 'Failed to load attempts');
        setUser(uJson.user);
        setClasses(cJson.classes || []);
        setAttempts(aJson.responses || []);
        setAttemptsError(null);
      } catch (e: any) {
        setError(e.message || 'Failed to load');
        setAttemptsError(e.message || 'Failed to load attempts');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    if (id) load();
    return () => { mounted = false };
  }, [id]);

  const className = user?.class ? (classes.find(c => c._id === String(user.class))?.name || (user.class as string)) : '-';

  // Pagination helpers for attempts
  const totalAttempts = attempts.length;
  const maxPage = Math.max(1, Math.ceil(totalAttempts / pageSize));
  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return attempts.slice(start, start + pageSize);
  }, [attempts, page]);

  const changePage = (dir: 1 | -1) => {
    setPage(prev => Math.min(maxPage, Math.max(1, prev + dir)));
  };

  // Score calculator (client-side fallback)
  const calcScore = (a: AttemptItem) => {
    if (typeof a.totalMarksAwarded === 'number') return a.totalMarksAwarded;
    let sum = 0;
    a.sectionAnswers?.forEach(sec => sec.answers.forEach(ans => { sum += ans.marksAwarded || 0 }));
    return sum;
  };

  const formatDuration = (ms: number) => {
    const sec = Math.floor(ms / 1000);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    const parts: string[] = [];
    if (h) parts.push(h + 'h');
    if (m) parts.push(m + 'm');
    if (!h && !m) parts.push(s + 's');
    return parts.join(' ');
  };


  return (
    <div className="container mx-auto py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Student Details</h1>
          <p className="text-muted-foreground mt-1">View information for a single student.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/students"><Button variant="outline">Back to Students</Button></Link>
          <Link href={'/students/edit/' + id}><Button>Edit</Button></Link>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : error ? (
        <div className="text-destructive">{error}</div>
      ) : !user ? (
        <div className="text-muted-foreground">User not found.</div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{user.name}</span>
                <span className="text-sm font-normal text-muted-foreground">Role: {user.role}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Email</div>
                  <div>{user.email || '-'}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Class</div>
                  <div>{className}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Roll Number</div>
                  <div>{user.rollNumber || '-'}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Enrolled At</div>
                  <div>{user.enrolledAt ? new Date(user.enrolledAt).toLocaleDateString() : '-'}</div>
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground">
                <div>Created: {user.createdAt ? new Date(user.createdAt).toLocaleString() : '-'}</div>
                <div>Updated: {user.updatedAt ? new Date(user.updatedAt).toLocaleString() : '-'}</div>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Attempts ({totalAttempts})</span>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Page {page} of {maxPage}</span>
                  <Button variant="outline" size="sm" onClick={() => changePage(-1)} disabled={page <= 1}>Prev</Button>
                  <Button variant="outline" size="sm" onClick={() => changePage(1)} disabled={page >= maxPage}>Next</Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {attemptsError ? (
                <div className="text-destructive">{attemptsError}</div>
              ) : totalAttempts === 0 ? (
                <div className="text-muted-foreground">No attempts found.</div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Paper</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Class</TableHead>
                        <TableHead>Attempted</TableHead>
                        <TableHead>Submitted</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Questions</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead className="w-[360px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pageItems.map(a => {
                        const paperId = (a.paper as any)?._id || '';
                        const paperTitle = (a.paper as any)?.title || '-';
                        const subjectName = typeof (a.paper as any)?.subject === 'object' ? (a.paper as any)?.subject?.name || '-' : (a.paper as any)?.subject || '-';
                        const className = typeof (a.paper as any)?.class === 'object' ? (a.paper as any)?.class?.name || '-' : (a.paper as any)?.class || '-';
                        const started = a.startedAt ? new Date(a.startedAt).toLocaleString() : '-';
                        const submitted = a.submittedAt ? new Date(a.submittedAt).toLocaleString() : '-';
                        const score = calcScore(a);
                        return (
                          <TableRow key={a._id}>
                            <TableCell className="font-medium">{paperTitle}</TableCell>
                            <TableCell>{subjectName}</TableCell>
                            <TableCell>{className}</TableCell>
                            <TableCell>{started}</TableCell>
                            <TableCell>{submitted}</TableCell>
                            <TableCell>{a.submittedAt ? "Submitted" : "In progress"}</TableCell>
                            <TableCell>{a.startedAt && a.submittedAt ? formatDuration(new Date(a.submittedAt).getTime() - new Date(a.startedAt).getTime()) : "-"}</TableCell>
                            <TableCell>{Array.isArray(a.sectionAnswers) ? a.sectionAnswers.reduce((sum, sec) => sum + (sec.answers?.length || 0), 0) : 0}</TableCell>
                            <TableCell>{score}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap items-center gap-2">
                                <Link href={'/analytics/student-tag-report/' + a._id}><Button variant="outline" size="sm">Student Report</Button></Link>
                                <Link href={'/analytics/class-tag-report/' + paperId} prefetch={false}><Button size="sm">Class Report</Button></Link>
                                <Link href={'/question-paper/view/' + paperId}><Button variant="outline" size="sm">View Paper</Button></Link>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
