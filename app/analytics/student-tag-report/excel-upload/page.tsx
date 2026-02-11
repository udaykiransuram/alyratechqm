'use client';

import React, { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { useSearchParams } from 'next/navigation';
import pLimit from 'p-limit';

// --- Icons (can be moved to a separate file) ---
const UploadCloudIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
    <path d="M12 12v9" />
    <path d="m16 16-4-4-4 4" />
  </svg>
);

const FileIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

const CheckCircleIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const AlertCircleIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" x2="12" y1="8" y2="12" />
    <line x1="12" x2="12.01" y1="16" y2="16" />
  </svg>
);


const limit = pLimit(10);

export default function ExcelStudentResponseUploadPage() {
  const [excelRows, setExcelRows] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sectionName, setSectionName] = useState<string>('');
  const [questionMap, setQuestionMap] = useState<{ [key: string]: string }>({});
  const searchParams = useSearchParams();
  const paperId = searchParams.get('paperId');
  const [fileName, setFileName] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  // Fetch section name from QuestionPaper when paperId changes
  useEffect(() => {
    async function fetchSectionNameAndQuestions() {
      if (!paperId) return;
      const res = await fetch(`/api/question-papers/${paperId}`);
      const data = await res.json();
      if (data.success && data.paper && data.paper.sections.length > 0) {
        setSectionName(data.paper.sections[0].name);
        // Build a map: Q1 -> question._id, Q2 -> question._id, etc.
        const map: { [key: string]: string } = {};
        data.paper.sections[0].questions.forEach((q: any, idx: number) => {
          map[`Q${idx + 1}`] = q.question._id; // assumes order matches Excel
        });
        setQuestionMap(map);
      }
    }
    fetchSectionNameAndQuestions();
  }, [paperId]);

  // Parse Excel file
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResults([]); // Clear previous results
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
      setExcelRows(data);
    };
    reader.readAsBinaryString(file);
  };

  // Add this cache outside the function so it persists during the upload
  const classIdCache: { [name: string]: string } = {};

  // Helper to get or create class and return its ID
  async function getOrCreateClassId(className: string, description?: string) {
    if (classIdCache[className]) return classIdCache[className];
    const res = await fetch('/api/classes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: className, description }),
    });
    const data = await res.json();
    const id = data.classId || (data.class && data.class._id);
    if (!id) throw new Error(data.message || 'Failed to get class ID');
    classIdCache[className] = id;
    return id;
  }

  // Helper to get or create student and return their user ID
  async function getOrCreateStudent({
    name,
    rollNumber,
    classId,
    fatherName,
  }: {
    name: string;
    rollNumber: string;
    classId: string;
    fatherName?: string;
  }) {
    // Check if student exists (by rollNumber and class)
    const res = await fetch(`/api/users?role=student&rollNumber=${encodeURIComponent(rollNumber)}&classId=${encodeURIComponent(classId)}`);
    const data = await res.json();
    if (data.success && data.users && data.users.length > 0) {
      return data.users[0]._id;
    }

    // If not, create the student
    const createRes = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        role: 'student',
        rollNumber,
        class: classId,
        fatherName,
      }),
    });
    const createData = await createRes.json();
    if (createData.success && createData.user && createData.user._id) {
      return createData.user._id;
    }
    throw new Error(createData.message || 'Failed to create student');
  }

  // Map Excel row to API payload (async)
  async function mapRowToPayloadAsync(row: any, header: string[]) {
    const rowData: { [key: string]: any } = {};
    header.forEach((key, idx) => {
      rowData[key] = row[idx];
    });

    const answers: any[] = [];
    // Updated optionMap for letters; numbers are handled separately
    const optionMap: { [key: string]: number } = { 
      'A': 0, 'B': 1, 'C': 2, 'D': 3 
    };

    for (const key in rowData) {
      if (key.toUpperCase().startsWith('Q')) {
        const questionId = questionMap[key]; // Use ObjectId, not "Q1"
        const option = rowData[key];
        let index: number | undefined;

        if (option !== null && option !== undefined) {
          if (typeof option === 'number') {
            index = option; // Direct number as index (e.g., 25 -> 25)
          } else if (typeof option === 'string') {
            const upper = option.toUpperCase();
            if (optionMap[upper] !== undefined) {
              index = optionMap[upper]; // Letter to index (e.g., 'A' -> 0)
            } else if (!isNaN(Number(upper))) {
              index = Number(upper); // String number to index (e.g., '12' -> 12)
            }
          }
        }

        if (questionId && index !== undefined) {
          answers.push({
            question: questionId,
            selectedOptions: [index],
          });
        }
      }
    }

    // --- Create the class first (or skip if missing) ---
    let classId: string | undefined = undefined;
    const className = `${rowData['FATHER'] || ''} ${rowData['GROUP'] || ''}`.trim();

    if (className) {
      classId = await getOrCreateClassId(className);
    } else if (rowData['CANDIDATE ID']) {
      // Try to find student by roll number only
      const existingStudentRes = await fetch(`/api/users?role=student&rollNumber=${encodeURIComponent(rowData['CANDIDATE ID'])}`);
      const existingStudentData = await existingStudentRes.json();
      if (existingStudentData.success && existingStudentData.users && existingStudentData.users.length > 0) {
        classId = existingStudentData.users[0].class;
      } else {
        throw new Error('Class name is empty and student not found for row: ' + JSON.stringify(rowData));
      }
    } else {
      throw new Error('Class name is empty for row: ' + JSON.stringify(rowData));
    }

    // --- Then create/get the student ---
    if (!rowData['CANDIDATE ID']) {
      throw new Error('Student roll number is required for row: ' + JSON.stringify(rowData));
    }
    if (!classId) {
      throw new Error('Class ID is undefined for row: ' + JSON.stringify(rowData));
    }
    const studentId = await getOrCreateStudent({
      name: rowData['CANDIDATE NAME'],
      rollNumber: rowData['CANDIDATE ID'],
      classId,
      fatherName: rowData['FATHER'],
    });

    // --- Use the fetched section name here ---
    if (!sectionName) throw new Error('Section name not found for this paper.');

    const payload: any = {
      paper: paperId,
      student: studentId,
      sectionAnswers: [{
        sectionName,
        answers: answers,
      }],
      submittedAt: new Date().toISOString(),
    };

    return payload;
  }

  // POST each row to /api/question-paper-response
  const handleUpload = async () => {
    setLoading(true);
    setProgress(0);
    const header = excelRows[0];
    const rowsToUpload = excelRows.slice(1).filter(row => row && row.length > 0);
    const uploadPromises = [];

    for (let i = 0; i < rowsToUpload.length; i++) {
      const row = rowsToUpload[i];
      uploadPromises.push(limit(async () => {
        try {
          const payload = await mapRowToPayloadAsync(row, header);
          const res = await fetch('/api/question-paper-response', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          // Update progress after each successful or failed upload
          setProgress(prev => prev + (1 / rowsToUpload.length) * 100);
          return { row: i + 2, success: data.success, message: data.message || '', id: data.response?._id };
        } catch (e: any) {
          setProgress(prev => prev + (1 / rowsToUpload.length) * 100);
          return { row: i + 2, success: false, message: e.message || 'Failed to upload' };
        }
      }));
    }
    const outResults = await Promise.all(uploadPromises);
    setResults(outResults);
    setLoading(false);
  };

  return (
    <div className="bg-slate-50 min-h-screen py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-800">Student Response Bulk Upload</h1>
          <p className="text-slate-500 mt-2">Upload an Excel file to create student responses for a test paper.</p>
        </div>

        {paperId && (
          <div className="mb-6 text-sm text-center text-slate-600 bg-slate-100 border border-slate-200 rounded-lg px-4 py-2 max-w-md mx-auto">
            <span className="font-semibold text-slate-800">Active Paper ID:</span>
            <span className="ml-2 font-mono bg-slate-200 text-blue-700 px-2 py-0.5 rounded">{paperId}</span>
          </div>
        )}

        <div className="bg-white p-8 rounded-2xl shadow-md border border-slate-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            {/* Left Side: File Upload */}
            <div>
              <label htmlFor="file-upload" className="cursor-pointer">
                <div className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-slate-300 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                  <UploadCloudIcon className="w-10 h-10 text-slate-400 mb-2" />
                  <span className="font-semibold text-slate-600">Click to upload a file</span>
                  <span className="text-xs text-slate-500">or drag and drop</span>
                  <p className="text-xs text-slate-500 mt-2">XLSX, XLS</p>
                </div>
              </label>
              <input id="file-upload" type="file" className="hidden" accept=".xlsx,.xls" onChange={handleFile} />
            </div>

            {/* Right Side: Upload Action */}
            <div className="text-center md:text-left">
              {fileName ? (
                <div className="mb-4">
                  <div className="flex items-center justify-center md:justify-start bg-blue-50 text-blue-800 p-3 rounded-lg border border-blue-200">
                    <FileIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                    <span className="font-medium text-sm truncate">{fileName}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2 text-center md:text-left">
                    {excelRows.length - 1} rows detected.
                  </p>
                </div>
              ) : (
                <p className="text-slate-500 mb-4">Please select a file to begin.</p>
              )}

              <button
                onClick={handleUpload}
                className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg shadow-md font-semibold hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                disabled={loading || excelRows.length <= 1}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>
                    <span>Uploading...</span>
                  </>
                ) : (
                  <span>Process and Upload File</span>
                )}
              </button>
            </div>
          </div>

          {loading && (
            <div className="mt-6">
              <div className="w-full bg-slate-200 rounded-full h-2.5">
                <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${progress}%`, transition: 'width 0.2s' }}></div>
              </div>
              <p className="text-center text-sm text-slate-600 mt-2">{Math.round(progress)}% Complete</p>
            </div>
          )}
        </div>

        {results.length > 0 && (
          <div className="mt-10 bg-white p-6 rounded-2xl shadow-md border border-slate-200">
            <div className="flex flex-col sm:flex-row items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-slate-800">Upload Results</h3>
              <div className="text-sm text-slate-600 mt-2 sm:mt-0">
                <span className="font-semibold text-green-600">{results.filter(r => r.success).length}</span> Succeeded
                <span className="mx-2">|</span>
                <span className="font-semibold text-red-600">{results.filter(r => !r.success).length}</span> Failed
              </div>
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full text-sm divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Row</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Status</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Message</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {results.map((r, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-3 font-medium text-slate-500">{r.row}</td>
                      <td className="px-4 py-3">
                        {r.success ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircleIcon className="w-4 h-4" /> Success
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            <AlertCircleIcon className="w-4 h-4" /> Error
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{r.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-8 text-sm text-gray-700 bg-blue-50 border border-blue-100 rounded p-4">
          <p className="mb-1">
            <b>Excel columns required:</b> <span className="font-mono">CANDIDATE ID</span>, <span className="font-mono">CANDIDATE NAME</span>, <span className="font-mono">FATHER</span>, <span className="font-mono">GROUP</span>, <span className="font-mono">Q1</span>, <span className="font-mono">Q2</span>, ...
          </p>
          <p className="mb-1">
            The question columns (<span className="font-mono">Q1</span>, <span className="font-mono">Q2</span>, etc.) should contain the selected option index or letter: use <span className="font-mono">A</span>/<span className="font-mono">B</span>/<span className="font-mono">C</span>/<span className="font-mono">D</span> for the first four options, or the option number (e.g., <span className="font-mono">1</span>, <span className="font-mono">2</span>, <span className="font-mono">12</span>, <span className="font-mono">25</span>).
          </p>
          <p>
            The <b>paper</b> is taken from the URL.
          </p>
        </div>
      </div>
    </div>
  );
}