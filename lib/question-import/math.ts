import {
  findXmlDescendants,
  getFirstXmlChild,
  getXmlChildren,
  getXmlText,
  type XmlElementNode,
} from "@/lib/question-import/xml";

const MATH_MAPPING_TABLE_VERSION = "1";

const UNICODE_OPERATOR_MAP: Record<string, string> = {
  "−": "-",
  "×": "\\times ",
  "÷": "\\div ",
  "≤": "\\le ",
  "≥": "\\ge ",
  "≠": "\\ne ",
  "≈": "\\approx ",
  "π": "\\pi ",
  "θ": "\\theta ",
  "α": "\\alpha ",
  "β": "\\beta ",
  "γ": "\\gamma ",
  "δ": "\\delta ",
  "Δ": "\\Delta ",
  "λ": "\\lambda ",
  "μ": "\\mu ",
  "σ": "\\sigma ",
  "Σ": "\\Sigma ",
  "φ": "\\phi ",
  "Φ": "\\Phi ",
  "ω": "\\omega ",
  "Ω": "\\Omega ",
  "∈": "\\in ",
  "∉": "\\notin ",
  "∪": "\\cup ",
  "∩": "\\cap ",
  "⊂": "\\subset ",
  "⊆": "\\subseteq ",
  "⊃": "\\supset ",
  "⊇": "\\supseteq ",
  "∞": "\\infty ",
  "∠": "\\angle ",
  "°": "^\\circ ",
  "′": "'",
  "″": "''",
};

const LATEX_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\\dfrac/g, "\\frac"],
  [/\\tfrac/g, "\\frac"],
  [/\\left/g, ""],
  [/\\right/g, ""],
  [/\\,/g, " "],
  [/\\!/g, ""],
  [/\\;/g, " "],
  [/\\operatorname\{([^}]+)\}/g, "\\mathrm{$1}"],
];

const BRACKET_MAP: Record<string, string> = {
  "(": "(",
  ")": ")",
  "[": "[",
  "]": "]",
  "{": "\\{",
  "}": "\\}",
  "|": "|",
  "‖": "\\|",
  "⟨": "\\langle ",
  "⟩": "\\rangle ",
  "⌈": "\\lceil ",
  "⌉": "\\rceil ",
  "⌊": "\\lfloor ",
  "⌋": "\\rfloor ",
};

const ACCENT_MAP: Record<string, string> = {
  "̂": "\\hat",
  "̃": "\\tilde",
  "̄": "\\bar",
  "⃗": "\\vec",
  "̇": "\\dot",
  "̈": "\\ddot",
};

const NARY_MAP: Record<string, string> = {
  "∑": "\\sum",
  "∏": "\\prod",
  "∫": "\\int",
  "⋂": "\\bigcap",
  "⋃": "\\bigcup",
};

function escapeHtml(value: string) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeHtmlAttribute(value: string) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function wrapLatex(value: string) {
  const trimmed = String(value || "").trim();
  return trimmed ? `{${trimmed}}` : "{}";
}

function normalizeUnicodeMathCharacters(value: string) {
  return Array.from(String(value || ""))
    .map((character) => UNICODE_OPERATOR_MAP[character] || character)
    .join("");
}

