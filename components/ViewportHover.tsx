"use client";

import { useEffect } from "react";

/**
 * Adds an 'in-view' class to elements with [data-observe-card] when they enter the viewport (mobile only)
 */
export default function ViewportHover() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    if (!isMobile) return;

    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-observe-card]'));
    if (!('IntersectionObserver' in window) || els.length === 0) return;

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
        } else {
          entry.target.classList.remove('in-view');
        }
      });
    }, { root: null, threshold: 0.25 });

    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return null;
}
