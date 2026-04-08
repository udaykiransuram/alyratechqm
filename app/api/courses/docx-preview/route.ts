import { NextResponse } from "next/server";

const MAX_DOCX_BYTES = 15 * 1024 * 1024;

function getAllowedHosts() {
  return String(process.env.COURSE_DOCX_ALLOWED_HOSTS || "")
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean);
}

function isPrivateHost(hostname: string) {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized.startsWith("10.") ||
    normalized.startsWith("192.168.") ||
    normalized.startsWith("172.16.") ||
    normalized.startsWith("172.17.") ||
    normalized.startsWith("172.18.") ||
    normalized.startsWith("172.19.") ||
    normalized.startsWith("172.2") ||
    normalized.startsWith("172.30.") ||
    normalized.startsWith("172.31.")
  );
}

function resolveFileUrl(rawUrl: string, requestUrl: string) {
  const trimmed = String(rawUrl || "").trim();
  if (!trimmed) {
    throw new Error("Missing file url.");
  }

  const requestOrigin = new URL(requestUrl).origin;
  if (trimmed.startsWith("/")) {
    return new URL(trimmed, requestOrigin).toString();
  }

  const parsed = new URL(trimmed);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Unsupported protocol.");
  }

  if (isPrivateHost(parsed.hostname)) {
    throw new Error("Private hosts are not allowed.");
  }

  const allowedHosts = getAllowedHosts();
  if (allowedHosts.length > 0 && !allowedHosts.includes(parsed.host)) {
    throw new Error("Host is not allowed.");
  }

  if (allowedHosts.length === 0 && parsed.origin !== requestOrigin) {
    throw new Error("Only same-origin files are allowed.");
  }

  return parsed.toString();
}

function buildHtmlDocument(htmlBody: string) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Document Preview</title>
    <style>
      :root { color-scheme: light; }
      body {
        margin: 0;
        padding: 32px 28px 48px;
        font-family: "Inter", "Manrope", "Helvetica Neue", Arial, sans-serif;
        color: #111827;
        background: #ffffff;
        line-height: 1.65;
      }
      h1, h2, h3, h4, h5 {
        color: #0f172a;
        line-height: 1.25;
        margin: 1.4em 0 0.6em;
      }
      p { margin: 0 0 0.9em; }
      table { width: 100%; border-collapse: collapse; margin: 1em 0; }
      table, th, td { border: 1px solid #e2e8f0; }
      th, td { padding: 8px 10px; text-align: left; vertical-align: top; }
      img { max-width: 100%; height: auto; }
      blockquote {
        margin: 1em 0;
        padding: 0.75em 1em;
        border-left: 3px solid #cbd5f5;
        background: #f8fafc;
      }
      ul, ol { margin: 0 0 1em 1.25em; }
    </style>
  </head>
  <body>
    ${htmlBody}
  </body>
</html>`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawUrl = searchParams.get("url") || "";

  try {
    const fileUrl = resolveFileUrl(rawUrl, request.url);
    const response = await fetch(fileUrl);

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch DOCX file." },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_DOCX_BYTES) {
      return NextResponse.json(
        { error: "DOCX file is too large for preview." },
        { status: 413 },
      );
    }

    const mammoth = await import("mammoth");
    const { value } = await mammoth.convertToHtml({ buffer });
    const html = buildHtmlDocument(value || "<p>Document is empty.</p>");

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Preview failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
