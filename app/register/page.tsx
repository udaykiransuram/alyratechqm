'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { CashfreeSDK, load } from '@/lib/cashfree';
import { SearchableDatalistInput } from '@/components/ui/searchable-datalist-input';
import { useToast } from '@/components/ui/use-toast';

type SchoolOption = {
	key: string;
	displayName: string;
};

type ClassOption = {
	id: string;
	name: string;
};

type SectionOption = {
	id: string;
	name: string;
	classId: string;
};

type SchoolsResponse = {
	success?: boolean;
	schools?: Array<{ key?: string; displayName?: string }>;
	message?: string;
};

type ClassesResponse = {
	success?: boolean;
	classes?: Array<{ id?: string; name?: string }>;
	message?: string;
};

type SectionsResponse = {
	success?: boolean;
	sections?: Array<{ id?: string; name?: string; classId?: string }>;
	message?: string;
};

export default function TalentTestRegisterPage() {
	const [cashfreeSDK, setCashfreeSDK] = useState<CashfreeSDK | null>(null);
	const [loading, setLoading] = useState(false);
	const [testConfig, setTestConfig] = useState<{ name?: string; price?: number; currency?: string; duration?: string; subjects?: string[]; features?: string[] } | null>(null);
	const [formData, setFormData] = useState({
		studentName: '',
		guardianName: '',
		phone: '',
		schoolKey: '',
		schoolName: '',
		classId: '',
		classLevel: '',
		sectionId: '',
		sectionName: '',
		aadhar: '',
		amount: '100',
		careerAspiration: '',
		rollNumber: '',
	});
	const [schools, setSchools] = useState<SchoolOption[]>([]);
	const [schoolSearch, setSchoolSearch] = useState('');
	const [classes, setClasses] = useState<ClassOption[]>([]);
	const [classSearch, setClassSearch] = useState('');
	const [sections, setSections] = useState<SectionOption[]>([]);
	const [sectionSearch, setSectionSearch] = useState('');
	const [directoryLoading, setDirectoryLoading] = useState({
		schools: true,
		classes: false,
		sections: false,
	});
	const [directoryError, setDirectoryError] = useState('');
	const [acceptedTerms, setAcceptedTerms] = useState(false);
	const { toast } = useToast();

	useEffect(() => {
		let mounted = true;

		fetch('/api/talent-test-config')
			.then(res => res.json())
			.then(data => {
				if (!mounted) return;
				if (data.success && data.data) {
					setTestConfig(data.data);
					setFormData(prev => ({ ...prev, amount: String(data.data.price) }));
				}
			})
			.catch(err => console.error('Failed to fetch test config:', err));

		fetch('/api/public/schools', { cache: 'no-store' })
			.then(async res => {
				const data: SchoolsResponse = await res.json();
				if (!res.ok || !data?.success) {
					throw new Error(data?.message || 'Failed to load schools.');
				}
				if (!mounted) return;
				const nextSchools = Array.isArray(data.schools)
					? data.schools
						.map((school) => ({
							key: String(school?.key || '').trim(),
							displayName: String(school?.displayName || '').trim(),
						}))
						.filter((school: SchoolOption) => school.key && school.displayName)
					: [];
				setSchools(nextSchools);
				if (nextSchools.length === 1) {
					setSchoolSearch(nextSchools[0].displayName);
					setFormData(prev => ({
						...prev,
						schoolKey: nextSchools[0].key,
						schoolName: nextSchools[0].displayName,
					}));
				}
			})
			.catch((error: Error) => {
				console.error('Failed to fetch schools:', error);
				if (!mounted) return;
				setSchools([]);
				setDirectoryError(error.message || 'Failed to load schools.');
			})
			.finally(() => {
				if (!mounted) return;
				setDirectoryLoading(prev => ({ ...prev, schools: false }));
			});

		load({ mode: process.env.NEXT_PUBLIC_CASHFREE_ENV || 'sandbox' })
			.then(setCashfreeSDK)
			.catch(() => {
				toast({
					title: 'Error',
					description: 'Failed to load payment module. Please refresh.',
					variant: 'destructive',
				});
			});

		return () => {
			mounted = false;
		};
	}, [toast]);

	useEffect(() => {
		if (!formData.schoolKey) {
			setClasses([]);
			setSections([]);
			setClassSearch('');
			setSectionSearch('');
			return;
		}

		let mounted = true;
		setDirectoryLoading(prev => ({ ...prev, classes: true }));
		setDirectoryError('');
		setClasses([]);
		setSections([]);

		fetch(`/api/public/classes?school=${encodeURIComponent(formData.schoolKey)}`, {
			cache: 'no-store',
		})
			.then(async res => {
				const data: ClassesResponse = await res.json();
				if (!res.ok || !data?.success) {
					throw new Error(data?.message || 'Failed to load classes.');
				}
				if (!mounted) return;
				setClasses(
					Array.isArray(data.classes)
						? data.classes
							.map((classItem) => ({
								id: String(classItem?.id || '').trim(),
								name: String(classItem?.name || '').trim(),
							}))
							.filter((classItem: ClassOption) => classItem.id && classItem.name)
						: [],
				);
			})
			.catch((error: Error) => {
				console.error('Failed to fetch classes:', error);
				if (!mounted) return;
				setClasses([]);
				setDirectoryError(error.message || 'Failed to load classes.');
			})
			.finally(() => {
				if (!mounted) return;
				setDirectoryLoading(prev => ({ ...prev, classes: false }));
			});

		return () => {
			mounted = false;
		};
	}, [formData.schoolKey]);

	useEffect(() => {
		if (!formData.schoolKey || !formData.classId) {
			setSections([]);
			setSectionSearch('');
			return;
		}

		let mounted = true;
		setDirectoryLoading(prev => ({ ...prev, sections: true }));
		setDirectoryError('');
		setSections([]);

		fetch(`/api/public/sections?school=${encodeURIComponent(formData.schoolKey)}&classId=${encodeURIComponent(formData.classId)}`, {
			cache: 'no-store',
		})
			.then(async res => {
				const data: SectionsResponse = await res.json();
				if (!res.ok || !data?.success) {
					throw new Error(data?.message || 'Failed to load sections.');
				}
				if (!mounted) return;
				setSections(
					Array.isArray(data.sections)
						? data.sections
							.map((section) => ({
								id: String(section?.id || '').trim(),
								name: String(section?.name || '').trim(),
								classId: String(section?.classId || '').trim(),
							}))
							.filter((section: SectionOption) => section.id && section.name)
						: [],
				);
			})
			.catch((error: Error) => {
				console.error('Failed to fetch sections:', error);
				if (!mounted) return;
				setSections([]);
				setDirectoryError(error.message || 'Failed to load sections.');
			})
			.finally(() => {
				if (!mounted) return;
				setDirectoryLoading(prev => ({ ...prev, sections: false }));
			});

		return () => {
			mounted = false;
		};
	}, [formData.schoolKey, formData.classId]);

	const formatAadhar = (value: string) =>
		value.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim();

	const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
		const { name, value } = e.target;
		if (name === 'aadhar') {
			const digits = value.replace(/\D/g, '').slice(0, 12);
			setFormData(prev => ({ ...prev, aadhar: formatAadhar(digits) }));
		} else {
			setFormData(prev => ({ ...prev, [name]: value }));
		}
	};

	const handleSchoolInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const nextValue = e.target.value;
		const normalizedValue = nextValue.trim().toLowerCase();
		const selectedSchool = schools.find(
			school => school.displayName.toLowerCase() === normalizedValue || school.key.toLowerCase() === normalizedValue,
		);

		setSchoolSearch(nextValue);
		setClassSearch('');
		setSectionSearch('');
		setFormData(prev => ({
			...prev,
			schoolKey: selectedSchool?.key || '',
			schoolName: selectedSchool?.displayName || '',
			classId: '',
			classLevel: '',
			sectionId: '',
			sectionName: '',
		}));
	};

	const handleClassInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const nextValue = e.target.value;
		const normalizedValue = nextValue.trim().toLowerCase();
		const selectedClass = classes.find(
			classItem => classItem.name.toLowerCase() === normalizedValue || classItem.id.toLowerCase() === normalizedValue,
		);

		setClassSearch(nextValue);
		setSectionSearch('');
		setFormData(prev => ({
			...prev,
			classId: selectedClass?.id || '',
			classLevel: selectedClass?.name || '',
			sectionId: '',
			sectionName: '',
		}));
	};

	const handleSectionInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const nextValue = e.target.value;
		const normalizedValue = nextValue.trim().toLowerCase();
		const selectedSection = sections.find(
			section => section.name.toLowerCase() === normalizedValue || section.id.toLowerCase() === normalizedValue,
		);

		setSectionSearch(nextValue);
		setFormData(prev => ({
			...prev,
			sectionId: selectedSection?.id || '',
			sectionName: selectedSection?.name || '',
		}));
	};

	const handleSchoolInputBlur = () => {
		if (formData.schoolName) {
			setSchoolSearch(formData.schoolName);
		}
	};

	const handleClassInputBlur = () => {
		if (formData.classLevel) {
			setClassSearch(formData.classLevel);
		}
	};

	const handleSectionInputBlur = () => {
		if (formData.sectionName) {
			setSectionSearch(formData.sectionName);
		}
	};

	const schoolSelectionPending = schoolSearch.trim().length > 0 && !formData.schoolKey;
	const classSelectionPending = classSearch.trim().length > 0 && !formData.classId;
	const sectionSelectionPending = sectionSearch.trim().length > 0 && !formData.sectionId;

	const schoolOptions = schools.map((school) => ({
		value: school.displayName,
	}));

	const classOptions = classes.map((classItem) => ({
		value: classItem.name,
	}));

	const sectionOptions = sections.map((section) => ({
		value: section.name,
	}));

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setLoading(true);

		const {
			studentName,
			guardianName,
			phone,
			schoolKey,
			schoolName,
			classId,
			classLevel,
			sectionId,
			sectionName,
			aadhar,
			careerAspiration,
			rollNumber,
		} = formData;
		const aadharDigits = aadhar.replace(/\s+/g, '');

		if (!studentName || !guardianName || !phone || !schoolKey || !schoolName || !classId || !classLevel || !sectionId || !sectionName || !aadharDigits || !careerAspiration || !rollNumber) {
			toast({
				title: 'Validation Error',
				description: 'Please fill in all required fields, including school, class, and section.',
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
				body: JSON.stringify({
					...formData,
					aadhar: aadharDigits,
					role: 'student',
				}),
			});

			const data = await res.json();

			if (!res.ok || !data.payment_session_id) {
				throw new Error(data.message || 'Payment session error.');
			}

			await cashfreeSDK?.checkout({ paymentSessionId: data.payment_session_id });

			setSchoolSearch('');
			setClassSearch('');
			setSectionSearch('');
			setFormData({
				studentName: '',
				guardianName: '',
				phone: '',
				schoolKey: '',
				schoolName: '',
				classId: '',
				classLevel: '',
				sectionId: '',
				sectionName: '',
				aadhar: '',
				amount: '100',
				careerAspiration: '',
				rollNumber: '',
			});
			setClasses([]);
			setSections([]);
			toast({
				title: 'Success',
				description: 'Registration successful! Proceeding to payment.',
				variant: 'default',
			});
		} catch (err: unknown) {
			if (err instanceof Error) {
				toast({
					title: 'Error',
					description: err.message || 'Something went wrong.',
					variant: 'destructive',
				});
			}
		} finally {
			setLoading(false);
		}
	};
	return (
		<div className="public-flow-page">
			<div className="public-flow-shell-narrow">
				{/* Header Section */}
				<div className="public-flow-hero text-center">
					<div className="public-flow-badge mb-4">
						Step 1 of 1
					</div>
					<h1 className="text-4xl font-extrabold tracking-tight text-foreground md:text-5xl">
						{testConfig?.name || 'Talent Test'} Registration
					</h1>
					<p className="mt-4 text-lg text-muted-foreground">
						Fill in the details below to secure your spot in the national-level STEM assessment.
					{testConfig?.duration && <span className="mt-2 block text-sm font-medium text-muted-foreground">⏱ Duration: {testConfig.duration} &bull; Subjects: {(testConfig.subjects || ['Mathematics', 'Science', 'English']).join(', ')}</span>}
					</p>
					<div className="public-flow-banner mt-6 inline-flex items-center gap-3">
						<span className="text-2xl">
							{testConfig?.currency === 'INR' ? '₹' : testConfig?.currency === 'USD' ? '$' : '€'}
							{testConfig?.price || 100}
						</span>
						<span className="text-sm font-normal opacity-90">Registration Fee</span>
					</div>
				</div>

			{/* Main Form Card */}
				<div className="public-flow-surface">
					<form onSubmit={handleSubmit} className="space-y-8">
						{directoryError ? (
							<div className="app-feedback app-feedback-error">{directoryError}</div>
						) : null}
						{/* Student Details Section */}
						<div className="space-y-6">
							<h2 className="flex items-center gap-3 text-xl font-semibold tracking-[-0.02em] text-foreground">
								<span className="public-flow-step">1</span>
								Student Information
							</h2>

							{/* Student Name */}
							<div>
									<label className="public-flow-label" htmlFor="studentName">
										Student Full Name <span className="text-red-500">*</span>
									</label>
									<input
										type="text"
										name="studentName"
										id="studentName"
										value={formData.studentName}
										onChange={handleChange}
										placeholder="Enter student's full name as per Aadhar"
									className="public-flow-input"
									required
								/>
							</div>

								{/* School */}
								<div>
									<label className="public-flow-label" htmlFor="schoolKey">
										School <span className="text-red-500">*</span>
									</label>
									<SearchableDatalistInput
										id="schoolKey"
										name="schoolKey"
										value={schoolSearch}
										onChange={handleSchoolInputChange}
										onBlur={handleSchoolInputBlur}
										autoFocus
										placeholder={directoryLoading.schools ? 'Loading schools...' : schools.length > 0 ? 'Search and select school' : 'No schools available'}
										disabled={directoryLoading.schools || schools.length === 0}
										aria-invalid={schoolSelectionPending}
										options={schoolOptions}
										required
									/>
								</div>
								{/* Roll Number */}
								<div>
										<label className="public-flow-label" htmlFor="rollNumber">
											School Roll Number <span className="text-red-500">*</span>
										</label>
										<input
											type="text"
											name="rollNumber"
											id="rollNumber"
											value={formData.rollNumber}
											onChange={handleChange}
											placeholder="Current school roll number"
											className="public-flow-input"
											required
										/>
								</div>

								<div className="grid gap-6 md:grid-cols-3">
									{/* Class */}
									<div>
										<label className="public-flow-label" htmlFor="classId">
											Current Class <span className="text-red-500">*</span>
										</label>
										<SearchableDatalistInput
											id="classId"
											name="classId"
											value={classSearch}
											onChange={handleClassInputChange}
											onBlur={handleClassInputBlur}
											placeholder={!formData.schoolKey ? 'Select school first' : directoryLoading.classes ? 'Loading classes...' : classes.length > 0 ? 'Search and select class' : 'No classes available'}
											disabled={!formData.schoolKey || directoryLoading.classes || classes.length === 0}
											aria-invalid={classSelectionPending}
											options={classOptions}
											required
										/>
									</div>

									{/* Section */}
									<div>
										<label className="public-flow-label" htmlFor="sectionId">
											Section <span className="text-red-500">*</span>
										</label>
										<SearchableDatalistInput
											id="sectionId"
											name="sectionId"
											value={sectionSearch}
											onChange={handleSectionInputChange}
											onBlur={handleSectionInputBlur}
											placeholder={!formData.classId ? 'Select class first' : directoryLoading.sections ? 'Loading sections...' : sections.length > 0 ? 'Search and select section' : 'No sections available'}
											disabled={!formData.classId || directoryLoading.sections || sections.length === 0}
											aria-invalid={sectionSelectionPending}
											options={sectionOptions}
											required
										/>
									</div>

									{/* Phone */}
									<div>
										<label className="public-flow-label" htmlFor="phone">
											Mobile Number <span className="text-red-500">*</span>
										</label>
										<input
											type="tel"
											name="phone"
											id="phone"
											value={formData.phone}
											onChange={handleChange}
											placeholder="10-digit mobile number"
											pattern="[0-9]{10}"
											className="public-flow-input"
											required
										/>
									</div>
								</div>

							{/* Aadhar */}
							<div>
									<label className="public-flow-label" htmlFor="aadhar">
										Aadhar Number <span className="text-red-500">*</span>
									</label>
									<input
										type="text"
										name="aadhar"
										id="aadhar"
										value={formData.aadhar}
										onChange={handleChange}
										placeholder="1234 5678 9012"
										maxLength={14} // 12 digits + 2 spaces
										className="public-flow-input"
									required
								/>
							</div>

							{/* Career Aspiration */}
							<div>
									<label className="public-flow-label" htmlFor="careerAspiration">
										Career Aspiration <span className="text-red-500">*</span>
									</label>
									<input
										type="text"
										name="careerAspiration"
										id="careerAspiration"
										value={formData.careerAspiration}
										onChange={handleChange}
										placeholder="e.g., Doctor, Engineer, Scientist, Artist, etc."
										className="public-flow-input"
									required
								/>
							</div>
						</div>

						{/* Guardian Details Section */}
						<div className="public-flow-section">
							<h2 className="flex items-center gap-3 text-xl font-semibold tracking-[-0.02em] text-foreground">
								<span className="public-flow-step">2</span>
								Guardian Information
							</h2>

							{/* Guardian Name */}
							<div>
								<label className="public-flow-label" htmlFor="guardianName">
									Parent/Guardian Full Name <span className="text-red-500">*</span>
								</label>
								<input
									type="text"
									name="guardianName"
									id="guardianName"
									value={formData.guardianName}
									onChange={handleChange}
									placeholder="Enter parent or guardian's full name"
									className="public-flow-input"
									required
								/>
							</div>
						</div>

						{/* Terms & Conditions */}
						<div className="public-flow-section space-y-4">
							<div className="public-flow-card-soft">
								<div className="flex items-start gap-3">
									<input
										type="checkbox"
										id="terms"
										checked={acceptedTerms}
										onChange={e => setAcceptedTerms(e.target.checked)}
										className="mt-1 h-5 w-5 rounded border-border text-primary transition focus:ring-2 focus:ring-ring/20"
										required
									/>
									<label htmlFor="terms" className="text-sm leading-6 text-muted-foreground">
										I accept the{' '}
										<Link
											href="/terms"
											target="_blank"
											rel="noopener noreferrer"
											className="font-semibold text-primary underline underline-offset-4 transition-colors hover:text-foreground"
										>
											Terms & Conditions
										</Link>{' '}
										and confirm that all information provided is accurate. I understand that the registration fee is non-refundable once payment is completed.
									</label>
								</div>
							</div>

							{!acceptedTerms && (
								<p className="text-sm font-medium text-amber-700 dark:text-amber-300">
									⚠️ Please accept the terms and conditions to proceed
								</p>
							)}
						</div>

						{/* Submit Button */}
						<div className="public-flow-section space-y-4">
							<button
								type="submit"
								disabled={loading || !cashfreeSDK || !acceptedTerms || directoryLoading.schools || directoryLoading.classes || directoryLoading.sections}
								className="public-flow-button-primary w-full text-base sm:text-lg"
							>
								{loading
									? '⏳ Processing...'
									: !cashfreeSDK
									? '⏳ Loading Payment Gateway...'
									: `💳 Pay ${testConfig?.currency === 'INR' ? '₹' : testConfig?.currency === 'USD' ? '$' : '€'}${testConfig?.price || 100} & Complete Registration`}
							</button>

							<p className="text-center text-xs text-muted-foreground">
								🔒 Secure payment powered by Cashfree • Your data is encrypted and safe
							</p>
						</div>
					</form>

					{/* Benefits Reminder */}
					<div className="public-flow-card-soft mt-8 space-y-3">
						<h3 className="font-semibold text-foreground">What you&apos;ll get:</h3>
						<ul className="space-y-3 text-sm text-muted-foreground">
							{(testConfig?.features && testConfig.features.length > 0
								? testConfig.features
								: [
									'Instant hall ticket generation via WhatsApp',
									'Comprehensive STEM assessment for your class level',
									'Detailed performance report with error-type analysis',
									'Study materials and previous year papers',
									'Certificates and awards for top performers',
									'Eligibility for mentorship programs with STEM experts',
								]
							).map((item, idx) => (
								<li key={idx} className="flex items-start gap-2">
									<span className="mt-0.5 text-primary">✓</span>
									<span>{item}</span>
								</li>
							))}
						</ul>
					</div>
				</div>

				{/* Help Section */}
				<div className="mt-8 text-center">
					<p className="text-sm text-muted-foreground">
						Need help? Contact us at{' '}
						<a href="tel:+919876543210" className="font-semibold text-primary transition-colors hover:text-foreground">
							+91-98765-43210
						</a>{' '}
						or WhatsApp us for instant support.
					</p>
					<Link
						href="/talent-test"
						className="public-flow-text-link mt-3"
					>
						← Back to Talent Test Details
					</Link>
				</div>
			</div>
		</div>
	);
}
