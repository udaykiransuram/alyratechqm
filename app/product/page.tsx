export const metadata = {
  title: "Solutions | Alyra Tech",
  description: "Explore Alyra Tech solutions for diagnostics, ERP, alumni engagement, and OMR-based academic intelligence.",
};

import { InnerHero } from "@/components/InnerHero";
import { Reveal, Stagger } from "@/components/Reveal";
import { LottieAnimation } from "@/components/LottieAnimation";
import { ProductSolutions } from "@/components/ProductSolutions";
import Link from 'next/link';
import { CheckIcon } from '@heroicons/react/20/solid';
import { connectDB } from '@/lib/db';
import PricingPlan from '@/models/PricingPlan';
import SiteStats from '@/models/SiteStats';
import Testimonial from '@/models/Testimonial';
import FAQ from '@/models/FAQ';

export const revalidate = 60; // re-fetch from DB every 60s

/* ── Types and fallbacks when DB is empty / unreachable ── */
interface Tier {
  name: string;
  id: string;
  href: string;
  priceDisplay: string;
  periodLabel: string;
  description: string;
  features: string[];
  mostPopular: boolean;
  studentLimit: number;
}
const DEFAULT_TRUST: { key: string; label: string; value: string; icon?: string }[] = [
  { key: 'schools', label: 'Schools Onboarded', value: '500+', icon: '🏫' },
  { key: 'students', label: 'Students Diagnosed', value: '50K+', icon: '👨‍🎓' },
  { key: 'renewalRate', label: 'Renewal Rate', value: '98%', icon: '🔄' },
];

interface ProductTestimonial { quote: string; author: string; role: string; rating: number }
interface FAQItem { question: string; answer: string }
const DEFAULT_PRODUCT_TESTIMONIALS: ProductTestimonial[] = [];

function fmtPrice(price: number, currency = 'INR') {
  if (price === 0) return 'Custom';
  return (currency === 'INR' ? '₹' : currency + ' ') + price.toLocaleString('en-IN');
}
function fmtPeriod(bp: string) {
  return bp === 'monthly' ? '/month' : bp === 'yearly' ? '/year' : '';
}

async function getProductPageData() {
  try {
    const work = (async () => {
      await connectDB();
            const [plans, statsDoc, testimonials, faqDocs]: [any[], any, any[], any[]] = await Promise.all([
        PricingPlan.find({ isActive: true }).sort({ displayOrder: 1 }).lean(),
        SiteStats.findOne({ section: 'homepage' }).lean(),
        Testimonial.find({ section: 'product', isActive: true }).sort({ displayOrder: 1 }).lean(),
        FAQ.find({ page: 'product', isActive: true }).sort({ displayOrder: 1 }).lean(),
      ]);
      const tiers = plans.length
        ? plans.map((p: any) => ({
            name: p.name, id: `tier-${p._id}`, href: '/contact',
            priceDisplay: fmtPrice(p.price, p.currency),
            periodLabel: fmtPeriod(p.billingPeriod),
            description: p.description, features: p.features ?? [], mostPopular: !!p.isPopular,
            studentLimit: p.studentLimit || 0,
          }))
        : [];
      const trustStats: { key: string; label: string; value: string; icon?: string }[] =
        (statsDoc?.stats ?? []).length
          ? (statsDoc.stats as any[]).map((s: any) => ({ key: s.key, label: s.label, value: String(s.value), icon: s.icon }))
          : DEFAULT_TRUST;

      const productTestimonials: ProductTestimonial[] = testimonials.length
        ? testimonials.map((t: any) => ({
            quote: t.quote,
            author: t.author,
            role: [t.role, t.school, t.location].filter(Boolean).join(', '),
            rating: t.rating ?? 5,
          }))
        : DEFAULT_PRODUCT_TESTIMONIALS;
      return {
        tiers,
        trustStats,
        testimonials: productTestimonials,
        faqs: faqDocs.map((f: any) => ({ question: f.question, answer: f.answer })) as FAQItem[], 
      };
    })();
    return await work;
  } catch {
    return { tiers: [], trustStats: DEFAULT_TRUST, testimonials: DEFAULT_PRODUCT_TESTIMONIALS, faqs: [] };
  }
}

