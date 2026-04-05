import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const IMAGE_EXTENSION_BY_MIME_TYPE = new Map<string, string>([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
  ["image/avif", "avif"],
  ["image/svg+xml", "svg"],
]);

function sanitizePathSegment(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "") || "default";
}

function sanitizeFileBaseName(fileName: string) {
  const normalized = String(fileName || "")
    .replace(/\.[a-z0-9]+$/i, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");

  return normalized || "image";
}

function guessMimeTypeFromFileName(fileName: string) {
  const extension = String(fileName || "")
    .toLowerCase()
    .split(".")
    .pop();

  switch (extension) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "avif":
      return "image/avif";
    case "svg":
      return "image/svg+xml";
    default:
      return null;
  }
}

export type StorePublicImageInput = {
  buffer: Buffer;
  schoolKey: string;
  fileName: string;
  mimeType?: string | null;
  relativeFolder: string;
};

export async function storePublicImage({
  buffer,
  schoolKey,
  fileName,
  mimeType,
  relativeFolder,
}: StorePublicImageInput) {
  const providedMimeType = String(mimeType || "").toLowerCase();
  const guessedMimeType = guessMimeTypeFromFileName(fileName) || "";
  const normalizedMimeType = IMAGE_EXTENSION_BY_MIME_TYPE.has(providedMimeType)
    ? providedMimeType
    : guessedMimeType;
  const extension = IMAGE_EXTENSION_BY_MIME_TYPE.get(normalizedMimeType);

  if (!extension) {
    throw new Error("Unsupported image format.");
  }

  const createdAt = new Date();
  const schoolKeySegment = sanitizePathSegment(schoolKey);
  const year = String(createdAt.getUTCFullYear());
  const month = String(createdAt.getUTCMonth() + 1).padStart(2, "0");
  const folderSegment = relativeFolder
    .split("/")
    .map((segment) => sanitizePathSegment(segment))
    .join("/");
  const baseName = sanitizeFileBaseName(fileName);
  const storedFileName = `${Date.now()}-${randomUUID()}-${baseName}.${extension}`;
  const relativeDir = path.join(
    "uploads",
    folderSegment,
    schoolKeySegment,
    year,
    month,
  );
  const absoluteDir = path.join(process.cwd(), "public", relativeDir);

  await mkdir(absoluteDir, { recursive: true });
  await writeFile(path.join(absoluteDir, storedFileName), buffer);

  return {
    url: `/${relativeDir.replace(/\\/g, "/")}/${storedFileName}`,
    fileName: storedFileName,
    mimeType: normalizedMimeType,
    size: buffer.length,
  };
}
