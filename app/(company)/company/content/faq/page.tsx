'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

type Page = 'homepage' | 'product' | 'about' | 'benefits' | 'talent-test' | 'case-study' | 'contact';

interface FAQItem {
  _id?: string;
  page: Page;
  question: string;
  answer: string;
  displayOrder: number;
  isActive: boolean;
}

const pages: { value: Page; label: string }[] = [
  { value: 'homepage', label: 'Homepage' },
  { value: 'product', label: 'Product' },
  { value: 'about', label: 'About' },
  { value: 'benefits', label: 'Benefits' },
  { value: 'talent-test', label: 'Talent Test' },
  { value: 'case-study', label: 'Case Study' },
  { value: 'contact', label: 'Contact' },
];

const PAGE_REFLECTS: Record<Page, string> = {
  homepage: '/ (Homepage) — FAQ section below testimonials',
  product: '/product — FAQ section (not yet wired)',
  about: '/about — FAQ section (not yet wired)',
  benefits: '/benefits — FAQ section (not yet wired)',
  'talent-test': '/talent-test — FAQ accordion section',
  'case-study': '/case-study — FAQ section (not yet wired)',
  contact: '/contact — FAQ section at bottom',
};

export default function FAQManagementPage() {
  const [selectedPage, setSelectedPage] = useState<Page>('homepage');
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchFaqs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/faq?page=${selectedPage}`);
      const data = await res.json();
      if (data.success) {
        setFaqs(data.data || []);
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to fetch FAQs', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [selectedPage, toast]);

  useEffect(() => {
    fetchFaqs();
  }, [fetchFaqs]);

  const addNew = () => {
    setFaqs(prev => [
      ...prev,
      { page: selectedPage, question: '', answer: '', displayOrder: prev.length, isActive: true },
    ]);
  };

  const handleChange = (index: number, field: keyof FAQItem, value: string | number | boolean) => {
    setFaqs(prev => prev.map((f, i) => (i === index ? { ...f, [field]: value } : f)));
  };

  const saveFaq = async (index: number) => {
    const faq = faqs[index];
    if (!faq.question.trim() || !faq.answer.trim()) {
      toast({ title: 'Validation', description: 'Question and answer are required', variant: 'destructive' });
      return;
    }
    setSaving(String(index));
    try {
      if (faq._id) {
        // Update
        const res = await fetch(`/api/admin/faq/${faq._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(faq),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message);
        toast({ title: 'Saved', description: 'FAQ updated' });
      } else {
        // Create
        const res = await fetch('/api/admin/faq', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(faq),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message);
        // Update local state with server-assigned _id
        setFaqs(prev => prev.map((f, i) => (i === index ? { ...f, _id: data.data._id } : f)));
        toast({ title: 'Created', description: 'FAQ added' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to save FAQ', variant: 'destructive' });
    } finally {
      setSaving(null);
    }
  };

  const deleteFaq = async (index: number) => {
    const faq = faqs[index];
    if (!faq._id) {
      // Not saved yet, just remove locally
      setFaqs(prev => prev.filter((_, i) => i !== index));
      return;
    }
    if (!confirm('Delete this FAQ?')) return;
    try {
      const res = await fetch(`/api/admin/faq/${faq._id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setFaqs(prev => prev.filter((_, i) => i !== index));
        toast({ title: 'Deleted', description: 'FAQ removed' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to delete', variant: 'destructive' });
    }
  };

  return (
    <div className="company-admin-page app-directory-stack">
      <div className="company-admin-header app-surface app-section-header">
        <div>
          <h2 className="company-admin-title">FAQ Management</h2>
          <p className="company-admin-description">
            Manage frequently asked questions for each page.
          </p>
        </div>
        <button
          onClick={addNew}
          className="app-button-primary"
        >
          + Add FAQ
        </button>
      </div>

      {/* Page selector */}
      <div className="company-admin-tabs app-surface app-section-body">
        {pages.map(p => (
          <button
            key={p.value}
            onClick={() => setSelectedPage(p.value)}
            className={`company-admin-tab ${selectedPage === p.value ? 'company-admin-tab-active' : ''}`}
          >
            {p.label}
          </button>
        ))}
      </div>

            {loading ? (
        <div className="company-admin-loading">Loading...</div>
      ) : faqs.length === 0 ? (
        <div className="company-admin-empty">
          <p className="text-muted-foreground">No FAQs for this page yet.</p>
          <button onClick={addNew} className="text-sm font-medium text-primary underline underline-offset-4">
            Add your first FAQ
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {faqs.map((faq, index) => (
            <div key={faq._id || `new-${index}`} className="company-admin-surface">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm font-bold text-primary">FAQ #{index + 1}</span>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <input
                      type="checkbox"
                      checked={faq.isActive}
                      onChange={e => handleChange(index, 'isActive', e.target.checked)}
                    />
                    Active
                  </label>
                  <input
                    type="number"
                    value={faq.displayOrder}
                    onChange={e => handleChange(index, 'displayOrder', parseInt(e.target.value) || 0)}
                    className="app-control-compact w-20"
                    placeholder="Order"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="company-admin-field-label">Question</label>
                  <input
                    type="text"
                    value={faq.question}
                    onChange={e => handleChange(index, 'question', e.target.value)}
                    placeholder="Enter the question..."
                  />
                </div>
                <div>
                  <label className="company-admin-field-label">Answer</label>
                  <textarea
                    value={faq.answer}
                    onChange={e => handleChange(index, 'answer', e.target.value)}
                    placeholder="Enter the answer..."
                    rows={3}
                  />
                </div>
              </div>

              <div className="mt-4 flex justify-end items-center gap-3">
                <div className="app-row-action-group">
                  <Button
                    variant="outline"
                    size="sm"
                    className="app-row-action-button app-row-action-button-danger"
                    onClick={() => deleteFaq(index)}
                    title="Delete FAQ"
                    aria-label="Delete FAQ"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </div>
                <button
                  onClick={() => saveFaq(index)}
                  disabled={saving === String(index)}
                  className="app-button-primary"
                >
                  {saving === String(index) ? 'Saving...' : faq._id ? 'Update' : 'Save'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
