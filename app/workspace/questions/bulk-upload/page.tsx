'use client';

import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import PageHero from '@/components/layout/PageHero';
import PageShell from '@/components/layout/PageShell';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useBackNavigation } from '@/hooks/useReturnNavigation';

export default function BulkQuestionUploadPage() {
  const { navigateBack } = useBackNavigation('/workspace/questions');
  const [jsonText, setJsonText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setResult(null);
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setJsonText(text);
    } catch {
      setError('Failed to read file');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    setError(null);
    setResult(null);

    let json;
    try {
      json = JSON.parse(jsonText);
    } catch {
      setError('Invalid JSON');
      setUploading(false);
      return;
    }

    try {
      const res = await fetch('/api/questions/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json),
      });
      const data = await res.json();
      setResult(data);
      if (!res.ok) setError(data.message || 'Upload failed');
    } catch {
      setError('Network or server error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <PageShell width="wide" padding="standard">
      <PageHero
        variant="editor"
        eyebrow="Question Bank"
        title="Bulk Question Upload"
        description="Upload a JSON file or paste structured JSON to create multiple questions in one go."
        actions={
          <Button variant="outline" onClick={navigateBack} className="app-button-back">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        }
        meta={
          <>
            <span className="app-meta-chip">JSON import flow</span>
            <span className="app-meta-chip">Batch authoring</span>
          </>
        }
        stats={[
          {
            label: 'Source mode',
            value: jsonText.trim() ? 'Ready to upload' : 'Waiting for JSON',
            meta: 'Load a file or paste JSON directly into the editor.',
          },
          {
            label: 'Result state',
            value: result ? 'Uploaded' : error ? 'Needs attention' : 'Idle',
            meta: 'Review the summary and raw response after each run.',
          },
        ]}
      />

      <div className="app-editor-grid">
        <div className="app-editor-main">
          <Card className="app-surface overflow-hidden">
            <CardContent className="app-surface-body">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="app-field-group">
                  <label className="app-field-label" htmlFor="bulkJsonFile">
                    Upload JSON File
                  </label>
                  <input
                    id="bulkJsonFile"
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileChange}
                    className="app-form-file"
                  />
                </div>

                <div className="app-field-group">
                  <label className="app-field-label" htmlFor="bulkJsonText">
                    Or Paste / Edit JSON
                  </label>
                  <Textarea
                    id="bulkJsonText"
                    rows={12}
                    className="font-mono"
                    value={jsonText}
                    onChange={(e) => setJsonText(e.target.value)}
                    placeholder="Paste or edit your JSON here"
                  />
                </div>

                <Button type="submit" disabled={uploading}>
                  {uploading ? 'Uploading...' : 'Upload'}
                </Button>
              </form>

              {error ? <div className="app-feedback app-feedback-error">{error}</div> : null}

              {result ? (
                <div className="app-section">
                  <div className="space-y-1">
                    <h2 className="text-lg font-semibold tracking-tight text-foreground">
                      Bulk Creation Summary
                    </h2>
                                      </div>

                  <div className="overflow-x-auto rounded-xl border border-border/60 bg-background">
                    <table className="min-w-[360px] w-full text-sm">
                      <tbody>
                        <tr className="border-b">
                          <td className="px-4 py-3 font-medium text-foreground">Questions created</td>
                          <td className="px-4 py-3 text-muted-foreground">{result.createdQuestions?.length ?? 0}</td>
                        </tr>
                        <tr className="border-b">
                          <td className="px-4 py-3 font-medium text-foreground">Tags created</td>
                          <td className="px-4 py-3 text-muted-foreground">{result.createdTags?.length ?? 0}</td>
                        </tr>
                        <tr className="border-b">
                          <td className="px-4 py-3 font-medium text-foreground">Tag types created</td>
                          <td className="px-4 py-3 text-muted-foreground">{result.createdTagTypes?.length ?? 0}</td>
                        </tr>
                        <tr className="border-b">
                          <td className="px-4 py-3 font-medium text-foreground">Subjects created</td>
                          <td className="px-4 py-3 text-muted-foreground">{result.createdSubjects?.length ?? 0}</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3 font-medium text-foreground">Classes created</td>
                          <td className="px-4 py-3 text-muted-foreground">{result.createdClasses?.length ?? 0}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <details className="rounded-xl border border-border/60 bg-background p-4">
                    <summary className="cursor-pointer text-sm font-medium text-foreground">
                      Show raw response
                    </summary>
                    <pre className="mt-3 overflow-x-auto rounded-lg bg-muted/40 p-3 text-xs text-foreground">
                      {JSON.stringify(result, null, 2)}
                    </pre>
                  </details>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
