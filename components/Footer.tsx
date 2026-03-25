"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Activity } from "lucide-react";

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
    <footer className="mt-24 border-t border-border/70 bg-[linear-gradient(180deg,hsl(var(--app-surface-2)/0.72)_0%,hsl(var(--app-surface-1))_38%,hsl(var(--secondary)/0.48)_100%)]">
      <div className="mx-auto grid max-w-[88rem] gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,1.25fr)_repeat(3,minmax(0,0.8fr))] lg:px-8">
        <div>
          <div className="mb-4 flex items-center gap-3 font-semibold">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary via-primary to-primary/80 text-primary-foreground shadow-[0_18px_32px_-20px_hsl(var(--primary)/0.42)] ring-1 ring-primary/10">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <p className="text-base font-semibold tracking-[-0.03em] text-foreground">
                Alyra Tech
              </p>
              <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Precision Diagnostics
              </p>
            </div>
          </div>
          <p className="max-w-md text-sm leading-6 text-muted-foreground">
            AI-driven diagnostic assessments that go beyond grades to reveal how students think, learn, and grow. Built by IITians &amp; NITians for India&apos;s schools.
          </p>
        </div>
        <div>
          <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Company</h4>
          <ul className="space-y-2.5 text-sm text-muted-foreground">
            <li><Link href="/about" className="transition-colors hover:text-primary">About</Link></li>
            <li><Link href="/product" className="transition-colors hover:text-primary">Product</Link></li>
            <li><Link href="/case-study" className="transition-colors hover:text-primary">Case Study</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Resources</h4>
          <ul className="space-y-2.5 text-sm text-muted-foreground">
            <li><Link href="/benefits" className="transition-colors hover:text-primary">Benefits</Link></li>
            <li><Link href="/talent-test" className="transition-colors hover:text-primary">Talent Test</Link></li>
            <li><Link href="/terms" className="transition-colors hover:text-primary">Terms</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Contact</h4>
          <ul className="space-y-2.5 text-sm text-muted-foreground">
            <li><a href={`mailto:${info.email}`} className="transition-colors hover:text-primary">{info.email}</a></li>
            <li><a href={`tel:${info.phone.replace(/\s+/g, "")}`} className="transition-colors hover:text-primary">{info.phone}</a></li>
            <li><span>{info.city}</span></li>
            {waHref ? (
              <li>
                <a href={waHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--app-success)/0.2)] bg-[hsl(var(--app-success)/0.1)] px-3 py-1.5 text-[13px] font-medium text-[hsl(var(--app-success))] transition-colors hover:bg-[hsl(var(--app-success)/0.16)]">
                  <span>WhatsApp us</span>
                </a>
              </li>
            ) : null}
          </ul>
        </div>
      </div>
      <div className="border-t border-border/70 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Alyra Tech Pvt. Ltd. All rights reserved.
      </div>
    </footer>
  );
}
