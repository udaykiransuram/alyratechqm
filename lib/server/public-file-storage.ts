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
  ["video/mp4", "mp4"],
  ["video/webm", "webm"],
  ["video/quicktime", "mov"],
  ["video/x-m4v", "m4v"],
]);

const SUPPORTED_FILE_EXTENSIONS = new Set(
  Array.from(FILE_EXTENSION_BY_MIME_TYPE.values()),
);

const FILE_MIME_TYPES_BY_EXTENSION = new Map(
  Array.from(FILE_EXTENSION_BY_MIME_TYPE.entries()).map(([mime, ext]) => [ext, mime]),
);

const BLOB_CACHE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

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

  if (!extension) {
    return null;
  }

  return FILE_MIME_TYPES_BY_EXTENSION.get(extension) || null;
}

export type StorePublicFileInput = {
  buffer: Buffer;
  schoolKey: string;
  fileName: string;
  mimeType?: string | null;
  relativeFolder: string;
};

type StoredPublicFile = {
  url: string;
  fileName: string;
  storedFileName: string;
  mimeType: string;
  size: number;
};

type VercelBlobPutOptions = {
  access: "public";
  addRandomSuffix: boolean;
  cacheControlMaxAge: number;
  contentType: string;
  token: string;
};

type VercelBlobPutResult = {
  url: string;
  pathname: string;
  contentType?: string | null;
};

type VercelBlobModule = {
  put: (
    pathname: string,
    body: Buffer,
    options: VercelBlobPutOptions,
  ) => Promise<VercelBlobPutResult>;
};

function shouldUseBlobStorage() {
  return process.env.NODE_ENV === "production";
}

async function loadBlobModule() {
  const dynamicImport = new Function(
    "specifier",
    "return import(specifier)",
  ) as (specifier: string) => Promise<VercelBlobModule>;

  try {
    const blobModule = await dynamicImport("@vercel/blob");
    if (typeof blobModule?.put !== "function") {
      throw new Error("Missing Vercel Blob put() export.");
    }

    return blobModule;
  } catch (error) {
    const reason =
      error instanceof Error && error.message.trim()
        ? ` ${error.message.trim()}`
        : "";
    throw new Error(
      `Vercel Blob SDK is unavailable for production file uploads.${reason}`,
    );
  }
}

async function storePublicFileLocally({
  buffer,
  relativeDir,
  storedFileName,
  displayFileName,
  normalizedMimeType,
}: {
  buffer: Buffer;
  relativeDir: string;
  storedFileName: string;
  displayFileName: string;
  normalizedMimeType: string;
}): Promise<StoredPublicFile> {
  const absoluteDir = path.join(process.cwd(), "public", relativeDir);

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

async function storePublicFileInBlob({
  buffer,
  relativeDir,
  storedFileName,
  displayFileName,
  normalizedMimeType,
}: {
  buffer: Buffer;
  relativeDir: string;
  storedFileName: string;
  displayFileName: string;
  normalizedMimeType: string;
}): Promise<StoredPublicFile> {
  const token = String(process.env.BLOB_READ_WRITE_TOKEN || "").trim();

  if (!token) {
    throw new Error(
      "Vercel Blob is not configured. Set BLOB_READ_WRITE_TOKEN for production file uploads.",
    );
  }

  const { put } = await loadBlobModule();
  const pathname = path.posix.join(relativeDir, storedFileName);
  const blob = await put(pathname, buffer, {
    access: "public",
    addRandomSuffix: false,
    cacheControlMaxAge: BLOB_CACHE_MAX_AGE_SECONDS,
    contentType: normalizedMimeType,
    token,
  });

  return {
    url: blob.url,
    fileName: displayFileName,
    storedFileName: path.posix.basename(blob.pathname || pathname),
    mimeType: String(blob.contentType || normalizedMimeType),
    size: buffer.length,
  };
}

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

  return shouldUseBlobStorage()
    ? storePublicFileInBlob({
        buffer,
        relativeDir: relativeDir.replace(/\\/g, "/"),
        storedFileName,
        displayFileName,
        normalizedMimeType,
      })
    : storePublicFileLocally({
        buffer,
        relativeDir,
        storedFileName,
        displayFileName,
        normalizedMimeType,
      });
}
