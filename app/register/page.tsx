'use client';

import { useState, useEffect } from 'react';
import { Cashfree } from '@cashfreepayments/cashfree-js';
import { useToast } from '@/components/ui/use-toast'; // <-- Use your custom toast

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
	{ value: '12', label: 'Class 12' }
];

export default function TalentTestRegisterPage() {
	const [cashfreeSDK, setCashfreeSDK] = useState<InstanceType<typeof Cashfree> | null>(null);
	const [loading, setLoading] = useState(false);
	const [formData, setFormData] = useState({
		studentName: '',
		guardianName: '',
		phone: '',
		classLevel: '',
		aadhar: '',
		amount: '100',
		careerAspiration: '',
	});
	const [isError, setIsError] = useState(false);
	const { toast } = useToast(); // <-- Use your custom toast

	useEffect(() => {
		import('@cashfreepayments/cashfree-js').then(({ load }) => {
			load({ mode: process.env.NEXT_PUBLIC_CASHFREE_ENV || 'sandbox' })
				.then(setCashfreeSDK)
				.catch(() => {
					toast({
						title: 'Error',
						description: 'Failed to load payment module. Please refresh.',
						variant: 'destructive',
					});
					setIsError(true);
				});
		});
	}, [toast]);

	const formatAadhar = (value: string) =>
		value.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim();

	const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
		const { name, value } = e.target;
		if (name === 'aadhar') {
			// Only allow digits and format with spaces
			const digits = value.replace(/\D/g, '').slice(0, 12);
			setFormData(prev => ({ ...prev, aadhar: formatAadhar(digits) }));
		} else {
			setFormData(prev => ({ ...prev, [name]: value }));
		}
	};

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setLoading(true);
		setIsError(false);

		const { studentName, guardianName, phone, classLevel, aadhar, careerAspiration } = formData;
		const aadharDigits = aadhar.replace(/\s+/g, '');

		if (!studentName || !guardianName || !phone || !classLevel || !aadharDigits || !careerAspiration) {
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

			await cashfreeSDK?.checkout({ paymentSessionId: data.payment_session_id });

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
				description: err.message || 'Something went wrong.',
				variant: 'destructive',
			});
			setIsError(true);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="min-h-screen flex items-center justify-center bg-neutral-100 px-4 py-12">
			<div className="w-full max-w-lg bg-white rounded-xl shadow-lg p-8 border border-neutral-200">
				<h1 className="text-3xl font-extrabold text-center mb-2 text-neutral-800">Talent Test Registration</h1>
				<p className="text-center text-neutral-500 mb-8">
					Fill in the details below to register.
					<br />
					<span className="font-semibold text-green-600">Registration fee: ₹100</span>
				</p>

				<form onSubmit={handleSubmit} className="space-y-6">
					{/* Student Name */}
					<div>
						<label className="block mb-1 font-medium text-neutral-700" htmlFor="studentName">
							Student Name
						</label>
						<input
							type="text"
							name="studentName"
							id="studentName"
							value={formData.studentName}
							onChange={handleChange}
							placeholder="Enter student's full name"
							className="w-full px-4 py-2 rounded border border-neutral-300 bg-neutral-50 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-green-400"
							required
						/>
					</div>
					{/* Guardian Name */}
					<div>
						<label className="block mb-1 font-medium text-neutral-700" htmlFor="guardianName">
							Guardian's Name
						</label>
						<input
							type="text"
							name="guardianName"
							id="guardianName"
							value={formData.guardianName}
							onChange={handleChange}
							placeholder="Enter guardian's full name"
							className="w-full px-4 py-2 rounded border border-neutral-300 bg-neutral-50 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-green-400"
							required
						/>
					</div>
					{/* Phone */}
					<div>
						<label className="block mb-1 font-medium text-neutral-700" htmlFor="phone">
							Student Phone Number
						</label>
						<input
							type="tel"
							name="phone"
							id="phone"
							value={formData.phone}
							onChange={handleChange}
							placeholder="10-digit mobile number"
							pattern="[0-9]{10}"
							className="w-full px-4 py-2 rounded border border-neutral-300 bg-neutral-50 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-green-400"
							required
						/>
					</div>
					{/* Class */}
					<div>
						<label className="block mb-1 font-medium text-neutral-700" htmlFor="classLevel">
							Class
						</label>
						<select
							name="classLevel"
							id="classLevel"
							value={formData.classLevel}
							onChange={handleChange}
							className="w-full px-4 py-2 rounded border border-neutral-300 bg-neutral-50 text-neutral-800 focus:outline-none focus:ring-2 focus:ring-green-400"
							required
						>
							{classLevels.map(level => (
								<option key={level.value} value={level.value} disabled={level.value === ''}>
									{level.label}
								</option>
							))}
						</select>
					</div>
					{/* Aadhar */}
					<div>
						<label className="block mb-1 font-medium text-neutral-700" htmlFor="aadhar">
							Student Aadhar Number
						</label>
						<input
							type="text"
							name="aadhar"
							id="aadhar"
							value={formData.aadhar}
							onChange={handleChange}
							placeholder="1234 5678 9012"
							maxLength={14} // 12 digits + 2 spaces
							className="w-full px-4 py-2 rounded border border-neutral-300 bg-neutral-50 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-green-400"
							required
						/>
					</div>
					{/* Career Aspiration */}
					<div>
						<label className="block mb-1 font-medium text-neutral-700" htmlFor="careerAspiration">
							What does the student want to be when they grow up?
						</label>
						<input
							type="text"
							name="careerAspiration"
							id="careerAspiration"
							value={formData.careerAspiration}
							onChange={handleChange}
							placeholder="e.g. Doctor, Engineer, Artist, etc."
							className="w-full px-4 py-2 rounded border border-neutral-300 bg-neutral-50 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-green-400"
							required
						/>
					</div>

					<button
						type="submit"
						disabled={loading || !cashfreeSDK}
						className={`w-full py-3 rounded font-semibold text-lg transition-all ${
							loading || !cashfreeSDK
								? 'bg-neutral-300 text-neutral-500 cursor-not-allowed'
								: 'bg-green-600 text-white hover:bg-green-700 shadow-md'
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
