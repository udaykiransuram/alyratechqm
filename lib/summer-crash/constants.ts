export const SUMMER_CRASH_SCHOOL_KEY = String(
  process.env.SUMMER_CRASH_SCHOOL_KEY || "summer-crash-course",
)
  .trim()
  .toLowerCase();

export const SUMMER_CRASH_DISPLAY_NAME = String(
  process.env.SUMMER_CRASH_DISPLAY_NAME || "Math Foundations Summer Sprint",
).trim();

export const SUMMER_CRASH_SUPPORT_CONTACT = String(
  process.env.SUMMER_CRASH_SUPPORT_CONTACT || "",
).trim();

export const SUMMER_CRASH_PRICE = Number(
  process.env.SUMMER_CRASH_PRICE || "0",
);

export const SUMMER_CRASH_CURRENCY = String(
  process.env.SUMMER_CRASH_CURRENCY || "INR",
)
  .trim()
  .toUpperCase();

export const SUMMER_CRASH_WHATSAPP_GROUP_URL = String(
  process.env.SUMMER_CRASH_WHATSAPP_GROUP_URL || "",
).trim();

export const SUMMER_CRASH_HOME_PATH = "/student/crash-course";
export const SUMMER_CRASH_SIGNIN_PATH = "/summer-crash-course/signin";
export const SUMMER_CRASH_REGISTER_PATH = "/summer-crash-course/register";
export const SUMMER_CRASH_HELP_PATH = "/summer-crash-course/help";
export const SUMMER_CRASH_WELCOME_PATH = "/summer-crash-course/welcome";
export const SUMMER_AUTHOR_SIGNIN_PATH = "/summer-author/signin";
export const SUMMER_CRASH_PUBLIC_TESTS_PATH = "/workspace/public-tests";
export const SUMMER_CRASH_SUCCESS_PATH = "/summer-crash-course/success";
export const SUMMER_CRASH_FAILURE_PATH = "/summer-crash-course/failure";
export const SUMMER_CRASH_PAYMENT_PATH = "/summer-crash-course/payment";

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
