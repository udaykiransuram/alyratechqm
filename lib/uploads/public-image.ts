const PUBLIC_IMAGE_MIME_TYPE_ENTRIES = [
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
  ["image/avif", "avif"],
  ["image/svg+xml", "svg"],
] as const;

export const PUBLIC_IMAGE_EXTENSION_BY_MIME_TYPE = new Map<string, string>(
  PUBLIC_IMAGE_MIME_TYPE_ENTRIES,
);

export const ALLOWED_PUBLIC_IMAGE_MIME_TYPES = new Set<string>(
  PUBLIC_IMAGE_MIME_TYPE_ENTRIES.map(([mimeType]) => mimeType),
);

// Keep server-side multipart uploads below Vercel's request body ceiling.
export const PUBLIC_IMAGE_MAX_UPLOAD_SIZE_BYTES = 4 * 1024 * 1024;
export const PUBLIC_IMAGE_MAX_UPLOAD_SIZE_LABEL = "4 MB";
export const SUPPORTED_PUBLIC_IMAGE_FORMATS_LABEL =
  "PNG, JPG/JPEG, WEBP, GIF, AVIF, and SVG";

export type PublicImageValidationInput = {
  fileName?: string | null;
  mimeType?: string | null;
  size: number;
};

export type PublicImageValidationOptions = {
  emptySource?: "selected" | "uploaded";
};

export type PublicImageValidationResult =
  | {
      ok: true;
      mimeType: string;
    }
  | {
      ok: false;
      message: string;
      status: 400 | 413;
    };

export function guessPublicImageMimeTypeFromFileName(fileName: string) {
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

export function resolvePublicImageMimeType({
  fileName,
  mimeType,
}: {
  fileName?: string | null;
  mimeType?: string | null;
}) {
  const normalizedMimeType = String(mimeType || "").trim().toLowerCase();

  if (ALLOWED_PUBLIC_IMAGE_MIME_TYPES.has(normalizedMimeType)) {
    return normalizedMimeType;
  }

  const guessedMimeType = guessPublicImageMimeTypeFromFileName(
    String(fileName || ""),
  );

  return guessedMimeType && ALLOWED_PUBLIC_IMAGE_MIME_TYPES.has(guessedMimeType)
    ? guessedMimeType
    : null;
}

export function getUnsupportedPublicImageFormatMessage() {
  return `Unsupported image format. Upload ${SUPPORTED_PUBLIC_IMAGE_FORMATS_LABEL} files only.`;
}

export function getEmptyPublicImageMessage(
  source: "selected" | "uploaded" = "uploaded",
) {
  return `${
    source === "selected" ? "The selected image is empty." : "Uploaded image is empty."
  } Upload a ${SUPPORTED_PUBLIC_IMAGE_FORMATS_LABEL} file up to ${PUBLIC_IMAGE_MAX_UPLOAD_SIZE_LABEL}.`;
}

export function getPublicImageTooLargeMessage() {
  return `Image too large. Upload ${SUPPORTED_PUBLIC_IMAGE_FORMATS_LABEL} files up to ${PUBLIC_IMAGE_MAX_UPLOAD_SIZE_LABEL}.`;
}

export function validatePublicImageFile(
  input: PublicImageValidationInput,
  options: PublicImageValidationOptions = {},
): PublicImageValidationResult {
  const mimeType = resolvePublicImageMimeType(input);
  if (!mimeType) {
    return {
      ok: false,
      message: getUnsupportedPublicImageFormatMessage(),
      status: 400,
    };
  }

  if (!(input.size > 0)) {
    return {
      ok: false,
      message: getEmptyPublicImageMessage(options.emptySource || "uploaded"),
      status: 400,
    };
  }

  if (input.size > PUBLIC_IMAGE_MAX_UPLOAD_SIZE_BYTES) {
    return {
      ok: false,
      message: getPublicImageTooLargeMessage(),
      status: 413,
    };
  }

  return {
    ok: true,
    mimeType,
  };
}
