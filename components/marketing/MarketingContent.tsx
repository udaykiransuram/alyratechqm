
'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import React from 'react'

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
}

function Section({ id, children, delay = 0 }: { id?: string; children: React.ReactNode; delay?: number }) {
  return (
    <motion.section
      id={id}
      variants={fadeUp}
      initial="initial"
      whileInView="animate"
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6, ease: 'easeOut', delay }}
      className="container py-12 md:py-16 border-t first:border-t-0"
    >
      {children}
    </motion.section>
  )
}

function ProblemCard({ title, desc, img }: { title: string; desc: string; img: string }){
  return (
    <motion.div whileHover={{ y: -4 }} className="rounded-xl border bg-background overflow-hidden">
      <img src={img} alt={title} className="w-full h-36 object-cover" />
      <div className="p-6">
        <h3 className="font-semibold">{title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
      </div>
    </motion.div>
  )
}

function SmallCard({ title, desc }: { title: string, desc: string }){
  return (
    <motion.div whileHover={{ y: -3 }} className="rounded-xl border p-6 bg-background">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
    </motion.div>
  )
}

export default function MarketingContent(){
  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted/30 text-foreground">
      {/* Hero */}
      <Section>
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div>
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight">Beyond Marks: Nurturing Growth and Understanding</h1>
            <p className="mt-4 text-lg text-muted-foreground">Built by IITians & NITians — a precision diagnostic platform that reveals the <strong>why</strong> behind scores and drives targeted learning.</p>
            <div className="mt-6 flex gap-3">
              <Link href="#contact" className="inline-flex items-center rounded-md bg-primary px-5 py-2.5 font-medium text-primary-foreground hover:opacity-90">Talk to us</Link>
              <Link href="#framework" className="inline-flex items-center rounded-md border px-5 py-2.5 font-medium hover:bg-accent">How it works</Link>
            </div>
            <ul className="mt-6 grid sm:grid-cols-2 gap-3 text-sm text-muted-foreground">
              <li>• Topic → Skill → Subskill → Option reasoning</li>
              <li>• Class heatmaps, targeted reteach</li>
              <li>• Visible progress over time</li>
              <li>• Actionable analytics for admins</li>
            </ul>
          </div>
          <motion.div whileHover={{ scale: 1.01 }} className="rounded-xl border overflow-hidden shadow-sm">
            <img
              src="https://images.unsplash.com/photo-1555255707-c07966088b7b?auto=format&fit=crop&w=1400&q=60"
              alt="Students collaborating in a classroom"
              className="w-full h-[320px] object-cover"
            />
          </motion.div>
        </div>
      </Section>

      {/* The Problem */}
      <Section id="problem" delay={0.05}>
        <h2 className="text-2xl md:text-3xl font-bold">The Root Problem: Why the current system falls short</h2>
        <div className="mt-6 grid md:grid-cols-3 gap-6">
          <ProblemCard
            title="Weak Foundations"
            desc="Early habits prioritize passing over understanding, creating shaky basics."
            img="https://images.unsplash.com/photo-1513258496099-48168024aec0?auto=format&fit=crop&w=1200&q=60"
          />
          <ProblemCard
            title="Fragile Grasp"
            desc="Facts are memorized, not applied; knowledge fades quickly."
            img="https://images.unsplash.com/photo-1523580846011-d3a5bc25702b?auto=format&fit=crop&w=1200&q=60"
          />
          <ProblemCard
            title="Employability Gap"
            desc="Graduates lack problem-solving and critical thinking required by industry."
            img="https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=60"
          />
        </div>
      </Section>

      {/* Missing Link */}
      <Section id="missing-link" delay={0.1}>
        <h2 className="text-2xl md:text-3xl font-bold">The Missing Link: Beyond the Score</h2>
        <div className="mt-6 grid md:grid-cols-2 gap-8">
          <motion.div className="rounded-xl border p-6 bg-background" whileHover={{ y: -2 }}>
            <h3 className="font-semibold">Marks Show</h3>
            <p className="text-muted-foreground mt-2">Only the final score — a single data point that hides the root causes.</p>
          </motion.div>
          <motion.div className="rounded-xl border p-6 bg-background" whileHover={{ y: -2 }}>
            <h3 className="font-semibold">True Diagnosis Reveals</h3>
            <ul className="text-muted-foreground mt-2 list-disc pl-5 space-y-1">
              <li>Where a student struggles</li>
              <li>Why they got it wrong</li>
              <li>What to fix next</li>
            </ul>
          </motion.div>
        </div>
      </Section>

      {/* Framework */}
      <Section id="framework" delay={0.15}>
        <h2 className="text-2xl md:text-3xl font-bold">Our Precision Diagnostic Framework</h2>
        <p className="mt-3 text-muted-foreground">We deconstruct understanding into <strong>Topic → Skill → Subskill</strong> and map option-level reasoning to misconception types.</p>
        <div className="mt-6 grid md:grid-cols-3 gap-6">
          <SmallCard title="Conceptual Gap" desc="Misunderstanding of core ideas." />
          <SmallCard title="Procedural Error" desc="Incorrect algorithm or step sequence." />
          <SmallCard title="Memory/Prerequisite" desc="Missing prior knowledge blocks progress." />
        </div>
        <div className="mt-8 grid md:grid-cols-2 gap-6 items-center">
          <motion.div className="rounded-xl border p-6 bg-background" whileHover={{ scale: 1.005 }}>
            <h3 className="font-semibold">Fractions Example: Comparing Different Denominators</h3>
            <ul className="mt-2 text-sm text-muted-foreground list-disc pl-5 space-y-1">
              <li>Equal parts concept • Numerator vs Denominator</li>
              <li>LCM / Multiples sense • Equivalent fractions</li>
              <li>Number line placement • Cross-multiplication logic</li>
            </ul>
          </motion.div>
          <motion.div whileHover={{ scale: 1.01 }} className="rounded-xl overflow-hidden border shadow-sm">
            <img
              src="https://images.unsplash.com/photo-1556157382-97eda2d62296?auto=format&fit=crop&w=1400&q=60"
              alt="Analytics dashboard illustrating class insights"
              className="w-full h-[260px] object-cover"
            />
          </motion.div>
        </div>
      </Section>

      {/* Outcomes */}
      <Section id="outcomes" delay={0.2}>
        <h2 className="text-2xl md:text-3xl font-bold">What You Gain</h2>
        <div className="mt-6 grid md:grid-cols-3 gap-6">
          <SmallCard title="Students" desc="Clear roadmap, self-awareness, visible growth, reduced exam fear." />
          <SmallCard title="Teachers" desc="Heatmaps, targeted interventions, saved time, better outcomes." />
          <SmallCard title="Admins" desc="System-wide visibility, data-driven interventions, improved reputation." />
        </div>
      </Section>

      {/* Case study */}
      <Section id="case" delay={0.25}>
        <div className="grid md:grid-cols-2 gap-6 items-center">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold">Case Study: From Averages to Achievers</h2>
            <p className="mt-3 text-muted-foreground">Two students with the same average benefit from <em>different</em> plans. Diagnosis isolates causes and accelerates progress.</p>
          </div>
          <motion.div whileHover={{ scale: 1.01 }} className="rounded-xl overflow-hidden border">
            <img
              src="https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1400&q=60"
              alt="Team reviewing insights and planning interventions"
              className="w-full h-[260px] object-cover"
            />
          </motion.div>
        </div>
      </Section>

      {/* Credibility */}
      <Section id="credibility" delay={0.3}>
        <h2 className="text-2xl md:text-3xl font-bold">Our Credibility</h2>
        <ul className="mt-3 text-muted-foreground list-disc pl-5 space-y-1">
          <li>Built by IITians & NITians</li>
          <li>Grounded in rigorous research</li>
          <li>Proven effective in classrooms</li>
        </ul>
      </Section>

      {/* CTA */}
      <Section id="contact" delay={0.35}>
        <div className="rounded-xl border p-6 md:p-10 text-center bg-background">
          <h2 className="text-2xl md:text-3xl font-bold">Marks don’t build futures. Diagnosis does.</h2>
          <p className="mt-3 text-muted-foreground">Ready to transform your classrooms with precision diagnostics?</p>
          <div className="mt-6 flex flex-col md:flex-row gap-3 justify-center">
            <a href="mailto:info@yourcompany.com" className="inline-flex items-center rounded-md bg-primary px-5 py-2.5 font-medium text-primary-foreground hover:opacity-90">Contact us</a>
            <Link href="/register" className="inline-flex items-center rounded-md border px-5 py-2.5 font-medium hover:bg-accent">Get Started</Link>
          </div>
        </div>
      </Section>
    </main>
  )
}
