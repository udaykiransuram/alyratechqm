"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Activity, MessageCircleMore } from "lucide-react";

import { useClientRuntimeSignals } from "@/lib/client/runtime-signals";

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
const FOOTER_CONTACT_CACHE_KEY = "public:footer-contact:v1";

let footerContactMemoryCache: Required<ContactDoc> | null = null;

function normalizeContactDoc(value: Partial<ContactDoc> | null | undefined) {
  return {
    email: String(value?.email || FALLBACK_CONTACT.email),
    phone: String(value?.phone || FALLBACK_CONTACT.phone),
    whatsappNumber: String(
      value?.whatsappNumber || FALLBACK_CONTACT.whatsappNumber,
    ),
    city: String(value?.city || FALLBACK_CONTACT.city),
  };
}

function readStoredFooterContact() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.sessionStorage.getItem(FOOTER_CONTACT_CACHE_KEY);
    if (!rawValue) {
      return null;
    }

    return normalizeContactDoc(JSON.parse(rawValue) as ContactDoc);
  } catch {
    return null;
  }
}

function writeStoredFooterContact(value: Required<ContactDoc>) {
  footerContactMemoryCache = value;

  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(FOOTER_CONTACT_CACHE_KEY, JSON.stringify(value));
  } catch {}
}

export default function Footer() {
  const [info, setInfo] = useState<Required<ContactDoc>>(FALLBACK_CONTACT);
  const runtimeSignals = useClientRuntimeSignals();

  useEffect(() => {
    let active = true;
    const cachedInfo = footerContactMemoryCache || readStoredFooterContact();
    if (cachedInfo) {
      setInfo(cachedInfo);
      if (runtimeSignals.lowBandwidth) {
        return () => {
          active = false;
        };
      }
    } else if (runtimeSignals.lowBandwidth) {
      return () => {
        active = false;
      };
    }

    const runFetch = () => {
      fetch("/api/contact-info", { cache: "force-cache" })
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok || !data?.success || !active) return;

          const nextInfo = normalizeContactDoc(data?.data || {});
          writeStoredFooterContact(nextInfo);
          setInfo(nextInfo);
        })
        .catch(() => {});
    };

    if ("requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(runFetch, { timeout: 1200 });
      return () => {
        active = false;
        window.cancelIdleCallback?.(idleId);
      };
    }

    const timeoutId = setTimeout(runFetch, 800);

    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, [runtimeSignals.lowBandwidth]);

  const waHref = useMemo(() => {
    const waDigits = (info.whatsappNumber || info.phone).replace(/\D+/g, "");
    if (!waDigits) return "";
    return `https://wa.me/${waDigits}?text=${encodeURIComponent("Hello Alyra Tech! I would like to know more about your diagnostics.")}`;
  }, [info.phone, info.whatsappNumber]);

  return (
    <footer className="public-footer-shell mt-20 border-t border-white/10 text-white">
      <div className="public-shell py-12 md:py-16">
        <div className="grid gap-8 md:gap-10 lg:grid-cols-[1.18fr_0.74fr_0.74fr_0.96fr]">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="public-brand-mark flex h-11 w-11 items-center justify-center rounded-2xl text-white">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <div className="text-lg font-semibold tracking-tight text-white">
                  Alyra Tech
                </div>
                <p className="public-footer-note text-[11px] uppercase tracking-[0.16em]">
                  School intelligence platform
                </p>
              </div>
            </div>
            <p className="public-footer-copy max-w-md text-sm leading-7">
              AI-driven diagnostic assessments that go beyond grades to reveal
              how students think, learn, and grow. Built for schools that want
              clearer academic decisions without more operational noise.
            </p>
            <div className="flex flex-wrap gap-2.5">
              <Link href="/contact" className="public-button-secondary">
                Book a demo
              </Link>
              <Link href="/talent-test" className="public-button-primary">
                Explore talent test
              </Link>
            </div>
          </div>

          <div>
            <h4 className="public-footer-heading mb-4">Company</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <Link href="/about" className="public-footer-link">
                  About
                </Link>
              </li>
              <li>
                <Link href="/product" className="public-footer-link">
                  Solutions
                </Link>
              </li>
              <li>
                <Link href="/case-study" className="public-footer-link">
                  Case studies
                </Link>
              </li>
              <li>
                <Link href="/benefits" className="public-footer-link">
                  Benefits
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="public-footer-heading mb-4">Explore</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <Link href="/platform-home" className="public-footer-link">
                  Platform home
                </Link>
              </li>
              <li>
                <Link href="/talent-test" className="public-footer-link">
                  Talent test
                </Link>
              </li>
              <li>
                <Link href="/register" className="public-footer-link">
                  Registration
                </Link>
              </li>
              <li>
                <Link href="/terms" className="public-footer-link">
                  Terms
                </Link>
              </li>
            </ul>
          </div>

          <div className="public-footer-card h-full">
            <h4 className="public-footer-heading mb-4">Contact</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <a href={`mailto:${info.email}`} className="public-footer-link">
                  {info.email}
                </a>
              </li>
              <li>
                <a
                  href={`tel:${info.phone.replace(/\s+/g, "")}`}
                  className="public-footer-link"
                >
                  {info.phone}
                </a>
              </li>
              <li className="public-footer-copy">{info.city}</li>
            </ul>
            {waHref ? (
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="public-button-primary mt-5 inline-flex w-full justify-center gap-2"
              >
                <MessageCircleMore className="h-4 w-4" />
                WhatsApp us
              </a>
            ) : null}
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 border-t border-white/10 pt-5 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p className="public-footer-note">
            © {new Date().getFullYear()} Alyra Tech Pvt. Ltd. All rights
            reserved.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/terms" className="public-footer-link">
              Terms
            </Link>
            <Link href="/contact" className="public-footer-link">
              Contact
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
