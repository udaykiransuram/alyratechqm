'use client';

import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useBackNavigation } from '@/hooks/useReturnNavigation';

export default function UploadPage() {
  const { navigateBack } = useBackNavigation('/questions');
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
    <div className="app-page-shell max-w-4xl px-4 py-6 sm:px-0">
      <div className="app-page-header-row">
        <div>
          <h1 className="app-page-title">Upload Question PDF</h1>
          <p className="app-page-subtitle">
            Upload a PDF and extract question content into a structured format.
          </p>
        </div>
        <Button variant="outline" onClick={navigateBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </div>

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
  );
}
