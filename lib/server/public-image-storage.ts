import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

import {
  PUBLIC_IMAGE_EXTENSION_BY_MIME_TYPE,
  resolvePublicImageMimeType,
} from "@/lib/uploads/public-image";

const BLOB_CACHE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function hasBlobReadWriteToken() {
  return Boolean(String(process.env.BLOB_READ_WRITE_TOKEN || "").trim());
}

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

export type StorePublicImageInput = {
  buffer: Buffer;
  schoolKey: string;
  fileName: string;
  mimeType?: string | null;
  relativeFolder: string;
};

type StoredPublicImage = {
  url: string;
  fileName: string;
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
  const explicitMode = String(
    process.env.PUBLIC_UPLOADS_DRIVER || process.env.PUBLIC_FILE_STORAGE || "",
  )
    .trim()
    .toLowerCase();

  if (explicitMode === "local") {
    return false;
  }

  if (explicitMode === "blob") {
    return true;
  }

  if (hasBlobReadWriteToken()) {
    return true;
  }

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
      `Vercel Blob SDK is unavailable for image uploads.${reason}`,
    );
  }
}

async function storePublicImageLocally({
  buffer,
  normalizedMimeType,
  relativeDir,
  storedFileName,
}: {
  buffer: Buffer;
  normalizedMimeType: string;
  relativeDir: string;
  storedFileName: string;
}): Promise<StoredPublicImage> {
  const absoluteDir = path.join(process.cwd(), "public", relativeDir);

  await mkdir(absoluteDir, { recursive: true });
  await writeFile(path.join(absoluteDir, storedFileName), buffer);

  return {
    url: `/${relativeDir}/${storedFileName}`,
    fileName: storedFileName,
    mimeType: normalizedMimeType,
    size: buffer.length,
  };
}

async function storePublicImageInBlob({
  buffer,
  normalizedMimeType,
  relativeDir,
  storedFileName,
}: {
  buffer: Buffer;
  normalizedMimeType: string;
  relativeDir: string;
  storedFileName: string;
}): Promise<StoredPublicImage> {
  const token = String(process.env.BLOB_READ_WRITE_TOKEN || "").trim();

  if (!token) {
    throw new Error(
      "Vercel Blob is not configured. Set BLOB_READ_WRITE_TOKEN for image uploads.",
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
    fileName: path.posix.basename(blob.pathname || pathname),
    mimeType: String(blob.contentType || normalizedMimeType),
    size: buffer.length,
  };
}

export async function storePublicImage({
  buffer,
  schoolKey,
  fileName,
  mimeType,
  relativeFolder,
}: StorePublicImageInput) {
  const normalizedMimeType = resolvePublicImageMimeType({ fileName, mimeType });

  if (!normalizedMimeType) {
    throw new Error("Unsupported image format.");
  }

  const extension = PUBLIC_IMAGE_EXTENSION_BY_MIME_TYPE.get(normalizedMimeType);

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
  const relativeDir = path.posix.join(
    "uploads",
    folderSegment,
    schoolKeySegment,
    year,
    month,
  );

  return shouldUseBlobStorage()
    ? storePublicImageInBlob({
        buffer,
        normalizedMimeType,
        relativeDir,
        storedFileName,
      })
    : storePublicImageLocally({
        buffer,
        normalizedMimeType,
        relativeDir,
        storedFileName,
      });
}
