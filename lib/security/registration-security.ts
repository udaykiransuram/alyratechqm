import crypto from "crypto";

const PUBLIC_SCOPE_COOKIE = "public_registration_scope";

function getRegistrationSecret() {
  return String(
    process.env.REGISTRATION_SECURITY_SECRET ||
      process.env.NEXTAUTH_SECRET ||
      "",
  ).trim();
}

function createDigest(input: string) {
  const secret = getRegistrationSecret();
  if (!secret) {
    if (process.env.NODE_ENV !== "production") {
      return crypto.createHash("sha256").update(`dev:${input}`).digest("hex");
    }
    throw new Error(
      "Registration security secret is missing. Set REGISTRATION_SECURITY_SECRET or NEXTAUTH_SECRET.",
    );
  }
  return crypto.createHmac("sha256", secret).update(input).digest("hex");
}

function secureEqualHex(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");

  if (
    leftBuffer.length === 0 ||
    rightBuffer.length === 0 ||
    leftBuffer.length !== rightBuffer.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function hashRegistrationLookupToken(token: string) {
  return createDigest(String(token || "").trim());
}

export function generateRegistrationLookupToken() {
  return crypto.randomBytes(24).toString("hex");
}

export function hashSensitiveRegistrationValue(
  label: string,
  value: string,
) {
  return createDigest(`${label}:${String(value || "").trim()}`);
}

export function getPublicRegistrationScopeCookieName() {
  return PUBLIC_SCOPE_COOKIE;
}

export function buildPublicRegistrationScopeValue(schoolKey: string) {
  const normalizedSchoolKey = String(schoolKey || "").trim().toLowerCase();
  const issuedAtSeconds = Math.floor(Date.now() / 1000);
  const payload = `${normalizedSchoolKey}:${issuedAtSeconds}`;
  const signature = createDigest(payload);
  return `${payload}:${signature}`;
}

export function verifyPublicRegistrationScopeValue(
  schoolKey: string,
  cookieValue: string,
  maxAgeSeconds = 900,
) {
  const parts = String(cookieValue || "").split(":");
  if (parts.length !== 3) {
    return false;
  }

  const [cookieSchoolKey, issuedAtRaw, signature] = parts;
  const normalizedSchoolKey = String(schoolKey || "").trim().toLowerCase();
  if (!cookieSchoolKey || cookieSchoolKey !== normalizedSchoolKey) {
    return false;
  }

  const issuedAt = Number(issuedAtRaw);
  if (!Number.isFinite(issuedAt)) {
    return false;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (issuedAt > nowSeconds || nowSeconds - issuedAt > maxAgeSeconds) {
    return false;
  }

  const expectedSignature = createDigest(`${cookieSchoolKey}:${issuedAt}`);
  if (!secureEqualHex(expectedSignature, signature)) {
    return false;
  }

  return true;
}
