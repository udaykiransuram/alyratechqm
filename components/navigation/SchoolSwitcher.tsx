
"use client";
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function SchoolSwitcher() {
  // Avoid SSR mismatch by rendering only after mount
  
  const [schools, setSchools] = useState<{key:string, displayName:string}[]>([]);
  const [mounted, setMounted] = useState(false);
  const [current, setCurrent] = useState<string>('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ key: '', displayName: '' });

  async function load() {
    const res = await fetch('/api/schools');
    const json = await res.json();
    if (json.success) setSchools(json.schools);
  }
  useEffect(() => {
    setMounted(true);
    load();
    try {
      const m = document.cookie.match(/(?:^|; )schoolKey=([^;]+)/);
      if (m && m[1]) setCurrent(m[1]);
    } catch {}
  }, []);

  function setCookie(name: string, value: string) {
    document.cookie = name + '=' + value + '; path=/; max-age=31536000';
  }

  function onSelect(val: string) {
    setCurrent(val);
    setCookie('schoolKey', val);
    // Optional: reload to ensure headers/cookies are read on server routes
    window.location.reload();
  }

  async function createSchool() {
    if (!form.key || !form.displayName) return;
    const res = await fetch('/api/schools', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const json = await res.json();
    if (json.success) {
      setForm({ key: '', displayName: '' });
      setOpen(false);
      await load();
    } else {
      alert(json.message || 'Failed to create school');
    }
  }

  if (!mounted) return null;

  return (
    <div className="flex items-center gap-2">
      <Select value={current} onValueChange={onSelect}>
        <SelectTrigger className="w-48 h-9"><SelectValue placeholder="Select school" /></SelectTrigger>
        <SelectContent>
          {schools.map(s => (
            <SelectItem key={s.key} value={s.key}>{s.displayName} ({s.key})</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">New School</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Create School</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="School key (e.g., alpha-high)" value={form.key} onChange={(e) => setForm(f => ({...f, key: e.target.value}))} />
            <Input placeholder="Display name" value={form.displayName} onChange={(e) => setForm(f => ({...f, displayName: e.target.value}))} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={createSchool}>Create</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
