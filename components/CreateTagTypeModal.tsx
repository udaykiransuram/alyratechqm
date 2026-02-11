'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Spinner } from './ui/spinner';

interface CreateTagTypeModalProps {
  open: boolean;
  onClose: () => void;
  onTagTypeCreated: (newTagType: { _id: string; name: string }) => void;
}

// Ensure tenant context is sent from client
const getSchoolKey = () => {
  if (typeof document === 'undefined') return '';
  const m = document.cookie.match(/(?:^|; )schoolKey=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : '';
};
const getSchoolQS = () => {
  const k = getSchoolKey();
  return k ? `?school=${encodeURIComponent(k)}` : '';
};

export function CreateTagTypeModal({ open, onClose, onTagTypeCreated }: CreateTagTypeModalProps) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast({ title: 'Validation Error', description: 'Tag type name cannot be empty.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/tag-types' + getSchoolQS(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ name: trimmed })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success) {
        toast({ title: 'Success', description: `Tag type "${data.tagType.name}" created.` });
        onTagTypeCreated(data.tagType);
        setName('');
        onClose();
      } else {
        const message = data?.message || `Failed to create tag type (HTTP ${res.status}).`;
        toast({ title: 'Error', description: message, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Network Error', description: 'Failed to create tag type.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Tag Type</DialogTitle>
          <DialogDescription>
            Define a new category for your tags, like "Difficulty" or "Topic".
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-4">
          <Label htmlFor="new-tag-type-name">Tag Type Name</Label>
          <Input
            id="new-tag-type-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Difficulty"
            disabled={loading}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Spinner />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
