
'use client';

import React, { useState, useEffect, FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Spinner } from '@/components/ui/spinner';
import { Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';

interface User {
  _id: string;
  name: string;
  email: string;
  role: 'admin' | 'teacher' | 'student';
}

interface ClassItem { _id: string; name: string }

type Role = 'teacher' | 'student' | 'admin';

function getSchoolKeyFromCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(/(?:^|; )schoolKey=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export default function ManageUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [formData, setFormData] = useState<{ name: string; email: string; password: string; role: Role; classId?: string; rollNumber?: string; enrolledAt?: string }>({ name: '', email: '', password: '', role: 'teacher', classId: '', rollNumber: '', enrolledAt: '' });
  const [editData, setEditData] = useState<Partial<User>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Pagination state
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(100);

  const { toast } = useToast();

  const loadUsers = async (pageNum = 1) => {
    try {
      setIsLoading(true);
      const schoolKey = getSchoolKeyFromCookie();
      const usersBase = '/api/users' + (schoolKey ? `?school=${schoolKey}` : '');
      const usersUrl = usersBase + (usersBase.includes('?') ? '&' : '?') + `limit=${limit}&page=${pageNum}`;
      const res = await fetch(usersUrl, { cache: 'no-store' });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to load users');
      setUsers(data.users || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
      setPage(data.page || pageNum);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to load users.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const schoolKey = getSchoolKeyFromCookie();
        const classesUrl = '/api/classes' + (schoolKey ? `?school=${schoolKey}` : '');
        const [cRes] = await Promise.all([
          fetch(classesUrl, { cache: 'no-store' })
        ]);
        const cData = await cRes.json();
        if (cData.success) setClasses(cData.classes);
      } catch {
        // ignore
      }
      await loadUsers(1);
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleRoleChange = (value: Role) => {
    setFormData(prev => ({ ...prev, role: value }));
  };

  const handleClassChange = (value: string) => {
    setFormData(prev => ({ ...prev, classId: value }));
  };

  const handleCreateUser = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (formData.role === 'student' && (!formData.classId || !formData.rollNumber)) {
        throw new Error('For Student role, Class and Roll Number are required.');
      }
      const body: any = {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: formData.role,
      };
      if (formData.role === 'student') {
        body.class = formData.classId;
        body.rollNumber = formData.rollNumber;
        body.enrolledAt = formData.enrolledAt ? new Date(formData.enrolledAt) : undefined;
      }
      const schoolKey = getSchoolKeyFromCookie();
      const postUrl = '/api/users' + (schoolKey ? `?school=${schoolKey}` : '');
      const res = await fetch(postUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      toast({ title: 'Success', description: `User "${data.user.name}" created.` });
      // Reload current page
      await loadUsers(page);
      setFormData({ name: '', email: '', password: '', role: 'teacher', classId: '', rollNumber: '', enrolledAt: '' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditUser = async () => {
    if (!editData._id || !editData.name || !editData.role) return;
    setIsEditing(true);
    try {
      const schoolKey = getSchoolKeyFromCookie();
      const putUrl = `/api/users/${editData._id}` + (schoolKey ? `?school=${schoolKey}` : '');
      const res = await fetch(putUrl, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: editData.name, role: editData.role }) });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      toast({ title: 'Success', description: 'User updated successfully.' });
      await loadUsers(page);
      setIsEditDialogOpen(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsEditing(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      const schoolKey = getSchoolKeyFromCookie();
      const delUrl = `/api/users/${userId}` + (schoolKey ? `?school=${schoolKey}` : '');
      const res = await fetch(delUrl, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      toast({ title: 'Success', description: 'User deleted successfully.' });
      await loadUsers(page);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="container py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
        <p className="text-muted-foreground mt-1">Create, view, and manage user accounts.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-1 space-y-8 lg:sticky lg:top-8">
          <Card>
            <CardHeader>
              <CardTitle>Create New User</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <Input name="name" placeholder="Full Name" value={formData.name} onChange={handleInputChange} required />
                <Input name="email" type="email" placeholder="Email Address" value={formData.email} onChange={handleInputChange} />
                <Input name="password" type="password" placeholder="Password" value={formData.password} onChange={handleInputChange} />
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={formData.role} onValueChange={(v) => handleRoleChange(v as Role)}>
                    <SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="teacher">Teacher</SelectItem>
                      <SelectItem value="student">Student</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.role === 'student' && (
                  <div className="space-y-3 border rounded-md p-3">
                    <div className="space-y-2">
                      <Label>Class</Label>
                      <Select value={formData.classId} onValueChange={handleClassChange}>
                        <SelectTrigger><SelectValue placeholder="Select Class" /></SelectTrigger>
                        <SelectContent>
                          {classes.map((c) => (
                            <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Roll Number</Label>
                      <Input name="rollNumber" placeholder="Roll Number" value={formData.rollNumber} onChange={handleInputChange} />
                    </div>
                    <div className="space-y-2">
                      <Label>Enrolled At</Label>
                      <Input name="enrolledAt" type="date" value={formData.enrolledAt} onChange={handleInputChange} />
                    </div>
                  </div>
                )}
                <Button type="submit" disabled={isSubmitting} className="w-full">
                  {isSubmitting ? <Spinner /> : 'Create User'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-3">
          <Card>
            <CardHeader>
              <CardTitle>Existing Users</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-2 text-sm text-muted-foreground">
                    <div>Total: {total} • Page {page} of {pages}</div>
                    <div>
                      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => loadUsers(page - 1)}>
                        <ChevronLeft className="h-4 w-4" /> Prev
                      </Button>
                      <Button variant="outline" size="sm" className="ml-2" disabled={page >= pages} onClick={() => loadUsers(page + 1)}>
                        Next <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead className="text-right w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map(user => (
                        <TableRow key={user._id}>
                          <TableCell className="font-medium">{user.name}</TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell><Badge variant={user.role === 'admin' ? 'default' : 'secondary'} className="capitalize">{user.role}</Badge></TableCell>
                          <TableCell className="text-right">
                            <Dialog open={isEditDialogOpen && editData._id === user._id} onOpenChange={(open) => { if (!open) setEditData({}); setIsEditDialogOpen(open); }}>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={() => { setEditData(user); setIsEditDialogOpen(true); }}>
                                  <Pencil className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader><DialogTitle>Edit User: {editData.name}</DialogTitle></DialogHeader>
                                <div className="space-y-4 py-4">
                                  <div className="space-y-2">
                                    <Label htmlFor="edit-name">Name</Label>
                                    <Input id="edit-name" value={editData.name || ''} onChange={(e) => setEditData(d => ({ ...d, name: e.target.value }))} />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Email (cannot be changed)</Label>
                                    <Input value={editData.email || ''} disabled />
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor="edit-role">Role</Label>
                                    <Select value={editData.role} onValueChange={(value) => setEditData(d => ({ ...d, role: value as User['role'] }))}>
                                      <SelectTrigger><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="teacher">Teacher</SelectItem>
                                        <SelectItem value="student">Student</SelectItem>
                                        <SelectItem value="admin">Admin</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                                <DialogFooter>
                                  <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                                  <Button onClick={handleEditUser} disabled={isEditing}>
                                    {isEditing && <Spinner />} Save Changes
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>

                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the user <strong className="mx-1">{user.name}</strong>.</AlertDialogDescription></AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteUser(user._id)}>Delete</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
