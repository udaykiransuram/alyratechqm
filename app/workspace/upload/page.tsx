'use client';

import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import PageHero from '@/components/layout/PageHero';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useBackNavigation } from '@/hooks/useReturnNavigation';

export default function UploadPage() {
  const { navigateBack } = useBackNavigation('/workspace/questions');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [status, setStatus] = useState<string>('');

  const handleUpload = async () => {
    if (!pdfFile) return;

    setStatus('Uploading...');
    const formData = new FormData();
    formData.append('file', pdfFile);

    setUploading(true);
    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        setStatus('Upload failed');
        setUploading(false);
        return;
      }

      setStatus('Processing PDF...');
      const json = await res.json();
      setResponse(json);
      setStatus('Done!');
    } catch {
      setStatus('Error uploading file');
    }
    setUploading(false);
  };

  return (
    <div className="app-page-shell max-w-6xl px-4 py-6 sm:px-0">
      <PageHero
        eyebrow="Import Tools"
        title="Upload Question PDF"
        description="Upload a PDF and extract question content into a structured format before deciding how to clean or publish it."
        actions={
          <Button variant="outline" onClick={navigateBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        }
        meta={
          <>
            <span className="app-meta-chip">PDF extraction</span>
            <span className="app-meta-chip">Pre-processing step</span>
          </>
        }
        stats={[
          {
            label: 'Current file',
            value: pdfFile?.name || 'No file selected',
            meta: 'Choose a PDF to begin the extraction process.',
          },
          {
            label: 'Status',
            value: status || 'Idle',
            meta: 'The status message updates as the file is uploaded and processed.',
          },
        ]}
      />

      <div className="app-editor-grid">
        <div className="app-editor-main">
          <Card className="app-surface">
            <CardContent className="app-surface-body">
              <div className="app-field-group">
                <label className="app-field-label" htmlFor="questionPdf">
                  PDF File
                </label>
                <input
                  id="questionPdf"
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                  className="app-form-file"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={handleUpload} disabled={uploading || !pdfFile}>
                  {uploading ? 'Uploading...' : 'Extract Questions'}
                </Button>
                {status ? <p className="app-page-subtitle">{status}</p> : null}
              </div>

              {response ? (
                <div className="app-section">
                  <h2 className="text-lg font-semibold tracking-tight text-foreground">
                    Extracted Response
                  </h2>
                  <pre className="max-h-[520px] overflow-auto rounded-xl bg-background p-4 text-sm text-foreground">
                    {JSON.stringify(response, null, 2)}
                  </pre>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
