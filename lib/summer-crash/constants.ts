export const SUMMER_CRASH_SCHOOL_KEY = String(
  process.env.SUMMER_CRASH_SCHOOL_KEY || "summer-crash-course",
)
  .trim()
  .toLowerCase();

export const SUMMER_CRASH_DISPLAY_NAME = String(
  process.env.SUMMER_CRASH_DISPLAY_NAME || "Summer Crash Course",
).trim();

export const SUMMER_CRASH_SUPPORT_CONTACT = String(
  process.env.SUMMER_CRASH_SUPPORT_CONTACT || "",
).trim();

export const SUMMER_CRASH_HOME_PATH = "/student/crash-course";
export const SUMMER_CRASH_SIGNIN_PATH = "/summer-crash-course/signin";
export const SUMMER_CRASH_REGISTER_PATH = "/summer-crash-course/register";
export const SUMMER_CRASH_HELP_PATH = "/summer-crash-course/help";
export const SUMMER_CRASH_WELCOME_PATH = "/summer-crash-course/welcome";

export const SUMMER_CRASH_DEFAULT_CLASS_BANDS = [
  "Class 5",
  "Class 6",
  "Class 7",
  "Class 8",
  "Class 9",
  "Class 10",
] as const;

export function isSummerCrashSchoolKey(value: unknown) {
  return (
    String(value || "").trim().toLowerCase() === SUMMER_CRASH_SCHOOL_KEY
  );
}