export default async function ProductPage() {
  const { tiers, trustStats, testimonials: productTestimonials, faqs } = await getProductPageData();

  return (
    <main className="bg-slate-50/50 min-h-screen">
      <InnerHero 
        title="Everything You Need" 
        subtitle="One process, endless possibilities for your institution."
        pillText="Solutions"
        lottieRight="/animations/online-learning-platform.lottie"
        lottieLeft="/animations/growth-chart.lottie"
      />

      {/* Solutions - Dynamic Animated Cards */}
      <ProductSolutions />

      {/* Pricing Section (render only when backend has active plans) */}
      {tiers.length > 0 && (
      <section className="mx-auto max-w-7xl px-6 py-24 lg:px-8 relative border-t border-slate-200/60 mt-20">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-gradient-to-r from-indigo-100/20 to-emerald-100/20 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="text-center max-w-2xl mx-auto mb-16 relative z-10">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Transparent Pricing</h2>
          <p className="mt-4 text-lg text-slate-600">Choose the perfect plan for your institution&apos;s size and ambitions.</p>
        </div>

        <Stagger className="grid max-w-lg grid-cols-1 gap-8 mx-auto lg:max-w-none lg:grid-cols-3 relative z-10">
          {tiers.map((tier) => (
            <div
              key={tier.id}
              className={`relative flex flex-col justify-between rounded-3xl p-8 transition-all duration-300 ${
                tier.mostPopular
                  ? 'bg-white ring-2 ring-emerald-500 shadow-2xl lg:scale-105 z-10'
                  : 'bg-white/60 backdrop-blur-sm ring-1 ring-slate-200 shadow-sm hover:shadow-lg hover:bg-white hover:-translate-y-1'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-x-4">
                  <h3
                    id={tier.id}
                    className={`text-lg font-semibold leading-8 ${
                      tier.mostPopular ? 'text-emerald-700' : 'text-slate-900'
                    }`}
                  >
                    {tier.name}
                  </h3>
                  {tier.mostPopular && (
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold leading-5 text-emerald-600 ring-1 ring-inset ring-emerald-200">
                      Most Popular
                    </span>
                  )}
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-600">{tier.description}</p>
                <p className="mt-6 flex items-baseline gap-x-1">
                  <span className="text-4xl font-bold tracking-tight text-slate-900">{tier.priceDisplay}</span>
                  {tier.periodLabel && <span className="text-sm font-semibold leading-6 text-slate-500">{tier.periodLabel}</span>}
                </p>
                <ul role="list" className="mt-8 space-y-3 text-sm leading-6 text-slate-600">
                  {tier.features.map((feature: string) => (
                    <li key={feature} className="flex gap-x-3">
                      <CheckIcon className="h-6 w-5 flex-none text-emerald-500" aria-hidden="true" />
                      {feature}
                    </li>
                  ))}
                  {tier.studentLimit > 0 && (
                    <li className="flex gap-x-3 font-medium text-slate-700">
                      <CheckIcon className="h-6 w-5 flex-none text-emerald-500" aria-hidden="true" />
                      Up to {tier.studentLimit.toLocaleString()} Students
                    </li>
                  )}
                </ul>
              </div>
              <Link
                href={tier.href}
                className={`mt-8 block rounded-xl px-3 py-3 text-center text-sm font-semibold leading-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 transition-all duration-300 ${
                  tier.mostPopular
                    ? 'bg-emerald-600 text-white shadow-md hover:bg-emerald-500 focus-visible:outline-emerald-600'
                    : 'bg-slate-50 text-slate-900 ring-1 ring-inset ring-slate-200 hover:bg-slate-100 hover:ring-slate-300'
                }`}
              >
                Get started
              </Link>
            </div>
          ))}
        </Stagger>
      </section>
      )}

      {/* Trust Band */}
      <section className="bg-slate-900 py-20 text-white">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <Reveal>
            <div className="text-center mb-12">
              <h3 className="text-3xl md:text-4xl font-bold tracking-tight">Trusted by India&apos;s Best Schools</h3>
              <p className="mt-3 text-slate-400 text-lg">Powering academic growth in 15+ states across the country.</p>
            </div>
          </Reveal>
          <Stagger className={`grid grid-cols-2 ${trustStats.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-4'} gap-8 text-center`}>
            {trustStats.map((stat) => (
              <div key={stat.key} className="py-4">
                {stat.icon && <div className="text-2xl md:text-3xl mb-2">{stat.icon}</div>}
                <div className="text-4xl md:text-5xl font-black text-white mb-2">{stat.value}</div>
                <div className="text-emerald-400 font-mono text-xs md:text-sm tracking-wider">{stat.label.toUpperCase()}</div>
              </div>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Product Testimonials */}
      {productTestimonials.length > 0 && (
        <section className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
          <Reveal>
            <div className="text-center mb-12">
              <h3 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900">What Our Clients Say</h3>
              <p className="mt-3 text-lg text-slate-600">Hear from schools already using Alyra Tech.</p>
            </div>
          </Reveal>
          <Stagger className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {productTestimonials.map((t, i) => (
              <div key={i} className="bg-white p-6 md:p-8 rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg transition-shadow duration-300">
                <div className="mb-4 flex gap-1">
                  {[...Array(t.rating)].map((_, j) => (
                    <span key={j} className="text-lg text-amber-500">⭐</span>
                  ))}
                </div>
                <p className="italic text-slate-600 leading-relaxed">&quot;{t.quote}&quot;</p>
                <div className="mt-5 pt-4 border-t border-slate-100">
                  <p className="font-bold text-slate-900">{t.author}</p>
                  <p className="text-sm text-slate-500">{t.role}</p>
                </div>
              </div>
            ))}
          </Stagger>
        </section>
      )}

      {/* FAQ Section */}
      {faqs.length > 0 && (
        <section className="mx-auto max-w-4xl px-6 py-20 lg:px-8">
          <Reveal>
            <h3 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 text-center mb-12">Frequently Asked Questions</h3>
          </Reveal>
          <Stagger className="space-y-6">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
                <h4 className="text-lg font-bold text-slate-900">{faq.question}</h4>
                <p className="mt-3 text-slate-600 leading-relaxed">{faq.answer}</p>
              </div>
            ))}
          </Stagger>
        </section>
      )}

      {/* Bottom CTA */}
      <section className="mx-auto max-w-7xl px-6 py-24 lg:px-8">
        <div className="rounded-[2rem] md:rounded-[2.5rem] bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 p-6 sm:p-10 lg:p-16 text-center text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-overlay pointer-events-none"></div>
          <div className="mx-auto max-w-xs mb-6">
            <LottieAnimation src="/animations/seo-team-isometric.lottie" className="w-full h-[200px]" />
          </div>
          <Reveal>
            <h3 className="relative z-10 text-3xl md:text-4xl font-bold mb-4">Ready to modernize your institution?</h3>
            <p className="relative z-10 text-lg text-white/80 max-w-xl mx-auto mb-8">
              Start with a pilot. No long-term contracts, no risk — just results.
            </p>
            <div className="relative z-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/contact" className="rounded-full bg-white px-8 py-4 text-lg font-semibold text-teal-700 shadow-xl transition hover:shadow-2xl hover:opacity-95">
                Book a Demo
              </Link>
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
