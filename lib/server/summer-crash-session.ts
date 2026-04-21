import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getSafeReturnToPath } from "@/lib/navigation/returnTo";
import { SUMMER_CRASH_HOME_PATH } from "@/lib/summer-crash/constants";
import { isSummerCrashSession } from "@/lib/summer-crash/shared";

type RedirectSummerCrashPublicSessionParams = {
  defaultHref?: string;
  nextDestinationHref?: string | null;
};

export async function redirectSummerCrashPublicSession(
  params: RedirectSummerCrashPublicSessionParams = {},
) {
  const session = await getServerSession(authOptions);

  if (
    !session?.user ||
    !isSummerCrashSession({
      accountType: session.user.accountType,
      role: session.user.role,
      schoolKey: session.user.schoolKey,
    })
  ) {
    return;
  }

  redirect(
    getSafeReturnToPath(params.nextDestinationHref) ||
      params.defaultHref ||
      SUMMER_CRASH_HOME_PATH,
  );
}
