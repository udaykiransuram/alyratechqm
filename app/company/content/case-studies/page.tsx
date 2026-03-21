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
      <div>
        <h1 className="text-3xl font-bold text-teal-900">Manage Case Studies</h1>
        <p className="text-teal-600 mt-2">Add, edit, or remove school success stories</p>
      </div>

            {/* Form */}
      <form onSubmit={handleSubmit} className="company-admin-form">
        <h2 className="text-xl font-semibold text-teal-900">
          {editingId ? 'Edit' : 'Add New'} Case Study
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-teal-900 mb-1">
              School Name *
            </label>
            <input
              type="text"
              required
              value={formData.schoolName}
              onChange={(e) => setFormData({ ...formData, schoolName: e.target.value })}
              className="w-full px-3 py-2 border border-teal-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-teal-900 mb-1">
              Location *
            </label>
            <input
              type="text"
              required
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full px-3 py-2 border border-teal-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-teal-900 mb-1">
              Student Count *
            </label>
            <input
              type="number"
              required
              value={formData.studentCount}
              onChange={(e) => setFormData({ ...formData, studentCount: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-teal-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-teal-900 mb-1">
              Display Order
            </label>
            <input
              type="number"
              value={formData.displayOrder}
              onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-teal-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-teal-900 mb-1">
            Challenge *
          </label>
          <textarea
            required
            rows={3}
            value={formData.challenge}
            onChange={(e) => setFormData({ ...formData, challenge: e.target.value })}
            className="w-full px-3 py-2 border border-teal-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-teal-900 mb-1">
            Solution *
          </label>
          <textarea
            required
            rows={3}
            value={formData.solution}
            onChange={(e) => setFormData({ ...formData, solution: e.target.value })}
            className="w-full px-3 py-2 border border-teal-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        {/* Results */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium text-teal-900">Results *</label>
            <button
              type="button"
              onClick={addResult}
              className="text-sm text-teal-600 hover:text-teal-700"
            >
              + Add Result
            </button>
          </div>
          {formData.results.map((result, index) => (
            <div key={index} className="flex gap-2 mb-2">
              <input
                type="text"
                required
                value={result}
                onChange={(e) => updateResult(index, e.target.value)}
                placeholder={`Result ${index + 1}`}
                className="flex-1 px-3 py-2 border border-teal-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              {formData.results.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeResult(index)}
                  className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-md"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Metrics */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium text-teal-900">Metrics</label>
            <button
              type="button"
              onClick={addMetric}
              className="text-sm text-teal-600 hover:text-teal-700"
            >
              + Add Metric
            </button>
          </div>
          {formData.metrics.map((metric, index) => (
            <div key={index} className="grid grid-cols-4 gap-2 mb-2">
              <input
                type="text"
                value={metric.label}
                onChange={(e) => updateMetric(index, 'label', e.target.value)}
                placeholder="Label"
                className="px-3 py-2 border border-teal-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <input
                type="text"
                value={metric.before}
                onChange={(e) => updateMetric(index, 'before', e.target.value)}
                placeholder="Before"
                className="px-3 py-2 border border-teal-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <input
                type="text"
                value={metric.after}
                onChange={(e) => updateMetric(index, 'after', e.target.value)}
                placeholder="After"
                className="px-3 py-2 border border-teal-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <div className="flex gap-1">
                <input
                  type="text"
                  value={metric.improvement}
                  onChange={(e) => updateMetric(index, 'improvement', e.target.value)}
                  placeholder="Improvement"
                  className="flex-1 px-3 py-2 border border-teal-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                {formData.metrics.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeMetric(index)}
                    className="px-2 text-red-600 hover:bg-red-50 rounded-md"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Testimonial */}
        <div className="border-t border-teal-200 pt-4">
          <h3 className="text-sm font-medium text-teal-900 mb-3">Optional Testimonial</h3>
          <div className="space-y-3">
            <textarea
              rows={2}
              value={formData.testimonial.quote}
              onChange={(e) => setFormData({
                ...formData,
                testimonial: { ...formData.testimonial, quote: e.target.value }
              })}
              placeholder="Quote"
              className="w-full px-3 py-2 border border-teal-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
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
                className="px-3 py-2 border border-teal-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <input
                type="text"
                value={formData.testimonial.role}
                onChange={(e) => setFormData({
                  ...formData,
                  testimonial: { ...formData.testimonial, role: e.target.value }
                })}
                placeholder="Role"
                className="px-3 py-2 border border-teal-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.isFeatured}
              onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
              className="w-4 h-4 text-teal-600 border-teal-300 rounded focus:ring-teal-500"
            />
            <span className="text-sm text-teal-900">Featured</span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="w-4 h-4 text-teal-600 border-teal-300 rounded focus:ring-teal-500"
            />
            <span className="text-sm text-teal-900">Active</span>
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
        <h2 className="text-xl font-semibold text-teal-900 mb-4">All Case Studies</h2>
        <div className="space-y-4">
          {caseStudies.length === 0 ? (
            <p className="text-teal-600 text-center py-8">No case studies yet. Create one above!</p>
          ) : (
            caseStudies.map((cs) => (
              <div
                key={cs._id}
                className="border border-teal-200 rounded-lg p-4 hover:border-teal-400 transition-colors"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-semibold text-teal-900">{cs.schoolName}</h3>
                    <p className="text-sm text-teal-600">{cs.location} • {cs.studentCount} students</p>
                  </div>
                  <div className="flex gap-2">
                    {cs.isFeatured && (
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">
                        Featured
                      </span>
                    )}
                    <span className={`px-2 py-1 text-xs rounded ${
                      cs.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {cs.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-teal-700 mb-2 line-clamp-2">{cs.challenge}</p>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-teal-500">Order: {cs.displayOrder}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(cs)}
                      className="px-3 py-1 text-sm text-teal-600 hover:bg-teal-50 rounded"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(cs._id)}
                      className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
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
