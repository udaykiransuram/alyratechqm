'use client';

import React, { useState, useEffect, FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Spinner } from '@/components/ui/spinner';
import PageHero from '@/components/layout/PageHero';
import { Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from '@/components/ui/skeleton';

interface ClassItem {
  _id: string;
  name: string;
  description?: string;
}

export default function ManageClassesPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [newClassName, setNewClassName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const res = await fetch('/api/classes');
        const data = await res.json();
        if (data.success) {
          setClasses(data.classes);
        } else {
          throw new Error(data.message);
        }
      } catch (err: any) {
        setError(err.message);
        toast({ title: 'Error', description: 'Failed to load classes.', variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    };
    fetchClasses();
  }, [toast]);

  const handleCreateClass = async (e: FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) {
      toast({ title: 'Validation Error', description: 'Class name cannot be empty.', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newClassName }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      toast({ title: 'Success', description: `Class "${data.class.name}" created.` });
      setClasses(prev => [...prev, data.class].sort((a, b) => a.name.localeCompare(b.name)));
      setNewClassName('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchiveClass = async (classId: string) => {
    try {
      const res = await fetch(`/api/classes/${classId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      toast({ title: 'Success', description: 'Class archived successfully.' });
      setClasses(prev => prev.filter(c => c._id !== classId));
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="app-page-shell max-w-[88rem] px-4 py-6 sm:px-0">
      <PageHero
        eyebrow="Academic Setup"
        title="Manage Classes"
        description="Create the class structure your school uses for student enrollment, question papers, analytics, and reports."
        meta={
          <>
            <span className="app-meta-chip">Foundation data</span>
            <span className="app-meta-chip">Used across papers and users</span>
          </>
        }
        stats={[
          {
            label: 'Total classes',
            value: String(classes.length),
            meta: 'All active classes currently available in this school workspace.',
          },
          {
            label: 'Create status',
            value: isSubmitting ? 'Saving' : 'Ready',
            meta: 'Add a new class without leaving this page.',
          },
          {
            label: 'Data health',
            value: error ? 'Needs review' : 'Good',
            meta: error
              ? 'One or more class operations failed to load.'
              : 'Class records loaded successfully.',
          },
          {
            label: 'Flow',
            value: 'Create + Archive',
            meta: 'Class maintenance stays in one standardized workspace.',
          },
        ]}
      />

      <div className="space-y-6">
        <Card className="app-surface overflow-hidden">
          <CardHeader className="app-section-header">
            <CardTitle>Create New Class</CardTitle>
            <CardDescription>Add a new class to be used for categorizing questions.</CardDescription>
          </CardHeader>
          <CardContent className="app-section-body">
            <form onSubmit={handleCreateClass} className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Input
                placeholder="e.g., Grade 10"
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                disabled={isSubmitting}
              />
              <Button type="submit" disabled={isSubmitting} className="w-[150px]">
                {isSubmitting ? <Spinner /> : 'Create Class'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="app-surface overflow-hidden">
          <CardHeader className="app-section-header">
            <CardTitle>Existing Classes</CardTitle>
          </CardHeader>
          <CardContent className="app-section-body">
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : error ? (
              <div className="app-feedback app-feedback-error">{error}</div>
            ) : (
              <div className="app-table-wrap"><Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Class Name</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classes.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-muted-foreground py-6">
                        No classes created yet.
                      </TableCell>
                    </TableRow>
                  )}
                  {classes.map(c => (
                    <TableRow key={c._id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Archive class?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone. This will archive the class
                                <strong className="mx-1">&ldquo;{c.name}&rdquo;</strong>.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleArchiveClass(c._id)}>
                                Archive
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
