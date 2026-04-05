import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const FILE_EXTENSION_BY_MIME_TYPE = new Map<string, string>([
  ["application/pdf", "pdf"],
  ["text/plain", "txt"],
  ["text/csv", "csv"],
  ["application/zip", "zip"],
  ["application/msword", "doc"],
  [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "docx",
  ],
  ["application/vnd.ms-excel", "xls"],
  [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "xlsx",
  ],
  ["application/vnd.ms-powerpoint", "ppt"],
  [
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "pptx",
  ],
]);

const SUPPORTED_FILE_EXTENSIONS = new Set(
  Array.from(FILE_EXTENSION_BY_MIME_TYPE.values()),
);

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

  return normalized || "file";
}

function sanitizeDisplayFileName(fileName: string) {
  const trimmed = String(fileName || "").trim();
  if (!trimmed) {
    return "";
  }

  return trimmed
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function ensureFileExtension(fileName: string, extension: string) {
  const normalizedName = sanitizeDisplayFileName(fileName);
  if (!normalizedName) {
    return `file.${extension}`;
  }

  const currentExtension = normalizedName.split(".").pop()?.toLowerCase();
  if (currentExtension === extension.toLowerCase()) {
    return normalizedName;
  }

  return `${normalizedName.replace(/\.+$/g, "")}.${extension}`;
}

function guessMimeTypeFromFileName(fileName: string) {
  const extension = String(fileName || "")
    .toLowerCase()
    .split(".")
    .pop();

  switch (extension) {
    case "pdf":
      return "application/pdf";
    case "txt":
      return "text/plain";
    case "csv":
      return "text/csv";
    case "zip":
      return "application/zip";
    case "doc":
      return "application/msword";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "xls":
      return "application/vnd.ms-excel";
    case "xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "ppt":
      return "application/vnd.ms-powerpoint";
    case "pptx":
      return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    default:
      return null;
  }
}

export type StorePublicFileInput = {
  buffer: Buffer;
  schoolKey: string;
  fileName: string;
  mimeType?: string | null;
  relativeFolder: string;
};

export async function storePublicFile({
  buffer,
  schoolKey,
  fileName,
  mimeType,
  relativeFolder,
}: StorePublicFileInput) {
  const providedMimeType = String(mimeType || "").toLowerCase();
  const guessedMimeType = guessMimeTypeFromFileName(fileName) || "";
  const normalizedMimeType = FILE_EXTENSION_BY_MIME_TYPE.has(providedMimeType)
    ? providedMimeType
    : guessedMimeType;
  const extension = FILE_EXTENSION_BY_MIME_TYPE.get(normalizedMimeType);

  if (!extension) {
    throw new Error("Unsupported file format.");
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
  const displayFileName = ensureFileExtension(fileName, extension);
  const displayExtension = displayFileName.split(".").pop()?.toLowerCase() || "";
  if (!SUPPORTED_FILE_EXTENSIONS.has(displayExtension)) {
    throw new Error("Unsupported file format.");
  }

  await mkdir(absoluteDir, { recursive: true });
  await writeFile(path.join(absoluteDir, storedFileName), buffer);

  return {
    url: `/${relativeDir.replace(/\\/g, "/")}/${storedFileName}`,
    fileName: displayFileName,
    storedFileName,
    mimeType: normalizedMimeType,
    size: buffer.length,
  };
}
