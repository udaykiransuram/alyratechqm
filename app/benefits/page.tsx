import { connectDB } from '@/lib/db';
import SiteStats from '@/models/SiteStats';
import Testimonial from '@/models/Testimonial';
import BenefitsContent from './BenefitsContent';
import type { BenefitsStat, BenefitsTestimonial } from './BenefitsContent';

export const revalidate = 60;

export const metadata = {
  title: 'Benefits | Alyra Tech',
  description: 'Discover how Alyra Tech delivers physical diagnostic reports that transform schools, empower teachers, and uplift students.',
};

async function getBenefitsData() {
  try {
    const work = (async () => {
      await connectDB();
            const [statsDoc, testimonials]: [any, any[]] = await Promise.all([
        SiteStats.findOne({ section: 'benefits' }).lean(),
        Testimonial.find({ section: 'benefits', isActive: true }).sort({ displayOrder: 1 }).lean(),
      ]);

      const roiStats: BenefitsStat[] = statsDoc?.stats?.length
        ? statsDoc.stats.map((s: any) => ({  
            value: String(s.value),
            label: s.label || s.key,
            icon: s.icon || '📊',
          }))
        : [];

      const tList: BenefitsTestimonial[] = testimonials.length
        ? testimonials.map((t: any) => ({  
            quote: t.quote,
            author: t.author,
            role: t.role,
            school: [t.school, t.location].filter(Boolean).join(', '),
            rating: t.rating ?? 5,
          }))
        : [];

      return { roiStats, testimonials: tList };
    })();
    const timeout = new Promise<{ roiStats: BenefitsStat[]; testimonials: BenefitsTestimonial[] }>(
      (r) => setTimeout(() => r({ roiStats: [], testimonials: [] }), 3000),
    );
    return await Promise.race([work, timeout]);
  } catch {
    return { roiStats: [], testimonials: [] };
  }
}

export default async function BenefitsPage() {
  const { roiStats, testimonials } = await getBenefitsData();
  return <BenefitsContent roiStats={roiStats} testimonials={testimonials} />;
}
