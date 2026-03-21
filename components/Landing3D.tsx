"use client";

import React, { useRef, useState, useEffect } from "react";
import { motion, useScroll, useTransform, useSpring, useMotionTemplate, useMotionValue } from "framer-motion";
import { cn } from "@/lib/utils";
import Link from "next/link";
import Image from "next/image";
import GlassPanel from "@/components/GlassPanel";

// --- Hero 3D Component ---
export const Hero3D = ({ whatsappHref }: { whatsappHref?: string }) => {
  const ref = useRef(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isInView, setIsInView] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [saveData, setSaveData] = useState(false);
  const envWaDigits = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D+/g, "") ?? "";
  const envWaHref = envWaDigits
    ? `https://wa.me/${envWaDigits}?text=${encodeURIComponent(
        "Hello Alyra Tech! I would like to know more about your diagnostics."
      )}`
    : "";
  
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const textY = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  // Respect user/device preferences and only load video when in view
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onRM = () => setReducedMotion(mq.matches);
    onRM();
    mq.addEventListener?.('change', onRM);
    // Data saver (not supported everywhere) without using `any`
    type MaybeConnection = { saveData?: boolean } | undefined;
    const navConn = navigator as unknown as {
      connection?: MaybeConnection;
      mozConnection?: MaybeConnection;
      webkitConnection?: MaybeConnection;
    };
    const conn: MaybeConnection = navConn.connection ?? navConn.mozConnection ?? navConn.webkitConnection;
    if (typeof conn?.saveData === 'boolean') setSaveData(!!conn.saveData);

    let io: IntersectionObserver | null = null;
    if (ref.current && 'IntersectionObserver' in window) {
      io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setIsInView(true);
            io?.disconnect();
          }
        });
      }, { rootMargin: '200px' });
      io.observe(ref.current as Element);
    } else {
      // Fallback: assume visible
      setIsInView(true);
    }

    return () => {
      mq.removeEventListener?.('change', onRM);
      io?.disconnect();
    };
  }, []);

  // Try autoplay once visible
  useEffect(() => {
    if (!isInView || reducedMotion || saveData) return;
    if (videoRef.current) {
      videoRef.current.play().catch(() => {
        /* ignore */
      });
    }
  }, [isInView, reducedMotion, saveData]);

  return (
    <div 
      ref={ref} 
      className="relative h-[80vh] sm:h-[90vh] md:h-screen w-full overflow-hidden bg-[#050505] flex flex-col items-center justify-center"
    >
      {/* WhatsApp contact CTA will be in the same line as the primary/demo buttons below */}
      <div className="absolute inset-0 z-0">
        {isInView && !saveData ? (
          <video
            ref={videoRef}
            autoPlay={!reducedMotion}
            loop={!reducedMotion}
            muted
            playsInline
            preload="none"
            poster="/images/source-frontend/ttf-hero-classroom.jpg"
            className="h-full w-full object-cover scale-105"
            style={{ filter: "brightness(0.9)", objectFit: "cover", objectPosition: "center 20%" }}
            onError={(e) => console.error("Video load error:", e)}
          >
            {/* HD video of a student thinking deep thought - clean background for text */}
            <source src="https://videos.pexels.com/video-files/8499774/8499774-hd_1920_1080_30fps.mp4" type="video/mp4" />
          </video>
        ) : (
          <Image
            src="/images/source-frontend/ttf-hero-classroom.jpg"
            alt="Students in classroom"
            fill
            priority
            sizes="100vw"
            className="object-cover scale-105"
            style={{ filter: "brightness(0.9)", objectFit: "cover", objectPosition: "center 20%" }}
          />
        )}
        
        {/* Gradients - tuned lighter so background video stays visible */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/25 to-transparent"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/10"></div>
        
        {/* Cinematic Noise Texture */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-overlay"></div>
      </div>

      <motion.div 
        style={{ y: textY, opacity }}
        className="relative z-10 flex flex-col items-center md:items-start px-6 sm:px-8 md:px-16 pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)] text-center md:text-left max-w-7xl mx-auto py-8 sm:py-12 md:py-14 w-full"
      >
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-4 py-1.5 text-sm font-medium text-emerald-300 backdrop-blur-md mb-8 shadow-xl shadow-black/20"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
          </span>
          Next-Gen Education Intelligence
        </motion.div>
        {/* Glass hero content */}
        <div className="w-full max-w-4xl px-0">
          <GlassPanel
            className="p-6 sm:p-7 md:p-10 mx-3 sm:mx-0 border border-white/15 shadow-[0_30px_80px_rgba(0,0,0,0.35)]"
            bgClassName="bg-white/[0.05] dark:bg-white/[0.03]"
            blurClassName="backdrop-blur-md"
            noHighlight
          >
            <h1 className="text-[2.25rem] sm:text-5xl md:text-7xl lg:text-8xl leading-tight font-bold tracking-tight text-white mb-6 sm:mb-8 drop-shadow-2xl">
              <motion.span 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.4 }}
                className="block"
              >
                Unlock
              </motion.span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-200 to-cyan-400 relative">
                Potential
                <motion.svg 
                  className="absolute -bottom-2 left-0 w-full h-3 text-emerald-500" 
                  viewBox="0 0 100 10" 
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1.5, delay: 1 }}
                >
                  <motion.path d="M0 5 Q 50 10 100 5" fill="none" stroke="currentColor" strokeWidth="2" />
                </motion.svg>
              </span>
            </h1>

            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="text-slate-100/95 text-base sm:text-lg md:text-xl max-w-2xl leading-relaxed mb-8 sm:mb-10 font-normal drop-shadow-md"
            >
              See what grades miss. We diagnose the <span className="text-white font-semibold">hidden patterns</span> in student thinking to bridge the gap between effort and outcome.
            </motion.p>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.8 }}
              className="flex flex-col sm:flex-row items-center gap-5"
            >
              <ButtonShiny text="Start Baseline Test" href="/talent-test" primary />
              <ButtonShiny text="View Demo" href="/contact" />
              {(whatsappHref || envWaHref) && (
                <a
                  href={whatsappHref || envWaHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Chat on WhatsApp"
                  title="Chat on WhatsApp"
                  className="inline-flex items-center gap-2 rounded-full bg-[#25D366] text-white px-6 py-3 sm:px-8 sm:py-4 font-semibold shadow-lg hover:bg-[#1ebd5a] transition-colors"
                >
                  <span className="flex h-5 w-5 items-center justify-center">
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M20.52 3.48A11.94 11.94 0 0012.06 0C5.44 0 .05 5.39.05 12.02c0 2.12.55 4.2 1.6 6.02L0 24l6.1-1.59a11.95 11.95 0 005.96 1.6h.01c6.62 0 12.01-5.39 12.01-12.02 0-3.21-1.25-6.22-3.56-8.53zM12.07 22c-1.86 0-3.67-.5-5.26-1.45l-.38-.23-3.62.94.97-3.53-.25-.36a9.91 9.91 0 01-1.55-5.35C2.98 6.5 7.51 2 12.07 2 16.64 2 21.2 6.5 21.2 12.02 21.2 17.55 16.64 22 12.07 22zm5.52-6.6c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.39-1.45-.88-.78-1.47-1.74-1.64-2.03-.17-.3-.02-.46.13-.61.14-.14.3-.33.45-.5.15-.17.2-.29.3-.48.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51l-.57-.01c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.47 0 1.45 1.07 2.86 1.22 3.06.15.2 2.11 3.23 5.11 4.53.71.31 1.26.5 1.69.64.71.23 1.36.2 1.87.12.57-.08 1.77-.72 2.02-1.42.25-.7.25-1.3.18-1.42-.07-.12-.27-.2-.57-.34z" />
                    </svg>
                  </span>
                  <span>Contact us</span>
                </a>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 1 }}
              className="mt-8 flex flex-wrap items-center gap-3 text-xs sm:text-sm text-white/85"
            >
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 backdrop-blur">AI-driven diagnostics</span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 backdrop-blur">School → Class → Student clarity</span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 backdrop-blur">Action-ready interventions</span>
            </motion.div>
          </GlassPanel>
        </div>
      </motion.div>
    </div>
  );
};


