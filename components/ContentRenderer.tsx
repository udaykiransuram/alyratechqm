"use client";

import { memo, useEffect, useRef } from "react";
import katex from 'katex';
// Make sure the KaTeX CSS is imported to style the math correctly.
import 'katex/dist/katex.min.css';
import { sanitizeRichTextHtml } from "@/lib/security/html-sanitize";

interface ContentRendererProps {
  htmlContent: string;
}

export const ContentRenderer = memo(function ContentRenderer({
  htmlContent,
}: ContentRendererProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const sanitizedHtml = sanitizeRichTextHtml(htmlContent);

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
  }, [sanitizedHtml]);

  return (
    <div
      ref={contentRef}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      className="content-renderer prose dark:prose-invert max-w-none"
    />
  );
});
