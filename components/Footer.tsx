"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type ContactDoc = {
  email?: string;
  phone?: string;
  whatsappNumber?: string;
  city?: string;
};

const FALLBACK_CONTACT: Required<ContactDoc> = {
  email: "hello@beyondmarks.edu",
  phone: "+91 98765 43210",
  whatsappNumber: "",
  city: "Hitech City, Hyderabad",
};

export default function Footer() {
  const [info, setInfo] = useState<Required<ContactDoc>>(FALLBACK_CONTACT);

  useEffect(() => {
    let mounted = true;

    fetch("/api/contact-info", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data?.success || !mounted) return;
        const nextInfo = data?.data || {};
        setInfo({
          email: String(nextInfo.email || FALLBACK_CONTACT.email),
          phone: String(nextInfo.phone || FALLBACK_CONTACT.phone),
          whatsappNumber: String(
            nextInfo.whatsappNumber || FALLBACK_CONTACT.whatsappNumber,
          ),
          city: String(nextInfo.city || FALLBACK_CONTACT.city),
        });
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  const waHref = useMemo(() => {
    const waDigits = (info.whatsappNumber || info.phone).replace(/\D+/g, "");
    if (!waDigits) return "";
    return `https://wa.me/${waDigits}?text=${encodeURIComponent("Hello Alyra Tech! I would like to know more about your diagnostics.")}`;
  }, [info.phone, info.whatsappNumber]);

  return (
    <footer className="mt-24 border-t border-neutral-200 bg-gradient-to-b from-emerald-50/40 to-white dark:border-neutral-800 dark:bg-neutral-950">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 md:grid-cols-4">
        <div>
          <div className="mb-3 flex items-center gap-2.5 font-semibold">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-500 text-white shadow-lg shadow-teal-500/20">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
            </div>
            <span>Alyra Tech</span>
          </div>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            AI-driven diagnostic assessments that go beyond grades to reveal how students think, learn, and grow. Built by IITians &amp; NITians for India&apos;s schools.
          </p>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">Company</h4>
          <ul className="space-y-2 text-sm text-neutral-600 dark:text-neutral-400">
            <li><Link href="/about" className="transition-colors hover:text-emerald-600 hover:underline underline-offset-4">About</Link></li>
            <li><Link href="/product" className="transition-colors hover:text-emerald-600 hover:underline underline-offset-4">Product</Link></li>
            <li><Link href="/case-study" className="transition-colors hover:text-emerald-600 hover:underline underline-offset-4">Case Study</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">Resources</h4>
          <ul className="space-y-2 text-sm text-neutral-600 dark:text-neutral-400">
            <li><Link href="/benefits" className="transition-colors hover:text-emerald-600 hover:underline underline-offset-4">Benefits</Link></li>
            <li><Link href="/talent-test" className="transition-colors hover:text-emerald-600 hover:underline underline-offset-4">Talent Test</Link></li>
            <li><Link href="/terms" className="transition-colors hover:text-emerald-600 hover:underline underline-offset-4">Terms</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">Contact</h4>
          <ul className="space-y-2 text-sm text-neutral-600 dark:text-neutral-400">
            <li><a href={`mailto:${info.email}`} className="transition-colors hover:text-emerald-600 hover:underline underline-offset-4">{info.email}</a></li>
            <li><a href={`tel:${info.phone.replace(/\s+/g, "")}`} className="transition-colors hover:text-emerald-600 hover:underline underline-offset-4">{info.phone}</a></li>
            <li><span className="text-neutral-500">{info.city}</span></li>
            {waHref ? (
              <li>
                <a href={waHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-green-600 hover:text-green-700">
                  <span>💬</span>
                  <span>WhatsApp us</span>
                </a>
              </li>
            ) : null}
          </ul>
        </div>
      </div>
      <div className="border-t border-neutral-200 py-6 text-center text-xs text-neutral-500 dark:border-neutral-800">
        © {new Date().getFullYear()} Alyra Tech Pvt. Ltd. All rights reserved.
      </div>
    </footer>
  );
}
