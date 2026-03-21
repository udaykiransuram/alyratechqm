"use client";

import React from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { LottieAnimation } from "./LottieAnimation";

interface InnerHeroProps {
  title: React.ReactNode;
  subtitle: string;
  pillText?: string;
  children?: React.ReactNode;
  /** Optional WhatsApp link to show a simple icon in the hero header */
  whatsappHref?: string;
  /** Lottie animation floating on the right */
  lottieRight?: string;
  /** Lottie animation floating on the left */
  lottieLeft?: string;
}

export const InnerHero = ({ title, subtitle, pillText, children, whatsappHref, lottieRight, lottieLeft }: InnerHeroProps) => {
  const { scrollY } = useScroll();
  const prefersReduced = useReducedMotion();
  const y1 = useTransform(scrollY, [0, 500], [0, 200]);
  const y2 = useTransform(scrollY, [0, 500], [0, -150]);

  return (
    <div className="relative w-full bg-gradient-to-b from-teal-300 via-teal-250 to-teal-200 pt-16 pb-20 sm:pt-20 sm:pb-28 overflow-x-clip">
      {whatsappHref && (
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Chat on WhatsApp"
          className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-[#25D366] text-white shadow-md hover:bg-[#1ebd5a] transition-colors"
        >
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20.52 3.48A11.94 11.94 0 0012.06 0C5.44 0 .05 5.39.05 12.02c0 2.12.55 4.2 1.6 6.02L0 24l6.1-1.59a11.95 11.95 0 005.96 1.6h.01c6.62 0 12.01-5.39 12.01-12.02 0-3.21-1.25-6.22-3.56-8.53zM12.07 22c-1.86 0-3.67-.5-5.26-1.45l-.38-.23-3.62.94.97-3.53-.25-.36a9.91 9.91 0 01-1.55-5.35C2.98 6.5 7.51 2 12.07 2 16.64 2 21.2 6.5 21.2 12.02 21.2 17.55 16.64 22 12.07 22zm5.52-6.6c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.39-1.45-.88-.78-1.47-1.74-1.64-2.03-.17-.3-.02-.46.13-.61.14-.14.3-.33.45-.5.15-.17.2-.29.3-.48.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51l-.57-.01c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.47 0 1.45 1.07 2.86 1.22 3.06.15.2 2.11 3.23 5.11 4.53.71.31 1.26.5 1.69.64.71.23 1.36.2 1.87.12.57-.08 1.77-.72 2.02-1.42.25-.7.25-1.3.18-1.42-.07-.12-.27-.2-.57-.34z" />
          </svg>
        </a>
      )}
      {/* Abstract Shapes Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div 
          style={{ y: prefersReduced ? 0 : y1 }}
          className="absolute -top-[30%] -right-[10%] w-[700px] h-[700px] rounded-full bg-emerald-500/40 blur-[80px] mix-blend-multiply"
        />
        <motion.div 
          style={{ y: prefersReduced ? 0 : y2 }}
          className="absolute top-[20%] -left-[10%] w-[600px] h-[600px] rounded-full bg-teal-400/50 blur-[80px] mix-blend-multiply" 
        />
        
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.05]"></div>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.05)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_0%,#000_70%,transparent_100%)]"></div>
      </div>

      {/* Floating Lottie - Right */}
      {lottieRight && (
        <motion.div
          initial={{ opacity: 0, x: 60 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
          className="absolute right-[3%] xl:right-[5%] 2xl:right-[8%] top-1/2 -translate-y-1/2 hidden lg:flex items-center justify-center pointer-events-none z-[2]"
        >
          <motion.div
            animate={prefersReduced ? undefined : { y: [-8, 12, -8] }}
            transition={prefersReduced ? undefined : { duration: 6, repeat: Infinity, ease: "easeInOut" }}
          >
            <LottieAnimation src={lottieRight} className="w-64 h-64 xl:w-80 xl:h-80 2xl:w-96 2xl:h-96 opacity-75" />
          </motion.div>
        </motion.div>
      )}

      {/* Floating Lottie - Left */}
      {lottieLeft && (
        <motion.div
          initial={{ opacity: 0, x: -60 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.5 }}
          className="absolute left-[3%] xl:left-[5%] 2xl:left-[8%] top-1/2 -translate-y-1/2 hidden lg:flex items-center justify-center pointer-events-none z-[2]"
        >
          <motion.div
            animate={prefersReduced ? undefined : { y: [8, -10, 8] }}
            transition={prefersReduced ? undefined : { duration: 7, repeat: Infinity, ease: "easeInOut" }}
          >
            <LottieAnimation src={lottieLeft} className="w-60 h-60 xl:w-72 xl:h-72 2xl:w-80 2xl:h-80 opacity-65" />
          </motion.div>
        </motion.div>
      )}

      <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          {pillText && (
            <motion.div 
              initial={prefersReduced ? undefined : { opacity: 0, scale: 0.9 }}
              animate={prefersReduced ? undefined : { opacity: 1, scale: 1 }}
              transition={prefersReduced ? undefined : { duration: 0.5 }}
              className="mb-8 inline-flex items-center rounded-full border border-teal-200/60 bg-white/60 px-3 py-1 text-sm font-medium text-teal-700 backdrop-blur-sm shadow-sm"
            >
              <span className="flex h-2 w-2 mr-2">
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
              </span>
              {pillText}
            </motion.div>
          )}
          
          <motion.h1 
            initial={prefersReduced ? undefined : { opacity: 0, y: 20 }}
            animate={prefersReduced ? undefined : { opacity: 1, y: 0 }}
            transition={prefersReduced ? undefined : { duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="text-balance text-5xl font-semibold tracking-tight text-slate-900 sm:text-7xl"
          >
            {title}
          </motion.h1>
          
          <motion.p 
            initial={prefersReduced ? undefined : { opacity: 0, y: 20 }}
            animate={prefersReduced ? undefined : { opacity: 1, y: 0 }}
            transition={prefersReduced ? undefined : { duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="mt-6 text-lg leading-8 text-slate-700 text-balance"
          >
            {subtitle}
          </motion.p>

          {children && (
            <motion.div 
               initial={prefersReduced ? undefined : { opacity: 0, y: 20 }}
               animate={prefersReduced ? undefined : { opacity: 1, y: 0 }}
               transition={prefersReduced ? undefined : { duration: 0.8, delay: 0.2 }}
               className="mt-10 flex items-center justify-center gap-x-6"
            >
              {children}
            </motion.div>
          )}
        </div>
      </div>
      
      {/* Clean bottom edge */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-teal-300/40 to-transparent"></div>
    </div>
  );
};
