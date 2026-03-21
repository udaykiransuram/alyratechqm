import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import ActivityClient from "./ActivityClient";

export const dynamic = "force-dynamic";

export default async function CompanyActivityPage() {
  const session = await getServerSession(authOptions);

  if (
    !session ||
    session.user.accountType !== "company_admin" ||
    session.user.role !== "company_admin"
  ) {
    redirect("/company/schools");
  }

  return <ActivityClient />;
}
