import type { NextRequest } from "next/server";
import mongoose, { Schema } from "mongoose";

export function applyArchiveFields(schema: Schema) {
  if (!schema.path("isArchived")) {
    schema.add({
      isArchived: {
        type: Boolean,
        default: false,
        index: true,
      },
      archivedAt: {
        type: Date,
        default: null,
      },
      archivedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
    });
  }
}

export function hasArchiveFields(model: any) {
  return Boolean(model?.schema?.path?.("isArchived"));
}

export function resolveIncludeArchived(
  source?: NextRequest | URL | URLSearchParams | null,
) {
  const searchParams =
    source instanceof URLSearchParams
      ? source
      : source instanceof URL
        ? source.searchParams
        : source?.nextUrl?.searchParams;

  return searchParams?.get("includeArchived") === "true";
}

export function buildArchiveFilter(includeArchived = false) {
  return includeArchived ? {} : { isArchived: { $ne: true } };
}

export function buildArchivedUpdate(actorId?: string | null) {
  const update: Record<string, any> = {
    isArchived: true,
    archivedAt: new Date(),
  };

  if (actorId && mongoose.Types.ObjectId.isValid(actorId)) {
    update.archivedBy = actorId;
  }

  return update;
}

export function buildRestoreUpdate() {
  return {
    isArchived: false,
    archivedAt: null,
    archivedBy: null,
  };
}
