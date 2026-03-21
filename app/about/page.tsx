import { InnerHero } from "@/components/InnerHero";
import Link from "next/link";
import { Reveal, Stagger } from "@/components/Reveal";
import { LottieAnimation } from "@/components/LottieAnimation";
import { connectDB } from '@/lib/db';
import SiteStats from '@/models/SiteStats';
import FAQ from '@/models/FAQ';
import ContactInfo from '@/models/ContactInfo';

export const revalidate = 60; // re-fetch from DB every 60s

export const metadata = {
  title: "About Us | Alyra Tech",
  description: "Built by IITians & NITians to transform K-12 education.",
};

const ABOUT_DEFAULTS: { key: string; label: string; value: string; icon?: string }[] = [
  { key: 'founded', label: 'Founded', value: '2020' },
  { key: 'students', label: 'Students Analyzed', value: '50K+' },
  { key: 'states', label: 'States Impacted', value: '15+' },
  { key: 'schools', label: 'Partner Schools', value: '500+' },
];

interface FAQItem { question: string; answer: string }

async function getAboutStats() {
  try {
    const work = (async () => {
      await connectDB();
            const [doc, faqDocs, contactDoc]: [any, any[], any] = await Promise.all([
        SiteStats.findOne({ section: 'about' }).lean(),
        FAQ.find({ page: 'about', isActive: true }).sort({ displayOrder: 1 }).lean(),
        ContactInfo.findOne().lean(),
      ]);
      if (!doc?.stats?.length) return { stats: ABOUT_DEFAULTS, faqs: faqDocs.map((f: any) => ({ question: f.question, answer: f.answer })) as FAQItem[] };
      const aboutStats: typeof ABOUT_DEFAULTS = doc.stats.map((s: any) => ({ key: s.key, label: s.label, value: String(s.value), icon: s.icon }));
      return {
        stats: aboutStats,
        faqs: faqDocs.map((f: any) => ({ question: f.question, answer: f.answer })) as FAQItem[], 
        contact: {
          email: contactDoc?.email || 'hello@beyondmarks.edu',
          phone: contactDoc?.phone || '+91 98765 43210',
          whatsappNumber: contactDoc?.whatsappNumber || '',
          city: contactDoc?.city || 'Hitech City, Hyderabad, India',
          address: contactDoc?.address || 'Innovation Hub',
        },
      };
    })();
    return await work;
  } catch {
    return { stats: ABOUT_DEFAULTS, faqs: [], contact: { email: 'hello@beyondmarks.edu', phone: '+91 98765 43210', whatsappNumber: '', city: 'Hitech City, Hyderabad, India', address: 'Innovation Hub' } };
  }
}

