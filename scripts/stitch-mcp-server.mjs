#!/usr/bin/env node

import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const DEFAULT_PROTOCOL_VERSION = "2024-11-05";
const SERVER_INFO = {
  name: "stitch-companion",
  version: "0.1.0",
};

const DEFAULT_CONTEXT_FILES = [
  "app/page.tsx",
  "app/globals.css",
  "components/home/HomePageClient.tsx",
  "components/home/HomeSceneCanvas.tsx",
  "components/home/home-content.ts",
  "components/Navbar.tsx",
  "components/Footer.tsx",
  "docs/ui-design-system.md",
];

const PALETTE_VARIANTS = [
  {
    id: "obsidian-teal",
    name: "Obsidian Teal",
    recommended: true,
    narrative:
      "Dark cinematic opening, luminous teal signal moments, and warm ivory proof surfaces for a flagship education brand.",
    tokens: {
      bg: "#071319",
      surface: "#0c1e26",
      surface2: "#122a35",
      text: "#f3fbfc",
      muted: "#91a8b1",
      border: "#1d3b46",
      primary: "#58dbc9",
      primaryContrast: "#041114",
      accent: "#8fcff6",
      success: "#54c98a",
      warning: "#f0c679",
      danger: "#f27f72",
      focus: "#9ee8ff",
      warm: "#f4e4ca",
    },
    useCases: [
      "Premium hero scenes with luminous depth",
      "School-leader-first trust framing",
      "Abstract 3D signal metaphors",
    ],
  },
  {
    id: "midnight-ivory",
    name: "Midnight Ivory",
    recommended: false,
    narrative:
      "Executive and editorial, with quieter cyan accents and brighter proof sections for a more conservative premium feel.",
    tokens: {
      bg: "#0b1118",
      surface: "#111a24",
      surface2: "#172432",
      text: "#f8f7f2",
      muted: "#a0a8b1",
      border: "#243446",
      primary: "#73d9e9",
      primaryContrast: "#081118",
      accent: "#d7c6ff",
      success: "#67c892",
      warning: "#e7c97b",
      danger: "#e9897a",
      focus: "#b6e8ff",
      warm: "#f4efe4",
    },
    useCases: [
      "Sharper executive storytelling",
      "Lighter proof blocks with luxury contrast",
      "Less glow, more boardroom polish",
    ],
  },
  {
    id: "emerald-bronze",
    name: "Emerald Bronze",
    recommended: false,
    narrative:
      "Warmer, more heritage-premium direction with emerald intelligence cues and bronze warmth for trust-heavy brand storytelling.",
    tokens: {
      bg: "#0d1512",
      surface: "#132019",
      surface2: "#1a2b23",
      text: "#f5f5ef",
      muted: "#9da79d",
      border: "#2a3e35",
      primary: "#69d2ac",
      primaryContrast: "#07110d",
      accent: "#c8a26b",
      success: "#76c57b",
      warning: "#e0bc74",
      danger: "#e37f6f",
      focus: "#9ee8c7",
      warm: "#efe2cb",
    },
    useCases: [
      "Trust-led storytelling with less tech coldness",
      "Founder-credibility and institution-heavy positioning",
      "Premium surfaces with restrained glow",
    ],
  },
  {
    id: "ink-cyan-sand",
    name: "Ink Cyan Sand",
    recommended: false,
    narrative:
      "A cleaner, brighter system with deep ink anchors, cyan signals, and sand-toned proof surfaces for a modern product-led feel.",
    tokens: {
      bg: "#0a1420",
      surface: "#10202d",
      surface2: "#173042",
      text: "#f6fbff",
      muted: "#93a6b4",
      border: "#23485a",
      primary: "#63d9ff",
      primaryContrast: "#051219",
      accent: "#f2d39c",
      success: "#64c79e",
      warning: "#eabb73",
      danger: "#ef837b",
      focus: "#a8ecff",
      warm: "#efe5d6",
    },
    useCases: [
      "More product-led public-site energy",
      "Sharper CTA contrast on light surfaces",
      "Calm premium without heavy teal dominance",
    ],
  },
];

