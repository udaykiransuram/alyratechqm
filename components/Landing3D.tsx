"use client";

import Image from "next/image";
import Link from "next/link";
import { type CSSProperties, useEffect, useRef, useState } from "react";

import GlassPanel from "@/components/GlassPanel";
import { useClientRuntimeSignals } from "@/lib/client/runtime-signals";

type Hero3DProps = {
  whatsappHref?: string;
};

export function Hero3D({ whatsappHref }: Hero3DProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isInView, setIsInView] = useState(false);
  const [panelScrollProgress, setPanelScrollProgress] = useState(0);
  const runtimeSignals = useClientRuntimeSignals();
  const envWaDigits =
    process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D+/g, "") ?? "";
  const envWaHref = envWaDigits
    ? `https://wa.me/${envWaDigits}?text=${encodeURIComponent(
        "Hello Alyra Tech! I would like to know more about your diagnostics.",
      )}`
    : "";

  const finalWhatsappHref = whatsappHref || envWaHref;
  const shouldUseLiteHeroMedia =
    runtimeSignals.prefersReducedMotion ||
    runtimeSignals.saveData ||
    (runtimeSignals.lowBandwidth && runtimeSignals.lowPower);
  const allowAmbientMotion = !runtimeSignals.prefersReducedMotion;

  useEffect(() => {
    let observer: IntersectionObserver | null = null;
    if (sectionRef.current && "IntersectionObserver" in window) {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setIsInView(true);
              observer?.disconnect();
            }
          });
        },
        { rootMargin: "200px" },
      );
      observer.observe(sectionRef.current);
    } else {
      setIsInView(true);
    }

    return () => {
      observer?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!isInView || shouldUseLiteHeroMedia || !videoRef.current) {
      return;
    }

    videoRef.current.play().catch(() => {});
  }, [isInView, shouldUseLiteHeroMedia]);

  useEffect(() => {
    if (runtimeSignals.prefersReducedMotion) {
      setPanelScrollProgress(0);
      return;
    }

    let frameId = 0;

    const updatePanelProgress = () => {
      const section = sectionRef.current;
      if (!section) {
        return;
      }

      const rect = section.getBoundingClientRect();
      const travelled = Math.max(0, -rect.top);
      const maxTravel = Math.max(rect.height * 0.26, 1);
      const nextProgress = Math.min(travelled / maxTravel, 1);

      setPanelScrollProgress((current) =>
        Math.abs(current - nextProgress) > 0.01 ? nextProgress : current,
      );
    };

    const handleViewportChange = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(updatePanelProgress);
    };

    updatePanelProgress();

    window.addEventListener("scroll", handleViewportChange, { passive: true });
    window.addEventListener("resize", handleViewportChange);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("scroll", handleViewportChange);
      window.removeEventListener("resize", handleViewportChange);
    };
  }, [runtimeSignals.prefersReducedMotion]);

  const panelRevealProgress = 1 - Math.pow(1 - panelScrollProgress, 2.35);
  const panelTopAlpha = Math.max(0.028, 0.2 - panelRevealProgress * 0.182);
  const panelBottomAlpha = Math.max(0.012, 0.08 - panelRevealProgress * 0.072);
  const panelBorderAlpha = Math.max(0.018, 0.09 - panelRevealProgress * 0.075);
  const panelShadowAlpha = Math.max(0.08, 0.22 - panelRevealProgress * 0.14);
  const panelBlur = Math.max(1.4, 10 - panelRevealProgress * 8.6);
  const panelSaturation = Math.max(112, 140 - panelRevealProgress * 30);
  const panelVerticalOffset = panelRevealProgress * 10;
  const heroPanelStyle = {
    "--home-glass-top-alpha": panelTopAlpha.toFixed(3),
    "--home-glass-bottom-alpha": panelBottomAlpha.toFixed(3),
    "--home-glass-border-alpha": panelBorderAlpha.toFixed(3),
    "--home-glass-shadow-alpha": panelShadowAlpha.toFixed(3),
    "--home-glass-blur": `${panelBlur.toFixed(2)}px`,
    "--home-glass-saturation": `${panelSaturation.toFixed(0)}%`,
    "--home-glass-cyan-alpha": `${Math.max(0.06, 0.12 - panelRevealProgress * 0.06).toFixed(3)}`,
    "--home-glass-accent-alpha": `${Math.max(0.04, 0.08 - panelRevealProgress * 0.04).toFixed(3)}`,
    "--home-glass-gold-alpha": `${Math.max(0.03, 0.07 - panelRevealProgress * 0.04).toFixed(3)}`,
    "--home-glass-white-top-alpha": `${Math.max(0.03, 0.08 - panelRevealProgress * 0.05).toFixed(3)}`,
    "--home-glass-white-bottom-alpha": `${Math.max(0.006, 0.016 - panelRevealProgress * 0.01).toFixed(3)}`,
    "--home-glass-inner-highlight-alpha": `${Math.max(0.05, 0.12 - panelRevealProgress * 0.07).toFixed(3)}`,
    transform: `translateY(-${panelVerticalOffset}px)`,
  } as CSSProperties;

  return (
    <section
      ref={sectionRef}
      data-home-cinematic-stage
      className="relative flex min-h-[80vh] w-full items-end overflow-hidden bg-[#050505] sm:min-h-[88vh] md:min-h-screen"
    >
      <div className="absolute inset-0 z-0">
        {isInView && !shouldUseLiteHeroMedia ? (
          <video
            ref={videoRef}
            autoPlay
            loop
            muted
            playsInline
            preload="none"
            poster="/images/hero-classroom.jpg"
            className="h-full w-full scale-105 object-cover"
            style={{ objectPosition: "center 20%", filter: "brightness(0.9)" }}
          >
            <source
              src="https://videos.pexels.com/video-files/8499774/8499774-hd_1920_1080_30fps.mp4"
              type="video/mp4"
            />
          </video>
        ) : (
          <Image
            src="/images/hero-classroom.jpg"
            alt="Students in a classroom"
            fill
            priority
            sizes="100vw"
            quality={78}
            className={[
              "scale-105 object-cover",
              allowAmbientMotion ? "ken-burns will-change-transform" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{ objectPosition: "center 20%", filter: "brightness(0.88)" }}
          />
        )}
        {allowAmbientMotion ? (
          <>
            <div className="public-lite-motion-pulse absolute left-[8%] top-[14%] h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(45,212,191,0.22)_0%,transparent_72%)] blur-3xl" />
            <div
              className="public-lite-motion-float absolute right-[10%] top-[22%] h-48 w-48 rounded-full bg-[radial-gradient(circle,rgba(103,232,249,0.2)_0%,transparent_72%)] blur-3xl"
              style={{ animationDelay: "1.1s" }}
            />
            <div
              className="public-lite-motion-scan absolute inset-x-[14%] top-[48%] h-24 rounded-full bg-[linear-gradient(90deg,transparent_0%,rgba(115,251,255,0.08)_18%,rgba(115,251,255,0.48)_48%,rgba(255,197,118,0.18)_70%,transparent_100%)] blur-2xl"
              style={{
                animationDuration: shouldUseLiteHeroMedia ? "7.4s" : "5.8s",
              }}
            />
          </>
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/35 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/10" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(45,212,191,0.18),transparent_22rem)]" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-[84rem] flex-col items-center px-4 pb-3 pt-28 text-center sm:px-6 sm:pb-4 sm:pt-32 md:items-start md:px-8 md:pb-5 md:pt-40 md:text-left lg:pb-6 lg:pt-44">
        <div className="w-full max-w-[42rem]">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/12 bg-black/40 px-4 py-1.5 text-sm font-medium text-emerald-300 shadow-xl shadow-black/20 backdrop-blur-md sm:mb-4">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Next-Gen Education Intelligence
          </div>

          <GlassPanel
            className="home-glass-surface home-hero-glass-panel w-full p-6 transition-[background,border-color,box-shadow,backdrop-filter,transform] duration-200 ease-out will-change-[background,border-color,box-shadow,backdrop-filter,transform] sm:p-7 md:p-10"
            style={heroPanelStyle}
            bgClassName="bg-transparent"
            blurClassName=""
            noHighlight
            edgeHighlight
            radiusClassName="rounded-[1.85rem]"
          >
            <div className="max-w-none">
              <h1 className="mb-6 text-[2.25rem] font-bold leading-tight tracking-tight text-white drop-shadow-2xl sm:text-5xl md:mb-8 md:text-7xl lg:text-8xl">
                <span className="block">
                  Unlock
                </span>
                <span className="relative bg-gradient-to-r from-emerald-400 via-teal-200 to-cyan-400 bg-clip-text text-transparent">
                  Potential
                  <svg
                    className="absolute -bottom-2 left-0 h-3 w-full text-emerald-500"
                    viewBox="0 0 100 10"
                  >
                    <path
                      d="M0 5 Q 50 10 100 5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                  </svg>
                </span>
              </h1>

              <p className="mb-8 max-w-2xl text-base font-normal leading-relaxed text-slate-100/95 drop-shadow-md sm:text-lg md:mb-10 md:text-xl">
                See what grades miss. We diagnose the{" "}
                <span className="font-semibold text-white">hidden patterns</span>{" "}
                in student thinking so schools can bridge the gap between effort
                and outcome.
              </p>

              <div className="flex flex-col items-center gap-5 sm:flex-row md:items-start">
                <ButtonShiny text="Start Baseline Test" href="/talent-test" primary />
                <ButtonShiny text="View Demo" href="/contact" />
                {finalWhatsappHref ? (
                  <a
                    href={finalWhatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Chat on WhatsApp"
                    title="Chat on WhatsApp"
                    className="inline-flex min-w-max items-center justify-center gap-2 whitespace-nowrap rounded-full bg-[#25D366] px-6 py-3 font-semibold text-white shadow-lg transition-colors hover:bg-[#1ebd5a] sm:px-8 sm:py-4"
                  >
                    <span className="flex h-5 w-5 items-center justify-center">
                      <svg
                        className="h-5 w-5"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path d="M20.52 3.48A11.94 11.94 0 0012.06 0C5.44 0 .05 5.39.05 12.02c0 2.12.55 4.2 1.6 6.02L0 24l6.1-1.59a11.95 11.95 0 005.96 1.6h.01c6.62 0 12.01-5.39 12.01-12.02 0-3.21-1.25-6.22-3.56-8.53zM12.07 22c-1.86 0-3.67-.5-5.26-1.45l-.38-.23-3.62.94.97-3.53-.25-.36a9.91 9.91 0 01-1.55-5.35C2.98 6.5 7.51 2 12.07 2 16.64 2 21.2 6.5 21.2 12.02 21.2 17.55 16.64 22 12.07 22zm5.52-6.6c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.39-1.45-.88-.78-1.47-1.74-1.64-2.03-.17-.3-.02-.46.13-.61.14-.14.3-.33.45-.5.15-.17.2-.29.3-.48.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51l-.57-.01c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.47 0 1.45 1.07 2.86 1.22 3.06.15.2 2.11 3.23 5.11 4.53.71.31 1.26.5 1.69.64.71.23 1.36.2 1.87.12.57-.08 1.77-.72 2.02-1.42.25-.7.25-1.3.18-1.42-.07-.12-.27-.2-.57-.34z" />
                      </svg>
                    </span>
                    <span>Contact us</span>
                  </a>
                ) : null}
              </div>

            </div>
          </GlassPanel>
        </div>
      </div>
    </section>
  );
}

function ButtonShiny({
  text,
  href,
  primary = false,
}: {
  text: string;
  href: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={[
        "group relative inline-flex min-w-max items-center justify-center whitespace-nowrap rounded-full px-6 py-3 text-base font-semibold transition-all duration-300 hover:-translate-y-0.5 active:scale-95 sm:px-8 sm:py-4 sm:text-lg",
        primary
          ? "bg-slate-100 text-slate-950 hover:shadow-[0_14px_40px_rgba(255,255,255,0.25)]"
          : "border border-slate-600 bg-slate-900/90 text-white hover:bg-slate-800",
      ].join(" ")}
    >
      <span className="relative z-10 tracking-wide">{text}</span>
      {primary ? (
        <div className="absolute inset-0 -z-10 rounded-full bg-gradient-to-r from-indigo-500 via-teal-400 to-emerald-400 opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-20" />
      ) : null}
    </Link>
  );
}
