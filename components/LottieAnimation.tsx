"use client";

import dynamic from "next/dynamic";
import type { DotLottie } from "@lottiefiles/dotlottie-react";
import { useEffect, useRef, useState } from "react";

import { useClientRuntimeSignals } from "@/lib/client/runtime-signals";

const LOCAL_DOTLOTTIE_WASM_URL = "/wasm/dotlottie-player.wasm";
let dotLottiePlayerPromise:
  | Promise<typeof import("@lottiefiles/dotlottie-react")>
  | null = null;

function loadDotLottiePlayer() {
  if (!dotLottiePlayerPromise) {
    dotLottiePlayerPromise = import("@lottiefiles/dotlottie-react").then(
      (module) => {
        // Force the player to load the WASM bundle from our own deployment.
        // The upstream default falls back to external CDNs, which is fragile
        // behind production CSPs and is what breaks on Vercel.
        module.setWasmUrl(LOCAL_DOTLOTTIE_WASM_URL);
        return module;
      },
    );
  }

  return dotLottiePlayerPromise;
}

// Lazy-load the heavy Lottie player on the client to reduce initial JS
const DotLottieReact = dynamic(
  () => loadDotLottiePlayer().then((module) => module.DotLottieReact),
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
  preferStatic?: boolean;
  respectLiteMode?: boolean;
  eager?: boolean;
}

export function LottieAnimation({
  src,
  className = "",
  loop = true,
  autoplay = true,
  speed = 1,
  preferStatic = false,
  respectLiteMode = true,
  eager = false,
}: LottieAnimationProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const runtimeSignals = useClientRuntimeSignals();
  const [isVisible, setIsVisible] = useState(eager);
  const [playbackFailed, setPlaybackFailed] = useState(false);
  const [dotLottie, setDotLottie] = useState<DotLottie | null>(null);
  const isGif = /\.(gif|webp)$/i.test(src);
  const isVideo = /\.(mp4|webm|ogg)$/i.test(src);
  const isLottie = /\.(lottie|json)$/i.test(src);
  const shouldPreferStatic =
    preferStatic ||
    runtimeSignals.saveData ||
    (respectLiteMode && runtimeSignals.liteMode);
  const shouldAutoplay =
    autoplay && !runtimeSignals.prefersReducedMotion && !shouldPreferStatic;

  useEffect(() => {
    setPlaybackFailed(false);
  }, [src]);

  useEffect(() => {
    if (eager) {
      setIsVisible(true);
    }
  }, [eager]);

  useEffect(() => {
    if (!eager || !isLottie || shouldPreferStatic) return;
    void loadDotLottiePlayer();
  }, [eager, isLottie, shouldPreferStatic]);

  useEffect(() => {
    if (eager || !containerRef.current || isVisible) return;
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
  }, [eager, isVisible]);

  useEffect(() => {
    if (!dotLottie) return;

    const markReady = () => setPlaybackFailed(false);
    const markFailed = () => setPlaybackFailed(true);

    dotLottie.addEventListener("ready", markReady);
    dotLottie.addEventListener("load", markReady);
    dotLottie.addEventListener("loadError", markFailed);
    dotLottie.addEventListener("renderError", markFailed);

    return () => {
      dotLottie.removeEventListener("ready", markReady);
      dotLottie.removeEventListener("load", markReady);
      dotLottie.removeEventListener("loadError", markFailed);
      dotLottie.removeEventListener("renderError", markFailed);
    };
  }, [dotLottie]);

  const fallbackDecoration = (
    <div
      aria-hidden
      className="h-full w-full rounded-[inherit] border border-white/25 bg-[radial-gradient(circle_at_30%_28%,rgba(255,255,255,0.88)_0%,rgba(255,255,255,0.36)_24%,rgba(45,212,191,0.22)_58%,rgba(15,23,42,0.08)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.34)]"
    />
  );

  return (
    <div className={className} ref={containerRef}>
      {isVisible && (
        isGif ? (
          // Static animated image fallback (GIF/WebP)
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt="animation"
            loading={eager ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={eager ? "high" : "auto"}
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        ) : isVideo ? (
          <video
            src={src}
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
            autoPlay={shouldAutoplay}
            muted
            loop={loop}
            playsInline
            preload={eager ? "auto" : "none"}
          />
        ) : isLottie ? (
          // Lottie with graceful fallback if the runtime chunk fails to load
          <div style={{ width: "100%", height: "100%" }}>
            {playbackFailed || shouldPreferStatic ? (
              fallbackDecoration
            ) : (
              <DotLottieReact
                src={src}
                loop={loop}
                autoplay={shouldAutoplay}
                speed={shouldAutoplay ? speed : 0}
                dotLottieRefCallback={setDotLottie}
                style={{ width: "100%", height: "100%" }}
              />
            )}
          </div>
        ) : (
          // Generic image fallback for JPG/PNG/SVG or other URLs
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt="illustration"
            loading={eager ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={eager ? "high" : "auto"}
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        )
      )}
    </div>
  );
}
