'use client';

import React, { useState } from 'react';

export default function BulkQuestionUploadPage() {
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
    } catch (err) {
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
    } catch (err) {
      setError('Network or server error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto mt-12 bg-white shadow-lg rounded-xl p-8">
      <h1 className="text-2xl font-bold mb-2 text-gray-800">Bulk Question Upload</h1>
      <p className="mb-6 text-gray-500">Upload a JSON file or paste your JSON below to create multiple questions at once.</p>
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block font-medium text-gray-700 mb-1">
            Upload JSON file
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleFileChange}
              className="block mt-2 w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </label>
        </div>
        <div className="mb-4">
          <label className="block font-medium text-gray-700 mb-1">
            Or paste/edit JSON
            <textarea
              rows={10}
              className="w-full mt-2 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono text-sm"
              value={jsonText}
              onChange={e => setJsonText(e.target.value)}
              placeholder='Paste or edit your JSON here'
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={uploading}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg shadow disabled:opacity-60"
        >
          {uploading ? 'Uploading...' : 'Upload'}
        </button>
      </form>
      {error && (
        <div className="mt-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}
      {result && (
        <div className="mt-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          <strong>Bulk creation completed!</strong>
          <div className="mt-2">
            <table className="min-w-full text-sm">
              <tbody>
                <tr>
                  <td className="pr-4 font-medium">Questions created:</td>
                  <td>{result.createdQuestions?.length ?? 0}</td>
                </tr>
                <tr>
                  <td className="pr-4 font-medium">Tags created:</td>
                  <td>{result.createdTags?.length ?? 0}</td>
                </tr>
                <tr>
                  <td className="pr-4 font-medium">Tag Types created:</td>
                  <td>{result.createdTagTypes?.length ?? 0}</td>
                </tr>
                <tr>
                  <td className="pr-4 font-medium">Subjects created:</td>
                  <td>{result.createdSubjects?.length ?? 0}</td>
                </tr>
                <tr>
                  <td className="pr-4 font-medium">Classes created:</td>
                  <td>{result.createdClasses?.length ?? 0}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <details className="mt-4">
            <summary className="cursor-pointer text-blue-700 underline">Show raw response</summary>
            <pre className="mt-2 bg-gray-100 rounded p-3 text-xs overflow-x-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}