const TOOL_DEFS = [
  {
    name: "stitch.health",
    description:
      "Report the workspace, environment, and homepage design context readiness for the local Stitch companion workflow.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "stitch.context_files",
    description:
      "Load the homepage and public-shell files that matter for a redesign prompt or design-system audit.",
    inputSchema: {
      type: "object",
      properties: {
        paths: {
          type: "array",
          description:
            "Optional repo-relative paths. Defaults to the homepage context bundle.",
          items: { type: "string" },
        },
        maxCharsPerFile: {
          type: "integer",
          description:
            "Maximum number of characters returned for each file's content.",
          minimum: 500,
          maximum: 40000,
        },
        includeContent: {
          type: "boolean",
          description: "Set false to return metadata only.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "stitch.palette_variants",
    description:
      "Return curated premium palette directions for the homepage and related public-site shell.",
    inputSchema: {
      type: "object",
      properties: {
        preferredId: {
          type: "string",
          description: "Optional palette id to highlight first in the response.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "stitch.generate_homepage_brief",
    description:
      "Generate a flagship homepage brief and Stitch-ready design prompt using the local project context.",
    inputSchema: {
      type: "object",
      properties: {
        brandName: {
          type: "string",
          description: "Brand name for the generated brief.",
        },
        audience: {
          type: "string",
          description: "Primary buyer or audience to optimize the story for.",
        },
        paletteVariantId: {
          type: "string",
          description: "Palette variant id from stitch.palette_variants.",
        },
        primaryCta: {
          type: "string",
          description: "Primary CTA label.",
        },
        secondaryCta: {
          type: "string",
          description: "Secondary CTA label.",
        },
        supportCta: {
          type: "string",
          description: "Support CTA label.",
        },
        tone: {
          type: "string",
          description: "Creative direction tone.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "stitch.export_homepage_brief",
    description:
      "Generate and save the flagship homepage brief under docs/stitch for reuse in design tooling.",
    inputSchema: {
      type: "object",
      properties: {
        brandName: { type: "string" },
        audience: { type: "string" },
        paletteVariantId: { type: "string" },
        primaryCta: { type: "string" },
        secondaryCta: { type: "string" },
        supportCta: { type: "string" },
        tone: { type: "string" },
        outputPath: {
          type: "string",
          description:
            "Optional repo-relative destination. Defaults to docs/stitch/homepage-brief.json.",
        },
      },
      additionalProperties: false,
    },
  },
];

function normalizeRelPath(inputPath) {
  return String(inputPath || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.?\//, "");
}

function resolveWorkspacePath(inputPath) {
  const normalized = normalizeRelPath(inputPath);
  const absolutePath = path.resolve(ROOT, normalized);

  if (absolutePath !== ROOT && !absolutePath.startsWith(`${ROOT}${path.sep}`)) {
    throw new Error(`Path must stay within the workspace: ${inputPath}`);
  }

  return {
    absolutePath,
    relativePath:
      absolutePath === ROOT
        ? "."
        : path.relative(ROOT, absolutePath).split(path.sep).join("/"),
  };
}

async function existsInWorkspace(relativePath) {
  try {
    await access(resolveWorkspacePath(relativePath).absolutePath);
    return true;
  } catch {
    return false;
  }
}

function pickPaletteVariant(preferredId) {
  if (preferredId) {
    const chosen = PALETTE_VARIANTS.find((variant) => variant.id === preferredId);
    if (chosen) return chosen;
  }

  return PALETTE_VARIANTS.find((variant) => variant.recommended) || PALETTE_VARIANTS[0];
}

async function readContextFile(relativePath, options = {}) {
  const includeContent = options.includeContent ?? true;
  const maxCharsPerFile = Math.max(
    500,
    Math.min(40000, Number(options.maxCharsPerFile) || 12000),
  );
  const { absolutePath, relativePath: safeRelativePath } =
    resolveWorkspacePath(relativePath);

  try {
    const raw = await readFile(absolutePath, "utf8");
    const truncated = raw.length > maxCharsPerFile;

    return {
      path: safeRelativePath,
      exists: true,
      bytes: Buffer.byteLength(raw, "utf8"),
      lines: raw.split("\n").length,
      truncated,
      omittedChars: truncated ? raw.length - maxCharsPerFile : 0,
      content: includeContent ? raw.slice(0, maxCharsPerFile) : undefined,
    };
  } catch (error) {
    return {
      path: safeRelativePath,
      exists: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function buildPalettePresentation(variant) {
  return {
    id: variant.id,
    name: variant.name,
    recommended: variant.recommended,
    narrative: variant.narrative,
    tokens: variant.tokens,
    useCases: variant.useCases,
  };
}

function buildHomepageBrief(rawArgs = {}) {
  const args = rawArgs || {};
  const palette = pickPaletteVariant(args.paletteVariantId);
  const brandName = String(args.brandName || "Alyra Tech");
  const audience = String(
    args.audience ||
      "school leaders, principals, academic directors, and quality teams",
  );
  const primaryCta = String(args.primaryCta || "Request Demo");
  const secondaryCta = String(args.secondaryCta || "Start Baseline Test");
  const supportCta = String(args.supportCta || "WhatsApp Support");
  const tone = String(
    args.tone || "flagship, cinematic, credible, calm-premium, and outcome-led",
  );

  const chapters = [
    {
      id: "hero",
      label: "Hero",
      outcome:
        "Establish trust with school leaders immediately and make the product feel like a premium operating system rather than another SaaS page.",
      headline:
        "Reveal hidden thinking patterns before they become school performance headlines.",
      scene:
        "A dark cinematic abstract intelligence field with a luminous signal core, orbit lines, and translucent interface planes.",
      cta: [primaryCta, secondaryCta, supportCta],
    },
    {
      id: "what-grades-miss",
      label: "Chapter 2",
      outcome:
        "Show that identical scores can hide very different reasoning quality, hesitation, and misconception patterns.",
      headline: "What grades miss",
      scene:
        "Score bars dissolve into misconception clusters, timing pulses, and recovery trails that visualize the hidden story behind the mark.",
    },
    {
      id: "school-class-student",
      label: "Chapter 3",
      outcome:
        "Demonstrate school-to-class-to-student drill-down as the signature intelligence story.",
      headline: "School -> Class -> Student",
      scene:
        "Camera zoom transitions through a leadership map, a class cluster lattice, and a learner action card.",
    },
    {
      id: "platform",
      label: "Chapter 4",
      outcome:
        "Present diagnostics, reports, OMR, ERP, and school workflows as one connected premium operating system.",
      headline: "One platform, one operating layer",
      scene:
        "Module planes organize into a clean system ribbon instead of a generic feature grid.",
    },
    {
      id: "proof",
      label: "Chapter 5",
      outcome:
        "Close with trust, evidence, and a strong conversion band without losing the premium feel.",
      headline: "Proof and conversion",
      scene:
        "The visual tone shifts lighter and warmer with premium proof cards, testimonials, FAQ surfaces, and a final CTA band.",
    },
  ];

  const designPrinciples = [
    "No emoji iconography, no generic SaaS card wall, and no fake AI visuals.",
    "Use fewer stronger sections instead of many stacked blocks.",
    "Keep the first half dark and cinematic, then transition to warmer premium proof surfaces.",
    "Use selective translucency only in the opening chapters; favor solid premium surfaces elsewhere.",
    "Make motion scroll-linked and purposeful rather than autoplay-heavy.",
  ];

  const implementationConstraints = [
    "Keep the current homepage server data contract intact: stats, testimonials, FAQs, pricing, and WhatsApp remain server-driven from app/page.tsx.",
    "Client-only motion and 3D layers should hydrate after readable content is already on screen.",
    "Reduced-motion and no-WebGL fallbacks must still look polished, not broken or empty.",
    "The homepage should align with the public navbar and footer instead of feeling like a different product.",
  ];

  const stitchPrompt = [
    `Design a flagship homepage for ${brandName}, a premium edtech company serving ${audience}.`,
    `Tone: ${tone}.`,
    `Primary conversion hierarchy: ${primaryCta} first, ${secondaryCta} second, ${supportCta} as the support CTA.`,
    `Creative direction: ${palette.narrative}`,
    "Build the experience as a dark-to-light cinematic scroll story with an abstract 3D system in the first half and calmer trust/proof sections in the second half.",
    "Use premium product metaphors instead of literal students or stock classroom footage: signal cores, orbit lines, translucent data slabs, misconception clusters, drill-down lattices, and connected module planes.",
    "Keep the product meaning anchored around: revealing hidden thinking patterns, drilling from school to class to student, connecting diagnosis to intervention, and presenting the broader platform as one operating system.",
    "Use Fraunces for large editorial display headlines and Manrope for body/UI text.",
    "Keep shapes crisp and expensive: 24px main radius, pill CTAs, thin borders, selective highlights, and high-contrast hero buttons.",
    "Avoid muddy glass, visual clutter, teal-on-white repetition, and generic feature-grid SaaS styling.",
    `Palette tokens to work from: ${JSON.stringify(palette.tokens)}.`,
    "The page should preserve current dynamic content inputs for stats, testimonials, FAQs, pricing, and WhatsApp while redesigning the full presentation layer.",
    "Desktop should feel like one continuous story across the first four chapters. Mobile should adapt the same narrative into premium stacked sections with lighter motion rather than forcing desktop pinning.",
    "Include a polished reduced-motion and no-WebGL fallback with strong static composition and intact CTA hierarchy.",
  ].join("\n");

  return {
    generatedAt: new Date().toISOString(),
    brandName,
    audience,
    tone,
    ctas: {
      primary: primaryCta,
      secondary: secondaryCta,
      support: supportCta,
    },
    palette: buildPalettePresentation(palette),
    designPrinciples,
    implementationConstraints,
    chapters,
    implementationReferences: DEFAULT_CONTEXT_FILES,
    stitchPrompt,
  };
}

function formatJsonPreview(value) {
  return JSON.stringify(value, null, 2);
}

function formatContextFilesPreview(result) {
  const lines = [
    `Loaded ${result.files.length} context files from ${result.cwd}`,
  ];

  for (const file of result.files) {
    const status = file.exists ? "ok" : "missing";
    lines.push(`- ${file.path} (${status})`);
    if (file.exists) {
      lines.push(`  bytes: ${file.bytes}, lines: ${file.lines}`);
      if (file.truncated) {
        lines.push(`  truncated: yes, omittedChars: ${file.omittedChars}`);
      }
      if (file.content) {
        lines.push("");
        lines.push(`----- ${file.path} -----`);
        lines.push(file.content);
        lines.push(`----- end ${file.path} -----`);
      }
    } else if (file.error) {
      lines.push(`  error: ${file.error}`);
    }
  }

  return lines.join("\n");
}

function formatPalettePreview(result) {
  return result.variants
    .map((variant) => {
      const heading = `${variant.name} (${variant.id})${
        variant.recommended ? " [recommended]" : ""
      }`;
      return [
        heading,
        variant.narrative,
        `tokens: ${formatJsonPreview(variant.tokens)}`,
        `useCases: ${variant.useCases.join("; ")}`,
      ].join("\n");
    })
    .join("\n\n");
}

function formatBriefPreview(result) {
  return [
    `Flagship homepage brief for ${result.brandName}`,
    `palette: ${result.palette.name} (${result.palette.id})`,
    "",
    result.stitchPrompt,
  ].join("\n");
}

function formatExportPreview(result) {
  return [
    `Exported homepage brief to ${result.outputPath}`,
    `palette: ${result.brief.palette.name} (${result.brief.palette.id})`,
    `chapters: ${result.brief.chapters.length}`,
  ].join("\n");
}

async function runTool(name, args) {
  switch (name) {
    case "stitch.health": {
      const contextFiles = await Promise.all(
        DEFAULT_CONTEXT_FILES.map(async (relativePath) => ({
          path: relativePath,
          exists: await existsInWorkspace(relativePath),
        })),
      );

      const result = {
        ok: true,
        cwd: ROOT,
        server: SERVER_INFO,
        command: "npm run mcp:stitch",
        entrypoint: "scripts/stitch-mcp-server.mjs",
        environment: {
          STITCH_API_KEY: Boolean(process.env.STITCH_API_KEY),
          STITCH_PROJECT_ID: Boolean(process.env.STITCH_PROJECT_ID),
          STITCH_BASE_URL: Boolean(process.env.STITCH_BASE_URL),
        },
        homepageContextReady: contextFiles.every((file) => file.exists),
        contextFiles,
        paletteVariants: PALETTE_VARIANTS.map((variant) => variant.id),
        generatedAt: new Date().toISOString(),
      };

      return {
        content: [{ type: "text", text: formatJsonPreview(result) }],
        structuredContent: result,
      };
    }

    case "stitch.context_files": {
      const requestedPaths =
        Array.isArray(args?.paths) && args.paths.length
          ? args.paths
          : DEFAULT_CONTEXT_FILES;
      const files = await Promise.all(
        requestedPaths.map((relativePath) => readContextFile(relativePath, args)),
      );

      const result = {
        cwd: ROOT,
        count: files.length,
        files,
      };

      return {
        content: [{ type: "text", text: formatContextFilesPreview(result) }],
        structuredContent: result,
      };
    }

    case "stitch.palette_variants": {
      const preferredId = args?.preferredId;
      const highlighted = pickPaletteVariant(preferredId);
      const ordered = [
        highlighted,
        ...PALETTE_VARIANTS.filter((variant) => variant.id !== highlighted.id),
      ].map(buildPalettePresentation);

      const result = {
        recommendedId: highlighted.id,
        variants: ordered,
      };

      return {
        content: [{ type: "text", text: formatPalettePreview(result) }],
        structuredContent: result,
      };
    }

    case "stitch.generate_homepage_brief": {
      const brief = buildHomepageBrief(args);

      return {
        content: [{ type: "text", text: formatBriefPreview(brief) }],
        structuredContent: brief,
      };
    }

    case "stitch.export_homepage_brief": {
      const brief = buildHomepageBrief(args);
      const targetPath = args?.outputPath || "docs/stitch/homepage-brief.json";
      const { absolutePath, relativePath } = resolveWorkspacePath(targetPath);

      await mkdir(path.dirname(absolutePath), { recursive: true });
      const payload = `${JSON.stringify(brief, null, 2)}\n`;
      await writeFile(absolutePath, payload, "utf8");

      const result = {
        outputPath: relativePath,
        bytes: Buffer.byteLength(payload, "utf8"),
        brief,
      };

      return {
        content: [{ type: "text", text: formatExportPreview(result) }],
        structuredContent: result,
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function sendMessage(message) {
  const json = JSON.stringify(message);
  const headers = [
    `Content-Length: ${Buffer.byteLength(json, "utf8")}`,
    "Content-Type: application/json",
    "",
    "",
  ].join("\r\n");
  process.stdout.write(headers);
  process.stdout.write(json);
}

function sendResult(id, result) {
  sendMessage({
    jsonrpc: "2.0",
    id,
    result,
  });
}

function sendError(id, code, message, data) {
  sendMessage({
    jsonrpc: "2.0",
    id: id ?? null,
    error: {
      code,
      message,
      ...(data === undefined ? {} : { data }),
    },
  });
}

async function handleMessage(message) {
  if (!message || typeof message !== "object") {
    sendError(null, -32600, "Invalid request");
    return;
  }

  const { id, method, params } = message;

  try {
    switch (method) {
      case "initialize": {
        sendResult(id, {
          protocolVersion: params?.protocolVersion || DEFAULT_PROTOCOL_VERSION,
          capabilities: {
            tools: {
              listChanged: false,
            },
          },
          serverInfo: SERVER_INFO,
          instructions:
            "Local Stitch companion for Alyra Tech homepage design work. Use stitch.context_files, stitch.palette_variants, and stitch.generate_homepage_brief to prepare high-quality redesign prompts.",
        });
        return;
      }

      case "notifications/initialized":
        return;

      case "ping":
        sendResult(id, {});
        return;

      case "tools/list":
        sendResult(id, { tools: TOOL_DEFS });
        return;

      case "tools/call": {
        const toolName = params?.name;
        const toolArgs = params?.arguments || {};
        const result = await runTool(toolName, toolArgs);
        sendResult(id, result);
        return;
      }

      default:
        sendError(id, -32601, `Method not found: ${method}`);
    }
  } catch (error) {
    const messageText = error instanceof Error ? error.message : String(error);
    console.error(`[stitch-mcp] ${messageText}`);
    if (id !== undefined) {
      sendError(id, -32000, messageText);
    }
  }
}

let buffer = Buffer.alloc(0);

function processBuffer() {
  while (true) {
    const headerEnd = buffer.indexOf("\r\n\r\n");
    if (headerEnd === -1) return;

    const headerText = buffer.slice(0, headerEnd).toString("utf8");
    const lengthMatch = headerText.match(/content-length:\s*(\d+)/i);
    if (!lengthMatch) {
      sendError(null, -32700, "Missing Content-Length header");
      buffer = Buffer.alloc(0);
      return;
    }

    const contentLength = Number(lengthMatch[1]);
    const messageEnd = headerEnd + 4 + contentLength;
    if (buffer.length < messageEnd) return;

    const bodyBuffer = buffer.slice(headerEnd + 4, messageEnd);
    buffer = buffer.slice(messageEnd);

    let parsed;
    try {
      parsed = JSON.parse(bodyBuffer.toString("utf8"));
    } catch (error) {
      const messageText =
        error instanceof Error ? error.message : "Invalid JSON payload";
      sendError(null, -32700, messageText);
      continue;
    }

    void handleMessage(parsed);
  }
}

process.stdin.on("data", (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  processBuffer();
});

process.stdin.on("error", (error) => {
  console.error(`[stitch-mcp] stdin error: ${error.message}`);
});

process.stdout.on("error", (error) => {
  console.error(`[stitch-mcp] stdout error: ${error.message}`);
});
