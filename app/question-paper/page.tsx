'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function QuestionPapersListPage() {
  const [papers, setPapers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/question-papers')
      .then(res => res.json())
      .then(data => {
        if (data.success) setPapers(data.papers || []);
        else setError(data.message || 'Failed to fetch question papers');
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to fetch question papers');
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="p-8">Loading...</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!papers.length) return <div className="p-8">No question papers found.</div>;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Question Papers</h1>
      <ul className="space-y-4">
        {papers.map(paper => (
          <li key={paper._id} className="border rounded p-4 bg-white shadow flex justify-between items-center">
            <div>
              <div className="font-semibold text-lg">{paper.title}</div>
              <div className="text-sm text-gray-600">Total Marks: {paper.totalMarks}</div>
              <div className="text-sm text-gray-500">Sections: {paper.sections?.length || 0}</div>
            </div>
            <div className="flex gap-4">
              <Link
                href={`/question-paper/view/${paper._id}`}
                className="text-blue-600 hover:underline font-medium"
              >
                View
              </Link>
              <Link
                href={`/question-paper/${paper._id}/responses`}
                className="text-green-600 hover:underline font-medium"
              >
                Responses
              </Link>
              <Link
                href={`/analytics/student-tag-report/excel-upload?paperId=${paper._id}`}
                className="text-purple-600 hover:underline font-medium"
              >
                Upload Excel
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}