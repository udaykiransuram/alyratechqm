import { unstable_cache } from "next/cache";

import HomePageClient from "@/components/home/HomePageClient";
import type {
  HomeFaq,
  HomeStat,
  HomeTestimonial,
} from "@/components/home/home-content";
import { connectDB } from "@/lib/db";
import { resolvePublicPageData } from "@/lib/server/public-page-data";
import ContactInfo from "@/models/ContactInfo";
import FAQ from "@/models/FAQ";
import SiteStats from "@/models/SiteStats";
import TalentTestConfig from "@/models/TalentTestConfig";
import Testimonial from "@/models/Testimonial";

export const revalidate = 60;

export const metadata = {
  title: "Alyra Tech | Premium School Intelligence Platform",
  description:
    "Alyra Tech reveals the hidden learning patterns behind performance and connects diagnostics, reports, OMR, and school workflows in one premium platform for school leaders.",
};

type PlatformHomePageData = {
  stats: HomeStat[];
  testPrice: number | undefined;
  testimonials: HomeTestimonial[];
  faqs: HomeFaq[];
  whatsappHref: string;
};

const DEFAULT_HOME_STATS: HomeStat[] = [
  { key: "tested", label: "Students assessed", value: "50K+" },
  { key: "schools", label: "Schools supported", value: "500+" },
  { key: "accuracy", label: "Diagnostic confidence", value: "100%" },
  { key: "time", label: "Teacher time saved", value: "40%" },
];

const PLATFORM_HOME_FALLBACK: PlatformHomePageData = {
  stats: DEFAULT_HOME_STATS,
  testPrice: undefined,
  testimonials: [],
  faqs: [],
  whatsappHref: "",
};

const getPlatformHomePageData = unstable_cache(
  async (): Promise<PlatformHomePageData> => {
    return resolvePublicPageData(
      async () => {
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

        const resolvedStats: HomeStat[] =
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
          ) ?? [];

        return {
          stats: resolvedStats.length ? resolvedStats : DEFAULT_HOME_STATS,
          testPrice:
            typeof testConfig?.price === "number" ? testConfig.price : undefined,
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
      },
      PLATFORM_HOME_FALLBACK,
      2000,
    );
  },
  ["public-platform-home-page-data"],
  { revalidate: 60 },
);

export default async function PlatformHomePage() {
  const { stats, testPrice, testimonials, faqs, whatsappHref } =
    await getPlatformHomePageData();

  return (
    <HomePageClient
      stats={stats}
      testimonials={testimonials}
      faqs={faqs}
      testPrice={testPrice}
      whatsappHref={whatsappHref}
    />
  );
}
