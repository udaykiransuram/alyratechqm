import { ClockIcon, EnvelopeIcon, MapPinIcon, PhoneIcon } from "@heroicons/react/24/outline";
import Script from "next/script";

import ContactForm from "@/components/ContactForm";
import { InnerHero } from "@/components/InnerHero";
import { LottieAnimation } from "@/components/LottieAnimation";
import { PublicFaqStack } from "@/components/public/PublicFaqStack";
import { PublicFinalCta } from "@/components/public/PublicFinalCta";
import { PublicInfoCardGrid } from "@/components/public/PublicInfoCardGrid";
import { PublicSectionIntro } from "@/components/public/PublicSectionIntro";
import { getContactPageData } from "@/lib/server/public-marketing";
import { getSiteUrlOrFallback } from "@/lib/site-url";

export const revalidate = 60;

export const metadata = {
  title: "Contact Us - Alyra Tech",
  description:
    "Get in touch with our team to start your transformation journey.",
};

export default async function ContactPage() {
  const { info, faqs } = await getContactPageData();
  const waDigits = (info.whatsappNumber || info.phone).replace(/\D+/g, "");
  const waText =
    "Hello Alyra Tech! I would like to know more about your diagnostics.";
  const waHref = waDigits
    ? `https://wa.me/${waDigits}?text=${encodeURIComponent(waText)}`
    : "";
  const siteUrl = getSiteUrlOrFallback("https://your-domain.com");
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
    <main className="public-page">
      <Script
        id="contact-organization-jsonld"
        type="application/ld+json"
        strategy="beforeInteractive"
      >
        {JSON.stringify(jsonLd)}
      </Script>

      <InnerHero
        title="Talk to the team behind the diagnostics"
        subtitle={info.tagline}
        pillText="Contact"
        variant="conversion"
        lottieRight="/animations/appointment-booking.lottie"
        whatsappHref={waHref}
      >
        {waHref ? (
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="public-button-primary"
          >
            Chat on WhatsApp
          </a>
        ) : null}
        <a href={`mailto:${info.email}`} className="public-button-secondary">
          Email Alyra Tech
        </a>
      </InnerHero>

      <section className="public-section">
        <div className="public-shell">
          <PublicSectionIntro
            eyebrow="Reach Us"
            title="Clear contact paths, fast replies, and no guessing about next steps"
            description="Whether you want a school demo, partnership conversation, or help understanding the reporting model, we&apos;ll route you to the right person quickly."
            actions={
              waHref ? (
                <a
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="public-button-primary"
                >
                  Message us now
                </a>
              ) : undefined
            }
          />

          <PublicInfoCardGrid
            className="mt-12"
            items={[
              {
                eyebrow: "Email",
                title: info.email,
                supportingText: "For demos, school partnerships, and support.",
                icon: <EnvelopeIcon className="h-5 w-5" />,
                href: `mailto:${info.email}`,
              },
              {
                eyebrow: "Phone",
                title: info.phone,
                supportingText: "Speak to the team directly during business hours.",
                icon: <PhoneIcon className="h-5 w-5" />,
                href: `tel:${info.phone.replace(/\s+/g, "")}`,
              },
              {
                eyebrow: "HQ",
                title: info.city,
                supportingText: info.address,
                icon: <MapPinIcon className="h-5 w-5" />,
              },
            ]}
          />

          <div className="mt-6 grid gap-6 lg:grid-cols-[1.05fr,0.95fr] lg:items-stretch">
            <div className="public-band-dark flex h-full items-start gap-4 p-6 md:p-8">
              <div className="public-icon-chip bg-white/10 text-white">
                <ClockIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
                  Response Time
                </p>
                <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-white">
                  {info.responseTime}
                </p>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-white/76">
                  {info.responseDescription}
                </p>
              </div>
            </div>

            <div className="public-panel-soft flex items-center gap-6 p-6 md:p-8">
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[hsl(var(--public-accent))]">
                  WhatsApp Preview
                </p>
                <p className="mt-3 text-base font-semibold text-[hsl(var(--public-ink))]">
                  We already prefill the first message to save time.
                </p>
                <div className="mt-4 rounded-2xl border border-[hsl(var(--public-border)/0.78)] bg-[hsl(var(--public-surface)/0.92)] px-4 py-3 text-sm leading-7 text-[hsl(var(--public-ink-soft))]">
                  &ldquo;{waText}&rdquo;
                </div>
              </div>
              <div className="hidden lg:block">
                <LottieAnimation
                  src="/animations/contact-us.lottie"
                  className="h-[180px] w-[180px]"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="public-section pt-0">
        <div className="public-shell">
          <div className="grid gap-10 lg:grid-cols-[0.92fr,1.08fr] lg:items-start">
            <div className="space-y-6">
              <PublicSectionIntro
                eyebrow="Message Alyra Tech"
                title="Send the details once and we&apos;ll take it from there"
                description="Tell us a little about your school, your role, and what you want to explore. We&apos;ll come back with the right next step instead of a generic follow-up."
                align="left"
                compact
              />

              <div className="public-panel-soft p-6 md:p-8">
                <LottieAnimation
                  src="/animations/contact-us.lottie"
                  className="mx-auto h-[220px] w-full max-w-sm"
                />
                <div className="mt-4 space-y-3 text-sm leading-7 text-[hsl(var(--public-muted))]">
                  <p>Best for demos, school onboarding conversations, and report delivery questions.</p>
                  <p>We usually respond with the next step in under one working day.</p>
                </div>
              </div>
            </div>

            <ContactForm />
          </div>
        </div>
      </section>

      {faqs.length > 0 ? (
        <section className="public-section">
          <div className="public-shell-narrow">
            <PublicSectionIntro
              eyebrow="FAQ"
              title="Common questions before the first conversation"
              description="These are the details school leaders usually want answered before booking a walkthrough."
            />
            <PublicFaqStack items={faqs} className="mt-12" />
          </div>
        </section>
      ) : null}

      <section className="public-section pt-0">
        <div className="public-shell">
          <PublicFinalCta
            eyebrow="Prefer to Explore First?"
            title="See the product and the talent-test experience before you talk to us."
            description="If you&apos;re still evaluating fit, you can review the public product story or experience the talent-test funnel directly."
            primaryAction={{ href: "/product", label: "See solutions" }}
            secondaryAction={{ href: "/talent-test", label: "Explore talent test" }}
            tone="dark"
          />
        </div>
      </section>
    </main>
  );
}
