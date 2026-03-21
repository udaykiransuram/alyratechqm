import { InnerHero } from "@/components/InnerHero";
import ContactForm from "@/components/ContactForm";
import { Reveal } from "@/components/Reveal";
import { LottieAnimation } from "@/components/LottieAnimation";
import { EnvelopeIcon, PhoneIcon, MapPinIcon } from "@heroicons/react/24/outline";
import { connectDB } from "@/lib/db";
import ContactInfo from "@/models/ContactInfo";
import FAQ from "@/models/FAQ";

export const revalidate = 60;

export const metadata = {
  title: "Contact Us - Alyra Tech",
  description: "Get in touch with our team to start your transformation journey.",
};

const CONTACT_DEFAULTS = {
  email: "hello@beyondmarks.edu",
  phone: "+91 98765 43210",
  whatsappNumber: "",
  address: "Innovation Hub",
  city: "Hitech City, Hyderabad, India",
  tagline: "We'd love to hear from you. Let's transform education together.",
  responseTime: "< 24h",
  responseDescription:
    "Our team responds to every inquiry within 24 hours. For school partnerships, we typically schedule a demo within 48 hours.",
};

interface FAQItem { question: string; answer: string }
type ContactDoc = {
  email?: string;
  phone?: string;
  whatsappNumber?: string;
  address?: string;
  city?: string;
  tagline?: string;
  responseTime?: string;
  responseDescription?: string;
};

type MinimalFaq = { question: string; answer: string };

async function getContactPageData() {
  try {
    await connectDB();
    const contactQuery = ContactInfo.findOne().lean().exec() as Promise<ContactDoc | null>;
    const faqQuery = FAQ.find({ page: "contact", isActive: true })
      .sort({ displayOrder: 1 })
      .lean<MinimalFaq[]>()
      .exec() as Promise<MinimalFaq[]>;
    const [infoDoc, faqDocs] = await Promise.all([contactQuery, faqQuery]);
    return {
      info: {
        email: infoDoc?.email || CONTACT_DEFAULTS.email,
        phone: infoDoc?.phone || CONTACT_DEFAULTS.phone,
        whatsappNumber: infoDoc?.whatsappNumber || CONTACT_DEFAULTS.whatsappNumber,
        address: infoDoc?.address || CONTACT_DEFAULTS.address,
        city: infoDoc?.city || CONTACT_DEFAULTS.city,
        tagline: infoDoc?.tagline || CONTACT_DEFAULTS.tagline,
        responseTime: infoDoc?.responseTime || CONTACT_DEFAULTS.responseTime,
        responseDescription: infoDoc?.responseDescription || CONTACT_DEFAULTS.responseDescription,
      },
      faqs: (faqDocs as MinimalFaq[]).map((f) => ({ question: f.question, answer: f.answer })) as FAQItem[],
    };
  } catch {
    return { info: CONTACT_DEFAULTS, faqs: [] };
  }
}

