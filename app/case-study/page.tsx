import { InnerHero } from "@/components/InnerHero";
import { Reveal, Stagger } from "@/components/Reveal";
import { LottieAnimation } from "@/components/LottieAnimation";
import Link from "next/link";
import { cache } from 'react';
import { connectDB } from '@/lib/db';
import CaseStudy from '@/models/CaseStudy';
import SiteStats from '@/models/SiteStats';
import Testimonial from '@/models/Testimonial';

export const revalidate = 60; // re-fetch from DB every 60s

interface CSData {
  schoolName: string;
  location: string;
  studentCount: number;
  challenge: string;
  solution: string;
  resultsText: string;
  quote: string;
  quoteAuthor: string;
  metrics: { metric: string; label: string; sub: string }[];
}

interface HeaderStat { value: string; label: string; icon: string }
interface TestimonialData { quote: string; author: string; role: string; school: string; rating: number }

const DEFAULT_HEADER_STATS: HeaderStat[] = [
  { value: '500+', label: 'Schools Served', icon: '🏫' },
  { value: '85%', label: 'Avg. Improvement', icon: '📈' },
  { value: '2M+', label: 'Students Impacted', icon: '👨‍🎓' },
  { value: '95%', label: 'Satisfaction Rate', icon: '⭐' },
];

const DEFAULT_TESTIMONIALS: TestimonialData[] = [];

function docToCS(doc: any): CSData { 
  return {
    schoolName: doc.schoolName || 'School Name',
    location: doc.location || '',
    studentCount: doc.studentCount || 0,
    challenge: doc.challenge || '',
    solution: doc.solution || '',
    resultsText: doc.results?.length ? doc.results.join(' ') : '',
    quote: doc.testimonial?.quote || '',
    quoteAuthor: [doc.testimonial?.role, doc.testimonial?.author].filter(Boolean).join(', ') || '',
    metrics: doc.metrics?.length
      ? doc.metrics.map((m: { improvement: string; label: string; before: string | number; after: string | number }) => ({
            metric: m.improvement,
            label: m.label,
            sub: `${m.before} → ${m.after}`,
          }))
      : [],
  };
}

const getCaseStudyData = cache(async () => {
  try {
    const work = (async () => {
      await connectDB();
            const [docs, statsDoc, testimonials]: [any[], any, any[]] = await Promise.all([
        CaseStudy.find({ isActive: true }).sort({ isFeatured: -1, displayOrder: 1 }).lean(),
        SiteStats.findOne({ section: 'casestudy' }).lean(),
        Testimonial.find({ section: 'casestudy', isActive: true }).sort({ displayOrder: 1 }).lean(),
      ]);

      // Split into featured (first match) and the rest
      const featuredDoc = docs.find((d: any) => d.isFeatured) || docs[0] || null; 
      const featuredCS: CSData | null = featuredDoc ? docToCS(featuredDoc) : null;
      const otherDocs = featuredDoc ? docs.filter((d: any) => d !== featuredDoc) : []; 
      const otherCaseStudies: CSData[] = otherDocs.map(docToCS);

      const headerStats: HeaderStat[] = statsDoc?.stats?.length
        ? statsDoc.stats.map((s: any) => ({ value: String(s.value), label: s.label || s.key, icon: s.icon || '📊' }))  
        : DEFAULT_HEADER_STATS;

      const tList: TestimonialData[] = testimonials.length
        ? testimonials.map((t: any) => ({  
            quote: t.quote,
            author: t.author,
            role: t.role,
            school: [t.school, t.location].filter(Boolean).join(', '),
            rating: t.rating ?? 5,
          }))
        : DEFAULT_TESTIMONIALS;

      return { featured: featuredCS, otherCaseStudies, headerStats, testimonials: tList };
    })();
    return await work;
  } catch {
    return { featured: null, otherCaseStudies: [], headerStats: DEFAULT_HEADER_STATS, testimonials: DEFAULT_TESTIMONIALS };
  }
});

export async function generateMetadata() {
  const { featured } = await getCaseStudyData();
  return {
    title: `Case Studies | Alyra Tech`,
    description: featured
      ? `See how schools like ${featured.schoolName} transformed academic outcomes with Alyra Tech.`
      : 'See how schools are transforming academic outcomes with Alyra Tech.',
  };
}

