"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type StudentLazySectionProps = {
  children: React.ReactNode;
  className?: string;
  rootMargin?: string;
};

export default function StudentLazySection({
  children,
  className,
  rootMargin = "160px",
}: StudentLazySectionProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isVisible) {
      return;
    }

    const element = containerRef.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [isVisible, rootMargin]);

  return (
    <div ref={containerRef} className={cn("app-student-lazy", className)}>
      {isVisible ? children : null}
    </div>
  );
}
