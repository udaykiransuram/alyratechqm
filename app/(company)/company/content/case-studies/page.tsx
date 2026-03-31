'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ui/use-toast';

interface Metric {
  label: string;
  before: string;
  after: string;
  improvement: string;
}

interface CaseStudy {
  _id: string;
  schoolName: string;
  location: string;
  studentCount: number;
  challenge: string;
  solution: string;
  results: string[];
  metrics: Metric[];
  testimonial?: {
    quote: string;
    author: string;
    role: string;
  };
  isFeatured: boolean;
  isActive: boolean;
  displayOrder: number;
}

export default function CaseStudiesAdmin() {
  const { toast } = useToast();
  const [caseStudies, setCaseStudies] = useState<CaseStudy[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    schoolName: '',
    location: '',
    studentCount: 0,
    challenge: '',
    solution: '',
    results: [''],
    metrics: [{ label: '', before: '', after: '', improvement: '' }],
    testimonial: {
      quote: '',
      author: '',
      role: '',
    },
    isFeatured: false,
    isActive: true,
    displayOrder: 1,
  });

  const fetchCaseStudies = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/case-studies');
      const data = await res.json();
      if (data.success) {
        setCaseStudies(data.data || []);
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to fetch case studies',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchCaseStudies();
  }, [fetchCaseStudies]);

  const resetForm = () => {
    setFormData({
      schoolName: '',
      location: '',
      studentCount: 0,
      challenge: '',
      solution: '',
      results: [''],
      metrics: [{ label: '', before: '', after: '', improvement: '' }],
      testimonial: {
        quote: '',
        author: '',
        role: '',
      },
      isFeatured: false,
      isActive: true,
      displayOrder: 1,
    });
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const url = editingId 
        ? `/api/admin/case-studies/${editingId}`
        : '/api/admin/case-studies';
      
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        toast({
          title: 'Success',
          description: `Case study ${editingId ? 'updated' : 'created'} successfully`,
        });
        resetForm();
        fetchCaseStudies();
      } else {
        const error = await res.json();
        throw new Error(error.error || 'Failed to save');
      }
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: (error as Error).message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (caseStudy: CaseStudy) => {
    setFormData({
      schoolName: caseStudy.schoolName,
      location: caseStudy.location,
      studentCount: caseStudy.studentCount,
      challenge: caseStudy.challenge,
      solution: caseStudy.solution,
      results: caseStudy.results,
      metrics: caseStudy.metrics,
      testimonial: caseStudy.testimonial || { quote: '', author: '', role: '' },
      isFeatured: caseStudy.isFeatured,
      isActive: caseStudy.isActive,
      displayOrder: caseStudy.displayOrder,
    });
    setEditingId(caseStudy._id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this case study?')) return;

    try {
      const res = await fetch(`/api/admin/case-studies/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast({
          title: 'Success',
          description: 'Case study deleted successfully',
        });
        fetchCaseStudies();
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to delete case study',
        variant: 'destructive',
      });
    }
  };

  const addResult = () => {
    setFormData({ ...formData, results: [...formData.results, ''] });
  };

  const removeResult = (index: number) => {
    const newResults = formData.results.filter((_, i) => i !== index);
    setFormData({ ...formData, results: newResults });
  };

  const updateResult = (index: number, value: string) => {
    const newResults = [...formData.results];
    newResults[index] = value;
    setFormData({ ...formData, results: newResults });
  };

  const addMetric = () => {
    setFormData({
      ...formData,
      metrics: [...formData.metrics, { label: '', before: '', after: '', improvement: '' }],
    });
  };

  const removeMetric = (index: number) => {
    const newMetrics = formData.metrics.filter((_, i) => i !== index);
    setFormData({ ...formData, metrics: newMetrics });
  };

  const updateMetric = (index: number, field: keyof Metric, value: string) => {
    const newMetrics = [...formData.metrics];
    newMetrics[index][field] = value;
    setFormData({ ...formData, metrics: newMetrics });
  };

  if (loading) {
    return (
      <div className="company-admin-page">
        <div className="company-admin-loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="company-admin-page">
      <div className="company-admin-header-block">
        <h1 className="company-admin-title">Manage Case Studies</h1>
        <p className="company-admin-description">Add, edit, or remove school success stories.</p>
      </div>

            {/* Form */}
      <form onSubmit={handleSubmit} className="company-admin-form">
        <h2 className="text-xl font-semibold text-foreground">
          {editingId ? 'Edit' : 'Add New'} Case Study
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="company-admin-field-label">
              School Name *
            </label>
            <input
              type="text"
              required
              value={formData.schoolName}
              onChange={(e) => setFormData({ ...formData, schoolName: e.target.value })}
            />
          </div>

          <div>
            <label className="company-admin-field-label">
              Location *
            </label>
            <input
              type="text"
              required
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            />
          </div>

          <div>
            <label className="company-admin-field-label">
              Student Count *
            </label>
            <input
              type="number"
              required
              value={formData.studentCount}
              onChange={(e) => setFormData({ ...formData, studentCount: parseInt(e.target.value) })}
            />
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

        <div>
          <label className="company-admin-field-label">
            Challenge *
          </label>
          <textarea
            required
            rows={3}
            value={formData.challenge}
            onChange={(e) => setFormData({ ...formData, challenge: e.target.value })}
          />
        </div>

        <div>
          <label className="company-admin-field-label">
            Solution *
          </label>
          <textarea
            required
            rows={3}
            value={formData.solution}
            onChange={(e) => setFormData({ ...formData, solution: e.target.value })}
          />
        </div>

        {/* Results */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="company-admin-field-label mb-0">Results *</label>
            <button
              type="button"
              onClick={addResult}
              className="company-admin-inline-add"
            >
              Add Result
            </button>
          </div>
          <div className="company-admin-inline-list">
            {formData.results.map((result, index) => (
              <div key={index} className="company-admin-inline-row">
              <input
                type="text"
                required
                value={result}
                onChange={(e) => updateResult(index, e.target.value)}
                placeholder={`Result ${index + 1}`}
                className="flex-1"
              />
              {formData.results.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeResult(index)}
                  className="company-admin-inline-remove"
                >
                  Remove
                </button>
              )}
              </div>
            ))}
          </div>
        </div>

        {/* Metrics */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="company-admin-field-label mb-0">Metrics</label>
            <button
              type="button"
              onClick={addMetric}
              className="company-admin-inline-add"
            >
              Add Metric
            </button>
          </div>
          <div className="company-admin-inline-list">
            {formData.metrics.map((metric, index) => (
              <div key={index} className="grid grid-cols-1 gap-2 md:grid-cols-4">
              <input
                type="text"
                value={metric.label}
                onChange={(e) => updateMetric(index, 'label', e.target.value)}
                placeholder="Label"
              />
              <input
                type="text"
                value={metric.before}
                onChange={(e) => updateMetric(index, 'before', e.target.value)}
                placeholder="Before"
              />
              <input
                type="text"
                value={metric.after}
                onChange={(e) => updateMetric(index, 'after', e.target.value)}
                placeholder="After"
              />
              <div className="flex gap-1">
                <input
                  type="text"
                  value={metric.improvement}
                  onChange={(e) => updateMetric(index, 'improvement', e.target.value)}
                  placeholder="Improvement"
                  className="flex-1"
                />
                {formData.metrics.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeMetric(index)}
                    className="company-admin-inline-icon-remove"
                  >
                    ✕
                  </button>
                )}
              </div>
              </div>
            ))}
          </div>
        </div>

        {/* Testimonial */}
        <div className="border-t border-border/60 pt-4">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Optional Testimonial</h3>
          <div className="space-y-3">
            <textarea
              rows={2}
              value={formData.testimonial.quote}
              onChange={(e) => setFormData({
                ...formData,
                testimonial: { ...formData.testimonial, quote: e.target.value }
              })}
              placeholder="Quote"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                value={formData.testimonial.author}
                onChange={(e) => setFormData({
                  ...formData,
                  testimonial: { ...formData.testimonial, author: e.target.value }
                })}
                placeholder="Author Name"
              />
              <input
                type="text"
                value={formData.testimonial.role}
                onChange={(e) => setFormData({
                  ...formData,
                  testimonial: { ...formData.testimonial, role: e.target.value }
                })}
                placeholder="Role"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 text-sm font-medium text-foreground">
            <input
              type="checkbox"
              checked={formData.isFeatured}
              onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
            />
            <span>Featured</span>
          </label>

          <label className="flex items-center gap-2 text-sm font-medium text-foreground">
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
            />
            <span>Active</span>
          </label>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="app-button-primary"
          >
            {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
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
      <div className="company-admin-surface">
        <h2 className="mb-4 text-xl font-semibold text-foreground">All Case Studies</h2>
        <div className="space-y-4">
          {caseStudies.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No case studies yet. Create one above!</p>
          ) : (
            caseStudies.map((cs) => (
              <div
                key={cs._id}
                className="company-admin-item-card"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-semibold text-foreground">{cs.schoolName}</h3>
                    <p className="text-sm text-muted-foreground">{cs.location} • {cs.studentCount} students</p>
                  </div>
                  <div className="flex gap-2">
                    {cs.isFeatured && (
                      <span className="company-admin-status-chip company-admin-status-chip-warning">
                        Featured
                      </span>
                    )}
                    <span className={`company-admin-status-chip ${
                      cs.isActive ? 'company-admin-status-chip-success' : 'company-admin-status-chip-muted'
                    }`}>
                      {cs.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                <p className="mb-2 line-clamp-2 text-sm text-muted-foreground">{cs.challenge}</p>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Order: {cs.displayOrder}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(cs)}
                      className="app-button-compact-secondary"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(cs._id)}
                      className="app-button-compact-secondary app-button-compact-danger"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
