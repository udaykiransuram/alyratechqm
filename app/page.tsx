import HomePageClient from "@/components/home/HomePageClient";
import type {
  HomeFaq,
  HomeStat,
  HomeTestimonial,
} from "@/components/home/home-content";
import { connectDB } from "@/lib/db";
import ContactInfo from "@/models/ContactInfo";
import FAQ from "@/models/FAQ";
import SiteStats from "@/models/SiteStats";
import TalentTestConfig from "@/models/TalentTestConfig";
import Testimonial from "@/models/Testimonial";

export const revalidate = 60;

export const metadata = {
  title: "Alyra Tech | Hidden Thinking Pattern Diagnostics for Schools",
  description:
    "Reveal the reasoning patterns grades miss. Alyra Tech gives schools a trust-first diagnostic story from school-wide signal to student-level intervention.",
};

async function getHomePageData() {
  try {
    await connectDB();

    const [statsDoc, testConfig, testimonials, faqDocs, contactInfo]: [
      any,
      any,
      any[],
      any[],
      any,
    ] = await Promise.all([
      SiteStats.findOne({ section: "homepage" }).lean(),
      TalentTestConfig.findOne().lean(),
      Testimonial.find({ section: "homepage", isActive: true })
        .sort({ displayOrder: 1 })
        .lean(),
      FAQ.find({ page: "homepage", isActive: true })
        .sort({ displayOrder: 1 })
        .lean(),
      ContactInfo.findOne().lean(),
    ]);

    const rawWhatsapp =
      (
        contactInfo?.whatsappNumber ||
        contactInfo?.phone ||
        process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ||
        ""
      ).toString();
    const digits = rawWhatsapp.replace(/\D+/g, "");
    const whatsappHref = digits
      ? `https://wa.me/${digits}?text=${encodeURIComponent(
          "Hello! I’d like to know more about Alyra Tech’s diagnostics.",
        )}`
      : "";

    return {
      stats:
        statsDoc?.stats?.map(
          (stat: {
            key: string;
            label: string;
            value: string | number;
            icon?: string;
          }) => ({
            key: stat.key,
            label: stat.label,
            value: String(stat.value),
            icon: stat.icon,
          }),
        ) ?? [],
      testConfig: testConfig ?? null,
      testimonials: testimonials.map((testimonial: any) => ({
        quote: testimonial.quote,
        author: testimonial.author,
        role: [testimonial.role, testimonial.school, testimonial.location]
          .filter(Boolean)
          .join(", "),
        rating: testimonial.rating ?? 5,
        image: testimonial.image || null,
      })),
      faqs: faqDocs.map((faq: any) => ({
        question: faq.question,
        answer: faq.answer,
      })),
      whatsappHref,
    };
  } catch {
    return {
      stats: [],
      testConfig: null,
      testimonials: [],
      faqs: [],
      whatsappHref: "",
    };
  }
}

export default async function HomePage() {
  const { stats, testConfig, testimonials, faqs, whatsappHref } =
    await getHomePageData();

  const homeStats: HomeStat[] = stats.length
    ? stats
    : [
        { key: "tested", label: "Students assessed", value: "50K+" },
        { key: "schools", label: "Schools supported", value: "500+" },
        { key: "accuracy", label: "Diagnostic confidence", value: "100%" },
        { key: "time", label: "Teacher time saved", value: "40%" },
      ];

  const homeTestimonials = testimonials as HomeTestimonial[];
  const homeFaqs = faqs as HomeFaq[];
  const testPrice =
    typeof testConfig?.price === "number" ? testConfig.price : undefined;

  return (
    <HomePageClient
      stats={homeStats}
      testimonials={homeTestimonials}
      faqs={homeFaqs}
      testPrice={testPrice}
      whatsappHref={whatsappHref}
    />
  );
}