export function normalizeLatexInput(source: string) {
  let normalized = normalizeUnicodeMathCharacters(String(source || "").trim());
  LATEX_REPLACEMENTS.forEach(([pattern, replacement]) => {
    normalized = normalized.replace(pattern, replacement);
  });

  normalized = normalized
    .replace(/\s+/g, " ")
    .replace(/\s+([)}\]])/g, "$1")
    .replace(/([({\[])\s+/g, "$1")
    .trim();

  return normalized;
}

export function createMathNodeHtml(latex: string, displayMode = false) {
  return `<span data-type="math" data-latex="${escapeHtmlAttribute(
    normalizeLatexInput(latex),
  )}" data-display-mode="${displayMode ? "true" : "false"}"></span>`;
}

type MathMarker = {
  displayMode: boolean;
  sourceFormat: "mathpix_latex" | "plain_latex";
  rawSource: string;
  latex: string;
};

function extractMathMarkers(source: string) {
  const markers: Array<
    MathMarker & {
      start: number;
      end: number;
    }
  > = [];
  const pattern =
    /\\\[((?:.|\n)*?)\\\]|\\\(((?:.|\n)*?)\\\)|\$\$((?:.|\n)*?)\$\$|\$(.+?)\$/g;

  for (;;) {
    const match = pattern.exec(source);
    if (!match) break;

    const displayBlock = match[1];
    const inlineBlock = match[2];
    const displayDollarBlock = match[3];
    const inlineDollarBlock = match[4];
    const rawSource = match[0];
    const latex = displayBlock ?? inlineBlock ?? displayDollarBlock ?? inlineDollarBlock ?? "";

    markers.push({
      start: match.index,
      end: match.index + rawSource.length,
      displayMode: typeof displayBlock === "string" || typeof displayDollarBlock === "string",
      sourceFormat:
        rawSource.startsWith("\\(") ||
        rawSource.startsWith("\\[") ||
        rawSource.startsWith("$$")
          ? "mathpix_latex"
          : "plain_latex",
      rawSource,
      latex,
    });
  }

  return markers;
}

export function renderPlainTextWithMathNodes(
  source: string,
  registerFragment: (fragment: {
    sourceFormat: "mathpix_latex" | "plain_latex";
    rawSource: string;
    normalizedLatex: string;
    displayMode: boolean;
  }) => string,
) {
  const text = String(source || "");
  const markers = extractMathMarkers(text);

  if (!markers.length) {
    return escapeHtml(text);
  }

  let cursor = 0;
  let html = "";

  markers.forEach((marker) => {
    if (marker.start > cursor) {
      html += escapeHtml(text.slice(cursor, marker.start));
    }

    const normalizedLatex = normalizeLatexInput(marker.latex);
    html += registerFragment({
      sourceFormat: marker.sourceFormat,
      rawSource: marker.rawSource,
      normalizedLatex,
      displayMode: marker.displayMode,
    });
    cursor = marker.end;
  });

  if (cursor < text.length) {
    html += escapeHtml(text.slice(cursor));
  }

  return html;
}

function getNodeAttr(node: XmlElementNode | null, attrName: string) {
  if (!node) return "";
  return String(node.attrs[attrName] || "").trim();
}

function extractDelimitedValue(node: XmlElementNode | null, childName: string) {
  const child = node ? getFirstXmlChild(node, childName) : null;
  return getNodeAttr(child, "m:val") || getNodeAttr(child, "val");
}

type OmmlConversionResult = {
  latex: string;
  warnings: string[];
};

function ommlChildrenToLatex(
  node: XmlElementNode | null,
  warnings: string[],
): string {
  if (!node) return "";

  return node.children
    .map((child) => {
      if (child.type === "text") {
        return normalizeUnicodeMathCharacters(child.text);
      }

      return ommlNodeToLatex(child, warnings);
    })
    .join("");
}

function ommlNodeToLatex(node: XmlElementNode, warnings: string[]): string {
  switch (node.name) {
    case "m:oMath":
    case "m:oMathPara":
    case "m:e":
    case "m:sub":
    case "m:sup":
    case "m:num":
    case "m:den":
    case "m:fName":
    case "m:deg":
    case "m:lim":
    case "m:ctrlPr":
    case "m:r":
    case "w:r":
      return ommlChildrenToLatex(node, warnings);
    case "m:t":
    case "w:t":
      return normalizeUnicodeMathCharacters(getXmlText(node));
    case "m:f": {
      const numerator = ommlChildrenToLatex(getFirstXmlChild(node, "m:num"), warnings);
      const denominator = ommlChildrenToLatex(getFirstXmlChild(node, "m:den"), warnings);
      return `\\frac${wrapLatex(numerator)}${wrapLatex(denominator)}`;
    }
    case "m:sSup": {
      const base = ommlChildrenToLatex(getFirstXmlChild(node, "m:e"), warnings);
      const superscript = ommlChildrenToLatex(getFirstXmlChild(node, "m:sup"), warnings);
      return `${wrapLatex(base)}^${wrapLatex(superscript)}`;
    }
    case "m:sSub": {
      const base = ommlChildrenToLatex(getFirstXmlChild(node, "m:e"), warnings);
      const subscript = ommlChildrenToLatex(getFirstXmlChild(node, "m:sub"), warnings);
      return `${wrapLatex(base)}_${wrapLatex(subscript)}`;
    }
    case "m:sSubSup": {
      const base = ommlChildrenToLatex(getFirstXmlChild(node, "m:e"), warnings);
      const subscript = ommlChildrenToLatex(getFirstXmlChild(node, "m:sub"), warnings);
      const superscript = ommlChildrenToLatex(getFirstXmlChild(node, "m:sup"), warnings);
      return `${wrapLatex(base)}_${wrapLatex(subscript)}^${wrapLatex(superscript)}`;
    }
    case "m:rad": {
      const degree = ommlChildrenToLatex(getFirstXmlChild(node, "m:deg"), warnings);
      const expression = ommlChildrenToLatex(getFirstXmlChild(node, "m:e"), warnings);
      if (degree.trim()) {
        return `\\sqrt[${degree.trim()}]${wrapLatex(expression)}`;
      }
      return `\\sqrt${wrapLatex(expression)}`;
    }
    case "m:d": {
      const props = getFirstXmlChild(node, "m:dPr");
      const beg = BRACKET_MAP[extractDelimitedValue(props, "m:begChr")] || "(";
      const end = BRACKET_MAP[extractDelimitedValue(props, "m:endChr")] || ")";
      const expression = ommlChildrenToLatex(getFirstXmlChild(node, "m:e"), warnings);
      return `\\left${beg}${expression}\\right${end}`;
    }
    case "m:nary": {
      const props = getFirstXmlChild(node, "m:naryPr");
      const operator = NARY_MAP[extractDelimitedValue(props, "m:chr")] || "\\sum";
      const subscript = ommlChildrenToLatex(getFirstXmlChild(node, "m:sub"), warnings);
      const superscript = ommlChildrenToLatex(getFirstXmlChild(node, "m:sup"), warnings);
      const expression = ommlChildrenToLatex(getFirstXmlChild(node, "m:e"), warnings);
      return `${operator}${subscript ? `_${wrapLatex(subscript)}` : ""}${
        superscript ? `^${wrapLatex(superscript)}` : ""
      }${wrapLatex(expression)}`;
    }
    case "m:func": {
      const functionName = ommlChildrenToLatex(getFirstXmlChild(node, "m:fName"), warnings);
      const expression = ommlChildrenToLatex(getFirstXmlChild(node, "m:e"), warnings);
      return `${functionName}${wrapLatex(expression)}`;
    }
    case "m:limLow": {
      const base = ommlChildrenToLatex(getFirstXmlChild(node, "m:e"), warnings);
      const limit = ommlChildrenToLatex(getFirstXmlChild(node, "m:lim"), warnings);
      return `${wrapLatex(base)}_${wrapLatex(limit)}`;
    }
    case "m:limUpp": {
      const base = ommlChildrenToLatex(getFirstXmlChild(node, "m:e"), warnings);
      const limit = ommlChildrenToLatex(getFirstXmlChild(node, "m:lim"), warnings);
      return `${wrapLatex(base)}^${wrapLatex(limit)}`;
    }
    case "m:acc": {
      const props = getFirstXmlChild(node, "m:accPr");
      const accent = ACCENT_MAP[extractDelimitedValue(props, "m:chr")] || "\\hat";
      const expression = ommlChildrenToLatex(getFirstXmlChild(node, "m:e"), warnings);
      return `${accent}${wrapLatex(expression)}`;
    }
    case "m:bar": {
      const props = getFirstXmlChild(node, "m:barPr");
      const position = extractDelimitedValue(props, "m:pos");
      const expression = ommlChildrenToLatex(getFirstXmlChild(node, "m:e"), warnings);
      const operator = position === "bot" ? "\\underline" : "\\overline";
      return `${operator}${wrapLatex(expression)}`;
    }
    case "m:m": {
      const rows = getXmlChildren(node, "m:mr");
      const matrixLatex = rows
        .map((row) =>
          getXmlChildren(row, "m:e")
            .map((cell) => ommlChildrenToLatex(cell, warnings))
            .join(" & "),
        )
        .join(" \\\\ ");
      return `\\begin{matrix}${matrixLatex}\\end{matrix}`;
    }
    case "m:eqArr": {
      const rows = getXmlChildren(node, "m:e")
        .map((entry) => ommlChildrenToLatex(entry, warnings))
        .join(" \\\\ ");
      return `\\begin{aligned}${rows}\\end{aligned}`;
    }
    case "m:groupChr": {
      const props = getFirstXmlChild(node, "m:groupChrPr");
      const chr = extractDelimitedValue(props, "m:chr");
      const expression = ommlChildrenToLatex(getFirstXmlChild(node, "m:e"), warnings);
      const operator = chr === "⏞" ? "\\overbrace" : chr === "⏟" ? "\\underbrace" : "";
      if (operator) {
        return `${operator}${wrapLatex(expression)}`;
      }
      warnings.push("Encountered a group character that was preserved as raw text.");
      return expression;
    }
    case "m:box":
    case "m:borderBox":
    case "m:phant":
      return ommlChildrenToLatex(getFirstXmlChild(node, "m:e"), warnings);
    case "m:dPr":
    case "m:radPr":
    case "m:fPr":
    case "m:naryPr":
    case "m:accPr":
    case "m:barPr":
    case "m:groupChrPr":
    case "m:rPr":
      return "";
    default: {
      if (node.name.startsWith("m:")) {
        const descendants = findXmlDescendants(node, "m:t")
          .map((child) => getXmlText(child))
          .join("");
        warnings.push(`Unsupported Word equation construct: ${node.name}`);
        return normalizeUnicodeMathCharacters(descendants);
      }

      return ommlChildrenToLatex(node, warnings);
    }
  }
}

export function convertOmmlNodeToLatex(node: XmlElementNode): OmmlConversionResult {
  const warnings: string[] = [];
  const latex = normalizeLatexInput(ommlNodeToLatex(node, warnings));

  return {
    latex,
    warnings,
  };
}

export function getMathMappingTableVersion() {
  return MATH_MAPPING_TABLE_VERSION;
}
