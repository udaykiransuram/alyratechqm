'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ui/use-toast';

export default function TalentTestAdmin() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    name: 'Precision Baseline Assessment',
    description: 'Comprehensive diagnostic test to identify student strengths and areas for improvement',
    price: 100,
    currency: 'INR',
    duration: '45 minutes',
    subjects: ['Mathematics', 'Science', 'English'],
    features: [
      'Detailed diagnostic report',
      'Personalized learning recommendations',
      'Subject-wise performance analysis',
      'Instant results delivery via email',
    ],
    isActive: true,
    registrationsOpen: '',
    registrationDeadline: '',
    testWindowStart: '',
    testWindowEnd: '',
    resultsDate: '',
  });

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/talent-test');
      const data = await res.json();
      if (data.success && data.data) {
        const config = data.data;
        // normalize dates -> yyyy-mm-dd for <input type="date">
        const toDateInput = (d?: string | Date) => (d ? new Date(d).toISOString().slice(0, 10) : '');
        setFormData({
          name: config.name,
          description: config.description,
          price: config.price,
          currency: config.currency,
          duration: config.duration,
          subjects: config.subjects,
          features: config.features,
          isActive: config.isActive,
          registrationsOpen: toDateInput(config.registrationsOpen),
          registrationDeadline: toDateInput(config.registrationDeadline),
          testWindowStart: toDateInput(config.testWindowStart),
          testWindowEnd: toDateInput(config.testWindowEnd),
          resultsDate: toDateInput(config.resultsDate),
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to fetch test configuration',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch('/api/admin/talent-test', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          // empty strings -> undefined to avoid overwriting with invalid dates
          registrationsOpen: formData.registrationsOpen || undefined,
          registrationDeadline: formData.registrationDeadline || undefined,
          testWindowStart: formData.testWindowStart || undefined,
          testWindowEnd: formData.testWindowEnd || undefined,
          resultsDate: formData.resultsDate || undefined,
        }),
      });

      if (res.ok) {
        toast({
          title: 'Success',
          description: 'Test configuration updated successfully',
        });
        fetchConfig();
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

  const addSubject = () => {
    setFormData({ ...formData, subjects: [...formData.subjects, ''] });
  };

  const removeSubject = (index: number) => {
    const newSubjects = formData.subjects.filter((_, i) => i !== index);
    setFormData({ ...formData, subjects: newSubjects });
  };

  const updateSubject = (index: number, value: string) => {
    const newSubjects = [...formData.subjects];
    newSubjects[index] = value;
    setFormData({ ...formData, subjects: newSubjects });
  };

  const addFeature = () => {
    setFormData({ ...formData, features: [...formData.features, ''] });
  };

  const removeFeature = (index: number) => {
    const newFeatures = formData.features.filter((_, i) => i !== index);
    setFormData({ ...formData, features: newFeatures });
  };

  const updateFeature = (index: number, value: string) => {
    const newFeatures = [...formData.features];
    newFeatures[index] = value;
    setFormData({ ...formData, features: newFeatures });
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
        <h1 className="company-admin-title">Talent Test Configuration</h1>
        <p className="company-admin-description">Manage the public talent-test offer, schedule, pricing, and registration availability.</p>
      </div>

            <form onSubmit={handleSubmit} className="company-admin-form">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="company-admin-field-label">
              Test Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Precision Baseline Assessment"
            />
          </div>

          <div className="md:col-span-2">
            <label className="company-admin-field-label">
              Description *
            </label>
            <textarea
              required
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of the test"
            />
          </div>

          <div>
            <label className="company-admin-field-label">
              Price *
            </label>
            <input
              type="number"
              required
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
            />
          </div>

          <div>
            <label className="company-admin-field-label">
              Currency
            </label>
            <select
              value={formData.currency}
              onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
            >
              <option value="INR">INR (₹)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
            </select>
          </div>

          <div>
            <label className="company-admin-field-label">
              Duration *
            </label>
            <input
              type="text"
              required
              value={formData.duration}
              onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
              placeholder="e.g., 45 minutes"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              />
              <span>Active (Available for Registration)</span>
            </label>
            <p className="company-admin-field-note mt-1">
              Tip: Uncheck to close registrations site-wide instantly.
            </p>
          </div>
        </div>

        {/* Scheduling */}
        <div className="company-admin-section">
          <h3 className="mb-3 text-base font-semibold text-foreground">Scheduling (Dates)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="company-admin-field-label">Registrations Open</label>
              <input
                type="date"
                value={formData.registrationsOpen}
                onChange={(e) => setFormData({ ...formData, registrationsOpen: e.target.value })}
              />
            </div>
            <div>
              <label className="company-admin-field-label">Registration Deadline</label>
              <input
                type="date"
                value={formData.registrationDeadline}
                onChange={(e) => setFormData({ ...formData, registrationDeadline: e.target.value })}
              />
            </div>
            <div>
              <label className="company-admin-field-label">Test Window Start</label>
              <input
                type="date"
                value={formData.testWindowStart}
                onChange={(e) => setFormData({ ...formData, testWindowStart: e.target.value })}
              />
            </div>
            <div>
              <label className="company-admin-field-label">Test Window End</label>
              <input
                type="date"
                value={formData.testWindowEnd}
                onChange={(e) => setFormData({ ...formData, testWindowEnd: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <label className="company-admin-field-label">Results Date</label>
              <input
                type="date"
                value={formData.resultsDate}
                onChange={(e) => setFormData({ ...formData, resultsDate: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Subjects */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="company-admin-field-label mb-0">Subjects Covered *</label>
            <button
              type="button"
              onClick={addSubject}
              className="company-admin-inline-add"
            >
              Add Subject
            </button>
          </div>
          <div className="company-admin-inline-list">
            {formData.subjects.map((subject, index) => (
              <div key={index} className="company-admin-inline-row">
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => updateSubject(index, e.target.value)}
                placeholder={`Subject ${index + 1}`}
                className="flex-1"
              />
              {formData.subjects.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeSubject(index)}
                  className="company-admin-inline-remove"
                >
                  Remove
                </button>
              )}
              </div>
            ))}
          </div>
        </div>

        {/* Features */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="company-admin-field-label mb-0">Features & Benefits *</label>
            <button
              type="button"
              onClick={addFeature}
              className="company-admin-inline-add"
            >
              Add Feature
            </button>
          </div>
          <div className="company-admin-inline-list">
            {formData.features.map((feature, index) => (
              <div key={index} className="company-admin-inline-row">
              <input
                type="text"
                required
                value={feature}
                onChange={(e) => updateFeature(index, e.target.value)}
                placeholder={`Feature ${index + 1}`}
                className="flex-1"
              />
              {formData.features.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeFeature(index)}
                  className="company-admin-inline-remove"
                >
                  Remove
                </button>
              )}
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-border/60 pt-4">
          <button
            type="submit"
            disabled={saving}
            className="app-button-primary"
          >
            {saving ? 'Saving...' : 'Update Configuration'}
          </button>
        </div>

        {/* Preview Section */}
        <div className="border-t border-border/60 pt-4">
          <h3 className="mb-3 text-lg font-semibold text-foreground">Preview</h3>
          <div className="company-admin-preview-card space-y-2">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-semibold text-foreground">{formData.name}</h4>
                <p className="mt-1 text-sm text-muted-foreground">{formData.description}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-foreground">
                  {formData.currency === 'INR' ? '₹' : formData.currency === 'USD' ? '$' : '€'}
                  {formData.price}
                </p>
                <p className="text-xs text-muted-foreground">{formData.duration}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 text-xs text-muted-foreground md:grid-cols-3">
              <div>
                <span className="font-medium text-foreground">Open:</span> {formData.registrationsOpen || '—'}
              </div>
              <div>
                <span className="font-medium text-foreground">Deadline:</span> {formData.registrationDeadline || '—'}
              </div>
              <div>
                <span className="font-medium text-foreground">Test Window:</span> {(formData.testWindowStart && formData.testWindowEnd) ? `${formData.testWindowStart} → ${formData.testWindowEnd}` : '—'}
              </div>
              <div className="md:col-span-3">
                <span className="font-medium text-foreground">Results:</span> {formData.resultsDate || '—'}
              </div>
            </div>
            <div className="mt-3">
              <p className="mb-1 text-xs font-medium text-foreground">Subjects:</p>
              <div className="flex flex-wrap gap-1">
                {formData.subjects.map((subject, i) => (
                  <span key={i} className="company-admin-status-chip">
                    {subject}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-3">
              <p className="mb-1 text-xs font-medium text-foreground">Features:</p>
              <ul className="space-y-0.5 text-xs text-muted-foreground">
                {formData.features.map((feature, i) => (
                  <li key={i}>• {feature}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
