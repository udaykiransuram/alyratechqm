"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

const DOT_LOTTIE_WASM_URL = "/wasm/dotlottie-player.wasm";

// Lazy-load the heavy Lottie player on the client to reduce initial JS
const DotLottieReact = dynamic(
  async () => {
    const dotLottieModule = await import("@lottiefiles/dotlottie-react");
    dotLottieModule.setWasmUrl(DOT_LOTTIE_WASM_URL);
    return dotLottieModule.DotLottieReact;
  },
  {
    ssr: false,
    // Show a lightweight placeholder while the chunk loads; avoids layout shifts
    loading: () => (
      <div style={{ width: "100%", height: "100%" }} aria-hidden />
    ),
  }
);

interface LottieAnimationProps {
  src: string;
  className?: string;
  loop?: boolean;
  autoplay?: boolean;
  speed?: number;
}

export function LottieAnimation({
  src,
  className = "",
  loop = true,
  autoplay = true,
  speed = 1,
}: LottieAnimationProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const isGif = /\.(gif|webp)$/i.test(src);
  const isVideo = /\.(mp4|webm|ogg)$/i.test(src);
  const isLottie = /\.(lottie|json)$/i.test(src);

  useEffect(() => {
    // Respect user motion preferences
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReducedMotion(mq.matches);
    onChange();
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  useEffect(() => {
    if (!containerRef.current || isVisible) return;
    if (typeof IntersectionObserver === "undefined") {
      setIsVisible(true);
      return;
    }
    const el = containerRef.current;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setIsVisible(true);
            io.disconnect();
          }
        });
      },
      { rootMargin: "100px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [isVisible]);

  return (
    <div className={className} ref={containerRef}>
      {isVisible && (
        isGif ? (
          // Static animated image fallback (GIF/WebP)
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="animation" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        ) : isVideo ? (
          <video
            src={src}
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
            autoPlay={!reducedMotion}
            muted
            loop={loop}
            playsInline
          />
        ) : isLottie ? (
          // Lottie with graceful fallback if the runtime chunk fails to load
          <div style={{ width: "100%", height: "100%" }}>
            <DotLottieReact
              src={src}
              loop={loop}
              autoplay={reducedMotion ? false : autoplay}
              speed={reducedMotion ? 0 : speed}
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        ) : (
          // Generic image fallback for JPG/PNG/SVG or other URLs
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="illustration" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        )
      )}
    </div>
  );
}
