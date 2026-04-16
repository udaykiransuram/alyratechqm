import { isSummerCrashSchoolKey } from "@/lib/summer-crash/constants";

export function isHiddenPublicSchoolKey(value: unknown): boolean {
  return isSummerCrashSchoolKey(value);
}
