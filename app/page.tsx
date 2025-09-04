import Link from 'next/link';

// Remove 'use client' for static optimization and SEO, since no client-only logic is needed

const benefits = [
  { icon: '🌟', title: 'Holistic STEM Assessment', description: 'Comprehensive evaluation in Maths, Physics, and Chemistry for all-round growth.' },
  { icon: '💡', title: 'Insightful Performance Analytics', description: 'Detailed reports pinpointing strengths and areas for development with actionable insights.' },
  { icon: '🏆', title: 'Prestigious Recognition & Awards', description: 'Certificates of excellence, medals, and scholarships for top-tier achievements.' },
];

const uniqueFeatures = [
  {
    icon: '🔬',
    title: 'Deep Conceptual Testing',
    description: 'Beyond rote learning — our questions assess conceptual depth, application ability, and reasoning skills in core STEM subjects.',
    border: 'border-blue-500'
  },
  {
    icon: '📊',
    title: 'Personalized Insights',
    description: 'Get AI-powered reports that show exact skill gaps, learning pace, and comparative performance — a true diagnostic tool.',
    border: 'border-purple-500'
  },
  {
    icon: '🧑‍🔬',
    title: 'Focused for Future Innovators',
    description: 'Crafted to foster critical thinking, problem-solving, and early interest in STEM careers — aligned with NEP 2020 goals.',
    border: 'border-emerald-500'
  },
  {
    icon: '📚',
    title: 'Free Study Materials & Past Papers',
    description: 'All registered students get access to free downloadable resources, including previous year papers and curated mock sets.',
    border: 'border-rose-500'
  },
  {
    icon: '🏫',
    title: 'School & District Level Ranks',
    description: 'Recognition at multiple levels — not just national — so more students get rewarded and motivated to improve.',
    border: 'border-orange-500'
  },
  {
    icon: '📞',
    title: 'Mentorship + Career Guidance',
    description: 'Top performers receive mentorship sessions with experts to guide their learning journey and career planning.',
    border: 'border-cyan-500'
  },
];

const importantDates = [
  { label: 'Registrations Open', date: 'Jul 10', year: '2025', color: 'border-amber-400', textColor: 'text-amber-300', dateColor: 'text-amber-100' },
  { label: 'Last Day to Register', date: 'Aug 15', year: '2025', color: 'border-blue-400', textColor: 'text-blue-300', dateColor: 'text-blue-100' },
  { label: 'Test Week Commences', date: 'Sept 1-7', year: '2025', color: 'border-emerald-400', textColor: 'text-emerald-300', dateColor: 'text-emerald-100' },
];

// Add metadata for SEO (Next.js app directory)
export const metadata = {
  title: 'Young Scholars Talent Test | Ignite Brilliance. Master Tomorrow.',
  description: 'A national-level STEM talent assessment for Classes 1-10. Register now for holistic evaluation, AI-powered analytics, and exclusive awards.',
  openGraph: {
    title: 'Young Scholars Talent Test',
    description: 'A national-level STEM talent assessment for Classes 1-10. Register now for holistic evaluation, AI-powered analytics, and exclusive awards.',
    url: 'https://yourdomain.com/',
    siteName: 'Young Scholars Talent Initiative',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Young Scholars Talent Test',
      },
    ],
    locale: 'en_IN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Young Scholars Talent Test',
    description: 'A national-level STEM talent assessment for Classes 1-10. Register now for holistic evaluation, AI-powered analytics, and exclusive awards.',
    images: ['/og-image.png'],
  },
};

export default function TalentTestLandingPage() {
  // Remove useState/useEffect for fade-in for static optimization and SEO
  // If you want animation, use CSS only (e.g., animate-fade-in class with Tailwind or custom CSS)

  return (
    <div className="min-h-screen bg-neutral-950 text-white font-inter antialiased">
      {/* Hero Section */}
      <section className="relative z-10 flex flex-col items-center justify-center min-h-[90vh] py-28 px-4 text-white bg-gradient-to-br from-blue-950 via-indigo-950 to-purple-950">
        <div className="max-w-7xl mx-auto text-center animate-fade-in">
          <h1 className="text-5xl lg:text-7xl font-extrabold mb-6 leading-tight tracking-tight">
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-400">Ignite Brilliance.</span>
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">Master Tomorrow.</span>
          </h1>
          <p className="text-xl lg:text-2xl mb-12">
            A talent assessment designed for young innovators from <strong>Class 1st to 10th</strong>
          </p>
          <Link href="/register" prefetch>
            <button className="bg-gradient-to-r from-teal-500 to-green-600 px-10 py-4 rounded-full text-xl font-semibold shadow-lg hover:scale-105 transition-transform focus:outline-none focus:ring-2 focus:ring-green-400">
              Enroll Now ✨
            </button>
          </Link>
        </div>
      </section>

      {/* Unique Features Section */}
      <section className="py-24 px-4 sm:px-8 bg-white text-gray-900">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-extrabold text-center mb-16">What Makes Our Test Unique?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {uniqueFeatures.map((item, idx) => (
              <div key={idx} className={`bg-gray-100 p-8 rounded-xl shadow-lg border-l-4 ${item.border} hover:scale-[1.02] transition-transform`}>
                <h3 className="text-xl font-semibold mb-3">{item.icon} {item.title}</h3>
                <p>{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-24 px-4 sm:px-8 bg-gray-50 text-gray-900">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-extrabold text-center mb-16">Core Benefits</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {benefits.map((benefit, index) => (
              <div key={index} className="bg-white p-8 rounded-2xl shadow-lg border hover:scale-[1.02] transition-transform">
                <div className="text-4xl mb-4 text-blue-600">{benefit.icon}</div>
                <h3 className="text-2xl font-bold mb-2">{benefit.title}</h3>
                <p>{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Important Dates */}
      <section className="py-24 px-4 sm:px-8 bg-neutral-900 text-white">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-extrabold text-center mb-16">Key Dates</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {importantDates.map((item, index) => (
              <div key={index} className={`p-8 rounded-2xl bg-neutral-800 shadow-xl border-t-4 ${item.color}`}>
                <p className={`text-xl font-bold mb-3 ${item.textColor}`}>{item.label}</p>
                <p className={`text-5xl font-extrabold ${item.dateColor}`}>{item.date}</p>
                <p className={`text-lg mt-2 ${item.textColor}`}>{item.year}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Previous Papers */}
      <section className="py-24 px-4 sm:px-8 bg-white text-gray-900">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-4xl font-extrabold text-center mb-12">Download Previous Year Question Papers</h2>
          <div className="space-y-6">
            {[
              { title: 'Grade 5 Sample Paper', href: '/papers/sample-grade-5.pdf' },
              { title: 'Grade 8 Science + Math', href: '/papers/sample-grade-8.pdf' },
              { title: 'Grade 10 Talent Paper', href: '/papers/sample-grade-10.pdf' }
            ].map((paper, idx) => (
              <a
                key={idx}
                href={paper.href}
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-gray-100 hover:bg-gray-200 rounded-lg p-4 font-medium shadow-md transition"
              >
                ⬇️ {paper.title}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-neutral-900 text-white text-center py-12 px-4 border-t border-neutral-700">
        <p className="text-lg mb-3">&copy; {new Date().getFullYear()} Young Scholars Talent Initiative</p>
        <p className="text-sm text-gray-400">Shaping the future through foundational knowledge and innovation.</p>
      </footer>
    </div>
  );
}