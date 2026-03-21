"use client";

import React, { useRef } from "react";
import Image from "next/image";
import { motion, useScroll, useTransform } from "framer-motion";

// Organic blob clip-paths
const shapes = {
  blob1: "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)",
  blob2: "ellipse(50% 45% at 50% 50%)",
  blob3: "polygon(25% 0%, 100% 0%, 100% 100%, 75% 100%, 0% 75%)",
  roundedTR: "polygon(0% 0%, 100% 0%, 100% 80%, 80% 100%, 0% 100%)",
  roundedBL: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 20%)",
  arch: "ellipse(50% 60% at 50% 40%)",
  organic1: "polygon(10% 0%, 90% 5%, 100% 40%, 95% 90%, 60% 100%, 5% 95%, 0% 50%)",
  organic2: "polygon(0% 15%, 40% 0%, 100% 10%, 95% 60%, 100% 100%, 50% 95%, 0% 100%)",
  circle: "circle(50% at 50% 50%)",
  pill: "ellipse(45% 50% at 50% 50%)",
} as const;

type ShapeKey = keyof typeof shapes;

interface FloatingImageProps {
  src: string;
  alt: string;
  /** Width in px or tailwind sizing */
  width?: number;
  height?: number;
  /** Clip-path shape */
  shape?: ShapeKey;
  /** Parallax speed: negative = moves up on scroll, positive = moves down */
  parallaxSpeed?: number;
  /** Gentle float animation */
  float?: boolean;
  /** Float duration in seconds */
  floatDuration?: number;
  /** Float distance in pixels */
  floatDistance?: number;
  /** Extra className for positioning (absolute, top-X, left-X, etc.) */
  className?: string;
  /** Rotation on scroll */
  rotateOnScroll?: number;
  /** Opacity range [start, end] */
  opacityRange?: [number, number];
  /** Scale on hover */
  hoverScale?: number;
  /** Overlay gradient direction (for mood) */
  overlay?: string;
  /** Delay before entrance animation */
  delay?: number;
  /** Border / ring */
  ring?: boolean;
  /** Priority loading */
  priority?: boolean;
}

export function FloatingImage({
  src,
  alt,
  width = 400,
  height = 500,
  shape = "organic1",
  parallaxSpeed = -50,
  float = true,
  floatDuration = 6,
  floatDistance = 15,
  className = "",
  rotateOnScroll = 0,
  opacityRange = [0.9, 1],
  hoverScale = 1.03,
  overlay,
  delay = 0,
  ring = false,
  priority = false,
}: FloatingImageProps) {
  const ref = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], [0, parallaxSpeed]);
  const rotate = useTransform(scrollYProgress, [0, 1], [0, rotateOnScroll]);
  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [opacityRange[0], 1, 1, opacityRange[1]]);

  const clipPath = shapes[shape];

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.9, y: 30 }}
      whileInView={{ opacity: 1, scale: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay }}
      whileHover={{ scale: hoverScale }}
      style={{ y, rotate, opacity }}
      className={`relative overflow-hidden ${ring ? "ring-4 ring-white/20 shadow-2xl" : "shadow-xl"} ${className}`}
      layout
    >
      {/* Float animation wrapper */}
      <motion.div
        animate={
          float
            ? {
                y: [-floatDistance, floatDistance, -floatDistance],
              }
            : undefined
        }
        transition={
          float
            ? {
                duration: floatDuration,
                repeat: Infinity,
                repeatType: "loop",
                ease: "easeInOut",
              }
            : undefined
        }
        style={{ clipPath, WebkitClipPath: clipPath }}
        className="relative"
      >
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          className="object-cover w-full h-full"
          sizes="(max-width: 768px) 50vw, 400px"
          priority={priority}
        />
        {/* Gradient overlay */}
        {overlay && (
          <div
            className={`absolute inset-0 pointer-events-none ${overlay}`}
          />
        )}
      </motion.div>
    </motion.div>
  );
}

/**
 * A decorative image that peeks in from the edge of the viewport.
 * Great for breaking up text-heavy sections.
 */
export function PeekImage({
  src,
  alt,
  side = "right",
  width = 350,
  height = 450,
  parallaxSpeed = -30,
  className = "",
  shape = "organic1",
  overlay,
  float = true,
  floatDuration = 7,
  delay = 0,
}: {
  src: string;
  alt: string;
  side?: "left" | "right";
  width?: number;
  height?: number;
  parallaxSpeed?: number;
  className?: string;
  shape?: ShapeKey;
  overlay?: string;
  float?: boolean;
  floatDuration?: number;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], [0, parallaxSpeed]);
  const x = useTransform(
    scrollYProgress,
    [0, 0.3, 0.7, 1],
    side === "right" ? [80, 0, 0, 40] : [-80, 0, 0, -40]
  );

  const clipPath = shapes[shape];

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: side === "right" ? 100 : -100 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay }}
      style={{ y, x }}
      className={`pointer-events-none select-none ${className}`}
    >
      <motion.div
        animate={
          float
            ? { y: [-10, 12, -10] }
            : undefined
        }
        transition={
          float
            ? {
                duration: floatDuration,
                repeat: Infinity,
                repeatType: "loop",
                ease: "easeInOut",
              }
            : undefined
        }
        style={{ clipPath, WebkitClipPath: clipPath }}
        className="relative shadow-2xl"
      >
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          className="object-cover"
          sizes="(max-width: 768px) 40vw, 350px"
        />
        {overlay && (
          <div className={`absolute inset-0 pointer-events-none ${overlay}`} />
        )}
      </motion.div>
    </motion.div>
  );
}