export default async function CaseStudyPage() {
  const { featured, otherCaseStudies, headerStats, testimonials: csTestimonials } = await getCaseStudyData();
  return (
    <main className="bg-slate-50/50 min-h-screen">
      <InnerHero 
        title="Real Impact, Real Growth" 
        subtitle="See how schools are transforming their academic performance with Alyra Tech."
        pillText="Case Studies"
        lottieRight="/animations/school-building.lottie"
        lottieLeft="/animations/success-graduation.lottie"
      />

      <section className="mx-auto max-w-7xl px-6 py-20 lg:px-8 relative">
        {/* Background Blob */}
        <div className="absolute top-0 right-0 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-l from-emerald-100/30 to-blue-100/30 rounded-full blur-[80px] pointer-events-none" />

        {/* Header Stats Band */}
        {headerStats.length > 0 && (
          <Stagger className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-20">
            {headerStats.map((stat, i) => (
              <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm text-center group hover:-translate-y-1 transition-transform duration-300">
                <div className="text-2xl mb-2">{stat.icon}</div>
                <div className="text-3xl md:text-4xl font-black text-slate-900 group-hover:text-emerald-600 transition-colors">{stat.value}</div>
                <div className="text-sm font-medium text-slate-500 mt-1">{stat.label}</div>
              </div>
            ))}
          </Stagger>
        )}

        {/* ─── Featured Case Study ─── */}
        {featured ? (
          <>
            <div className="mb-20 text-center max-w-3xl mx-auto">
              <span className="mb-4 inline-block rounded-full bg-emerald-100/50 px-3 py-1 text-sm font-semibold uppercase tracking-wider text-emerald-700 border border-emerald-100">Featured Story</span>
              <h2 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl mt-6">{featured.schoolName}</h2>
              <p className="mt-2 text-lg text-slate-500 font-medium">{featured.location} &bull; {featured.studentCount.toLocaleString()} Students</p>
              <p className="mt-4 text-xl text-slate-600 leading-relaxed">
                A journey from rote memorization to <span className="text-emerald-700 font-medium">deep conceptual understanding</span>.
              </p>
            </div>

            <div className="grid gap-16 lg:grid-cols-2 items-center">
               <Reveal>
                 <div className="space-y-10">
                   <div className="relative pl-8 border-l-2 border-emerald-200">
                     <h3 className="text-xl font-bold text-slate-900 mb-3">The Challenge</h3>
                     <p className="text-lg text-slate-600 leading-relaxed">{featured.challenge}</p>
                   </div>
                   <div className="relative pl-8 border-l-2 border-blue-200">
                     <h3 className="text-xl font-bold text-slate-900 mb-3">The Solution</h3>
                     <p className="text-lg text-slate-600 leading-relaxed">{featured.solution}</p>
                   </div>
                   <div className="relative pl-8 border-l-2 border-emerald-500 bg-emerald-50/30 py-6 pr-6 rounded-r-2xl">
                     <h3 className="text-xl font-bold text-slate-900 mb-3">The Results</h3>
                     <p className="text-lg text-slate-600 leading-relaxed">{featured.resultsText}</p>
                   </div>
                 </div>
               </Reveal>

               <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[2rem] shadow-2xl ring-1 ring-slate-900/10 group bg-gradient-to-br from-emerald-50 to-blue-50">
                 <div className="flex items-center justify-center h-full">
                   <LottieAnimation src="/animations/online-learning-scene.lottie" className="w-full h-full" />
                 </div>
               </div>
            </div>

            {/* Featured Key Metrics */}
            <div className="mt-16 md:mt-32 mb-16">
              <Reveal>
                <h3 className="mb-8 md:mb-12 text-center text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">The Numbers Speak — {featured.schoolName}</h3>
              </Reveal>
              <Stagger className={`grid grid-cols-2 ${featured.metrics.length <= 4 ? `md:grid-cols-${featured.metrics.length}` : 'md:grid-cols-4'} gap-6`}>
                {featured.metrics.map((item, i) => (
                  <div key={i} className="bg-white p-5 md:p-8 rounded-[2rem] border border-slate-100 shadow-sm text-center group hover:-translate-y-1 transition-transform duration-300">
                    <div className="text-3xl md:text-4xl lg:text-5xl font-black text-slate-900 group-hover:text-emerald-600 transition-colors mb-2">{item.metric}</div>
                    <div className="text-sm font-semibold text-slate-700">{item.label}</div>
                    <div className="text-xs text-slate-400 mt-1">{item.sub}</div>
                  </div>
                ))}
              </Stagger>
            </div>
          </>
        ) : (
          <div className="mb-20 text-center max-w-3xl mx-auto py-16">
            <div className="text-6xl mb-6">📚</div>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Case Studies Coming Soon</h2>
            <p className="text-lg text-slate-500">We&apos;re documenting the success stories of schools using Alyra Tech. Check back soon!</p>
            <Link href="/contact" className="mt-8 inline-block rounded-full bg-emerald-600 px-8 py-3 text-white font-semibold hover:bg-emerald-700 transition-colors">Get in Touch</Link>
          </div>
        )}

        {/* ─── More Case Studies ─── */}
        {otherCaseStudies.length > 0 && (
          <div className="mt-16 md:mt-32">
            <Reveal>
              <div className="text-center mb-12">
                <span className="mb-4 inline-block rounded-full bg-blue-100/50 px-3 py-1 text-sm font-semibold uppercase tracking-wider text-blue-700 border border-blue-100">More Success Stories</span>
                <h3 className="text-3xl md:text-4xl font-bold text-slate-900 mt-4">Schools Across India Trust Alyra Tech</h3>
              </div>
            </Reveal>
            <Stagger className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {otherCaseStudies.map((study, i) => (
                <div key={i} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                  {/* Top gradient bar */}
                  <div className={`h-2 ${i % 3 === 0 ? 'bg-gradient-to-r from-emerald-400 to-teal-400' : i % 3 === 1 ? 'bg-gradient-to-r from-blue-400 to-indigo-400' : 'bg-gradient-to-r from-amber-400 to-orange-400'}`} />
                  <div className="p-6 md:p-8">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h4 className="text-xl font-bold text-slate-900">{study.schoolName}</h4>
                        <p className="text-sm text-slate-500">{study.location} &bull; {study.studentCount.toLocaleString()} Students</p>
                      </div>
                      <div className="flex-shrink-0 h-10 w-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-lg">{study.schoolName.charAt(0)}</div>
                    </div>

                    <div className="space-y-4 mb-6">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-400 font-bold mb-1">Challenge</p>
                        <p className="text-sm text-slate-600 line-clamp-3">{study.challenge}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-emerald-600 font-bold mb-1">Results</p>
                        <p className="text-sm text-slate-600 line-clamp-2">{study.resultsText}</p>
                      </div>
                    </div>

                    {/* Metrics row */}
                    {study.metrics.length > 0 && (
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        {study.metrics.slice(0, 4).map((m, j) => (
                          <div key={j} className="bg-slate-50 rounded-xl p-3 text-center">
                            <div className="text-lg font-black text-slate-900">{m.metric}</div>
                            <div className="text-xs text-slate-500">{m.label}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Quote */}
                    {study.quote && (
                      <div className="border-l-2 border-emerald-300 pl-4 mt-4">
                        <p className="text-sm italic text-slate-600">&quot;{study.quote}&quot;</p>
                        <p className="text-xs text-slate-400 mt-1 font-medium">— {study.quoteAuthor}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </Stagger>
          </div>
        )}

        {/* Testimonials from case-study section */}
        {csTestimonials.length > 0 && (
          <div className="mt-16 md:mt-24">
            <Reveal>
              <h3 className="mb-8 md:mb-12 text-center text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">What Educators Say</h3>
            </Reveal>
            <Stagger className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {csTestimonials.map((t, i) => (
                <div key={i} className="bg-white p-6 md:p-8 rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg transition-shadow duration-300">
                  <div className="mb-4 flex gap-1">
                    {[...Array(t.rating)].map((_, j) => (
                      <span key={j} className="text-lg text-amber-500">⭐</span>
                    ))}
                  </div>
                  <p className="italic text-slate-600 leading-relaxed">&quot;{t.quote}&quot;</p>
                  <div className="mt-5 pt-4 border-t border-slate-100">
                    <p className="font-bold text-slate-900">{t.author}</p>
                    <p className="text-sm text-slate-500">{t.role}{t.school ? ` • ${t.school}` : ''}</p>
                  </div>
                </div>
              ))}
            </Stagger>
          </div>
        )}

        {/* Bottom CTA */}
        <div className="mt-12 md:mt-20 rounded-[2rem] md:rounded-[2.5rem] bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 p-6 sm:p-10 lg:p-16 text-center text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-overlay pointer-events-none"></div>
          <Reveal>
            <h3 className="relative z-10 text-3xl md:text-4xl font-bold mb-4">Want results like these schools?</h3>
            <p className="relative z-10 text-lg text-white/80 max-w-xl mx-auto mb-8">
              Start with a baseline assessment and let data guide your school&apos;s transformation.
            </p>
            <div className="relative z-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/register" className="rounded-full bg-white px-8 py-4 text-lg font-semibold text-teal-700 shadow-xl transition hover:shadow-2xl hover:opacity-95">
                Register Your School
              </Link>
              <Link href="/contact" className="rounded-full border-2 border-white px-8 py-4 text-lg font-semibold text-white transition hover:bg-white/10">
                Talk to Our Team
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