// --- Shiny 3D Button ---
const ButtonShiny = ({ text, href, primary = false }: { text: string; href: string, primary?: boolean }) => {
  return (
    <Link 
      href={href}
      className={cn(
        "group relative rounded-full px-6 py-3 sm:px-8 sm:py-4 font-semibold text-base sm:text-lg transition-all duration-300 hover:-translate-y-0.5 active:scale-95",
        primary 
          ? "bg-slate-100 text-slate-950 hover:shadow-[0_14px_40px_rgba(255,255,255,0.25)]" 
          : "bg-slate-900/90 text-white border border-slate-600 hover:bg-slate-800"
      )}
    >
      <span className="relative z-10 tracking-wide">{text}</span>
      {primary && (
         <div className="absolute inset-0 -z-10 rounded-full bg-gradient-to-r from-indigo-500 via-teal-400 to-emerald-400 opacity-0 transition-opacity duration-500 group-hover:opacity-20 blur-xl" />
      )}
    </Link>
  );
};


// --- 3D Tilt Card ---
export const FeatureCard3D = ({ 
  title, 
  description, 
  icon 
}: { 
  title: string; 
  description: string; 
  icon: string;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const [isCoarse, setIsCoarse] = useState(false);

  const mouseX = useSpring(x, { stiffness: 500, damping: 100 });
  const mouseY = useSpring(y, { stiffness: 500, damping: 100 });
  // Always create transforms (avoid conditional hook usage)
  const rotateYMV = useTransform(mouseX, [-200, 200], [-10, 10]);
  const rotateXMV = useTransform(mouseY, [-200, 200], [10, -10]);

  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)');
    const apply = () => setIsCoarse(mq.matches);
    apply();
    mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
  }, []);

  function onMouseMove({ currentTarget, clientX, clientY }: React.MouseEvent) {
    if (isCoarse) return; // disable tilt on touch devices
    const { left, top, width, height } = currentTarget.getBoundingClientRect();
    x.set(clientX - left - width / 2);
    y.set(clientY - top - height / 2);
  }

  function onMouseLeave() {
    if (isCoarse) return;
    x.set(0);
    y.set(0);
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      style={{
        rotateY: isCoarse ? 0 : rotateYMV,
        rotateX: isCoarse ? 0 : rotateXMV,
        transformStyle: "preserve-3d",
      }}
      className="group relative h-full w-full rounded-2xl border border-slate-200 bg-white p-8 transition-shadow hover:shadow-2xl dark:border-slate-800 dark:bg-slate-900/50 overflow-hidden"
    >
      <div className="h-1 bg-teal-500"></div>
      <div style={{ transform: "translateZ(50px)" }} className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-slate-50 text-3xl shadow-sm ring-1 ring-slate-100 dark:bg-white/5 dark:ring-white/10">
        {icon}
      </div>
      <h3 style={{ transform: "translateZ(40px)" }} className="mb-3 text-xl font-bold text-slate-900 dark:text-white">
        {title}
      </h3>
      <p style={{ transform: "translateZ(30px)" }} className="text-slate-600 leading-relaxed dark:text-slate-400">
        {description}
      </p>
      
      {/* Glow Effect */}
      <motion.div
        style={{
          background: useMotionTemplate`radial-gradient(
            400px circle at ${mouseX}px ${mouseY}px,
            rgba(50, 200, 160, 0.1),
            transparent 80%
          )`,
        }}
        className={cn(
          "pointer-events-none absolute -inset-px rounded-2xl transition duration-300",
          isCoarse ? "opacity-0" : "opacity-0 group-hover:opacity-100"
        )}
      />
    </motion.div>
  );
};
