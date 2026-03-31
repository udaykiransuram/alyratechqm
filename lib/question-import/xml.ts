type XmlTextNode = {
  type: "text";
  text: string;
};

export type XmlElementNode = {
  type: "element";
  name: string;
  attrs: Record<string, string>;
  children: XmlNode[];
};

export type XmlNode = XmlElementNode | XmlTextNode;

function decodeXmlEntities(value: string) {
  return String(value || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function parseAttributes(source: string) {
  const attrs: Record<string, string> = {};
  const attrRegex = /([^\s=]+)\s*=\s*"([^"]*)"/g;

  for (;;) {
    const match = attrRegex.exec(source);
    if (!match) break;
    attrs[match[1]] = decodeXmlEntities(match[2]);
  }

  return attrs;
}

export function parseXml(source: string) {
  const root: XmlElementNode = {
    type: "element",
    name: "__root__",
    attrs: {},
    children: [],
  };

  const stack: XmlElementNode[] = [root];
  const tokenRegex = /<!\[CDATA\[[\s\S]*?\]\]>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<[^>]+>|[^<]+/g;

  for (;;) {
    const match = tokenRegex.exec(source);
    if (!match) break;

    const token = match[0];
    const current = stack[stack.length - 1];

    if (!token) {
      continue;
    }

    if (token.startsWith("<?") || token.startsWith("<!--")) {
      continue;
    }

    if (token.startsWith("<![CDATA[")) {
      const text = token.slice(9, -3);
      if (text) {
        current.children.push({ type: "text", text });
      }
      continue;
    }

    if (token.startsWith("</")) {
      stack.pop();
      continue;
    }

    if (token.startsWith("<")) {
      const selfClosing = token.endsWith("/>");
      const inner = token.slice(1, selfClosing ? -2 : -1).trim();
      if (!inner) continue;

      const firstSpaceIndex = inner.search(/\s/);
      const name =
        firstSpaceIndex === -1 ? inner : inner.slice(0, firstSpaceIndex);
      const attrsSource =
        firstSpaceIndex === -1 ? "" : inner.slice(firstSpaceIndex + 1);
      const element: XmlElementNode = {
        type: "element",
        name,
        attrs: parseAttributes(attrsSource),
        children: [],
      };

      current.children.push(element);
      if (!selfClosing) {
        stack.push(element);
      }
      continue;
    }

    const text = decodeXmlEntities(token);
    if (text) {
      current.children.push({ type: "text", text });
    }
  }

  return root;
}

export function isXmlElement(node: XmlNode): node is XmlElementNode {
  return node.type === "element";
}

export function getXmlChildren(node: XmlElementNode, name?: string) {
  const children = node.children.filter(isXmlElement);
  if (!name) {
    return children;
  }
  return children.filter((child) => child.name === name);
}

export function getFirstXmlChild(node: XmlElementNode, name: string) {
  return getXmlChildren(node, name)[0] || null;
}

export function getXmlText(node: XmlNode): string {
  if (node.type === "text") {
    return node.text;
  }

  return node.children.map(getXmlText).join("");
}

export function walkXml(
  node: XmlNode,
  visitor: (node: XmlElementNode) => void,
) {
  if (!isXmlElement(node)) {
    return;
  }

  visitor(node);
  node.children.forEach((child) => walkXml(child, visitor));
}

export function findXmlDescendants(node: XmlElementNode, name: string) {
  const matches: XmlElementNode[] = [];
  walkXml(node, (child) => {
    if (child.name === name) {
      matches.push(child);
    }
  });
  return matches;
}
