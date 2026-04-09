'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Mail, Trash2 } from 'lucide-react';

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
    <div className="company-admin-page app-directory-stack">
      <div className="company-admin-header app-surface app-section-header">
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
            className="app-control-compact w-[8.5rem]"
          >
            <option value="all">All</option>
            <option value="false">Unread</option>
            <option value="true">Read</option>
          </select>
          <div className="app-meta-chip">Page {page} / {totalPages}</div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="app-button-compact"
              disabled={page<=1}
              onClick={() => setPage(p=>Math.max(1,p-1))}
            >
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="app-button-compact"
              disabled={page>=totalPages}
              onClick={() => setPage(p=>Math.min(totalPages,p+1))}
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      <div className="company-admin-table-wrap app-surface app-section-body">
        <table className="min-w-full">
          <thead>
            <tr>
              <th>From</th>
              <th>Institution</th>
              <th>Message</th>
              <th>Date</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Loading...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">No messages</td></tr>
            ) : (
              items.map(msg => (
                <tr key={msg._id} className={!msg.read ? 'bg-primary/5' : ''}>
                  <td className="px-4 py-3 align-top">
                    <div className="font-semibold text-foreground">{msg.name}</div>
                    <a href={`mailto:${msg.email}`} className="text-xs text-primary underline">{msg.email}</a>
                  </td>
                  <td className="px-4 py-3 align-top text-sm text-foreground">{msg.institution || '—'}</td>
                  <td className="max-w-md px-4 py-3 align-top text-sm text-foreground">{msg.message}</td>
                  <td className="whitespace-normal break-words px-4 py-3 align-top text-xs text-muted-foreground">{new Date(msg.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3 align-top text-right">
                    <div className="app-row-action-group justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        className="app-row-action-button"
                        onClick={() => toggleRead(msg._id, !msg.read)}
                      >
                        <Mail className="h-4 w-4" />
                        {msg.read ? 'Mark Unread' : 'Mark Read'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="app-row-action-button app-row-action-button-danger"
                        onClick={() => remove(msg._id)}
                        title="Delete message"
                        aria-label="Delete message"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
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
