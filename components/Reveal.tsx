"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("matchMedia" in window)) {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => {
      setPrefersReducedMotion(mediaQuery.matches);
    };

    syncPreference();
    mediaQuery.addEventListener?.("change", syncPreference);

    return () => {
      mediaQuery.removeEventListener?.("change", syncPreference);
    };
  }, []);

  return prefersReducedMotion;
}

function useInViewOnce<T extends HTMLElement>(amount = 0.2) {
  const elementRef = useRef<T | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isVisible) {
      return undefined;
    }

    const node = elementRef.current;
    if (!node) {
      return undefined;
    }

    if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
      setIsVisible(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting || entry.intersectionRatio >= amount) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      {
        threshold: [0, amount, 1],
        rootMargin: "0px 0px -8% 0px",
      },
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [amount, isVisible]);

  return {
    elementRef,
    isVisible,
  };
}

function createRevealStyle({
  isVisible,
  delaySeconds,
  reducedMotion,
}: {
  isVisible: boolean;
  delaySeconds: number;
  reducedMotion: boolean;
}): CSSProperties {
  const durationMs = reducedMotion ? 180 : 600;
  const hiddenTransform = reducedMotion
    ? "translate3d(0,0,0)"
    : "translate3d(0,16px,0)";

  return {
    opacity: isVisible ? 1 : 0,
    transform: isVisible ? "translate3d(0,0,0)" : hiddenTransform,
    transitionProperty: "opacity, transform",
    transitionDuration: `${durationMs}ms`,
    transitionDelay: `${Math.max(delaySeconds, 0)}s`,
    transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
    willChange: isVisible ? "auto" : "opacity, transform",
  };
}

type RevealProps = {
  children: React.ReactNode;
  className?: string;
  delay?: number;
};

export function Reveal({ children, className, delay = 0 }: RevealProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const { elementRef, isVisible } = useInViewOnce<HTMLDivElement>(0.2);
  const style = useMemo(
    () =>
      createRevealStyle({
        isVisible,
        delaySeconds: delay,
        reducedMotion: prefersReducedMotion,
      }),
    [delay, isVisible, prefersReducedMotion],
  );

  return (
    <div ref={elementRef} className={className} style={style}>
      {children}
    </div>
  );
}

type StaggerProps = {
  children: React.ReactNode;
  className?: string;
  delayChildren?: number;
  staggerChildren?: number;
};

export function Stagger({ children, className, delayChildren = 0.05, staggerChildren = 0.06 }: StaggerProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const { elementRef, isVisible } = useInViewOnce<HTMLDivElement>(0.2);

  return (
    <div ref={elementRef} className={className}>
      {React.Children.map(children, (childNode, index) => (
        <div
          key={
            React.isValidElement(childNode) && childNode.key != null
              ? String(childNode.key)
              : `stagger-${index}`
          }
          style={createRevealStyle({
            isVisible,
            delaySeconds: prefersReducedMotion
              ? 0
              : delayChildren + index * staggerChildren,
            reducedMotion: prefersReducedMotion,
          })}
        >
          {childNode as React.ReactNode}
        </div>
      ))}
    </div>
  );
}
