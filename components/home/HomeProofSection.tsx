"use client";

import Link from "next/link";
import { Quote, Star } from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import HomeCtaCluster from "./HomeCtaCluster";
import {
  HOME_DEFAULT_FAQS,
  HOME_DEFAULT_TESTIMONIALS,
  HOME_FOUNDER_NOTE,
  HOME_PLATFORM_ITEMS,
  HOME_PROOF_POINTS,
  type HomeFaq,
  type HomeStat,
  type HomeTestimonial,
} from "./home-content";

type HomeProofSectionProps = {
  stats: HomeStat[];
  testimonials: HomeTestimonial[];
  faqs: HomeFaq[];
  testPrice?: number;
  whatsappHref?: string;
};

function clampRating(rating: number) {
  if (!Number.isFinite(rating)) {
    return 5;
  }

  return Math.max(1, Math.min(5, Math.round(rating)));
}

export default function HomeProofSection({
  stats,
  testimonials,
  faqs,
  testPrice,
  whatsappHref,
}: HomeProofSectionProps) {
  const proofTestimonials = testimonials.length
    ? testimonials
    : HOME_DEFAULT_TESTIMONIALS;
  const proofFaqs = faqs.length ? faqs : HOME_DEFAULT_FAQS;

  return (
    <section
      id="proof"
      className="home-proof-section relative overflow-hidden px-4 pb-16 pt-20 sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-[96rem] space-y-10">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
          <div className="home-proof-surface rounded-[2rem] px-6 py-7 sm:px-8 sm:py-8">
            <p className="home-proof-kicker">Proof and conversion</p>
            <h2 className="home-flagship-display mt-4 text-4xl leading-[1.02] text-[hsl(var(--home-proof-text))] sm:text-[3.25rem]">
              A premium academic system should feel decisive in real use, not
              ornamental in a sales deck.
            </h2>
            <p className="mt-5 max-w-3xl text-base leading-8 text-[hsl(var(--home-proof-muted))]">
              Alyra is designed to help school leadership move from diagnosis to
              action with one calmer, more intentional operating layer.
            </p>

            <div className="home-proof-stat-rail mt-8">
              {stats.map((stat) => (
                <div key={stat.key} className="home-proof-stat-cell">
                  <p className="text-3xl font-semibold tracking-[-0.05em] text-[hsl(var(--home-proof-text))]">
                    {stat.value}
                  </p>
                  <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-[hsl(var(--home-proof-muted))]">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="home-proof-surface rounded-[2rem] px-6 py-7 sm:px-8 sm:py-8">
              <p className="home-proof-kicker">{HOME_FOUNDER_NOTE.eyebrow}</p>
              <div className="mt-4 flex items-start gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-[1rem] bg-[linear-gradient(135deg,hsl(var(--home-accent-strong))_0%,hsl(var(--home-accent))_100%)] text-[hsl(var(--home-bg-0))] shadow-[0_18px_36px_-24px_hsl(var(--home-shadow)/0.4)]">
                  <Quote className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-lg leading-8 text-[hsl(var(--home-proof-text))]">
                    {HOME_FOUNDER_NOTE.quote}
                  </p>
                  <p className="mt-4 text-sm font-semibold uppercase tracking-[0.18em] text-[hsl(var(--home-proof-muted))]">
                    {HOME_FOUNDER_NOTE.author}
                  </p>
                  <p className="text-sm text-[hsl(var(--home-proof-muted))]">
                    {HOME_FOUNDER_NOTE.role}
                  </p>
                </div>
              </div>
            </div>

            <div className="home-proof-surface rounded-[2rem] px-6 py-7 sm:px-8 sm:py-8">
              <p className="home-proof-kicker">Why it lands</p>
              <div className="mt-5 space-y-4">
                {HOME_PROOF_POINTS.map((point) => {
                  const Icon = point.icon;

                  return (
                    <div key={point.title} className="home-proof-card px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-[1rem] border border-[hsl(var(--home-proof-border)/0.82)] bg-[hsl(var(--home-proof-bg))] text-[hsl(var(--home-proof-text))]">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold tracking-[-0.02em] text-[hsl(var(--home-proof-text))]">
                            {point.title}
                          </h3>
                        </div>
                      </div>
                      <p className="mt-3 text-sm leading-7 text-[hsl(var(--home-proof-muted))]">
                        {point.body}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          <div className="home-proof-surface rounded-[2rem] px-6 py-7 sm:px-8 sm:py-8">
            <p className="home-proof-kicker">Platform modules</p>
            <div className="mt-5 grid gap-3">
              {HOME_PLATFORM_ITEMS.map((item) => {
                const Icon = item.icon;

                return (
                  <div key={item.title} className="home-proof-card px-4 py-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-[0.95rem] bg-[linear-gradient(135deg,hsl(var(--home-accent-strong)/0.16)_0%,hsl(var(--home-accent)/0.08)_100%)] text-[hsl(var(--home-proof-text))]">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold tracking-[-0.02em] text-[hsl(var(--home-proof-text))]">
                          {item.title}
                        </h3>
                        <p className="mt-2 text-sm leading-7 text-[hsl(var(--home-proof-muted))]">
                          {item.body}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-6">
            <div className="home-proof-surface rounded-[2rem] px-6 py-7 sm:px-8 sm:py-8">
              <p className="home-proof-kicker">What leaders say</p>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {proofTestimonials.map((testimonial) => {
                  const rating = clampRating(testimonial.rating);

                  return (
                    <div
                      key={`${testimonial.author}-${testimonial.quote}`}
                      className="home-proof-card px-5 py-5"
                    >
                      <div className="flex items-center gap-1 text-[hsl(var(--home-accent-warm))]">
                        {Array.from({ length: rating }).map((_, index) => (
                          <Star key={`${testimonial.author}-${index}`} className="h-4 w-4 fill-current" />
                        ))}
                      </div>
                      <p className="mt-4 text-base leading-8 text-[hsl(var(--home-proof-text))]">
                        &quot;{testimonial.quote}&quot;
                      </p>
                      <div className="mt-5">
                        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[hsl(var(--home-proof-text))]">
                          {testimonial.author}
                        </p>
                        <p className="mt-1 text-sm text-[hsl(var(--home-proof-muted))]">
                          {testimonial.role}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="home-proof-surface rounded-[2rem] px-6 py-7 sm:px-8 sm:py-8">
              <p className="home-proof-kicker">FAQ</p>
              <Accordion type="single" collapsible className="mt-4">
                {proofFaqs.map((faq, index) => (
                  <AccordionItem
                    key={`${faq.question}-${index}`}
                    value={`faq-${index}`}
                    className="border-b border-[hsl(var(--home-proof-border)/0.82)]"
                  >
                    <AccordionTrigger className="py-5 text-left text-base font-semibold text-[hsl(var(--home-proof-text))] hover:no-underline">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="pb-5 text-sm leading-7 text-[hsl(var(--home-proof-muted))]">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
        </div>

        <div className="home-proof-band rounded-[2rem] px-6 py-8 sm:px-8 sm:py-9">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div>
              <p className="home-proof-kicker text-white/64">Next step</p>
              <h3 className="home-flagship-display mt-4 text-3xl leading-[1.02] text-white sm:text-[3rem]">
                Bring your leadership team into one clearer diagnostic story.
              </h3>
              <p className="mt-4 max-w-3xl text-base leading-8 text-white/68">
                Request a product walkthrough, start with a baseline assessment,
                or speak with us directly about how Alyra fits your school’s
                quality workflow.
              </p>
            </div>

            <div className="lg:max-w-[28rem]">
              <HomeCtaCluster
                whatsappHref={whatsappHref}
                testPrice={testPrice}
                tone="dark"
              />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-white/62">
            <span>School-leader-first</span>
            <span className="h-1 w-1 rounded-full bg-white/32" />
            <span>Diagnostics anchored</span>
            <span className="h-1 w-1 rounded-full bg-white/32" />
            <Link href="/contact" className="font-semibold text-white/88 transition-colors hover:text-white">
              Book a live walkthrough
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
