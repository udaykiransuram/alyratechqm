'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ui/use-toast';

interface PricingPlan {
  _id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  billingPeriod: 'monthly' | 'yearly' | 'one-time';
  features: string[];
  studentLimit?: number;
  isPopular: boolean;
  isActive: boolean;
  displayOrder: number;
}

export default function PricingAdmin() {
  const { toast } = useToast();
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0,
    currency: 'INR',
    billingPeriod: 'yearly' as 'monthly' | 'yearly' | 'one-time',
    features: [''],
    studentLimit: undefined as number | undefined,
    isPopular: false,
    isActive: true,
    displayOrder: 1,
  });

  const fetchPlans = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/pricing');
      const data = await res.json();
      if (data.success) {
        setPlans(data.data || []);
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to fetch pricing plans',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      price: 0,
      currency: 'INR',
      billingPeriod: 'yearly',
      features: [''],
      studentLimit: undefined,
      isPopular: false,
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
        ? `/api/admin/pricing/${editingId}`
        : '/api/admin/pricing';
      
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        toast({
          title: 'Success',
          description: `Pricing plan ${editingId ? 'updated' : 'created'} successfully`,
        });
        resetForm();
        fetchPlans();
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

  const handleEdit = (plan: PricingPlan) => {
    setFormData({
      name: plan.name,
      description: plan.description,
      price: plan.price,
      currency: plan.currency,
      billingPeriod: plan.billingPeriod,
      features: plan.features,
      studentLimit: plan.studentLimit,
      isPopular: plan.isPopular,
      isActive: plan.isActive,
      displayOrder: plan.displayOrder,
    });
    setEditingId(plan._id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this pricing plan?')) return;

    try {
      const res = await fetch(`/api/admin/pricing/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast({
          title: 'Success',
          description: 'Pricing plan deleted successfully',
        });
        fetchPlans();
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to delete pricing plan',
        variant: 'destructive',
      });
    }
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
        <h1 className="company-admin-title">Manage Pricing Plans</h1>
        <p className="company-admin-description">Configure pricing tiers and feature bundles using the same standardized admin surface.</p>
      </div>

            {/* Form */}
      <form onSubmit={handleSubmit} className="company-admin-form">
        <h2 className="text-xl font-semibold text-foreground">
          {editingId ? 'Edit' : 'Add New'} Pricing Plan
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="company-admin-field-label">
              Plan Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Starter, Professional, Enterprise"
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
              Billing Period *
            </label>
            <select
              value={formData.billingPeriod}
              onChange={(e) => setFormData({ 
                ...formData, 
                billingPeriod: e.target.value as 'monthly' | 'yearly' | 'one-time' 
              })}
            >
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
              <option value="one-time">One-time</option>
            </select>
          </div>

          <div>
            <label className="company-admin-field-label">
              Student Limit
            </label>
            <input
              type="number"
              value={formData.studentLimit || ''}
              onChange={(e) => setFormData({ 
                ...formData, 
                studentLimit: e.target.value ? parseInt(e.target.value) : undefined 
              })}
              placeholder="Leave empty for unlimited"
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
            Description *
          </label>
          <textarea
            required
            rows={2}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Brief description of this plan"
          />
        </div>

        {/* Features */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="company-admin-field-label mb-0">Features *</label>
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

        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 text-sm font-medium text-foreground">
            <input
              type="checkbox"
              checked={formData.isPopular}
              onChange={(e) => setFormData({ ...formData, isPopular: e.target.checked })}
            />
            <span>Mark as Popular</span>
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
        <h2 className="mb-4 text-xl font-semibold text-foreground">All Pricing Plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.length === 0 ? (
            <p className="col-span-full py-8 text-center text-muted-foreground">
              No pricing plans yet. Create one above!
            </p>
          ) : (
            plans.map((plan) => (
              <div
                key={plan._id}
                className="company-admin-item-card"
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-lg font-semibold text-foreground">{plan.name}</h3>
                  <div className="flex flex-col gap-1">
                    {plan.isPopular && (
                      <span className="company-admin-status-chip company-admin-status-chip-warning justify-center">
                        Popular
                      </span>
                    )}
                    <span className={`company-admin-status-chip justify-center ${
                      plan.isActive ? 'company-admin-status-chip-success' : 'company-admin-status-chip-muted'
                    }`}>
                      {plan.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                
                <p className="mb-1 text-2xl font-bold text-foreground">
                  {plan.currency === 'INR' ? '₹' : plan.currency === 'USD' ? '$' : '€'}
                  {plan.price.toLocaleString()}
                </p>
                <p className="mb-3 text-sm text-muted-foreground">
                  per {plan.billingPeriod === 'one-time' ? 'purchase' : plan.billingPeriod}
                </p>

                <p className="mb-3 text-sm text-muted-foreground">{plan.description}</p>

                <div className="mb-3">
                  <p className="mb-1 text-xs font-medium text-foreground">
                    {plan.features.length} Features
                  </p>
                  {plan.studentLimit && (
                    <p className="text-xs text-muted-foreground">
                      Up to {plan.studentLimit.toLocaleString()} students
                    </p>
                  )}
                </div>

                <div className="flex gap-2 border-t border-border/60 pt-3">
                  <button
                    onClick={() => handleEdit(plan)}
                    className="app-button-compact-secondary flex-1"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(plan._id)}
                    className="app-button-compact-secondary app-button-compact-danger flex-1"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
