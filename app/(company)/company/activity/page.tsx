import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getCompanyActivityData } from "@/lib/company/activity";
import ActivityClient from "./ActivityClient";


export default async function CompanyActivityPage() {
  const session = await getServerSession(authOptions);

  if (
    !session ||
    session.user.accountType !== "company_admin" ||
    session.user.role !== "company_admin"
  ) {
    redirect("/company/schools");
  }

  try {
    const initialData = await getCompanyActivityData({ limit: 100 });

    return (
      <ActivityClient
        initialLogs={initialData.logs}
        initialSchoolKeys={initialData.filters.schoolKeys}
        initialActions={initialData.filters.actions}
        initialSources={initialData.filters.sources}
      />
    );
  } catch (error: any) {
    return (
      <ActivityClient
        initialLogs={[]}
        initialSchoolKeys={[]}
        initialActions={[]}
        initialSources={[]}
        initialError={
          error?.message || "Failed to load initial company activity."
        }
      />
    );
  }
}
