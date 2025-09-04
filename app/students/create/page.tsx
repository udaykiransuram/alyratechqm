'use client';

import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';

export default function CreateStudentPage() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    class: '',
    rollNumber: '',
    enrolledAt: '',
  });
  const [classes, setClasses] = useState<{ _id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  // Fetch classes on mount
  useEffect(() => {
    fetch('/api/classes')
      .then(res => res.json())
      .then(data => {
        if (data.success) setClasses(data.classes);
      });
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        role: 'student',
        enrolledAt: form.enrolledAt ? new Date(form.enrolledAt) : undefined,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (data.success) {
      setMessage('Student created!');
      setForm({
        name: '',
        email: '',
        password: '',
        class: '',
        rollNumber: '',
        enrolledAt: '',
      });
    } else {
      setMessage(data.message || 'Error creating student');
    }
  };

  // --- Bulk Upload Handlers ---
  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkLoading(true);
    setMessage(null);

    let students: any[] = [];

    if (file.name.endsWith('.csv')) {
      const text = await file.text();
      console.log('CSV file content:', text); // <-- Add this
      const lines = text.split('\n').filter(Boolean);
      const [header, ...rows] = lines;
      const columns = header.split(',').map(h => h.trim());
      students = rows.map(row => {
        const values = row.split(',').map(v => v.trim());
        const obj: any = {};
        columns.forEach((col, idx) => {
          obj[col] = values[idx] || '';
        });
        obj.role = 'student';
        // Map class name to class ID
        if (obj.class) {
          const found = classes.find(c => c.name.trim().toLowerCase() === obj.class.trim().toLowerCase());
          obj.class = found ? found._id : '';
        }
        if (obj.enrolledAt) obj.enrolledAt = new Date(obj.enrolledAt);
        return obj;
      }).filter(s => s.class); // Only keep students with a valid class

      // For CSV
      console.log('Parsed CSV rows:', rows);
      console.log('CSV columns:', columns);

      const unmatched = rows
        .map(row => {
          const values = row.split(',').map(v => v.trim());
          const obj: any = {};
          columns.forEach((col, idx) => {
            obj[col] = values[idx] || '';
          });
          return obj.class;
        })
        .filter(className => className && !classes.find(c => c.name.trim().toLowerCase() === className.trim().toLowerCase()));

      console.log('Unmatched class names:', unmatched);
    } else if (file.name.endsWith('.xlsx')) {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(sheet);
      console.log('Excel parsed JSON:', json); // <-- Add this

      // Normalize keys to lowercase for each row
      const normalizedJson = json.map((row: any) => {
        const newRow: any = {};
        Object.keys(row).forEach(key => {
          newRow[key.toLowerCase()] = row[key];
        });
        return newRow;
      });

      students = normalizedJson.map((row: any) => {
        // Map class name to class ID
        if (row.class) {
          const found = classes.find(
            c => c.name.trim().toLowerCase() === String(row.class).trim().toLowerCase()
          );
          row.class = found ? found._id : '';
        }
        return {
          ...row,
          role: 'student',
          enrolledAt: row.enrolledAt ? new Date(row.enrolledAt) : undefined,
        };
      }).filter(s => s.class);
    } else {
      setBulkLoading(false);
      setMessage('Unsupported file type. Please upload a CSV or Excel (.xlsx) file.');
      return;
    }

    // After mapping and before sending:
    const skipped = students.filter(s => !s.class);
    if (skipped.length > 0) {
      setMessage(`Some students were skipped due to invalid class: ${skipped.map(s => s.name).join(', ')}`);
    }

    console.log('Sending students to backend:', students);

    const res = await fetch('/api/users/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ students }),
    });
    const data = await res.json();
    setBulkLoading(false);

    console.log('Bulk upload response:', data);

    if (data.success) {
      // Count successes and failures
      const failed = (data.results || []).filter((r: any) => !r.success);
      const succeeded = (data.results || []).filter((r: any) => r.success && !r.existed);
      const existed = (data.results || []).filter((r: any) => r.existed);

      let msg = `Bulk upload successful! ${succeeded.length} students created.`;
      if (existed.length > 0) {
        msg += ` ${existed.length} already existed.`;
      }
      if (failed.length > 0) {
        msg += ` ${failed.length} failed: `;
        msg += failed
          .map((f: any) => {
            // Try to get row number from student object, fallback to name
            const rowNum = (f.student?.__rownum__ ?? f.student?.__rowNum__ ?? f.student?.rownum ?? f.student?.rowNum ?? 0) + 2;
            return `Row ${rowNum || '?'} (${f.student?.name || 'Unknown'}): ${f.message}`;
          })
          .join('; ');
      }
      setMessage(msg);
    } else {
      setMessage(data.message || 'Bulk upload failed');
    }
    e.target.value = '';
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded shadow">
      <h1 className="text-2xl font-bold mb-4">Create Student</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          name="name"
          placeholder="Name"
          value={form.name}
          onChange={handleChange}
          required
          className="w-full border px-3 py-2 rounded"
        />
        <input
          name="email"
          placeholder="Email"
          value={form.email}
          onChange={handleChange}
          type="email"
          className="w-full border px-3 py-2 rounded"
        />
        <input
          name="password"
          placeholder="Password"
          value={form.password}
          onChange={handleChange}
          type="password"
          className="w-full border px-3 py-2 rounded"
        />
        <select
          name="class"
          value={form.class}
          onChange={handleChange}
          required
          className="w-full border px-3 py-2 rounded"
        >
          <option value="">Select Class</option>
          {classes.map(cls => (
            <option key={cls._id} value={cls._id}>
              {cls.name}
            </option>
          ))}
        </select>
        <input
          name="rollNumber"
          placeholder="Roll Number"
          value={form.rollNumber}
          onChange={handleChange}
          required
          className="w-full border px-3 py-2 rounded"
        />
        <input
          name="enrolledAt"
          placeholder="Enrolled At (YYYY-MM-DD)"
          value={form.enrolledAt}
          onChange={handleChange}
          type="date"
          className="w-full border px-3 py-2 rounded"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
        >
          {loading ? 'Creating...' : 'Create Student'}
        </button>
      </form>

      <div className="my-6 border-t pt-6">
        <label className="block font-semibold mb-2">Bulk Upload Students (CSV or Excel)</label>
        <input
          type="file"
          accept=".csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={handleBulkUpload}
          disabled={bulkLoading}
          className="block w-full text-sm text-slate-700 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
        <p className="text-xs text-slate-500 mt-2">
          CSV or Excel columns: <code>name,email,password,class,rollNumber,enrolledAt</code>
        </p>
        {bulkLoading && <div className="mt-2 text-blue-600">Uploading...</div>}
      </div>

      {message && <div className="mt-4 text-center">{message}</div>}
    </div>
  );
}