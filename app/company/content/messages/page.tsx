'use client';

import { useEffect, useState, useCallback } from 'react';

type Message = {
  _id: string;
  name: string;
  email: string;
  institution?: string;
  message: string;
  read: boolean;
  createdAt: string;
};

export default function AdminMessagesPage() {
  const [items, setItems] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize] = useState(20);
  const [filter, setFilter] = useState<'all'|'true'|'false'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/messages?page=${page}&pageSize=${pageSize}&read=${filter}`);
    const data = await res.json();
    if (data.success) {
      setItems(data.data);
      setTotal(data.total);
    }
    setLoading(false);
  }, [page, pageSize, filter]);

  useEffect(() => { load(); }, [load]);

  async function toggleRead(id: string, read: boolean) {
    const res = await fetch('/api/admin/messages', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, read }) });
    const data = await res.json();
    if (data.success) load();
  }

  async function remove(id: string) {
    if (!confirm('Delete this message?')) return;
    const res = await fetch(`/api/admin/messages?id=${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) load();
  }

  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  return (
    <div className="company-admin-page">
      <div className="company-admin-header">
        <div>
          <h2 className="company-admin-title">Contact Messages</h2>
          <p className="company-admin-description">View and manage inquiries sent from the Contact page.</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={filter}
            onChange={(e) => {
              const v = e.target.value;
              if (v === 'all' || v === 'true' || v === 'false') setFilter(v);
            }}
            className="rounded border border-teal-200 bg-white px-3 py-2 text-sm dark:border-teal-800 dark:bg-teal-900"
          >
            <option value="all">All</option>
            <option value="false">Unread</option>
            <option value="true">Read</option>
          </select>
          <div className="text-sm text-teal-700 dark:text-teal-300">Page {page} / {totalPages}</div>
          <div className="flex gap-2">
            <button disabled={page<=1} onClick={() => setPage(p=>Math.max(1,p-1))} className="app-button-primary disabled:opacity-50">Prev</button>
            <button disabled={page>=totalPages} onClick={() => setPage(p=>Math.min(totalPages,p+1))} className="app-button-primary disabled:opacity-50">Next</button>
          </div>
        </div>
      </div>

      <div className="company-admin-table-wrap">
        <table className="min-w-full divide-y divide-teal-200 dark:divide-teal-800">
          <thead className="bg-teal-50 dark:bg-teal-900/40">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-teal-700 dark:text-teal-200">From</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-teal-700 dark:text-teal-200">Institution</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-teal-700 dark:text-teal-200">Message</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-teal-700 dark:text-teal-200">Date</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-teal-700 dark:text-teal-200">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-teal-100 dark:divide-teal-800 bg-white dark:bg-teal-950">
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-teal-700 dark:text-teal-300">Loading...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-teal-700 dark:text-teal-300">No messages</td></tr>
            ) : (
              items.map(msg => (
                <tr key={msg._id} className={!msg.read ? 'bg-teal-50/40 dark:bg-teal-900/20' : ''}>
                  <td className="px-4 py-3 align-top">
                    <div className="font-semibold text-teal-900 dark:text-teal-50">{msg.name}</div>
                    <a href={`mailto:${msg.email}`} className="text-xs text-teal-700 underline dark:text-teal-300">{msg.email}</a>
                  </td>
                  <td className="px-4 py-3 align-top text-sm text-teal-800 dark:text-teal-200">{msg.institution || '—'}</td>
                  <td className="px-4 py-3 align-top text-sm text-teal-800 dark:text-teal-200 max-w-md">{msg.message}</td>
                  <td className="px-4 py-3 align-top text-xs text-teal-700 dark:text-teal-300 whitespace-normal break-words">{new Date(msg.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3 align-top text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => toggleRead(msg._id, !msg.read)} className={`rounded px-3 py-1 text-xs font-semibold ${msg.read ? 'bg-teal-100 text-teal-800 dark:bg-teal-800 dark:text-teal-100' : 'bg-emerald-600 text-white'}`}>{msg.read ? 'Mark Unread' : 'Mark Read'}</button>
                      <button onClick={() => remove(msg._id)} className="rounded px-3 py-1 text-xs font-semibold bg-red-600 text-white">Delete</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
