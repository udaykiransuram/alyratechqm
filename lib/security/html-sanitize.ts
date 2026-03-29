const ALLOWED_TAGS = new Set([
  "a",
  "b",
  "blockquote",
  "br",
  "code",
  "div",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "img",
  "li",
  "ol",
  "p",
  "pre",
  "s",
  "span",
  "strong",
  "sub",
  "sup",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "u",
  "ul",
]);

const VOID_TAGS = new Set(["br", "hr", "img"]);

const GLOBAL_ALLOWED_ATTRS = new Set([
  "class",
  "title",
  "aria-label",
  "aria-hidden",
]);

const TAG_ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "target", "rel"]),
  img: new Set(["src", "alt", "width", "height", "loading", "decoding"]),
  span: new Set(["data-type", "data-latex", "data-display-mode"]),
  td: new Set(["colspan", "rowspan"]),
  th: new Set(["colspan", "rowspan"]),
  ol: new Set(["start", "type"]),
  li: new Set(["value"]),
};

const DISALLOWED_BLOCK_TAGS = [
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "form",
  "input",
  "button",
  "textarea",
  "select",
  "option",
  "meta",
  "link",
  "base",
  "noscript",
  "svg",
  "math",
];

const REL_TOKENS = new Set(["noopener", "noreferrer", "nofollow", "ugc"]);
const CLASS_TOKEN_PATTERN = /^[a-zA-Z0-9:_/-]+$/;

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&#(\d+);?/g, (_, num: string) =>
      String.fromCodePoint(Number.parseInt(num, 10)),
    )
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&colon;?/gi, ":")
    .replace(/&tab;?/gi, "\t")
    .replace(/&newline;?/gi, "\n")
    .replace(/&nbsp;?/gi, " ");
}

function escapeHtmlAttr(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function sanitizeClassValue(value: string) {
  const tokens = value
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token && CLASS_TOKEN_PATTERN.test(token));
  return tokens.join(" ");
}

function sanitizeRelValue(value: string) {
  const tokens = value
    .split(/\s+/)
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token && REL_TOKENS.has(token));
  return [...new Set(tokens)].join(" ");
}

function sanitizeNumericAttr(value: string, options?: { min?: number; max?: number }) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  const min = options?.min ?? 1;
  const max = options?.max ?? 10_000;
  const clamped = Math.min(max, Math.max(min, parsed));
  return String(clamped);
}

function sanitizeUrl(value: string, options?: { allowDataImage?: boolean }) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const decoded = decodeHtmlEntities(raw).replace(/[\u0000-\u001F\u007F\s]+/g, "");
  const lowered = decoded.toLowerCase();

  if (
    lowered.startsWith("javascript:") ||
    lowered.startsWith("vbscript:") ||
    lowered.startsWith("data:text/html")
  ) {
    return null;
  }

  if (
    decoded.startsWith("/") ||
    decoded.startsWith("./") ||
    decoded.startsWith("../") ||
    decoded.startsWith("#") ||
    decoded.startsWith("?")
  ) {
    return raw;
  }

  if (options?.allowDataImage && /^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=\s]+$/i.test(decoded)) {
    return raw;
  }

  try {
    const parsedUrl = new URL(decoded);
    if (
      parsedUrl.protocol === "http:" ||
      parsedUrl.protocol === "https:" ||
      parsedUrl.protocol === "mailto:" ||
      parsedUrl.protocol === "tel:"
    ) {
      return raw;
    }
  } catch {
    return null;
  }

  return null;
}

function sanitizeAttributeValue(tagName: string, attrName: string, value: string) {
  if (attrName === "class") {
    const sanitizedClass = sanitizeClassValue(value);
    return sanitizedClass || null;
  }

  if (attrName === "rel") {
    return sanitizeRelValue(value) || null;
  }

  if (attrName === "target") {
    const normalized = value.trim().toLowerCase();
    if (["_self", "_blank", "_parent", "_top"].includes(normalized)) {
      return normalized;
    }
    return null;
  }

  if (attrName === "href") {
    return sanitizeUrl(value);
  }

  if (attrName === "src") {
    return sanitizeUrl(value, { allowDataImage: tagName === "img" });
  }

  if (attrName === "loading" && tagName === "img") {
    const normalized = value.trim().toLowerCase();
    if (["lazy", "eager"].includes(normalized)) {
      return normalized;
    }
    return null;
  }

  if (attrName === "decoding" && tagName === "img") {
    const normalized = value.trim().toLowerCase();
    if (["async", "sync", "auto"].includes(normalized)) {
      return normalized;
    }
    return null;
  }

  if (
    attrName === "width" ||
    attrName === "height" ||
    attrName === "colspan" ||
    attrName === "rowspan" ||
    attrName === "start" ||
    attrName === "value"
  ) {
    return sanitizeNumericAttr(value);
  }

  if (attrName === "type" && tagName === "ol") {
    const normalized = value.trim().toLowerCase();
    if (["1", "a", "A", "i", "I"].includes(normalized)) {
      return normalized;
    }
    return null;
  }

  if (attrName === "data-type" && tagName === "span") {
    return value.trim() === "math" ? "math" : null;
  }

  if (attrName === "data-display-mode" && tagName === "span") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "false") {
      return normalized;
    }
    return null;
  }

  if (attrName === "data-latex" && tagName === "span") {
    return value.trim();
  }

  return value.trim() || null;
}

