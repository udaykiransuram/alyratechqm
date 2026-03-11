'use client';

import { useEffect, useState } from 'react';
import { Cashfree } from '@cashfreepayments/cashfree-js';
import { AlertCircle, CheckCircle2, CreditCard, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

const classLevels = [
  { value: '', label: 'Select Class' },
  { value: '1', label: 'Class 1' },
  { value: '2', label: 'Class 2' },
  { value: '3', label: 'Class 3' },
  { value: '4', label: 'Class 4' },
  { value: '5', label: 'Class 5' },
  { value: '6', label: 'Class 6' },
  { value: '7', label: 'Class 7' },
  { value: '8', label: 'Class 8' },
  { value: '9', label: 'Class 9' },
  { value: '10', label: 'Class 10' },
  { value: '11', label: 'Class 11' },
  { value: '12', label: 'Class 12' },
];

type PaymentModuleState = 'loading' | 'ready' | 'error';

export default function TalentTestRegisterPage() {
  const [cashfreeSDK, setCashfreeSDK] = useState<InstanceType<typeof Cashfree> | null>(null);
  const [loading, setLoading] = useState(false);
  const [paymentModuleState, setPaymentModuleState] =
    useState<PaymentModuleState>('loading');
  const [formData, setFormData] = useState({
    studentName: '',
    guardianName: '',
    phone: '',
    classLevel: '',
    aadhar: '',
    amount: '100',
    careerAspiration: '',
  });
  const { toast } = useToast();

  useEffect(() => {
    let isActive = true;

    const loadPaymentModule = async () => {
      try {
        setPaymentModuleState('loading');
        const { load } = await import('@cashfreepayments/cashfree-js');
        const sdk = await load({ mode: process.env.NEXT_PUBLIC_CASHFREE_ENV || 'sandbox' });
        if (!isActive) return;
        setCashfreeSDK(sdk);
        setPaymentModuleState('ready');
      } catch {
        if (!isActive) return;
        setCashfreeSDK(null);
        setPaymentModuleState('error');
        toast({
          title: 'Error',
          description: 'Failed to load payment module. Please refresh.',
          variant: 'destructive',
        });
      }
    };

    void loadPaymentModule();

    return () => {
      isActive = false;
    };
  }, [toast]);

  const formatAadhar = (value: string) =>
    value.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'aadhar') {
      const digits = value.replace(/\D/g, '').slice(0, 12);
      setFormData((prev) => ({ ...prev, aadhar: formatAadhar(digits) }));
      return;
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const { studentName, guardianName, phone, classLevel, aadhar, careerAspiration } = formData;
    const aadharDigits = aadhar.replace(/\s+/g, '');

    if (
      !studentName ||
      !guardianName ||
      !phone ||
      !classLevel ||
      !aadharDigits ||
      !careerAspiration
    ) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    if (!/^[0-9]{10}$/.test(phone)) {
      toast({
        title: 'Validation Error',
        description: 'Enter a valid 10-digit phone number.',
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    if (!/^\d{12}$/.test(aadharDigits)) {
      toast({
        title: 'Validation Error',
        description: 'Enter a valid 12-digit Aadhar number.',
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    if (!cashfreeSDK || paymentModuleState !== 'ready') {
      toast({
        title: 'Payment Unavailable',
        description: 'Payment module is still loading. Please wait a moment and try again.',
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/cashfree/register-pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, aadhar: aadharDigits }),
      });

      const data = await res.json();

      if (!res.ok || !data.payment_session_id) {
        throw new Error(data.message || 'Payment session error.');
      }

      await cashfreeSDK.checkout({ paymentSessionId: data.payment_session_id });

      setFormData({
        studentName: '',
        guardianName: '',
        phone: '',
        classLevel: '',
        aadhar: '',
        amount: '100',
        careerAspiration: '',
      });

      toast({
        title: 'Success',
        description: 'Registration successful! Proceeding to payment.',
        variant: 'default',
      });
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err?.message || 'Something went wrong.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const isPaymentReady = paymentModuleState === 'ready' && !!cashfreeSDK;
  const statusTone =
    paymentModuleState === 'ready'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : paymentModuleState === 'error'
        ? 'border-rose-200 bg-rose-50 text-rose-700'
        : 'border-amber-200 bg-amber-50 text-amber-700';

  return (
    <div className="min-h-screen bg-muted/20 px-4 py-10">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <div className="space-y-3 text-center">
          <div className="inline-flex items-center justify-center rounded-full border border-border/60 bg-background px-4 py-1 text-xs font-medium text-muted-foreground shadow-sm">
            Talent Test Registration • Fee ₹100
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Register and pay in one flow
            </h1>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              Fill in the student details, then continue to the secure payment step.
            </p>
          </div>
        </div>

        <Card className="border-border/60 bg-card/95 shadow-lg">
          <CardHeader className="space-y-4 border-b border-border/60 bg-muted/20">
            <div
              className={cn(
                'flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-sm',
                statusTone,
              )}
            >
              {loading ? (
                <Loader2 className="mt-0.5 h-4 w-4 animate-spin" />
              ) : paymentModuleState === 'ready' ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4" />
              ) : paymentModuleState === 'error' ? (
                <AlertCircle className="mt-0.5 h-4 w-4" />
              ) : (
                <CreditCard className="mt-0.5 h-4 w-4" />
              )}
              <div className="space-y-1 text-left">
                <p className="font-semibold">
                  {loading
                    ? 'Processing registration'
                    : paymentModuleState === 'ready'
                      ? 'Payment module ready'
                      : paymentModuleState === 'error'
                        ? 'Payment module unavailable'
                        : 'Preparing payment module'}
                </p>
                <p className="text-xs text-current/90">
                  {loading
                    ? 'Submitting details and opening the payment window.'
                    : paymentModuleState === 'ready'
                      ? 'You can complete registration and continue directly to payment.'
                      : paymentModuleState === 'error'
                        ? 'Refresh the page and try again if the payment controls do not appear.'
                        : 'Loading secure payment controls. This usually takes a few seconds.'}
                </p>
              </div>
            </div>

            <div>
              <CardTitle className="text-xl">Student details</CardTitle>
              <CardDescription>
                Use the same phone number that should receive registration updates.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="p-5 sm:p-6">
            <form onSubmit={handleSubmit} className="space-y-5" aria-busy={loading}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="studentName">Student Name</Label>
                  <Input
                    id="studentName"
                    name="studentName"
                    value={formData.studentName}
                    onChange={handleChange}
                    placeholder="Enter student's full name"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="guardianName">Guardian Name</Label>
                  <Input
                    id="guardianName"
                    name="guardianName"
                    value={formData.guardianName}
                    onChange={handleChange}
                    placeholder="Enter guardian's full name"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Student Phone Number</Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]{10}"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="10-digit mobile number"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="classLevel">Class</Label>
                  <select
                    id="classLevel"
                    name="classLevel"
                    value={formData.classLevel}
                    onChange={handleChange}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    required
                  >
                    {classLevels.map((level) => (
                      <option key={level.value} value={level.value} disabled={level.value === ''}>
                        {level.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="aadhar">Student Aadhar Number</Label>
                  <Input
                    id="aadhar"
                    name="aadhar"
                    inputMode="numeric"
                    maxLength={14}
                    value={formData.aadhar}
                    onChange={handleChange}
                    placeholder="1234 5678 9012"
                    required
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="careerAspiration">Career Aspiration</Label>
                  <Input
                    id="careerAspiration"
                    name="careerAspiration"
                    value={formData.careerAspiration}
                    onChange={handleChange}
                    placeholder="e.g. Doctor, Engineer, Artist"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={loading || !isPaymentReady}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing payment
                  </>
                ) : isPaymentReady ? (
                  <>
                    <CreditCard className="h-4 w-4" />
                    Pay ₹100 & Register
                  </>
                ) : paymentModuleState === 'error' ? (
                  'Payment unavailable'
                ) : (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading payment module
                  </>
                )}
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                After you submit, a secure payment window opens to complete the registration.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
