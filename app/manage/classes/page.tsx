'use client';

import React, { useState, useEffect, FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Spinner } from '@/components/ui/spinner';
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

  const handleDeleteClass = async (classId: string) => {
    try {
      const res = await fetch(`/api/classes/${classId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      toast({ title: 'Success', description: 'Class deleted successfully.' });
      setClasses(prev => prev.filter(c => c._id !== classId));
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="container mx-auto max-w-2xl py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Manage Classes</h1>
        <p className="text-muted-foreground mt-1">Add, view, or remove classes from the system.</p>
      </header>

      <div className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Create New Class</CardTitle>
            <CardDescription>Add a new class to be used for categorizing questions.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateClass} className="flex items-center gap-4">
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

        <Card>
          <CardHeader>
            <CardTitle>Existing Classes</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : error ? (
              <p className="text-destructive text-center py-4">{error}</p>
            ) : (
              <Table>
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
                              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete the class
                                <strong className="mx-1">"{c.name}"</strong>.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteClass(c._id)}>
                                Continue
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}