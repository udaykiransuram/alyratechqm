'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Edit, Trash2 } from 'lucide-react';

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
    <div className="company-admin-page app-directory-stack">
      <div className="company-admin-header-block app-surface app-section-header">
        <h2 className="company-admin-title">Testimonials Management</h2>
        <p className="company-admin-description">
          Add, edit, or remove customer testimonials
        </p>
      </div>

            {/* Form */}
      <form onSubmit={handleSubmit} className="company-admin-form app-surface app-section-body">
        <h3 className="mb-4 text-lg font-bold text-foreground">
          {editingId ? 'Edit Testimonial' : 'Add New Testimonial'}
        </h3>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="company-admin-field-label">
              Section *
            </label>
            <select
              value={formData.section}
              onChange={(e) => setFormData({ ...formData, section: e.target.value as 'homepage' | 'benefits' | 'product' | 'casestudy' })}
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
            <label className="company-admin-field-label">
              Author Name *
            </label>
            <input
              type="text"
              value={formData.author}
              onChange={(e) => setFormData({ ...formData, author: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="company-admin-field-label">
              Role/Designation *
            </label>
            <input
              type="text"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              placeholder="e.g., Principal, Parent, Teacher"
              required
            />
          </div>

          <div>
            <label className="company-admin-field-label">
              School Name
            </label>
            <input
              type="text"
              value={formData.school || ''}
              onChange={(e) => setFormData({ ...formData, school: e.target.value })}
            />
          </div>

          <div>
            <label className="company-admin-field-label">
              Location
            </label>
            <input
              type="text"
              value={formData.location || ''}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="e.g., Mumbai, Maharashtra"
            />
          </div>

          <div>
            <label className="company-admin-field-label">
              Rating (1-5)
            </label>
            <input
              type="number"
              min="1"
              max="5"
              value={formData.rating || 5}
              onChange={(e) => setFormData({ ...formData, rating: parseInt(e.target.value) })}
            />
          </div>

          <div className="md:col-span-2">
            <label className="company-admin-field-label">
              Quote/Testimonial *
            </label>
            <textarea
              value={formData.quote}
              onChange={(e) => setFormData({ ...formData, quote: e.target.value })}
              rows={4}
              required
            />
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              />
              Active (visible on site)
            </label>
          </div>

          <div>
            <label className="company-admin-field-label">
              Display Order
            </label>
            <input
              type="number"
              value={formData.displayOrder}
              onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) })}
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
      <div className="app-surface app-section-body">
        <h3 className="mb-4 text-lg font-bold text-foreground">Existing Testimonials</h3>

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
                className="company-admin-item-card"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="company-admin-status-chip">
                        {t.section}
                      </span>
                      {!t.isActive && (
                        <span className="company-admin-status-chip border-rose-200 bg-rose-50 text-rose-700">
                          Inactive
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">Order: {t.displayOrder}</span>
                    </div>
                    <p className="italic text-foreground">&quot;{t.quote}&quot;</p>
                    <div className="mt-2 text-sm text-muted-foreground">
                      — <strong>{t.author}</strong>, {t.role}
                      {t.school && <> • {t.school}</>}
                      {t.location && <> • {t.location}</>}
                    </div>
                  </div>
                  <div className="ml-4">
                    <div className="app-row-action-group">
                      <Button
                        variant="outline"
                        size="sm"
                        className="app-row-action-button app-row-action-button-accent"
                        onClick={() => handleEdit(t)}
                        title="Edit testimonial"
                        aria-label="Edit testimonial"
                      >
                        <Edit className="h-4 w-4" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="app-row-action-button app-row-action-button-danger"
                        onClick={() => handleDelete(t._id!)}
                        title="Delete testimonial"
                        aria-label="Delete testimonial"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    </div>
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
