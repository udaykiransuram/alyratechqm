"use client";

import Link from "next/link";
import { Activity, ArrowRight } from "lucide-react";

export default function HomeFooter() {
  return (
    <footer className="home-footer-shell border-t border-white/8 px-4 py-12 text-white sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-[96rem] gap-10 lg:grid-cols-[minmax(0,1.25fr)_repeat(3,minmax(0,0.78fr))]">
        <div>
          <div className="mb-5 flex items-center gap-3">
            <div className="home-brand-mark flex h-11 w-11 items-center justify-center rounded-[1rem] text-[hsl(var(--home-bg-0))]">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <p className="text-base font-semibold tracking-[-0.03em] text-white">
                Alyra Tech
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/54">
                Diagnostics For Schools
              </p>
            </div>
          </div>

          <h2 className="home-flagship-display max-w-md text-3xl leading-[1.02] text-white sm:text-[2.5rem]">
            A premium operating layer for diagnosis, action, and calmer school decisions.
          </h2>
          <p className="mt-4 max-w-md text-sm leading-7 text-white/62">
            Alyra brings diagnostics, reporting, OMR, and workflow together so
            school teams can move with more clarity and less noise.
          </p>
          <div className="mt-6">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/8 px-5 py-3 text-sm font-semibold text-white transition-transform duration-200 hover:-translate-y-0.5 hover:bg-white/12"
            >
              Book a Demo
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/42">
            Product
          </h3>
          <ul className="mt-4 space-y-3 text-sm text-white/68">
            <li>
              <Link href="/product" className="transition-colors hover:text-white">
                Platform
              </Link>
            </li>
            <li>
              <Link href="/benefits" className="transition-colors hover:text-white">
                Benefits
              </Link>
            </li>
            <li>
              <Link href="/talent-test" className="transition-colors hover:text-white">
                Baseline Test
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/42">
            Explore
          </h3>
          <ul className="mt-4 space-y-3 text-sm text-white/68">
            <li>
              <Link href="/case-study" className="transition-colors hover:text-white">
                Case Studies
              </Link>
            </li>
            <li>
              <Link href="/about" className="transition-colors hover:text-white">
                Company
              </Link>
            </li>
            <li>
              <Link href="/auth/signin" className="transition-colors hover:text-white">
                Sign In
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/42">
            Contact
          </h3>
          <ul className="mt-4 space-y-3 text-sm text-white/68">
            <li>
              <Link href="/contact" className="transition-colors hover:text-white">
                Book a live walkthrough
              </Link>
            </li>
            <li>Hyderabad, India</li>
            <li>
              <Link href="/terms" className="transition-colors hover:text-white">
                Terms
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="mx-auto mt-10 max-w-[96rem] border-t border-white/8 pt-6 text-xs text-white/42">
        © {new Date().getFullYear()} Alyra Tech Pvt. Ltd. All rights reserved.
      </div>
    </footer>
  );
}
