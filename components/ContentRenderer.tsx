"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import katex from 'katex';
// Make sure the KaTeX CSS is imported to style the math correctly.
import 'katex/dist/katex.min.css';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { sanitizeRichTextHtml } from "@/lib/security/html-sanitize";

interface ContentRendererProps {
  htmlContent: string;
  enableImageZoom?: boolean;
  dialogContainer?: HTMLElement | null;
}

export const ContentRenderer = memo(function ContentRenderer({
  htmlContent,
  enableImageZoom = false,
  dialogContainer,
}: ContentRendererProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const sanitizedHtml = sanitizeRichTextHtml(htmlContent);
  const [zoomedImage, setZoomedImage] = useState<{
    src: string;
    alt: string;
  } | null>(null);

  const openImageZoom = useCallback((image: HTMLImageElement) => {
    const src = String(image.getAttribute("src") || "").trim();

    if (!src) {
      return;
    }

    setZoomedImage({
      src,
      alt: String(image.getAttribute("alt") || "").trim(),
    });
  }, []);

  // This useEffect hook will run after the component renders its HTML.
  // It will then find and process any math elements.
  useEffect(() => {
    const currentRef = contentRef.current;
    if (!currentRef) return;

    // Find all the special math spans that we need to render.
    const mathElements = currentRef.querySelectorAll('span[data-type="math"]');

    if (mathElements.length > 0) {
      mathElements.forEach(span => {
        const latex = span.getAttribute('data-latex') || '';
        const displayMode = span.getAttribute('data-display-mode') === 'true';

        // Use KaTeX to render the math inside the span.
        // We add a check to prevent re-rendering an already processed element.
        if (latex && span.innerHTML === '') {
          try {
            katex.render(latex, span as HTMLElement, {
              throwOnError: false,
              displayMode: displayMode,
            });
          } catch (error) {
            console.error("KaTeX rendering error:", error);
            span.textContent = `[Math Error]`;
          }
        }
      });
    }

    const images = currentRef.querySelectorAll("img");
    images.forEach((image) => {
      if (!(image instanceof HTMLImageElement)) {
        return;
      }

      if (enableImageZoom && String(image.getAttribute("src") || "").trim()) {
        image.dataset.zoomEnabled = "true";
        image.tabIndex = 0;
        image.setAttribute("role", "button");
        image.setAttribute(
          "aria-label",
          image.alt
            ? `Open image preview for ${image.alt}`
            : "Open image preview",
        );
        return;
      }

      delete image.dataset.zoomEnabled;
      image.removeAttribute("role");
      image.removeAttribute("tabindex");
      image.removeAttribute("aria-label");
    });
  }, [enableImageZoom, openImageZoom, sanitizedHtml]);

  useEffect(() => {
    const currentRef = contentRef.current;
    if (!currentRef || !enableImageZoom) {
      return;
    }

    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      const image = target.closest("img[data-zoom-enabled='true']");
      if (!(image instanceof HTMLImageElement)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      openImageZoom(image);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      const target = event.target;
      if (!(target instanceof HTMLImageElement)) {
        return;
      }

      if (target.dataset.zoomEnabled !== "true") {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      openImageZoom(target);
    };

    currentRef.addEventListener("click", handleClick);
    currentRef.addEventListener("keydown", handleKeyDown);

    return () => {
      currentRef.removeEventListener("click", handleClick);
      currentRef.removeEventListener("keydown", handleKeyDown);
    };
  }, [enableImageZoom, openImageZoom]);

  return (
    <>
      <div
        ref={contentRef}
        data-image-zoom-enabled={enableImageZoom ? "true" : "false"}
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
        className="content-renderer prose dark:prose-invert max-w-none"
      />
      {enableImageZoom ? (
        <Dialog
          open={Boolean(zoomedImage)}
          onOpenChange={(open) => {
            if (!open) {
              setZoomedImage(null);
            }
          }}
        >
          <DialogContent
            container={dialogContainer}
            className="app-content-image-zoom-dialog"
          >
            <DialogHeader className="sr-only">
              <DialogTitle>Image preview</DialogTitle>
            </DialogHeader>
            <div className="app-content-image-zoom-stage">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={zoomedImage?.src || ""}
                alt={zoomedImage?.alt || "Expanded content image"}
                className="app-content-image-zoom-image"
              />
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
});
