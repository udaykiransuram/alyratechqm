import Link from "next/link";

import { InnerHero } from "@/components/InnerHero";
import { PublicFinalCta } from "@/components/public/PublicFinalCta";
import { PublicSectionIntro } from "@/components/public/PublicSectionIntro";
import { PublicStatsGrid } from "@/components/public/PublicStatsGrid";

const highlightItems = [
  {
    label: "Eligible classes",
    value: "Class 1 to 12",
  },
  {
    label: "Assessment type",
    value: "National STEM talent test",
  },
  {
    label: "Outcome",
    value: "Detailed diagnostic report",
  },
];

const sections = [
  {
    title: "What is the Talent Test?",
    body:
      "The Talent Test is a national-level assessment designed to help students from Class 1 to 12 discover their strengths in STEM subjects such as Maths, Physics, and Chemistry. Every participant receives a personalized analysis report that highlights conceptual understanding, skill gaps, and practical next steps for improvement.",
  },
  {
    title: "How your data is used",
    body:
      "Registration details and test responses are stored securely and used only for generating diagnostic reports, rankings, and related communication. We do not share personal information with third parties except when required by law. Families may request deletion of data by contacting support.",
  },
  {
    title: "Awards and recognition",
    body:
      "Top performers may receive certificates, medals, scholarships, and mentorship opportunities. Selection is based strictly on merit and test performance, and the organizers' decision remains final.",
  },
  {
    title: "Code of conduct",
    body:
      "All students must attempt the assessment honestly. Any form of cheating, impersonation, or misuse of the testing process may lead to disqualification and cancellation of results.",
  },
  {
    title: "Changes and updates",
    body:
      "The organizers may update the test format, reporting methodology, timelines, or participation rules when needed. The latest version will always be reflected on the official public pages.",
  },
];

export default function AboutTermsPage() {
  return (
    <main className="public-page">
      <InnerHero
        title="Talent Test terms, conduct, and support"
        subtitle="A quieter overview of eligibility, reporting, data use, and support for the Alyra Tech talent test."
        pillText="Terms"
        variant="conversion"
      >
        <Link href="/register" className="public-button-primary">
          Register now
        </Link>
        <Link href="/contact" className="public-button-secondary">
          Contact support
        </Link>
      </InnerHero>

      <section className="public-section-tight">
        <div className="public-shell-narrow">
          <PublicStatsGrid
            items={highlightItems.map((item) => ({
              value: item.value,
              label: item.label,
            }))}
            columns={3}
          />
        </div>
      </section>

      <section className="public-section pt-0">
        <div className="public-shell-narrow">
          <div className="public-panel-quiet p-6 sm:p-8 md:p-10">
            <PublicSectionIntro
              eyebrow="Overview"
              title="Everything important, without the legal noise."
              description="These terms summarize how participation works, what students receive, and how to reach support if anything needs clarification."
              align="left"
              compact
            />

            <div className="public-rich-copy mt-10 text-base md:text-lg">
              {sections.map((section) => (
                <section key={section.title}>
                  <h2>{section.title}</h2>
                  <p>{section.body}</p>
                </section>
              ))}

              <section>
                <h2>Contact and support</h2>
                <p>
                  For questions about registration, analysis, or report access,
                  email <a href="mailto:support@talenttest.com">support@talenttest.com</a>{" "}
                  or visit the <Link href="/contact">contact page</Link>.
                </p>
              </section>
            </div>
          </div>
        </div>
      </section>

      <section className="public-section pt-0">
        <div className="public-shell-narrow">
          <PublicFinalCta
            eyebrow="Need Help Before Registering?"
            title="We can guide your school or family through the process."
            description="Reach out for timelines, eligibility clarification, report questions, or support on participation and delivery."
            primaryAction={{ href: "/contact", label: "Contact Alyra Tech" }}
            secondaryAction={{
              href: "/register",
              label: "Continue to registration",
            }}
            tone="dark"
          />
        </div>
      </section>
    </main>
  );
}
