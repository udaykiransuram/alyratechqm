'use client';

import { useState, useEffect } from 'react';
import { load, Cashfree } from '@cashfreepayments/cashfree-js';
import { useRouter } from 'next/navigation';

export default function TalentTestRegisterPage() {
  const router = useRouter();
  const [cashfreeSDK, setCashfreeSDK] = useState<Cashfree | null>(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    classLevel: '',
    subjectFocus: '',
    testDatePreference: '',
    amount: '100',
  });
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    load({ mode: process.env.NEXT_PUBLIC_CASHFREE_ENV || 'sandbox' })
      .then(setCashfreeSDK)
      .catch(() => {
        setMessage('Failed to load payment module. Please refresh.');
        setIsError(true);
      });
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setIsError(false);

    const { fullName, email, phone, classLevel, subjectFocus, testDatePreference } = formData;
    if (!fullName || !email || !phone || !classLevel || !subjectFocus || !testDatePreference) {
      setMessage('Please fill in all required fields.');
      setIsError(true);
      setLoading(false);
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setMessage('Enter a valid email.');
      setIsError(true);
      setLoading(false);
      return;
    }

    if (!/^[0-9]{10}$/.test(phone)) {
      setMessage('Enter a valid 10-digit phone number.');
      setIsError(true);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/cashfree/register-pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok || !data.payment_session_id) {
        throw new Error(data.message || 'Payment session error.');
      }

      await cashfreeSDK?.checkout({ paymentSessionId: data.payment_session_id });

      setFormData({
        fullName: '', email: '', phone: '', classLevel: '',
        subjectFocus: '', testDatePreference: '', amount: '100',
      });
    } catch (err: any) {
      setMessage(err.message || 'Something went wrong.');
      setIsError(true);
    } finally {
      setLoading(false);
    }
  };

  const classLevels = Array.from({ length: 10 }, (_, i) => `${i + 1}th`);

  return (
    <div className="min-h-screen bg-neutral-950 text-white px-4 py-12 flex items-center justify-center">
      <div className="bg-neutral-900 rounded-2xl shadow-xl p-8 max-w-xl w-full">
        <h1 className="text-3xl font-bold text-center mb-6">Talent Test Registration</h1>
        <p className="text-center text-gray-400 mb-8">
          Fill in the details below to register. Registration fee: ₹100
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <input
            type="text"
            name="fullName"
            value={formData.fullName}
            onChange={handleChange}
            placeholder="Child's Full Name"
            className="w-full px-4 py-2 rounded bg-neutral-800 border border-neutral-700 placeholder-gray-400"
            required
          />
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="Parent/Guardian Email"
            className="w-full px-4 py-2 rounded bg-neutral-800 border border-neutral-700 placeholder-gray-400"
            required
          />
          <input
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            placeholder="Parent/Guardian Phone (10 digits)"
            pattern="[0-9]{10}"
            className="w-full px-4 py-2 rounded bg-neutral-800 border border-neutral-700 placeholder-gray-400"
            required
          />
          <select
            name="classLevel"
            value={formData.classLevel}
            onChange={handleChange}
            className="w-full px-4 py-2 rounded bg-neutral-800 border border-neutral-700 text-white"
            required
          >
            <option value="">Select Class</option>
            {classLevels.map(level => <option key={level} value={level}>{level}</option>)}
          </select>

          <select
            name="subjectFocus"
            value={formData.subjectFocus}
            onChange={handleChange}
            className="w-full px-4 py-2 rounded bg-neutral-800 border border-neutral-700 text-white"
            required
          >
            <option value="">Subject Focus</option>
            <option value="Mathematics">Mathematics</option>
            <option value="Physics">Physics</option>
            <option value="Chemistry">Chemistry</option>
            <option value="All Subjects">All Subjects</option>
          </select>

          <input
            type="date"
            name="testDatePreference"
            value={formData.testDatePreference}
            onChange={handleChange}
            className="w-full px-4 py-2 rounded bg-neutral-800 border border-neutral-700 text-white"
            min={new Date().toISOString().split('T')[0]}
            required
          />

          {message && (
            <div className={`text-sm px-4 py-2 rounded ${isError ? 'bg-red-600' : 'bg-green-600'}`}>
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !cashfreeSDK}
            className={`w-full py-3 rounded font-semibold text-lg transition-all ${
              loading || !cashfreeSDK
                ? 'bg-gray-500 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {loading
              ? 'Processing...'
              : cashfreeSDK
              ? 'Pay ₹100 & Register'
              : 'Loading Payment...'}
          </button>
        </form>
      </div>
    </div>
  );
}
