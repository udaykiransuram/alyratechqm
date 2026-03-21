'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';

interface ContactInfoData {
  email: string;
  phone: string;
  whatsappNumber?: string;
  address: string;
  city: string;
  tagline: string;
  responseTime: string;
  responseDescription: string;
}

const DEFAULTS: ContactInfoData = {
  email: 'hello@beyondmarks.edu',
  phone: '+91 98765 43210',
  whatsappNumber: '',
  address: 'Innovation Hub',
  city: 'Hitech City, Hyderabad, India',
  tagline: "We'd love to hear from you. Let's transform education together.",
  responseTime: '< 24h',
  responseDescription: 'Our team responds to every inquiry within one business day.',
};

export default function ContactInfoPage() {
  const [data, setData] = useState<ContactInfoData>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof ContactInfoData, string>>>({});
  const { toast } = useToast();

  const validate = (payload: ContactInfoData) => {
    const next: Partial<Record<keyof ContactInfoData, string>> = {};
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
    const digits = (s: string) => s.replace(/\D+/g, '');
    if (!emailRe.test(payload.email.trim())) next.email = 'Enter a valid email address';
    if (digits(payload.phone).length < 10) next.phone = 'Enter a valid phone number (10+ digits)';
    if (payload.whatsappNumber && digits(payload.whatsappNumber).length < 10) next.whatsappNumber = 'Enter a valid WhatsApp number or leave blank';
    if (!payload.address.trim()) next.address = 'Address is required';
    if (!payload.city.trim()) next.city = 'City/Region is required';
    if (!payload.tagline.trim()) next.tagline = 'Tagline is required';
    if (!payload.responseTime.trim()) next.responseTime = 'Response time is required';
    if (!payload.responseDescription.trim()) next.responseDescription = 'Response description is required';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  useEffect(() => {
    fetch('/api/admin/contact-info')
      .then(res => res.json())
      .then(result => {
        if (result.success && result.data) {
          setData({
            email: result.data.email || DEFAULTS.email,
            phone: result.data.phone || DEFAULTS.phone,
            whatsappNumber: result.data.whatsappNumber || DEFAULTS.whatsappNumber,
            address: result.data.address || DEFAULTS.address,
            city: result.data.city || DEFAULTS.city,
            tagline: result.data.tagline || DEFAULTS.tagline,
            responseTime: result.data.responseTime || DEFAULTS.responseTime,
            responseDescription: result.data.responseDescription || DEFAULTS.responseDescription,
          });
        }
      })
      .catch(() => toast({ title: 'Error', description: 'Failed to load contact info', variant: 'destructive' }))
      .finally(() => setLoading(false));
  }, [toast]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (!validate(data)) {
        toast({ title: 'Fix errors', description: 'Please correct highlighted fields and try again.', variant: 'destructive' });
        return;
      }
      const res = await fetch('/api/admin/contact-info', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Saved', description: 'Contact info updated successfully' });
      } else {
        throw new Error(result.error || result.message || 'Unknown error');
      }
    } catch (e: unknown) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Failed to save', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="company-admin-loading">Loading...</div>;

  const fields: { key: keyof ContactInfoData; label: string; type: 'text' | 'textarea'; placeholder: string }[] = [
    { key: 'email', label: 'Email Address', type: 'text', placeholder: 'hello@beyondmarks.edu' },
    { key: 'phone', label: 'Phone Number', type: 'text', placeholder: '+91 98765 43210' },
    { key: 'whatsappNumber', label: 'WhatsApp Number (for direct chat button)', type: 'text', placeholder: '+91 98765 43210' },
    { key: 'address', label: 'Office / Building Name', type: 'text', placeholder: 'Innovation Hub' },
    { key: 'city', label: 'City & Region', type: 'text', placeholder: 'Hitech City, Hyderabad, India' },
    { key: 'tagline', label: 'Hero Tagline (shown on contact page)', type: 'textarea', placeholder: "We'd love to hear from you..." },
    { key: 'responseTime', label: 'Response Time Badge', type: 'text', placeholder: '< 24h' },
    { key: 'responseDescription', label: 'Response Time Description', type: 'textarea', placeholder: 'Our team responds to every inquiry within...' },
  ];

  return (
    <div className="company-admin-page">
      <div className="company-admin-header">
        <div>
          <h2 className="company-admin-title">Contact Information</h2>
          <p className="company-admin-description">
            Update contact details shown on the Contact page.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="app-button-primary"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

            <div className="company-admin-form">
        <div className="space-y-5">
          {fields.map(f => (
            <div key={f.key}>
              <label className="mb-2 block text-sm font-semibold text-teal-900 dark:text-teal-200">
                {f.label}
              </label>
              {f.type === 'textarea' ? (
                <textarea
                  value={data[f.key]}
                  onChange={e => { setData(prev => ({ ...prev, [f.key]: e.target.value })); setErrors(prev => ({ ...prev, [f.key]: undefined })); }}
                  placeholder={f.placeholder}
                  rows={3}
                  className={`w-full rounded-lg border ${errors[f.key] ? 'border-red-500' : 'border-teal-200'} bg-white px-4 py-3 text-teal-950 placeholder-teal-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-teal-700 dark:bg-teal-800 dark:text-white`}
                  aria-invalid={!!errors[f.key]}
                />
              ) : (
                <input
                  type="text"
                  value={data[f.key]}
                  onChange={e => { setData(prev => ({ ...prev, [f.key]: e.target.value })); setErrors(prev => ({ ...prev, [f.key]: undefined })); }}
                  placeholder={f.placeholder}
                  className={`w-full rounded-lg border ${errors[f.key] ? 'border-red-500' : 'border-teal-200'} bg-white px-4 py-3 text-teal-950 placeholder-teal-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-teal-700 dark:bg-teal-800 dark:text-white`}
                  aria-invalid={!!errors[f.key]}
                />
              )}
              {errors[f.key] && (
                <p className="mt-1 text-xs text-red-600">{errors[f.key]}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