function sanitizeTagAttributes(tagName: string, rawAttrs: string) {
  const attributes = new Map<string, string>();
  const attributePattern =
    /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match: RegExpExecArray | null;

  while ((match = attributePattern.exec(rawAttrs)) !== null) {
    const attrName = String(match[1] || "").trim().toLowerCase();
    if (!attrName) continue;
    if (attrName.startsWith("on") || attrName === "style") continue;

    const tagAllowedAttrs = TAG_ALLOWED_ATTRS[tagName];
    const canUseAttr =
      GLOBAL_ALLOWED_ATTRS.has(attrName) || Boolean(tagAllowedAttrs?.has(attrName));
    if (!canUseAttr) continue;

    const attrValue = match[2] ?? match[3] ?? match[4] ?? "";
    const sanitizedValue = sanitizeAttributeValue(tagName, attrName, String(attrValue));
    if (!sanitizedValue) continue;
    attributes.set(attrName, sanitizedValue);
  }

  if (tagName === "a" && attributes.get("target") === "_blank") {
    const relTokens = new Set(
      (attributes.get("rel") || "")
        .split(/\s+/)
        .map((token) => token.trim().toLowerCase())
        .filter(Boolean),
    );
    relTokens.add("noopener");
    relTokens.add("noreferrer");
    attributes.set("rel", [...relTokens].join(" "));
  }

  return [...attributes.entries()]
    .map(([name, value]) => `${name}="${escapeHtmlAttr(value)}"`)
    .join(" ");
}

export function sanitizeRichTextHtml(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  let source = value.replace(/\u0000/g, "").replace(/<!--[\s\S]*?-->/g, "");

  for (const tag of DISALLOWED_BLOCK_TAGS) {
    const blockTagPattern = new RegExp(
      `<\\s*${tag}\\b[^>]*>[\\s\\S]*?<\\s*\\/\\s*${tag}\\s*>`,
      "gi",
    );
    source = source.replace(blockTagPattern, "");
    const orphanTagPattern = new RegExp(`<\\/?\\s*${tag}\\b[^>]*>`, "gi");
    source = source.replace(orphanTagPattern, "");
  }

  return source.replace(/<\/?([a-zA-Z][a-zA-Z0-9:-]*)([^<>]*)>/g, (fullTag, tagName, attrs) => {
    const normalizedTagName = String(tagName || "").toLowerCase();
    const isClosingTag = fullTag.startsWith("</");

    if (!ALLOWED_TAGS.has(normalizedTagName)) {
      return "";
    }

    if (isClosingTag) {
      return VOID_TAGS.has(normalizedTagName) ? "" : `</${normalizedTagName}>`;
    }

    const serializedAttrs = sanitizeTagAttributes(normalizedTagName, String(attrs || ""));
    if (VOID_TAGS.has(normalizedTagName)) {
      return serializedAttrs
        ? `<${normalizedTagName} ${serializedAttrs} />`
        : `<${normalizedTagName} />`;
    }

    return serializedAttrs
      ? `<${normalizedTagName} ${serializedAttrs}>`
      : `<${normalizedTagName}>`;
  });
}

export function sanitizeQuestionOptions(options: unknown) {
  if (!Array.isArray(options)) {
    return [];
  }

  return options.map((option) => {
    const plainOption =
      option && typeof option === "object"
        ? { ...(option as Record<string, unknown>) }
        : {};
    return {
      ...plainOption,
      content: sanitizeRichTextHtml(plainOption.content),
    };
  });
}

export function sanitizeQuestionForApiResponse(question: any) {
  if (!question) return question;

  const plainQuestion =
    question && typeof question?.toObject === "function"
      ? question.toObject()
      : { ...question };

  if (typeof plainQuestion.content !== "undefined") {
    plainQuestion.content = sanitizeRichTextHtml(plainQuestion.content);
  }

  if (typeof plainQuestion.explanation !== "undefined") {
    plainQuestion.explanation = sanitizeRichTextHtml(plainQuestion.explanation);
  }

  if (Array.isArray(plainQuestion.options)) {
    plainQuestion.options = sanitizeQuestionOptions(plainQuestion.options);
  }

  return plainQuestion;
}
