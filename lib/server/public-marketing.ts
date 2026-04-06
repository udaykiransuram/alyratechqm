import "server-only";

import { unstable_cache } from "next/cache";

import type {
  HomeFaq,
  HomeStat,
  HomeTestimonial,
} from "@/components/home/home-content";
import { connectDB } from "@/lib/db";
import { resolvePublicPageData } from "@/lib/server/public-page-data";
import CaseStudy from "@/models/CaseStudy";
import ContactInfo from "@/models/ContactInfo";
import FAQ from "@/models/FAQ";
import PricingPlan from "@/models/PricingPlan";
import SiteStats from "@/models/SiteStats";
import TalentTestConfig from "@/models/TalentTestConfig";
import Testimonial from "@/models/Testimonial";

type PlatformHomePageData = {
  stats: HomeStat[];
  testPrice: number | undefined;
  testimonials: HomeTestimonial[];
  faqs: HomeFaq[];
  whatsappHref: string;
};

type CaseStudyData = {
  schoolName: string;
  location: string;
  studentCount: number;
  challenge: string;
  solution: string;
  resultsText: string;
  quote: string;
  quoteAuthor: string;
  metrics: { metric: string; label: string; sub: string }[];
};

type CaseStudyHeaderStat = {
  value: string;
  label: string;
  icon: string;
};

type CaseStudyTestimonial = {
  quote: string;
  author: string;
  role: string;
  school: string;
  rating: number;
};

type ProductTier = {
  name: string;
  id: string;
  href: string;
  priceDisplay: string;
  periodLabel: string;
  description: string;
  features: string[];
  mostPopular: boolean;
  studentLimit: number;
};

type ProductTrustStat = {
  key: string;
  label: string;
  value: string;
  icon?: string;
};

type ProductTestimonial = {
  quote: string;
  author: string;
  role: string;
  rating: number;
};

type FaqItem = {
  question: string;
  answer: string;
};

type ContactPageInfo = {
  email: string;
  phone: string;
  whatsappNumber: string;
  address: string;
  city: string;
  tagline: string;
  responseTime: string;
  responseDescription: string;
};

type MinimalContactDoc = {
  email?: string;
  phone?: string;
  whatsappNumber?: string;
  address?: string;
  city?: string;
  tagline?: string;
  responseTime?: string;
  responseDescription?: string;
};

type AboutStat = {
  key: string;
  label: string;
  value: string;
  icon?: string;
};

