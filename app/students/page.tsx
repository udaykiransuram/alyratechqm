"use client";

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

interface ClassGroup {
  classId: string
  className: string
  count: number
  students: Array<{ _id: string; name: string; email?: string; rollNumber?: string; enrolledAt?: string }>
}

interface ClassItem { _id: string; name: string }

export default function StudentsByClassPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [groups, setGroups] = useState<ClassGroup[]>([])

  const [classes, setClasses] = useState<ClassItem[]>([])
  const [selectedClass, setSelectedClass] = useState<string>('all')
  const [query, setQuery] = useState('')
  const [includeEmpty, setIncludeEmpty] = useState(false)

  // Per-class pagination state
  const [pages, setPages] = useState<Record<string, number>>({})
  const pageSize = 10

  // Inline Edit modal state
  const [editOpen, setEditOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [editStudent, setEditStudent] = useState<{ _id: string; name: string } | null>(null)
  const [editClassId, setEditClassId] = useState<string>('')
  const [editRollNumber, setEditRollNumber] = useState<string>('')
  const [editEnrolledAt, setEditEnrolledAt] = useState<string>('')

  useEffect(() => {
    fetch('/api/classes')
      .then(r => r.json())
      .then(data => { if (data.success) setClasses(data.classes || []) })
  }, [])

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (selectedClass && selectedClass !== 'all') params.set('classId', selectedClass)
      if (query.trim()) params.set('q', query.trim())
      if (includeEmpty) params.set('includeEmpty', 'true')
      const res = await fetch(`/api/users/students-by-class?${params.toString()}`)
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to load students')
      setGroups(data.data || [])
      const initialPages: Record<string, number> = {}
      ;(data.data || []).forEach((g: ClassGroup) => { initialPages[g.classId] = 1 })
      setPages(initialPages)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const totalStudents = useMemo(() => groups.reduce((sum, g) => sum + (g.count || 0), 0), [groups])

  const onSearch = (e?: React.FormEvent) => {
    e?.preventDefault()
    fetchData()
  }

  const changePage = (classId: string, dir: 1 | -1) => {
    setPages(prev => {
      const current = prev[classId] || 1
      const group = groups.find(g => g.classId === classId)
      const maxPage = group ? Math.max(1, Math.ceil((group.students?.length || 0) / pageSize)) : 1
      const next = Math.min(maxPage, Math.max(1, current + dir))
      return { ...prev, [classId]: next }
    })
  }

  const exportCSV = (group: ClassGroup) => {
    const headers = ['Name', 'Roll Number', 'Email', 'Enrolled At']
    const rows = group.students.map(s => [
      escapeCSV(s.name || ''),
      escapeCSV(s.rollNumber || ''),
      escapeCSV(s.email || ''),
      escapeCSV(s.enrolledAt ? new Date(s.enrolledAt).toISOString().split('T')[0] : ''),
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${group.className.replace(/\s+/g, '_')}_students.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const escapeCSV = (val: string) => {
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return '"' + val.replace(/"/g, '""') + '"'
    }
    return val
  }

  // Inline Edit handlers
  function openEditModal(student: { _id: string; name: string; rollNumber?: string; enrolledAt?: string }, groupClassId: string) {
    setEditStudent({ _id: student._id, name: student.name })
    setEditClassId(groupClassId)
    setEditRollNumber(student.rollNumber || '')
    setEditEnrolledAt(student.enrolledAt ? new Date(student.enrolledAt).toISOString().split('T')[0] : '')
    setEditOpen(true)
  }

  async function saveEdit() {
    if (!editStudent) return
    try {
      setSaving(true)
      const body: any = {
        name: editStudent.name,
        role: 'student',
        class: editClassId,
        rollNumber: editRollNumber,
      }
      if (editEnrolledAt) body.enrolledAt = new Date(editEnrolledAt)
      const res = await fetch(`/api/users/${editStudent._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to update')
      setEditOpen(false)
      await fetchData()
    } catch (e: any) {
      alert(e.message || 'Failed to update student')
    } finally {
      setSaving(false)
    }
  }

  async function deleteStudent(id: string) {
    if (!confirm('Delete this student? This action cannot be undone.')) return
    try {
      setDeleteLoading(true)
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to delete')
      await fetchData()
    } catch (e: any) {
      alert(e.message || 'Failed to delete student')
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Students by Class</h1>
        <p className="text-muted-foreground mt-1">Browse all students grouped by class. Total: {totalStudents}</p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSearch} className="flex flex-col md:flex-row gap-3 md:items-center">
            <div className="w-full md:w-64">
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger>
                  <SelectValue placeholder="All Classes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {classes.map(cls => (
                    <SelectItem key={cls._id} value={cls._id}>{cls.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name / email / roll no." className="md:flex-1" />
            <Button type="submit">Apply</Button>
            <Button type="button" variant={includeEmpty ? 'default' : 'outline'} onClick={() => { setIncludeEmpty(v => !v); setTimeout(fetchData, 0) }}>
              {includeEmpty ? 'Hide Empty' : 'Show Empty Classes'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner /> Loading…</div>
      ) : error ? (
        <div className="text-destructive">{error}</div>
      ) : groups.length === 0 ? (
        <div className="text-muted-foreground">No classes or students found.</div>
      ) : (
        <Accordion type="multiple" className="space-y-3">
          {groups.map(group => {
            const page = pages[group.classId] || 1
            const start = (page - 1) * pageSize
            const end = start + pageSize
            const pageItems = group.students.slice(start, end)
            const maxPage = Math.max(1, Math.ceil(group.students.length / pageSize))
            return (
              <AccordionItem key={group.classId} value={group.classId} className="border rounded-md">
                <AccordionTrigger className="px-4">
                  <div className="flex w-full items-center justify-between">
                    <span className="font-medium">{group.className}</span>
                    <span className="text-sm text-muted-foreground">{group.count} students</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="px-4 pb-4">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="text-sm text-muted-foreground">Page {page} of {maxPage}</div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => changePage(group.classId, -1)} disabled={page <= 1}>Prev</Button>
                        <Button variant="outline" size="sm" onClick={() => changePage(group.classId, 1)} disabled={page >= maxPage}>Next</Button>
                        <Separator orientation="vertical" className="h-6" />
                        <Button size="sm" onClick={() => exportCSV(group)}>Export CSV</Button>
                      </div>
                    </div>
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Roll No.</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Enrolled</TableHead>
                            <TableHead className="w-[240px]">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pageItems.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center text-muted-foreground">No students on this page.</TableCell>
                            </TableRow>
                          ) : pageItems.map(s => (
                            <TableRow key={s._id}>
                              <TableCell className="font-medium">{s.name}</TableCell>
                              <TableCell>{s.rollNumber || '-'}</TableCell>
                              <TableCell>{s.email || '-'}</TableCell>
                              <TableCell>{s.enrolledAt ? new Date(s.enrolledAt).toLocaleDateString() : '-'}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Link href={`/students/${s._id}`}><Button variant="outline" size="sm">View</Button></Link>
                                  <Button variant="outline" size="sm" onClick={() => openEditModal(s, group.classId)}>Edit</Button>
                                  <Button variant="destructive" size="sm" disabled={deleteLoading} onClick={() => deleteStudent(s._id)}>
                                    {deleteLoading ? 'Deleting…' : 'Delete'}
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            )
          })}
        </Accordion>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Student</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">Name</Label>
              <Input id="name" className="col-span-3" value={editStudent?.name || ''} onChange={(e) => setEditStudent(s => s ? { ...s, name: e.target.value } : s)} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Class</Label>
              <div className="col-span-3">
                <Select value={editClassId} onValueChange={setEditClassId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map(c => (
                      <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="roll" className="text-right">Roll No.</Label>
              <Input id="roll" className="col-span-3" value={editRollNumber} onChange={(e) => setEditRollNumber(e.target.value)} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="enrolled" className="text-right">Enrolled At</Label>
              <Input id="enrolled" className="col-span-3" type="date" value={editEnrolledAt} onChange={(e) => setEditEnrolledAt(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
