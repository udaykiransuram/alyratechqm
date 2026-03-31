import katex from "katex";

import { sanitizeRichTextHtml } from "@/lib/security/html-sanitize";
import { cn } from "@/lib/utils";

type StaticContentRendererProps = {
  htmlContent: string;
  className?: string;
};

function decodeHtmlAttribute(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);?/g, (_, num: string) =>
      String.fromCodePoint(Number.parseInt(num, 10)),
    )
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    );
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function readAttribute(attributes: string, name: string) {
  const match = new RegExp(`${name}="([^"]*)"`, "i").exec(attributes);
  return match?.[1] || "";
}

function renderStaticMathHtml(html: string) {
  return html.replace(
    /<span\b([^>]*)data-type="math"([^>]*)><\/span>/gi,
    (_fullMatch, beforeAttrs: string, afterAttrs: string) => {
      const attributes = `${beforeAttrs || ""} ${afterAttrs || ""}`;
      const latex = decodeHtmlAttribute(readAttribute(attributes, "data-latex"));
      const displayMode =
        readAttribute(attributes, "data-display-mode").toLowerCase() === "true";

      try {
        return katex.renderToString(latex, {
          throwOnError: false,
          displayMode,
        });
      } catch {
        return escapeHtml(latex);
      }
    },
  );
}

export default function StaticContentRenderer({
  htmlContent,
  className,
}: StaticContentRendererProps) {
  const sanitizedHtml = sanitizeRichTextHtml(htmlContent);
  const renderedHtml = renderStaticMathHtml(sanitizedHtml);

  return (
    <div
      dangerouslySetInnerHTML={{ __html: renderedHtml }}
      className={cn(
        "content-renderer prose max-w-none dark:prose-invert",
        className,
      )}
    />
  );
}
