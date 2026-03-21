import Link from 'next/link';
import Image from 'next/image';
import { Hero3D } from '@/components/Landing3D';
import { ProCard } from '@/components/ProCard';
import GlassPanel from '@/components/GlassPanel';
import { Reveal, Stagger } from '@/components/Reveal';
import { connectDB } from '@/lib/db';
import SiteStats from '@/models/SiteStats';
import TalentTestConfig from '@/models/TalentTestConfig';
import Testimonial from '@/models/Testimonial';
import FAQ from '@/models/FAQ';
import ContactInfo from '@/models/ContactInfo';

export const revalidate = 60;

export const metadata = {
  title: 'Alyra Tech — The Future of Education Intelligence',
  description: 'AI-driven diagnostics for K-12 education. Identify learning gaps with precision.',
};

async function getHomePageData() {
  try {
    const dataPromise = (async () => {
      await connectDB();
            const [statsDoc, testConfig, testimonials, faqDocs, contactInfo]: [any, any, any[], any[], any] = await Promise.all([
        SiteStats.findOne({ section: 'homepage' }).lean(),
        TalentTestConfig.findOne().lean(),
        Testimonial.find({ section: 'homepage', isActive: true }).sort({ displayOrder: 1 }).lean(),
        FAQ.find({ page: 'homepage', isActive: true }).sort({ displayOrder: 1 }).lean(),
        ContactInfo.findOne().lean(),
      ]);
      // Mirror Contact page behavior: fallback to phone if whatsappNumber is not set
      const rawWa = (contactInfo?.whatsappNumber || contactInfo?.phone || process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '').toString();
      const digits = rawWa.replace(/\D+/g, '');
      const whatsappHref = digits
        ? `https://wa.me/${digits}?text=${encodeURIComponent('Hello! I’d like to know more about Alyra Tech’s diagnostics.')}`
        : '';
      return {
        stats: statsDoc?.stats ?? [],
        testConfig: testConfig ?? null,
        testimonials: testimonials.map((t: any) => ({  
          quote: t.quote, author: t.author,
          role: [t.role, t.school, t.location].filter(Boolean).join(', '),
          rating: t.rating ?? 5, image: t.image || null,
        })),
        faqs: faqDocs.map((f: any) => ({ question: f.question, answer: f.answer })), 
        whatsappHref,
      };
    })();

    const timeoutPromise = new Promise<{ stats: never[]; testConfig: null; testimonials: never[]; faqs: never[]; whatsappHref: '' }>((resolve) =>
      setTimeout(() => resolve({ stats: [], testConfig: null, testimonials: [], faqs: [], whatsappHref: '' }), 2000)
    );

    return await Promise.race([dataPromise, timeoutPromise]);
  } catch {
    return { stats: [], testConfig: null, testimonials: [], faqs: [], whatsappHref: '' };
  }
}

