import { NextResponse } from "next/server";

function isTruthyEnv(value: string | undefined) {
  const normalized = String(value || "").trim().toLowerCase();
  return (
    normalized === "1" ||
    normalized === "true" ||
    normalized === "yes" ||
    normalized === "on"
  );
}

export function isProductionEnvironment() {
  return process.env.NODE_ENV === "production";
}

export function isProductionDebugRouteEnabled() {
  return (
    !isProductionEnvironment() ||
    isTruthyEnv(process.env.ENABLE_PRODUCTION_DEBUG_ROUTES)
  );
}

export function isProductionAdminMaintenanceEnabled() {
  return (
    !isProductionEnvironment() ||
    isTruthyEnv(process.env.ENABLE_PRODUCTION_ADMIN_MAINTENANCE)
  );
}

export function requireProductionDebugRouteAccess() {
  if (isProductionDebugRouteEnabled()) {
    return null;
  }

  return NextResponse.json(
    { success: false, message: "Not found." },
    { status: 404 },
  );
}

export function requireProductionAdminMaintenanceAccess() {
  if (isProductionAdminMaintenanceEnabled()) {
    return null;
  }

  return NextResponse.json(
    {
      success: false,
      message:
        "Company maintenance routes are disabled in production for safety. Temporarily enable ENABLE_PRODUCTION_ADMIN_MAINTENANCE to use this route.",
    },
    { status: 403 },
  );
}