type AboutContactDoc = {
  email?: string;
  phone?: string;
  whatsappNumber?: string;
  city?: string;
  address?: string;
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

const DEFAULT_CASE_STUDY_HEADER_STATS: CaseStudyHeaderStat[] = [
  { value: "500+", label: "Schools Served", icon: "🏫" },
  { value: "85%", label: "Avg. Improvement", icon: "📈" },
  { value: "2M+", label: "Students Impacted", icon: "👨‍🎓" },
  { value: "95%", label: "Satisfaction Rate", icon: "⭐" },
];

const CASE_STUDY_FALLBACK = {
  featured: null as CaseStudyData | null,
  otherCaseStudies: [] as CaseStudyData[],
  headerStats: DEFAULT_CASE_STUDY_HEADER_STATS,
  testimonials: [] as CaseStudyTestimonial[],
};

const DEFAULT_PRODUCT_TRUST: ProductTrustStat[] = [
  { key: "schools", label: "Schools Onboarded", value: "500+", icon: "🏫" },
  { key: "students", label: "Students Diagnosed", value: "50K+", icon: "👨‍🎓" },
  { key: "renewalRate", label: "Renewal Rate", value: "98%", icon: "🔄" },
];

const PRODUCT_PAGE_FALLBACK = {
  tiers: [] as ProductTier[],
  trustStats: DEFAULT_PRODUCT_TRUST,
  testimonials: [] as ProductTestimonial[],
  faqs: [] as FaqItem[],
};

const CONTACT_DEFAULTS: ContactPageInfo = {
  email: "hello@beyondmarks.edu",
  phone: "+91 98765 43210",
  whatsappNumber: "",
  address: "Innovation Hub",
  city: "Hitech City, Hyderabad, India",
  tagline:
    "We'd love to hear from you. Let's transform education together.",
  responseTime: "< 24h",
  responseDescription:
    "Our team responds to every inquiry within 24 hours. For school partnerships, we typically schedule a demo within 48 hours.",
};

const ABOUT_DEFAULTS: AboutStat[] = [
  { key: "founded", label: "Founded", value: "2020" },
  { key: "students", label: "Students Analyzed", value: "50K+" },
  { key: "states", label: "States Impacted", value: "15+" },
  { key: "schools", label: "Partner Schools", value: "500+" },
];

const ABOUT_FALLBACK = {
  stats: ABOUT_DEFAULTS,
  faqs: [] as FaqItem[],
  contact: {
    email: "hello@beyondmarks.edu",
    phone: "+91 98765 43210",
    whatsappNumber: "",
    city: "Hitech City, Hyderabad, India",
    address: "Innovation Hub",
  },
};

function mapCaseStudyDoc(doc: any): CaseStudyData {
  return {
    schoolName: doc.schoolName || "School Name",
    location: doc.location || "",
    studentCount: doc.studentCount || 0,
    challenge: doc.challenge || "",
    solution: doc.solution || "",
    resultsText: doc.results?.length ? doc.results.join(" ") : "",
    quote: doc.testimonial?.quote || "",
    quoteAuthor:
      [doc.testimonial?.role, doc.testimonial?.author]
        .filter(Boolean)
        .join(", ") || "",
    metrics: doc.metrics?.length
      ? doc.metrics.map(
          (metric: {
            improvement: string;
            label: string;
            before: string | number;
            after: string | number;
          }) => ({
            metric: metric.improvement,
            label: metric.label,
            sub: `${metric.before} -> ${metric.after}`,
          }),
        )
      : [],
  };
}

function formatProductPrice(price: number, currency = "INR") {
  if (price === 0) return "Custom";
  return `${currency === "INR" ? "₹" : `${currency} `}${price.toLocaleString("en-IN")}`;
}

function formatProductPeriod(billingPeriod: string) {
  return billingPeriod === "monthly"
    ? "/month"
    : billingPeriod === "yearly"
      ? "/year"
      : "";
}

export const getPlatformHomePageData = unstable_cache(
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
              "Hello! I'd like to know more about Alyra Tech's diagnostics.",
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

export const getCaseStudyPageData = unstable_cache(
  async () => {
    return resolvePublicPageData(
      async () => {
        await connectDB();
        const [docs, statsDoc, testimonials]: [any[], any, any[]] =
          await Promise.all([
            CaseStudy.find({ isActive: true })
              .sort({ isFeatured: -1, displayOrder: 1 })
              .lean(),
            SiteStats.findOne({ section: "casestudy" }).lean(),
            Testimonial.find({ section: "casestudy", isActive: true })
              .sort({ displayOrder: 1 })
              .lean(),
          ]);

        const featuredDoc = docs.find((doc: any) => doc.isFeatured) || docs[0] || null;
        const featured = featuredDoc ? mapCaseStudyDoc(featuredDoc) : null;
        const otherCaseStudies = (featuredDoc
          ? docs.filter((doc: any) => doc !== featuredDoc)
          : []
        ).map(mapCaseStudyDoc);

        const headerStats: CaseStudyHeaderStat[] = statsDoc?.stats?.length
          ? statsDoc.stats.map((stat: any) => ({
              value: String(stat.value),
              label: stat.label || stat.key,
              icon: stat.icon || "📊",
            }))
          : DEFAULT_CASE_STUDY_HEADER_STATS;

        const caseStudyTestimonials: CaseStudyTestimonial[] = testimonials.length
          ? testimonials.map((testimonial: any) => ({
              quote: testimonial.quote,
              author: testimonial.author,
              role: testimonial.role,
              school: [testimonial.school, testimonial.location]
                .filter(Boolean)
                .join(", "),
              rating: testimonial.rating ?? 5,
            }))
          : [];

        return {
          featured,
          otherCaseStudies,
          headerStats,
          testimonials: caseStudyTestimonials,
        };
      },
      CASE_STUDY_FALLBACK,
      2000,
    );
  },
  ["public-case-study-page-data"],
  { revalidate: 60 },
);

export const getProductPageData = unstable_cache(
  async () => {
    return resolvePublicPageData(
      async () => {
        await connectDB();

        const [plans, statsDoc, testimonials, faqDocs]: [any[], any, any[], any[]] =
          await Promise.all([
            PricingPlan.find({ isActive: true }).sort({ displayOrder: 1 }).lean(),
            SiteStats.findOne({ section: "homepage" }).lean(),
            Testimonial.find({ section: "product", isActive: true })
              .sort({ displayOrder: 1 })
              .lean(),
            FAQ.find({ page: "product", isActive: true })
              .sort({ displayOrder: 1 })
              .lean(),
          ]);

        const tiers: ProductTier[] = plans.length
          ? plans.map((plan: any) => ({
              name: plan.name,
              id: `tier-${plan._id}`,
              href: "/contact",
              priceDisplay: formatProductPrice(plan.price, plan.currency),
              periodLabel: formatProductPeriod(plan.billingPeriod),
              description: plan.description,
              features: plan.features ?? [],
              mostPopular: Boolean(plan.isPopular),
              studentLimit: plan.studentLimit || 0,
            }))
          : [];

        const trustStats: ProductTrustStat[] = (statsDoc?.stats ?? []).length
          ? (statsDoc.stats as any[]).map((stat: any) => ({
              key: stat.key,
              label: stat.label,
              value: String(stat.value),
              icon: stat.icon,
            }))
          : DEFAULT_PRODUCT_TRUST;

        const productTestimonials: ProductTestimonial[] = testimonials.length
          ? testimonials.map((testimonial: any) => ({
              quote: testimonial.quote,
              author: testimonial.author,
              role: [testimonial.role, testimonial.school, testimonial.location]
                .filter(Boolean)
                .join(", "),
              rating: testimonial.rating ?? 5,
            }))
          : [];

        return {
          tiers,
          trustStats,
          testimonials: productTestimonials,
          faqs: faqDocs.map((faq: any) => ({
            question: faq.question,
            answer: faq.answer,
          })) as FaqItem[],
        };
      },
      PRODUCT_PAGE_FALLBACK,
      2000,
    );
  },
  ["public-product-page-data"],
  { revalidate: 60 },
);

export const getContactPageData = unstable_cache(
  async () => {
    return resolvePublicPageData(
      async () => {
        await connectDB();
        const contactQuery = ContactInfo.findOne().lean().exec() as Promise<
          MinimalContactDoc | null
        >;
        const faqQuery = FAQ.find({ page: "contact", isActive: true })
          .sort({ displayOrder: 1 })
          .lean<FaqItem[]>()
          .exec() as Promise<FaqItem[]>;
        const [infoDoc, faqDocs] = await Promise.all([contactQuery, faqQuery]);

        return {
          info: {
            email: infoDoc?.email || CONTACT_DEFAULTS.email,
            phone: infoDoc?.phone || CONTACT_DEFAULTS.phone,
            whatsappNumber:
              infoDoc?.whatsappNumber || CONTACT_DEFAULTS.whatsappNumber,
            address: infoDoc?.address || CONTACT_DEFAULTS.address,
            city: infoDoc?.city || CONTACT_DEFAULTS.city,
            tagline: infoDoc?.tagline || CONTACT_DEFAULTS.tagline,
            responseTime:
              infoDoc?.responseTime || CONTACT_DEFAULTS.responseTime,
            responseDescription:
              infoDoc?.responseDescription ||
              CONTACT_DEFAULTS.responseDescription,
          },
          faqs: faqDocs.map((faq) => ({
            question: faq.question,
            answer: faq.answer,
          })) as FaqItem[],
        };
      },
      { info: CONTACT_DEFAULTS, faqs: [] as FaqItem[] },
      2000,
    );
  },
  ["public-contact-page-data"],
  { revalidate: 60 },
);

export const getAboutPageData = unstable_cache(
  async () => {
    return resolvePublicPageData(
      async () => {
        await connectDB();

        const [doc, faqDocs, contactDoc] = (await Promise.all([
          SiteStats.findOne({ section: "about" }).lean(),
          FAQ.find({ page: "about", isActive: true })
            .sort({ displayOrder: 1 })
            .lean(),
          ContactInfo.findOne().lean() as Promise<AboutContactDoc | null>,
        ])) as [any, any[], AboutContactDoc | null];

        const stats: AboutStat[] = doc?.stats?.length
          ? doc.stats.map((stat: any) => ({
              key: stat.key,
              label: stat.label,
              value: String(stat.value),
              icon: stat.icon,
            }))
          : ABOUT_DEFAULTS;

        return {
          stats,
          faqs: faqDocs.map((faq: any) => ({
            question: faq.question,
            answer: faq.answer,
          })) as FaqItem[],
          contact: {
            email: contactDoc?.email || ABOUT_FALLBACK.contact.email,
            phone: contactDoc?.phone || ABOUT_FALLBACK.contact.phone,
            whatsappNumber:
              contactDoc?.whatsappNumber || ABOUT_FALLBACK.contact.whatsappNumber,
            city: contactDoc?.city || ABOUT_FALLBACK.contact.city,
            address: contactDoc?.address || ABOUT_FALLBACK.contact.address,
          },
        };
      },
      ABOUT_FALLBACK,
      2000,
    );
  },
  ["public-about-page-data"],
  { revalidate: 60 },
);