export default async function HomePage() {
  const { stats, testConfig, testimonials, faqs, whatsappHref } = await getHomePageData();

  const homeStats: { key: string; label: string; value: string; icon?: string }[] = stats.length
    ? stats.map((s: { key: string; label: string; value: string | number; icon?: string }) => ({ key: s.key, label: s.label, value: String(s.value), icon: s.icon }))
    : [
        { key: 'tested', label: 'Students Tested', value: '50K+', icon: '👨‍🎓' },
        { key: 'schools', label: 'Schools', value: '500+', icon: '🏫' },
        { key: 'accuracy', label: 'Diagnostic Accuracy', value: '100%', icon: '🎯' },
        { key: 'time', label: 'Teacher Time Saved', value: '40%', icon: '⏱️' },
      ];
  const testPrice = typeof testConfig?.price === 'number' ? testConfig.price : undefined;

  return (
    <div className="relative min-h-screen bg-white text-slate-900 selection:bg-teal-500/30 dark:bg-slate-950 dark:text-slate-100 transition-colors duration-500 overflow-x-hidden">

      {/* Hero (mobile-safe) */}
      <div className="relative overflow-hidden">
        <Hero3D whatsappHref={whatsappHref} />
      </div>

      {/* Premium Value Section */}
      <section aria-labelledby="value-heading" className="relative border-t border-slate-200/70 bg-white text-gray-900 dark:text-gray-100 py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="mx-auto max-w-4xl text-center">
              <span className="inline-flex items-center rounded-full border border-teal-200 bg-teal-50 px-4 py-1 text-xs sm:text-sm font-semibold tracking-wide text-teal-700">
                Post-assessment command center
              </span>
              <h2 id="value-heading" className="mt-4 text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-slate-900 leading-[1.15]">
                Clear insight. Faster action. Better outcomes.
              </h2>
              <p className="mt-5 text-base sm:text-lg md:text-xl text-slate-900/80 max-w-2xl mx-auto leading-relaxed">
                Get leadership-ready analytics and teacher-ready recommendations from one diagnostic flow.
              </p>
            </div>
          </Reveal>

          <div className="mt-10 md:mt-12">
            <div className="rounded-[2rem] border border-slate-200/80 bg-gradient-to-br from-white via-slate-50/70 to-teal-50/50 shadow-[0_18px_50px_rgba(15,23,42,0.08)] p-4 sm:p-6 md:p-10">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-10 items-center">
                <div className="lg:col-span-5">
                  <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 leading-tight">
                    One diagnostic, multiple layers of decision intelligence.
                  </h3>
                  <p className="mt-4 text-slate-700 leading-relaxed">
                    School leaders see trends, teachers get intervention clarity, and students receive targeted support — all from the same assessment cycle.
                  </p>

                  <div className="mt-6 space-y-3">
                    {[
                      'School → class → student drill-down in seconds',
                      'Topic-level error pattern tracking',
                      'Action-ready remediation guidance',
                    ].map((item) => (
                      <div key={item} className="flex items-start gap-3 text-sm sm:text-base text-slate-700">
                        <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-teal-100 text-teal-700 text-xs font-bold">✓</span>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 flex flex-col sm:flex-row gap-3">
                    <Link href="/talent-test" className="inline-flex items-center justify-center rounded-md bg-teal-600 text-white px-6 py-3 font-semibold hover:bg-teal-700 transition-colors">
                      Start Baseline Test
                    </Link>
                    <Link href="/contact" className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white text-slate-800 px-6 py-3 font-semibold hover:bg-slate-50 transition-colors">
                      Request Demo
                    </Link>
                  </div>
                </div>

                <div className="lg:col-span-7">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
                    <div className="relative w-full">
                      <div className="pt-[56%]" />
                      <Image
                        src="/images/source-frontend/ttf-gemini-6cards.png"
                        alt="Diagnostic analytics dashboard preview"
                        fill
                        sizes="(max-width: 1024px) 100vw, 55vw"
                        className="object-contain"
                        priority
                      />
                    </div>
                  </div>

                  <div className={`mt-4 grid grid-cols-2 ${homeStats.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-4'} gap-3`}>
                    {homeStats.map((s) => (
                      <div key={`top-${s.key}`} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-center">
                        <div className="text-lg sm:text-xl font-bold text-slate-900 tabular-nums">{s.value}</div>
                        <div className="mt-1 text-[10px] sm:text-xs uppercase tracking-wide text-slate-500">{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 md:mt-10">
              <Stagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 md:gap-10 items-stretch">
                {[
                  { icon: '📊', title: 'Performance Snapshot', desc: 'Instant school → class → student intelligence in one clear view.' },
                  { icon: '🧭', title: 'Strengths & Risks', desc: 'Spot top-performing skills and early-risk areas before scores drop.' },
                  { icon: '🧩', title: 'Misconceptions Map', desc: 'Separate conceptual gaps from procedural errors by topic.' },
                  { icon: '✅', title: 'Action Playbook', desc: 'Get practical teaching moves and worksheet recommendations.' },
                ].map((c) => (
                  <ProCard key={c.title} icon={c.icon} title={c.title} description={c.desc} accent="teal" />
                ))}
              </Stagger>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section aria-labelledby="solutions-heading" className="relative z-10 py-16 md:py-20 border-t border-slate-200/20 bg-gradient-to-br from-slate-900 via-slate-900 to-teal-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 md:mb-14 text-center">
            <span className="inline-flex items-center rounded-full border border-teal-200/40 bg-teal-200/10 px-4 py-1.5 text-xs sm:text-sm font-semibold uppercase tracking-wider text-teal-200 mb-5">
              Platform Capabilities
            </span>
            <h2 id="solutions-heading" className="text-3xl md:text-5xl font-bold text-white mb-7 tracking-tight">
              From diagnostics to institution-wide execution
            </h2>
            <p className="mx-auto max-w-2xl text-base md:text-lg text-white/80 leading-relaxed">
              Every module is aligned to the same goal: faster decisions, better interventions, and measurable learning improvement.
            </p>
          </div>

          <div>
            {/* Mobile/tablet image */}
            <div className="lg:hidden mx-auto max-w-md mb-8">
              <div className="rounded-2xl p-4 bg-white/10 ring-1 ring-white/20 shadow-sm backdrop-blur-sm">
                <div className="relative w-full h-64 sm:h-72">
                  <Image
                    src="/images/source-frontend/ttf-gemini-6cards.png"
                    alt="Intelligent education insights illustration"
                    fill
                    sizes="(max-width: 640px) 100vw, 50vw"
                    className="object-contain"
                    priority
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Single section image (desktop) */}
              <div className="hidden lg:block lg:col-span-5">
                <div className="flex items-center justify-center rounded-3xl p-4 bg-white/10 ring-1 ring-white/20 shadow-[0_16px_44px_rgba(2,132,199,0.2)] backdrop-blur-sm">
                  {/* Make image scale to match the full column height so it aligns with the stacked cards */}
                  <div className="relative w-full max-w-xl">
                    {/* natural height is driven by intrinsic ratio via next/image with object-contain */}
                    <div className="pt-[56%]" />
                    <Image
                      src="/images/source-frontend/ttf-gemini-6cards.png"
                      alt="Intelligent education insights illustration"
                      fill
                      sizes="(max-width: 1280px) 45vw, 40vw"
                      className="object-contain"
                      priority
                    />
                  </div>
                </div>
              </div>
              <div className="lg:col-span-7">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-7 md:gap-10 items-stretch">
                  {[
                    { title: 'Deep Diagnostics', description: 'Pinpoint precise learning gaps with AI-powered analysis, enabling targeted interventions for every student.', icon: '🧬' },
                    { title: 'Predictive ERP', description: 'Streamline campus management with adaptive systems that forecast needs and optimize operations.', icon: '⚡' },
                    { title: 'Alumni Network', description: 'Build lasting connections with graduates through automated engagement tools and community platforms.', icon: '🌐' },
                    { title: 'OMR Digitization', description: 'Digitize assessments effortlessly with high-accuracy scanning via mobile devices.', icon: '📱' },
                    { title: 'Growth Analytics', description: 'Track student progress with intuitive visualizations and predictive trend analysis.', icon: '📈' },
                    { title: 'Parent Connect', description: 'Facilitate seamless communication between schools and families with secure, organized channels.', icon: '💬' },
                  ].map((f) => (
                    <ProCard key={f.title} icon={f.icon} title={f.title} description={f.description} accent="teal" />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* Stats Band */}
      <section aria-label="Impact statistics" className="py-16 md:py-20 relative overflow-hidden bg-white border-t border-slate-200/70">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(20,184,166,0.1),transparent_55%)]" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 md:mb-10">
            <span className="inline-flex items-center rounded-full border border-teal-200 bg-teal-50 px-4 py-1.5 text-xs sm:text-sm font-semibold uppercase tracking-wider text-teal-700 mb-4">
              Impact Snapshot
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">Trusted impact in numbers</h2>
            <p className="mt-3 text-slate-600 max-w-2xl mx-auto">A clear snapshot of outcomes delivered for schools, teachers, and learners.</p>
          </div>
          <div className={`grid grid-cols-2 ${homeStats.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-4'} gap-8 md:gap-10 text-center`}>
            {homeStats.map((stat) => (
              <div key={stat.key} className="py-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 flex flex-col items-center gap-2 shadow-[0_10px_30px_rgba(15,23,42,0.07)] transition-all duration-300 hover:-translate-y-1 hover:bg-white">
                  {stat.icon && <div className="text-2xl md:text-3xl text-teal-600">{stat.icon}</div>}
                  <div className="text-4xl md:text-6xl font-bold text-slate-900 tracking-tight tabular-nums leading-none">{stat.value}</div>
                  <div className="text-slate-500 text-[11px] md:text-xs tracking-wide uppercase">{stat.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      {testimonials.length > 0 && (
        <section aria-labelledby="testimonials-heading" className="py-16 md:py-20 bg-gradient-to-br from-teal-50 via-cyan-50 to-white relative border-t border-slate-200/60">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Reveal>
              <div className="text-center mb-4">
                <span className="inline-flex items-center rounded-full border border-teal-600/30 bg-white px-4 py-1.5 text-xs sm:text-sm font-semibold uppercase tracking-wider text-teal-700">
                  Real Outcomes
                </span>
              </div>
              <h2 id="testimonials-heading" className="text-3xl md:text-4xl font-bold text-center text-slate-900 mb-4">Voices from Our Community</h2>
              <p className="text-center text-slate-900/85 max-w-2xl mx-auto mb-12">Insights from educators and parents transforming education with Alyra Tech.</p>
            </Reveal>
            <GlassPanel
              className="rounded-2xl shadow-[0_16px_50px_rgba(0,0,0,0.10)] transition-shadow duration-500"
              bgClassName="bg-white/60"
              blurClassName="backdrop-blur-xl backdrop-saturate-150"
              borderClassName="border-slate-200/70 dark:border-white/15"
              textureUrl="https://www.transparenttextures.com/patterns/bubbles.png"
              textureOpacityClass="opacity-5"
              noiseUrl="https://grainy-gradients.vercel.app/noise.svg"
              noiseOpacityClass="opacity-5"
              specular
              edgeHighlight
            >
              <div className="px-4 sm:px-6 md:px-8 lg:px-10 py-8 sm:py-10 md:py-12">
                <Stagger className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                  {testimonials.map((t: { quote: string; author: string; role: string; rating: number; image: string | null }, i: number) => (
                    <div key={i} className="rounded-2xl p-7 md:p-8 border border-slate-200/80 bg-white/90 backdrop-blur-sm text-slate-900 shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
                      <div className="flex gap-1 mb-4 text-teal-500">
                        {[...Array(t.rating)].map((_, j) => <span key={j}>⭐</span>)}
                      </div>
                      <p className="text-slate-900 leading-relaxed">&quot;{t.quote}&quot;</p>
                      <div className="mt-6 pt-4 border-t border-slate-200 flex items-center gap-3">
                        {t.image ? (
                          <Image src={t.image} alt={t.author} width={40} height={40} className="w-10 h-10 rounded-full object-cover" unoptimized />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-teal-500/20 flex items-center justify-center text-teal-700 dark:text-teal-300 font-bold">{t.author.charAt(0)}</div>
                        )}
                        <div>
                          <p className="font-semibold text-slate-900 text-sm">{t.author}</p>
                          <p className="text-xs text-slate-700/80">{t.role}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </Stagger>
              </div>
            </GlassPanel>
          </div>
        </section>
      )}

      {/* FAQ Section */}
      {faqs.length > 0 && (
        <section aria-labelledby="faq-heading" className="py-16 md:py-20 bg-white border-t border-gray-200/70 dark:border-gray-800/60 relative">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <Reveal>
              <div className="text-center mb-4">
                <span className="inline-flex items-center rounded-full border border-slate-300 bg-slate-50 px-4 py-1.5 text-xs sm:text-sm font-semibold uppercase tracking-wider text-slate-700">
                  Need Clarity?
                </span>
              </div>
              <h2 id="faq-heading" className="text-3xl md:text-4xl font-bold text-center text-slate-900 mb-14">Common Questions Answered</h2>
            </Reveal>
            <div>
              <Stagger className="space-y-5 md:space-y-7">
                {faqs.map((faq: { question: string; answer: string }, i: number) => (
                  <div key={i} className="rounded-2xl border border-slate-200 bg-slate-50 p-6 md:p-7 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-white hover:shadow-lg">
                    <h3 className="text-lg font-semibold text-slate-900">{faq.question}</h3>
                    <p className="mt-3 text-slate-800/90 leading-relaxed">{faq.answer}</p>
                  </div>
                ))}
              </Stagger>
            </div>
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section aria-labelledby="cta-heading" className="relative py-20 md:py-24 overflow-hidden bg-gradient-to-br from-cyan-700 via-teal-700 to-emerald-700 text-white border-t border-slate-200/30">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-25 [background-image:radial-gradient(rgba(255,255,255,0.45)_1px,transparent_1px)] [background-size:30px_30px]" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 id="cta-heading" className="text-3xl sm:text-4xl md:text-5xl font-bold mb-7 sm:mb-10 tracking-tight">Elevate Your Institution Today</h2>
          <p className="text-base sm:text-lg md:text-xl mb-10 md:mb-12 max-w-2xl mx-auto text-white/90 leading-relaxed">
            Join leading educational institutions leveraging data-driven insights to foster student success.
            {typeof testPrice === 'number' ? (
              <><br />Pricing begins at just <span className="font-bold">{testPrice} INR</span> per assessment.</>
            ) : null}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <Link href="/contact" className="rounded-md bg-white text-teal-700 px-8 py-4 md:px-10 md:py-5 text-base md:text-lg font-semibold transition-all hover:shadow-lg hover:-translate-y-1">
              Book Demo
            </Link>
            <Link href="/register" className="rounded-md border-2 border-white/80 text-white px-8 py-4 md:px-10 md:py-5 text-base md:text-lg font-semibold transition-all hover:bg-white hover:text-teal-700 hover:shadow-lg hover:-translate-y-1">
              Get Started
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
