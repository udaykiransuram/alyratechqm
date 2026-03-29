export const USER_GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
] as const;

export type UserGender = (typeof USER_GENDER_OPTIONS)[number]["value"];

export function normalizeUserGender(value: unknown): UserGender | undefined {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

  return USER_GENDER_OPTIONS.some((option) => option.value === normalized)
    ? (normalized as UserGender)
    : undefined;
}

export function getUserGenderLabel(value: unknown) {
  const normalized = normalizeUserGender(value);
  if (!normalized) {
    return undefined;
  }

  return USER_GENDER_OPTIONS.find((option) => option.value === normalized)?.label;
}
