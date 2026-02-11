"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface ClassItem { _id: string; name: string }

export default function EditStudentPage() {
  const params = useParams();
  const router = useRouter();
  const id = (params?.id as string) || '';

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    class: '',
    rollNumber: '',
    enrolledAt: '',
  });

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const [uRes, cRes] = await Promise.all([
          fetch('/api/users/' + id),
          fetch('/api/classes'),
        ]);
        const uJson = await uRes.json();
        const cJson = await cRes.json();
        if (!mounted) return;
        if (!uJson.success) throw new Error(uJson.message || 'Failed to load user');
        if (!cJson.success) throw new Error(cJson.message || 'Failed to load classes');
        const u = uJson.user || {};
        setForm({
          name: u.name || '',
          email: u.email || '',
          password: '',
          class: u.class ? String(u.class) : '',
          rollNumber: u.rollNumber || '',
          enrolledAt: u.enrolledAt ? new Date(u.enrolledAt).toISOString().split('T')[0] : '',
        });
        setClasses(cJson.classes || []);
      } catch (e: any) {
        setError(e.message || 'Failed to load');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    if (id) load();
    return () => { mounted = false };
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch('/api/users/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          role: 'student',
          email: form.email.trim(),
          password: form.password || undefined,
          class: form.class,
          rollNumber: form.rollNumber.trim(),
          enrolledAt: form.enrolledAt ? new Date(form.enrolledAt) : undefined,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to update');
      setMessage('Student updated successfully.');
      setTimeout(() => router.push('/students/' + id), 600);
    } catch (e: any) {
      setError(e.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="max-w-md mx-auto mt-10">Loading…</div>;
  if (error) return <div className="max-w-md mx-auto mt-10 text-destructive">{error}</div>;

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded shadow">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Edit Student</h1>
        <button onClick={() => router.back()} className="text-sm text-blue-600">Back</button>
      </div>
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
          placeholder="New Password (optional)"
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
            <option key={cls._id} value={cls._id}>{cls.name}</option>
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
          disabled={saving}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-70"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </form>
      {message && <div className="mt-4 text-center text-green-600">{message}</div>}
      {error && <div className="mt-2 text-center text-red-600">{error}</div>}
    </div>
  );
}
