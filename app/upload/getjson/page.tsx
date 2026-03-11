'use client';

import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useBackNavigation } from '@/hooks/useReturnNavigation';

export default function ImportQuestionsPage() {
  const { navigateBack } = useBackNavigation('/upload');
  const [file, setFile] = useState<File | null>(null);
  const [payload, setPayload] = useState<{
    questions?: any[];
    studentPaperHtml?: string;
    answerKeyHtml?: string;
    testId?: string;
  }>({});
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [bulkTestId, setBulkTestId] = useState<string | null>(null);

  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    setFile(nextFile);
    setPayload({});
    setUploadResult(null);
    setUploadError(null);
    setBulkTestId(null);
  };

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) {
      toast({
        title: 'No file selected',
        description: 'Choose an Excel file before converting.',
        variant: 'destructive',
      });
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setUploadError(null);
    setUploadResult(null);
    setBulkTestId(null);

    const res = await fetch('/api/convert', { method: 'POST', body: formData });

    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: 'Conversion failed',
          description: data?.error || 'Unable to convert the uploaded file.',
          variant: 'destructive',
        });
        return;
      }

      setPayload(data);
      toast({
        title: 'Conversion complete',
        description: 'Review the generated files before uploading them.',
      });
      return;
    }

    toast({
      title: 'Unexpected response',
      description: 'The server returned an invalid response for this conversion.',
      variant: 'destructive',
    });
  }

  function dl(filename: string, content: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function handleDownloadExcel() {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/convert?excel=1', {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      toast({
        title: 'Excel generation failed',
        description: 'Try the conversion again and then retry the download.',
        variant: 'destructive',
      });
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'questions.xlsx';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function handleDownloadWord() {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/convert?word=1', {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      toast({
        title: 'Word generation failed',
        description: 'Try the conversion again and then retry the download.',
        variant: 'destructive',
      });
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'question_paper.docx';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function handleBulkUpload() {
    if (!payload.questions?.length) {
      toast({
        title: 'No questions to upload',
        description: 'Convert an Excel file first so there is data to upload.',
        variant: 'destructive',
      });
      return;
    }

    const body = payload.testId
      ? { testId: payload.testId, questions: payload.questions }
      : { questions: payload.questions };

    setUploading(true);
    setUploadError(null);
    setUploadResult(null);

    try {
      const res = await fetch('/api/questions/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setUploadResult(data);

      if (!res.ok) {
        const message = data.message || 'Bulk upload failed';
        setUploadError(message);
        toast({
          title: 'Upload failed',
          description: message,
          variant: 'destructive',
        });
      } else {
        if (payload.testId) {
          setBulkTestId(payload.testId);
        }
        toast({
          title: 'Upload successful',
          description: 'The converted questions were added to the question bank.',
        });
      }
    } catch {
      const message = 'Network or server error';
      setUploadError(message);
      toast({
        title: 'Upload failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  }

  const hasData = !!payload.questions?.length;

  return (
    <main className="py-6">
      <div className="container">
        <div className="app-page-shell">
          <div className="app-page-header-row">
            <div>
              <h1 className="app-page-title">Question Import &amp; Test Builder</h1>
              <p className="app-page-subtitle">
                Convert spreadsheet uploads, review the generated artifacts, and publish directly to the question bank.
              </p>
            </div>
            <Button type="button" variant="outline" onClick={navigateBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </div>

          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header">
              <CardTitle>1. Upload Excel</CardTitle>
              <CardDescription>
                Start with the template, then convert your worksheet into previewable question data.
              </CardDescription>
            </CardHeader>
            <CardContent className="app-section-body space-y-5">
              <div>
                <Button variant="outline" asChild>
                  <a href="/api/convert/template">Download Excel Template</a>
                </Button>
              </div>

              <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                <div className="app-field-group">
                  <label htmlFor="questionImportFile" className="app-field-label">
                    Excel File
                  </label>
                  <input
                    id="questionImportFile"
                    type="file"
                    accept=".xlsx,.xls"
                    className="app-form-file"
                    onChange={handleFileChange}
                  />
                </div>
                <Button type="submit" disabled={!file} className="md:min-w-[120px]">
                  Convert
                </Button>
              </form>

              {payload.testId && (
                <div className="app-feedback app-feedback-info">
                  Generated Test ID:{' '}
                  <span className="font-mono font-medium text-foreground">{payload.testId}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {hasData && (
            <Card className="app-surface overflow-hidden">
              <CardHeader className="app-section-header">
                <CardTitle>2. Review &amp; Download</CardTitle>
                <CardDescription>
                  Validate the generated output and download the files you need.
                </CardDescription>
              </CardHeader>
              <CardContent className="app-section-body space-y-5">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => dl('questions.json', JSON.stringify({ questions: payload.questions }, null, 2), 'application/json')}
                  >
                    Download `questions.json`
                  </Button>
                  <Button variant="outline" onClick={handleDownloadExcel}>
                    Download `questions.xlsx`
                  </Button>
                  <Button variant="outline" onClick={handleDownloadWord}>
                    Download `question_paper.docx`
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => dl('question_paper.html', payload.studentPaperHtml || '', 'text/html')}
                  >
                    Download `question_paper.html`
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => dl('answersheet.html', payload.answerKeyHtml || '', 'text/html')}
                  >
                    Download `answersheet.html`
                  </Button>
                </div>

                <details className="app-section">
                  <summary className="cursor-pointer text-sm font-medium text-foreground">
                    Preview the first generated question
                  </summary>
                  <pre className="mt-3 overflow-auto rounded-xl border border-border/60 bg-background p-4 text-xs text-foreground">
                    {JSON.stringify(payload.questions?.[0], null, 2)}
                  </pre>
                </details>
              </CardContent>
            </Card>
          )}

          {hasData && (
            <Card className="app-surface overflow-hidden">
              <CardHeader className="app-section-header">
                <CardTitle>3. Upload to Question Bank</CardTitle>
                <CardDescription>
                  Push the reviewed question set into the workspace once everything looks right.
                </CardDescription>
              </CardHeader>
              <CardContent className="app-section-body space-y-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <Button onClick={handleBulkUpload} disabled={uploading} className="sm:min-w-[220px]">
                    {uploading ? 'Uploading…' : 'Upload to Question Bank'}
                  </Button>
                  {(bulkTestId || payload.testId) && (
                    <div className="text-sm text-muted-foreground">
                      Uploaded Test ID:{' '}
                      <span className="font-mono font-medium text-foreground">
                        {bulkTestId || payload.testId}
                      </span>
                    </div>
                  )}
                </div>

                {uploadResult && (
                  <div className="app-section">
                    <h3 className="text-sm font-semibold text-foreground">Upload Result</h3>
                    <pre className="mt-3 overflow-auto rounded-xl border border-border/60 bg-background p-4 text-xs text-foreground">
                      {JSON.stringify(uploadResult, null, 2)}
                    </pre>
                  </div>
                )}

                {uploadError && <div className="app-feedback app-feedback-error">Error: {uploadError}</div>}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </main>
  );
}
