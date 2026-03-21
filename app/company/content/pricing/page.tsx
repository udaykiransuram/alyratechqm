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
        <h2 className="text-xl font-semibold text-teal-900">
          {editingId ? 'Edit' : 'Add New'} Pricing Plan
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-teal-900 mb-1">
              Plan Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Starter, Professional, Enterprise"
              className="w-full px-3 py-2 border border-teal-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-teal-900 mb-1">
              Price *
            </label>
            <input
              type="number"
              required
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
              className="w-full px-3 py-2 border border-teal-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-teal-900 mb-1">
              Currency
            </label>
            <select
              value={formData.currency}
              onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
              className="w-full px-3 py-2 border border-teal-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="INR">INR (₹)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-teal-900 mb-1">
              Billing Period *
            </label>
            <select
              value={formData.billingPeriod}
              onChange={(e) => setFormData({ 
                ...formData, 
                billingPeriod: e.target.value as 'monthly' | 'yearly' | 'one-time' 
              })}
              className="w-full px-3 py-2 border border-teal-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
              <option value="one-time">One-time</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-teal-900 mb-1">
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
            Description *
          </label>
          <textarea
            required
            rows={2}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Brief description of this plan"
            className="w-full px-3 py-2 border border-teal-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        {/* Features */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium text-teal-900">Features *</label>
            <button
              type="button"
              onClick={addFeature}
              className="text-sm text-teal-600 hover:text-teal-700"
            >
              + Add Feature
            </button>
          </div>
          {formData.features.map((feature, index) => (
            <div key={index} className="flex gap-2 mb-2">
              <input
                type="text"
                required
                value={feature}
                onChange={(e) => updateFeature(index, e.target.value)}
                placeholder={`Feature ${index + 1}`}
                className="flex-1 px-3 py-2 border border-teal-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              {formData.features.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeFeature(index)}
                  className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-md"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.isPopular}
              onChange={(e) => setFormData({ ...formData, isPopular: e.target.checked })}
              className="w-4 h-4 text-teal-600 border-teal-300 rounded focus:ring-teal-500"
            />
            <span className="text-sm text-teal-900">Mark as Popular</span>
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
        <h2 className="text-xl font-semibold text-teal-900 mb-4">All Pricing Plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.length === 0 ? (
            <p className="text-teal-600 text-center py-8 col-span-full">
              No pricing plans yet. Create one above!
            </p>
          ) : (
            plans.map((plan) => (
              <div
                key={plan._id}
                className="border border-teal-200 rounded-lg p-4 hover:border-teal-400 transition-colors"
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-lg font-semibold text-teal-900">{plan.name}</h3>
                  <div className="flex flex-col gap-1">
                    {plan.isPopular && (
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded text-center">
                        Popular
                      </span>
                    )}
                    <span className={`px-2 py-1 text-xs rounded text-center ${
                      plan.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {plan.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                
                <p className="text-2xl font-bold text-teal-700 mb-1">
                  {plan.currency === 'INR' ? '₹' : plan.currency === 'USD' ? '$' : '€'}
                  {plan.price.toLocaleString()}
                </p>
                <p className="text-sm text-teal-600 mb-3">
                  per {plan.billingPeriod === 'one-time' ? 'purchase' : plan.billingPeriod}
                </p>

                <p className="text-sm text-teal-700 mb-3">{plan.description}</p>

                <div className="mb-3">
                  <p className="text-xs font-medium text-teal-900 mb-1">
                    {plan.features.length} Features
                  </p>
                  {plan.studentLimit && (
                    <p className="text-xs text-teal-600">
                      Up to {plan.studentLimit.toLocaleString()} students
                    </p>
                  )}
                </div>

                <div className="flex gap-2 pt-3 border-t border-teal-200">
                  <button
                    onClick={() => handleEdit(plan)}
                    className="flex-1 px-3 py-1.5 text-sm text-teal-600 hover:bg-teal-50 rounded"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(plan._id)}
                    className="flex-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded"
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
