'use client';

export default function AboutTermsPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-emerald-100 px-4 py-12">
      <div className="w-full max-w-2xl bg-white/90 rounded-2xl shadow-2xl p-10 border border-emerald-100">
        <h1 className="text-3xl font-extrabold text-emerald-700 mb-4 text-center">About the Talent Test & Terms</h1>
        <div className="space-y-6 text-neutral-700 text-base">
          <section>
            <h2 className="font-semibold text-emerald-800 mb-2">What is the Talent Test?</h2>
            <p>
              The Talent Test is a national-level assessment designed to help students from Class 1 to 12 discover their strengths in STEM subjects (Maths, Physics, Chemistry). Every participant receives a personalized analysis report, highlighting conceptual understanding, skill gaps, and actionable recommendations for improvement.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-emerald-800 mb-2">How Your Data is Used</h2>
            <p>
              Your registration details and test responses are securely stored and used only for generating your analysis report and ranking. We do not share your personal information with third parties except as required by law. You may request deletion of your data at any time by contacting our support team.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-emerald-800 mb-2">Awards & Recognition</h2>
            <p>
              Top performers receive certificates, medals, scholarships, and mentorship opportunities. Selection is based strictly on merit and test scores. The organizers’ decision is final.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-emerald-800 mb-2">Code of Conduct</h2>
            <p>
              All students must attempt the test honestly. Any form of cheating or misuse of the test will result in disqualification.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-emerald-800 mb-2">Changes & Updates</h2>
            <p>
              The organizers reserve the right to update the test format, analysis methodology, or terms at any time. Changes will be posted on the official website.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-emerald-800 mb-2">Contact & Support</h2>
            <p>
              For questions about registration, analysis, or your report, email <a href="mailto:support@talenttest.com" className="text-emerald-600 underline">support@talenttest.com</a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}