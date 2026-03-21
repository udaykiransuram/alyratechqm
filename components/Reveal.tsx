"use client";
import { motion, type Variants } from "framer-motion";
import React from "react";

type RevealProps = {
  children: React.ReactNode;
  className?: string;
  delay?: number;
};

export function Reveal({ children, className, delay = 0 }: RevealProps) {
  const prefersReduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const initial = prefersReduced ? { opacity: 0 } : { opacity: 0, y: 16 };
  const animate = prefersReduced ? { opacity: 1 } : { opacity: 1, y: 0 };
  const duration = prefersReduced ? 0.2 : 0.6;

  return (
    <motion.div
      initial={initial}
      whileInView={animate}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration, ease: "easeOut", delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

type StaggerProps = {
  children: React.ReactNode;
  className?: string;
  delayChildren?: number;
  staggerChildren?: number;
};

export function Stagger({ children, className, delayChildren = 0.05, staggerChildren = 0.06 }: StaggerProps) {
  const prefersReduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const variants: Variants = prefersReduced
    ? { hidden: {}, show: { transition: { staggerChildren: 0, delayChildren: 0 } } }
    : { hidden: {}, show: { transition: { staggerChildren, delayChildren } } };

  const child: Variants = prefersReduced
    ? { hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.2 } } }
    : { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } } };

  return (
    <motion.div variants={variants} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }} className={className}>
      {React.Children.map(children, (c) => (
        <motion.div variants={child}>{c as React.ReactNode}</motion.div>
      ))}
    </motion.div>
  );
}