export default async function AboutPage() {
  const { stats: aboutStats, faqs, contact } = await getAboutStats();
  const contactSafe = contact ?? { email: 'hello@beyondmarks.edu', phone: '+91 98765 43210', whatsappNumber: '', city: 'Hitech City, Hyderabad, India', address: 'Innovation Hub' };
  const waDigits = (contactSafe.whatsappNumber || contactSafe.phone).replace(/\D+/g, '');
  // Tailored demo request message for WhatsApp; falls back to /contact when not available
  const waHref = waDigits ? `https://wa.me/${waDigits}?text=${encodeURIComponent('Hello! I would like to request a demo of Alyra Tech’s diagnostics for our school.')}` : '';
  return (
    <main className="bg-slate-50/50 min-h-screen">
      <InnerHero 
        title="Built by Educators," 
        subtitle="Driven by Evidence"
        pillText="Our Mission"
        lottieLeft="/animations/seo-isometric-team.lottie"
        whatsappHref={waHref}
      />

      <section className="mx-auto max-w-7xl px-6 py-20 lg:px-8 relative">
        {/* Story Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mb-32">
          <Reveal>
             <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 mb-6">Marks don&apos;t tell the whole story.</h2>
             <div className="space-y-6 text-lg text-slate-600 leading-relaxed">
               <p>A student scores 60% in math—but why? Is it algebra? Geometry? Or just calculation errors?</p>
               <p>As graduates from <strong className="text-slate-900">IITs and NITs</strong>, we saw talented students fall through the cracks because the system couldn&apos;t identify their specific learning needs.</p>
               <p>We built <strong className="text-emerald-700 font-semibold">Alyra Tech</strong> to provide the visibility that grades miss. We believe every educational decision should be backed by evidence, not guesswork.</p>
             </div>
          </Reveal>
          <Reveal delay={0.2}>
            <div className="relative aspect-[4/3] rounded-[2rem] overflow-hidden shadow-2xl bg-gradient-to-br from-emerald-50 to-blue-50 flex items-center justify-center max-w-lg mx-auto">
               <LottieAnimation src="/animations/team-collaboration.lottie" className="w-full h-full" />
            </div>
          </Reveal>
        </div>

        {/* ─── Founder's Note ─── */}
        <div className="mb-16 md:mb-32 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/60 via-white to-blue-50/60 rounded-[2.5rem]" />
          <div className="absolute -top-8 -left-8 w-40 h-40 bg-emerald-400/10 rounded-full blur-[60px] pointer-events-none" />
          <div className="absolute -bottom-8 -right-8 w-40 h-40 bg-blue-400/10 rounded-full blur-[60px] pointer-events-none" />
          
          <Reveal>
            <div className="relative z-10 border border-emerald-100/80 rounded-[2.5rem] p-8 sm:p-12 lg:p-16 text-center overflow-hidden">
              {/* Decorative quote marks */}
              <div className="absolute top-6 left-8 text-[120px] md:text-[180px] font-serif text-emerald-100 leading-none select-none pointer-events-none">&ldquo;</div>
              <div className="absolute bottom-2 right-8 text-[120px] md:text-[180px] font-serif text-emerald-100 leading-none select-none pointer-events-none rotate-180">&ldquo;</div>
              
              <div className="relative z-10">
                <div className="inline-block rounded-full bg-emerald-500/10 px-5 py-2 text-sm font-semibold uppercase tracking-widest text-emerald-700 border border-emerald-200/60 mb-8">
                  Founder&apos;s Note
                </div>
                
                <h3 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 leading-[1.15] mb-6 max-w-4xl mx-auto">
                  Every student deserves{' '}
                  <span className="relative inline-block">
                    <span className="relative z-10 text-emerald-600">attention.</span>
                    <span className="absolute bottom-1 left-0 w-full h-3 bg-emerald-200/50 -rotate-1 rounded-sm" />
                  </span>
                </h3>
                
                <p className="text-xl md:text-2xl text-slate-600 leading-relaxed max-w-2xl mx-auto mb-8">
                  With the right attention, we don&apos;t just improve grades — we{' '}
                  <strong className="text-slate-900 font-semibold">transform lives</strong>.{' '}
                  A child who believes they&apos;re &ldquo;bad at math&rdquo; just hasn&apos;t found the gap we can fix.
                </p>
                
                <div className="flex items-center justify-center gap-4">
                  <div className="h-px w-12 bg-emerald-300" />
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-emerald-500/20">
                      US
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-slate-900 text-sm">Uday Suram</p>
                      <p className="text-xs text-slate-500">CEO &amp; Founder &bull; Alyra Tech</p>
                    </div>
                  </div>
                  <div className="h-px w-12 bg-emerald-300" />
                </div>
              </div>
            </div>
          </Reveal>
        </div>

        {/* Stats Grid - Dynamic from Admin */}
        <div className="mb-16 md:mb-32 relative">
          <Stagger className={`grid grid-cols-2 ${aboutStats.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-4'} gap-6 md:gap-8`}>
            {aboutStats.map((stat) => (
              <div key={stat.key} className="bg-white p-6 md:p-10 rounded-[2rem] border border-slate-100 shadow-sm text-center group hover:-translate-y-1 transition-transform duration-300">
                 {stat.icon && <div className="text-2xl mb-2">{stat.icon}</div>}
                 <div className="text-4xl md:text-6xl font-bold text-slate-900 mb-2 group-hover:text-emerald-600 transition-colors">{stat.value}</div>
                 <div className="text-sm font-medium text-slate-500 uppercase tracking-widest">{stat.label}</div>
              </div>
            ))}
          </Stagger>
        </div>

        {/* Values Section */}
        <div className="bg-slate-900 text-white rounded-[2rem] md:rounded-[2.5rem] p-6 sm:p-10 lg:p-20 relative overflow-hidden">
           <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-emerald-500/20 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/2"></div>
           
           <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-16">
             <div>
               <div className="inline-block rounded-full bg-emerald-500/20 px-4 py-1.5 text-sm font-medium text-emerald-300 border border-emerald-500/30 mb-8">
                 Our Core Values
               </div>
               <h3 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">Precision over Intuition</h3>
               <p className="text-slate-300 text-lg leading-relaxed max-w-md">
                 We are a team of data scientists and educators obsessed with finding the &quot;why&quot; behind every student&apos;s performance.
               </p>
             </div>
             
             <div className="grid gap-6">
                {[
                  { title: "Data-Driven", desc: "Decisions based on hard metrics, not gut feelings." },
                  { title: "Student-First", desc: "Every feature we build ultimately serves the learner." },
                  { title: "Teacher Efficiency", desc: "We help improve efficiency for teachers. With huge teacher-student ratios, our company helps teachers understand each student better and enables more personalized attention." }
                ].map((val, i) => (
                  <div key={i} className="bg-white/5 border border-white/10 p-6 rounded-2xl hover:bg-white/10 transition-colors">
                    <h4 className="text-xl font-bold text-white mb-2">{val.title}</h4>
                    <p className="text-slate-400">{val.desc}</p>
                  </div>
                ))}
             </div>
           </div>
        </div>

        {/* Contact Block (Dynamic from Admin Contact Info) */}
        <div className="mt-16 md:mt-24">
          <Reveal>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">Email</div>
                <a href={`mailto:${contactSafe.email}`} className="text-slate-900 font-bold hover:text-emerald-600 transition-colors">{contactSafe.email}</a>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">Phone</div>
                <a href={`tel:${contactSafe.phone.replace(/\s+/g, '')}`} className="text-slate-900 font-bold hover:text-emerald-600 transition-colors">{contactSafe.phone}</a>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">HQ</div>
                <div className="text-slate-900 font-bold">{contactSafe.city}</div>
                <div className="text-slate-500 text-xs mt-1 uppercase tracking-wider">{contactSafe.address}</div>
              </div>
            </div>
            {waDigits && (
              <div className="mt-6">
                <a href={waHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full bg-green-600 px-5 py-3 text-sm font-semibold text-white shadow hover:bg-green-500">
                  <span>💬</span>
                  <span>Chat on WhatsApp</span>
                </a>
              </div>
            )}
          </Reveal>
        </div>

        {/* How We Work */}
        <div className="mt-16 md:mt-32 mb-16 md:mb-32 relative">
          <div className="text-center mb-16">
            <Reveal>
              <div className="inline-block rounded-full bg-slate-100 px-4 py-1.5 text-sm font-medium text-slate-600 border border-slate-200 mb-6">
                Our Process
              </div>
              <h3 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">How We Transform Schools</h3>
              <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">From onboarding to outcomes in four simple steps.</p>
              <div className="mt-8 mx-auto max-w-xs">
                <LottieAnimation src="/animations/rocket-success.lottie" className="w-full h-[200px]" />
              </div>
            </Reveal>
          </div>
          <Stagger className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            {[
              { step: "01", title: "Baseline Assessment", desc: "Deploy our diagnostic test to capture a snapshot of every student\u2019s current skill landscape." },
              { step: "02", title: "Deep Analysis", desc: "Our AI engine maps conceptual gaps, error patterns, and learning pace at the sub-topic level." },
              { step: "03", title: "Actionable Reports", desc: "Teachers and parents receive heatmaps, personalized action plans, and benchmark comparisons." },
              { step: "04", title: "Track Growth", desc: "Re-assess quarterly to measure improvement, adjust strategies, and celebrate wins." },
            ].map((item, i) => (
              <div key={i} className="relative bg-white p-6 md:p-8 rounded-[2rem] border border-slate-100 shadow-sm group hover:-translate-y-1 transition-transform duration-300">
                <div className="text-6xl font-black text-slate-100 group-hover:text-emerald-100 transition-colors absolute top-4 right-6 select-none pointer-events-none">{item.step}</div>
                <div className="relative z-10">
                  <h4 className="text-xl font-bold text-slate-900 mb-3 mt-8">{item.title}</h4>
                  <p className="text-slate-600 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </Stagger>
        </div>

        {/* FAQ Section */}
        {faqs.length > 0 && (
          <div className="mb-16 md:mb-32">
            <Reveal>
              <h3 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight text-center mb-12">Frequently Asked Questions</h3>
            </Reveal>
            <Stagger className="space-y-6 max-w-3xl mx-auto">
              {faqs.map((faq, i) => (
                <div key={i} className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                  <h4 className="text-lg font-bold text-slate-900">{faq.question}</h4>
                  <p className="mt-3 text-slate-600 leading-relaxed">{faq.answer}</p>
                </div>
              ))}
            </Stagger>
          </div>
        )}

        {/* Bottom CTA */}
        <div className="rounded-[2rem] md:rounded-[2.5rem] bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 p-6 sm:p-10 lg:p-16 text-center text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-overlay pointer-events-none"></div>
          <Reveal>
            <h3 className="relative z-10 text-3xl md:text-4xl font-bold mb-4">Want to see Alyra Tech in action?</h3>
            <p className="relative z-10 text-lg text-white/80 max-w-xl mx-auto mb-8">
              Schedule a demo and see how our diagnostics can elevate your school&apos;s outcomes.
            </p>
            <div className="relative z-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              {waHref ? (
                <a
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full bg-white px-8 py-4 text-lg font-semibold text-teal-700 shadow-xl transition hover:shadow-2xl hover:opacity-95"
                  aria-label="Request a demo on WhatsApp"
                >
                  Request a Demo
                </a>
              ) : (
                <Link href="/contact" className="rounded-full bg-white px-8 py-4 text-lg font-semibold text-teal-700 shadow-xl transition hover:shadow-2xl hover:opacity-95">
                  Request a Demo
                </Link>
              )}
              <Link href="/talent-test" className="rounded-full border-2 border-white px-8 py-4 text-lg font-semibold text-white transition hover:bg-white/10">
                Try the Talent Test
              </Link>
            </div>
          </Reveal>
        </div>

      </section>
    </main>
  );
}
