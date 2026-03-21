'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ui/use-toast';

type Testimonial = {
  _id?: string;
  section: 'homepage' | 'benefits' | 'product' | 'casestudy';
  quote: string;
  author: string;
  role: string;
  school?: string;
  location?: string;
  rating?: number;
  isActive: boolean;
  displayOrder: number;
};

const sections = [
  { value: 'homepage', label: 'Homepage' },
  { value: 'benefits', label: 'Benefits Page' },
  { value: 'product', label: 'Product Page' },
  { value: 'casestudy', label: 'Case Study Page' },
];

export default function TestimonialsPage() {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Testimonial>({
    section: 'homepage',
    quote: '',
    author: '',
    role: '',
    school: '',
    location: '',
    rating: 5,
    isActive: true,
    displayOrder: 0,
  });
  const { toast } = useToast();

  const fetchTestimonials = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/testimonials');
      const data = await res.json();
      if (data.success) {
        setTestimonials(data.data);
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to fetch testimonials',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchTestimonials();
  }, [fetchTestimonials]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const url = editingId
        ? `/api/admin/testimonials/${editingId}`
        : '/api/admin/testimonials';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (data.success) {
        toast({
          title: 'Success',
          description: editingId ? 'Testimonial updated' : 'Testimonial added',
        });
        fetchTestimonials();
        resetForm();
      } else {
        throw new Error(data.error);
      }
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: (error as Error).message || 'Failed to save testimonial',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (testimonial: Testimonial) => {
    setFormData(testimonial);
    setEditingId(testimonial._id || null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this testimonial?')) return;

    try {
      const res = await fetch(`/api/admin/testimonials/${id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (data.success) {
        toast({
          title: 'Success',
          description: 'Testimonial deleted',
        });
        fetchTestimonials();
      } else {
        throw new Error(data.error);
      }
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: (error as Error).message || 'Failed to delete testimonial',
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setFormData({
      section: 'homepage',
      quote: '',
      author: '',
      role: '',
      school: '',
      location: '',
      rating: 5,
      isActive: true,
      displayOrder: 0,
    });
    setEditingId(null);
  };

  return (
    <div className="company-admin-page">
      <div className="company-admin-header-block">
        <h2 className="company-admin-title">Testimonials Management</h2>
        <p className="company-admin-description">
          Add, edit, or remove customer testimonials
        </p>
      </div>

            {/* Form */}
      <form onSubmit={handleSubmit} className="company-admin-form">
        <h3 className="mb-4 text-lg font-bold text-teal-950 dark:text-teal-50">
          {editingId ? 'Edit Testimonial' : 'Add New Testimonial'}
        </h3>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-teal-900 dark:text-teal-100">
              Section *
            </label>
            <select
              value={formData.section}
              onChange={(e) => setFormData({ ...formData, section: e.target.value as 'homepage' | 'benefits' | 'product' | 'casestudy' })}
              className="w-full rounded border border-teal-200 bg-white px-3 py-2 text-teal-950 dark:border-teal-600 dark:bg-teal-900 dark:text-teal-50"
              required
            >
              {sections.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-teal-900 dark:text-teal-100">
              Author Name *
            </label>
            <input
              type="text"
              value={formData.author}
              onChange={(e) => setFormData({ ...formData, author: e.target.value })}
              className="w-full rounded border border-teal-200 bg-white px-3 py-2 text-teal-950 dark:border-teal-600 dark:bg-teal-900 dark:text-teal-50"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-teal-900 dark:text-teal-100">
              Role/Designation *
            </label>
            <input
              type="text"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              placeholder="e.g., Principal, Parent, Teacher"
              className="w-full rounded border border-teal-200 bg-white px-3 py-2 text-teal-950 dark:border-teal-600 dark:bg-teal-900 dark:text-teal-50"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-teal-900 dark:text-teal-100">
              School Name
            </label>
            <input
              type="text"
              value={formData.school || ''}
              onChange={(e) => setFormData({ ...formData, school: e.target.value })}
              className="w-full rounded border border-teal-200 bg-white px-3 py-2 text-teal-950 dark:border-teal-600 dark:bg-teal-900 dark:text-teal-50"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-teal-900 dark:text-teal-100">
              Location
            </label>
            <input
              type="text"
              value={formData.location || ''}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="e.g., Mumbai, Maharashtra"
              className="w-full rounded border border-teal-200 bg-white px-3 py-2 text-teal-950 dark:border-teal-600 dark:bg-teal-900 dark:text-teal-50"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-teal-900 dark:text-teal-100">
              Rating (1-5)
            </label>
            <input
              type="number"
              min="1"
              max="5"
              value={formData.rating || 5}
              onChange={(e) => setFormData({ ...formData, rating: parseInt(e.target.value) })}
              className="w-full rounded border border-teal-200 bg-white px-3 py-2 text-teal-950 dark:border-teal-600 dark:bg-teal-900 dark:text-teal-50"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-teal-900 dark:text-teal-100">
              Quote/Testimonial *
            </label>
            <textarea
              value={formData.quote}
              onChange={(e) => setFormData({ ...formData, quote: e.target.value })}
              rows={4}
              className="w-full rounded border border-teal-200 bg-white px-3 py-2 text-teal-950 dark:border-teal-600 dark:bg-teal-900 dark:text-teal-50"
              required
            />
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm font-medium text-teal-900 dark:text-teal-100">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="h-4 w-4 rounded border-teal-300"
              />
              Active (visible on site)
            </label>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-teal-900 dark:text-teal-100">
              Display Order
            </label>
            <input
              type="number"
              value={formData.displayOrder}
              onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) })}
              className="w-full rounded border border-teal-200 bg-white px-3 py-2 text-teal-950 dark:border-teal-600 dark:bg-teal-900 dark:text-teal-50"
            />
          </div>
        </div>

        <div className="mt-4 flex gap-3">
          <button
            type="submit"
            className="app-button-primary"
          >
            {editingId ? 'Update' : 'Add'} Testimonial
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="app-button-secondary"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* List */}
      <div>
        <h3 className="mb-4 text-lg font-bold text-teal-950 dark:text-teal-50">Existing Testimonials</h3>

        {loading ? (
          <div className="company-admin-loading">Loading...</div>
        ) : testimonials.length === 0 ? (
          <div className="company-admin-empty">
            No testimonials yet. Add one above!
          </div>
        ) : (
          <div className="space-y-4">
            {testimonials.map((t) => (
              <div
                key={t._id}
                className="company-admin-section"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="rounded bg-teal-100 px-2 py-0.5 text-xs font-semibold text-teal-700 dark:bg-teal-800 dark:text-teal-200">
                        {t.section}
                      </span>
                      {!t.isActive && (
                        <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                          Inactive
                        </span>
                      )}
                      <span className="text-xs text-teal-600">Order: {t.displayOrder}</span>
                    </div>
                    <p className="italic text-teal-800 dark:text-teal-200">&quot;{t.quote}&quot;</p>
                    <div className="mt-2 text-sm text-teal-700 dark:text-teal-300">
                      — <strong>{t.author}</strong>, {t.role}
                      {t.school && <> • {t.school}</>}
                      {t.location && <> • {t.location}</>}
                    </div>
                  </div>
                  <div className="ml-4 flex gap-2">
                    <button
                      onClick={() => handleEdit(t)}
                      className="rounded bg-teal-600 px-3 py-1 text-sm font-semibold text-white hover:bg-teal-700"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(t._id!)}
                      className="rounded bg-red-500 px-3 py-1 text-sm font-semibold text-white hover:bg-red-600"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
