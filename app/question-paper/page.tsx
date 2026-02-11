"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import JSZip from 'jszip';
import { downloadDefaultClassAnalyticsExcel } from '@/components/analytics/helpers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';

export default function QuestionPapersListPage() {
  const [papers, setPapers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [numTags, setNumTags] = useState<number>(5);
  const [selectedPaperIds, setSelectedPaperIds] = useState<string[]>([]);
  const [classFilter, setClassFilter] = useState<string>('All');
  const [zipLoading, setZipLoading] = useState(false);
  const [excelLoadingId, setExcelLoadingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/question-papers', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setPapers(data.papers || []);
        } else {
          setError(data.message || 'Failed to fetch question papers');
        }
        setLoading(false);
      })
      .catch(() => {
        setError('An unexpected error occurred while fetching data.');
        setLoading(false);
      });
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this question paper?')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/question-papers/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setPapers(currentPapers => currentPapers.filter(p => p._id !== id));
      } else {
        alert(data.message || 'Failed to delete question paper');
      }
    } catch (e) {
      alert('An error occurred while trying to delete the paper.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownloadExcel = async (paperId: string) => {
    setExcelLoadingId(paperId);
    const paper = papers.find(p => p._id === paperId);
    if (!paper) {
      alert('Could not find paper details.');
      setExcelLoadingId(null);
      return;
    }

    const safeTitle = paper.title?.replace(/[^a-zA-Z0-9_\-]/g, '_') || `paper_${paperId}`;
    const suggestedFilename = `${safeTitle}.xlsx`;
    const fileName = window.prompt('Enter file name for the Excel download:', suggestedFilename);

    if (fileName) {
      const excelBlob = await downloadDefaultClassAnalyticsExcel(paperId, numTags, true);
      if (excelBlob) {
        const url = URL.createObjectURL(excelBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        alert('Failed to generate Excel file.');
      }
    }
    setExcelLoadingId(null);
  };

  const handleDownloadAllZip = async () => {
    if (selectedPaperIds.length === 0) {
      alert('Please select at least one question paper to download.');
      return;
    }

    const suggestedName = 'question_papers_excel.zip';
    let finalZipName = window.prompt('Enter the name for the ZIP file:', suggestedName);

    if (!finalZipName) return;

    if (!finalZipName.toLowerCase().endsWith('.zip')) {
      finalZipName += '.zip';
    }

    setZipLoading(true);
    const zip = new JSZip();
    for (const paperId of selectedPaperIds) {
      const paper = papers.find(p => p._id === paperId);
      const safeTitle = paper?.title?.replace(/[^a-zA-Z0-9_\-]/g, '_') || `paper_${paperId}`;
      const excelBlob = await downloadDefaultClassAnalyticsExcel(paperId, numTags, true);
      if (excelBlob) {
        zip.file(`${safeTitle}.xlsx`, excelBlob);
      } else {
        console.warn(`Failed to generate Excel for paper: ${safeTitle}`);
      }
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = finalZipName;
    a.click();
    URL.revokeObjectURL(url);
    setZipLoading(false);
  };

  const classOptions = useMemo(
    () => ['All', ...Array.from(new Set(papers.map(p => p.class?.name).filter(Boolean)))],
    [papers]
  );

  const filteredPapers = useMemo(() => {
    let list = classFilter === 'All' ? papers : papers.filter(p => p.class?.name === classFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p => (p.title || '').toLowerCase().includes(q));
    }
    return list;
  }, [papers, classFilter, search]);

  const allFilteredChecked = filteredPapers.length > 0 && filteredPapers.every(p => selectedPaperIds.includes(p._id));

  if (loading) return (
    <div className="container mx-auto p-8 flex justify-center items-center gap-2 text-muted-foreground"><Spinner /> Loading question papers…</div>
  );
  if (error) return <div className="container mx-auto p-8 text-destructive text-center">{error}</div>;
  if (!papers.length) return <div className="container mx-auto p-8 text-center">No question papers found.</div>;

  return (
    <div className="container mx-auto py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Question Papers</h1>
        <div className="flex items-center gap-2">
          <Link href="/question-paper/create"><Button>Create</Button></Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters & Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-48">
                <Select value={classFilter} onValueChange={setClassFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Classes" />
                  </SelectTrigger>
                  <SelectContent>
                    {classOptions.map(cls => (
                      <SelectItem key={cls} value={cls}>{cls}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by title…"
                className="w-60"
              />
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Tags for Excel</span>
                <Input type="number" min={1} max={10} value={numTags} onChange={e => setNumTags(Number(e.target.value || 1))} className="w-20" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleDownloadAllZip} disabled={zipLoading || selectedPaperIds.length === 0}>
                {zipLoading ? 'Zipping…' : `Download Selected (${selectedPaperIds.length})`}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={allFilteredChecked}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedPaperIds(prev => Array.from(new Set([...prev, ...filteredPapers.map(p => p._id)])));
                        } else {
                          const filteredIds = new Set(filteredPapers.map(p => p._id));
                          setSelectedPaperIds(prev => prev.filter(id => !filteredIds.has(id)));
                        }
                      }}
                      aria-label="Select all filtered papers"
                    />
                  </TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Total Marks</TableHead>
                  <TableHead>Sections</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[380px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPapers.map(paper => (
                  <TableRow key={paper._id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedPaperIds.includes(paper._id)}
                        onCheckedChange={(checked) => {
                          setSelectedPaperIds(ids => checked ? [...ids, paper._id] : ids.filter(id => id !== paper._id));
                        }}
                        aria-label={`Select ${paper.title}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{paper.title}</TableCell>
                    <TableCell>{paper.class?.name || '-'}</TableCell>
                    <TableCell>{paper.totalMarks}</TableCell>
                    <TableCell>{paper.sections?.length || 0}</TableCell>
                    <TableCell>{paper.createdAt ? new Date(paper.createdAt).toLocaleDateString() : '-'}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Link href={`/question-paper/view/${paper._id}`}><Button variant="outline" size="sm">View</Button></Link>
                        <Link href={`/question-paper/${paper._id}/responses`}><Button variant="outline" size="sm">Responses</Button></Link>
                        <Link href={`/analytics/student-tag-report/excel-upload?paperId=${paper._id}`}><Button variant="outline" size="sm">Upload Excel</Button></Link>
                        <Link href={`/analytics/class-tag-report/${paper._id}`} prefetch={false}><Button size="sm">Class Analytics</Button></Link>
                        <Button variant="outline" size="sm" onClick={() => handleDownloadExcel(paper._id)} disabled={excelLoadingId === paper._id}>
                          {excelLoadingId === paper._id ? 'Downloading…' : 'Download Excel'}
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDelete(paper._id)} disabled={deletingId === paper._id}>
                          {deletingId === paper._id ? 'Deleting…' : 'Delete'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
