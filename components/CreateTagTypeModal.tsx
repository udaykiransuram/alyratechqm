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

const getSchoolKey = () => {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(/(?:^|; )schoolKey=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
};

const getSchoolQS = () => {
  const schoolKey = getSchoolKey();
  return schoolKey ? `?school=${encodeURIComponent(schoolKey)}` : '';
};

export function CreateTagTypeModal({ open, onClose, onTagTypeCreated }: CreateTagTypeModalProps) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleDialogChange = (nextOpen: boolean) => {
    if (!nextOpen && !loading) {
      setName('');
      onClose();
    }
  };

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast({
        title: 'Validation Error',
        description: 'Tag type name cannot be empty.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/tag-types' + getSchoolQS(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data?.success) {
        toast({
          title: 'Tag type created',
          description: `"${data.tagType.name}" is ready to use.`,
        });
        onTagTypeCreated(data.tagType);
        setName('');
        onClose();
      } else {
        const message = data?.message || `Failed to create tag type (HTTP ${res.status}).`;
        toast({ title: 'Error', description: message, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Network Error', description: 'Failed to create tag type.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-left">
          <DialogTitle>Create New Tag Type</DialogTitle>
          <DialogDescription>
            Define a reusable category for tags, such as difficulty, topic, or skill area.
          </DialogDescription>
        </DialogHeader>

        <div className="app-field-group">
          <Label htmlFor="new-tag-type-name" className="app-field-label">
            Tag Type Name
          </Label>
          <Input
            id="new-tag-type-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g., Difficulty"
            disabled={loading}
          />
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" onClick={() => handleDialogChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? <Spinner /> : 'Create Tag Type'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
