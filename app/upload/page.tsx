'use client';

import { useState } from 'react';

export default function UploadPage() {
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
      // Change the URL in this fetch request
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
    } catch (err) {
      setStatus('Error uploading file');
    }
    setUploading(false);
  };

  return (
    <div className="p-10 space-y-4">
      <h1 className="text-2xl font-bold">Upload Question PDF</h1>
      <input type="file" accept="application/pdf" onChange={(e) => setPdfFile(e.target.files?.[0] || null)} />
      <button
        className="bg-blue-500 text-white px-4 py-2 rounded"
        onClick={handleUpload}
        disabled={uploading || !pdfFile}
      >
        {uploading ? 'Uploading...' : 'Extract Questions'}
      </button>
      {status && <div className="text-sm text-gray-600">{status}</div>}
      {response && (
        <pre className="bg-gray-100 p-4 mt-4 overflow-auto max-h-[500px]">
          {JSON.stringify(response, null, 2)}
        </pre>
      )}
    </div>
  );
}