export default async function ContactPage() {
  const { info, faqs } = await getContactPageData();
  const waDigits = (info.whatsappNumber || info.phone).replace(/\D+/g, "");
  const waText = "Hello Alyra Tech! I would like to know more about your diagnostics.";
  const waHref = waDigits ? `https://wa.me/${waDigits}?text=${encodeURIComponent(waText)}` : "";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://your-domain.com";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Alyra Tech",
    url: siteUrl,
    email: info.email,
    contactPoint: [
      {
        "@type": "ContactPoint",
        telephone: waDigits ? `+${waDigits}` : info.phone,
        contactType: "customer support",
        areaServed: "IN",
        availableLanguage: ["en", "hi"],
        email: info.email,
      },
    ],
    address: {
      "@type": "PostalAddress",
      addressLocality: info.city,
      streetAddress: info.address,
      addressCountry: "IN",
    },
  } as const;

  return (
    <main className="bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <InnerHero
        title="Get in touch for a demo"
        subtitle={info.tagline}
        pillText="Contact"
        lottieRight="/animations/appointment-booking.lottie"
        whatsappHref={waHref}
      >
        {waDigits && (
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Chat on WhatsApp"
            title="Chat on WhatsApp"
            className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] text-white shadow-md hover:bg-[#1ebd5a] transition-colors"
          >
            <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20.52 3.48A11.94 11.94 0 0012.06 0C5.44 0 .05 5.39.05 12.02c0 2.12.55 4.2 1.6 6.02L0 24l6.1-1.59a11.95 11.95 0 005.96 1.6h.01c6.62 0 12.01-5.39 12.01-12.02 0-3.21-1.25-6.22-3.56-8.53zM12.07 22c-1.86 0-3.67-.5-5.26-1.45l-.38-.23-3.62.94.97-3.53-.25-.36a9.91 9.91 0 01-1.55-5.35C2.98 6.5 7.51 2 12.07 2 16.64 2 21.2 6.5 21.2 12.02 21.2 17.55 16.64 22 12.07 22zm5.52-6.6c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.39-1.45-.88-.78-1.47-1.74-1.64-2.03-.17-.3-.02-.46.13-.61.14-.14.3-.33.45-.5.15-.17.2-.29.3-.48.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51l-.57-.01c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.47 0 1.45 1.07 2.86 1.22 3.06.15.2 2.11 3.23 5.11 4.53.71.31 1.26.5 1.69.64.71.23 1.36.2 1.87.12.57-.08 1.77-.72 2.02-1.42.25-.7.25-1.3.18-1.42-.07-.12-.27-.2-.57-.34z" />
            </svg>
          </a>
        )}
      </InnerHero>

      <section className="mx-auto max-w-7xl px-4 py-20 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20">
          {/* Left: Visual + concise info */}
          <div className="order-1 space-y-8">
            <div className="flex justify-center">
              <LottieAnimation src="/animations/contact-us.lottie" className="w-full max-w-xs h-[220px] md:max-w-sm md:h-[240px]" />
            </div>
            <Reveal>
              <div className="rounded-3xl bg-white border border-slate-200 p-8 shadow-md transition-shadow hover:shadow-lg">
                <h3 className="text-2xl font-extrabold text-slate-900 mb-6 tracking-tight">Contact Information</h3>
                <div className="space-y-6 divide-y divide-slate-100">
                  <div className="flex gap-5 items-start pb-6 min-w-0">
                    <div className="flex-none rounded-xl bg-emerald-50 p-4 text-emerald-600 ring-1 ring-emerald-100"><EnvelopeIcon className="h-6 w-6" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900 text-base">Email</p>
                      <a href={`mailto:${info.email}`} className="text-slate-600 hover:text-emerald-600 transition-colors underline underline-offset-2 break-words whitespace-normal">{info.email}</a>
                    </div>
                  </div>
                  <div className="flex gap-5 items-start py-6 min-w-0">
                    <div className="flex-none rounded-xl bg-emerald-50 p-4 text-emerald-600 ring-1 ring-emerald-100"><PhoneIcon className="h-6 w-6" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900 text-base">Phone</p>
                      <a href={`tel:${info.phone.replace(/\s+/g, "")}`} className="text-slate-600 hover:text-emerald-600 transition-colors underline underline-offset-2 break-words whitespace-normal">{info.phone}</a>
                    </div>
                  </div>
                  <div className="flex gap-5 items-start pt-6 min-w-0">
                    <div className="flex-none rounded-xl bg-emerald-50 p-4 text-emerald-600 ring-1 ring-emerald-100"><MapPinIcon className="h-6 w-6" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900 text-base">HQ</p>
                      <p className="text-slate-600 font-medium break-words whitespace-normal">{info.city}</p>
                      <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider font-semibold break-words whitespace-normal">{info.address}</p>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>

          {/* Right: Form */}
          <div className="order-2 space-y-8">
            <Reveal>
              <div className="mb-7">
                <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900">Send us a message</h2>
                <p className="mt-3 text-lg text-slate-600 leading-relaxed">Whether you&apos;re a school principal, a teacher, or a concerned parent, we&apos;re here to help you unlock potential.</p>
              </div>
              <div className="bg-white rounded-3xl p-8 shadow-md border border-slate-200 transition-shadow hover:shadow-lg">
                <ContactForm />
              </div>
            </Reveal>
          </div>
        </div>

        {/* Centered CTA + Response block under the two columns */}
        <div className="mt-14">
          <div className="mx-auto max-w-3xl grid gap-6 sm:grid-cols-2 items-stretch">
            {waDigits && (
              <Reveal>
                <a
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Message us on WhatsApp"
                  title="Message us on WhatsApp"
                  className="h-full group block rounded-2xl border border-green-200 bg-green-50 px-7 py-6 text-green-800 hover:bg-green-100 transition-colors shadow-sm hover:shadow-md"
                >
                  <div className="flex items-center gap-4">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#25D366] text-white shadow-md">
                      {/* Official WhatsApp glyph */}
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                        <path d="M20.52 3.48A11.94 11.94 0 0012.06 0C5.44 0 .05 5.39.05 12.02c0 2.12.55 4.2 1.6 6.02L0 24l6.1-1.59a11.95 11.95 0 005.96 1.6h.01c6.62 0 12.01-5.39 12.01-12.02 0-3.21-1.25-6.22-3.56-8.53zM12.07 22c-1.86 0-3.67-.5-5.26-1.45l-.38-.23-3.62.94.97-3.53-.25-.36a9.91 9.91 0 01-1.55-5.35C2.98 6.5 7.51 2 12.07 2 16.64 2 21.2 6.5 21.2 12.02 21.2 17.55 16.64 22 12.07 22zm5.52-6.6c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.39-1.45-.88-.78-1.47-1.74-1.64-2.03-.17-.3-.02-.46.13-.61.14-.14.3-.33.45-.5.15-.17.2-.29.3-.48.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51l-.57-.01c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.47 0 1.45 1.07 2.86 1.22 3.06.15.2 2.11 3.23 5.11 4.53.71.31 1.26.5 1.69.64.71.23 1.36.2 1.87.12.57-.08 1.77-.72 2.02-1.42.25-.7.25-1.3.18-1.42-.07-.12-.27-.2-.57-.34z"/>
                      </svg>
                    </span>
                    <div className="flex-1">
                      <div className="text-xs font-semibold uppercase tracking-wider opacity-80">WhatsApp</div>
                      <div className="text-base md:text-lg font-bold flex items-center gap-2">
                        Open in WhatsApp
                        <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
                      </div>
                      <div className="text-xs opacity-80 mt-1">Typical reply within {info.responseTime}</div>
                      {/* Prefilled message preview (wrap safely on small screens) */}
                      <div className="mt-2 w-full max-w-full rounded-xl bg-white/90 border border-green-200 px-3 py-2 text-xs text-green-800 overflow-hidden break-words whitespace-normal">
                        “{waText}”
                      </div>
                    </div>
                  </div>
                </a>
              </Reveal>
            )}

            <Reveal>
              <div className="h-full rounded-2xl bg-slate-900 text-white p-6 md:p-7 flex items-center gap-5 shadow-md">
                <div className="text-3xl md:text-4xl font-black text-emerald-400">{info.responseTime}</div>
                <div>
                  <div className="text-sm font-semibold">Response Time</div>
                  <div className="text-slate-300 text-sm leading-relaxed">{info.responseDescription}</div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {faqs.length > 0 && (
        <section className="mx-auto max-w-4xl px-4 pb-24 lg:px-8">
          <Reveal>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 text-center mb-14">Frequently Asked Questions</h2>
          </Reveal>
          <div className="space-y-7">
            {faqs.map((faq, i) => (
              <Reveal key={i} delay={i * 0.05}>
                <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-md transition-shadow hover:shadow-lg">
                  <h3 className="text-lg md:text-xl font-bold text-slate-900 mb-2">{faq.question}</h3>
                  <p className="text-slate-600 leading-relaxed text-base">{faq.answer}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
