"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCcw, Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { fetchApiJson } from "@/lib/client/api";
import { isMockedE2ETestMode } from "@/lib/test-mode";

const REPORT_JOBS_REFRESH_EVENT = "report-jobs:refresh";

type ReportJobsHeroActionsProps = {
  schoolKey: string;
};

export default function ReportJobsHeroActions({
  schoolKey,
}: ReportJobsHeroActionsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const shouldRefreshMockedData = isMockedE2ETestMode();
  const [isRefreshing, startRefreshTransition] = useTransition();
  const [isRunningWorker, setIsRunningWorker] = useState(false);

  const handleRefresh = () => {
    if (shouldRefreshMockedData) {
      window.dispatchEvent(new Event(REPORT_JOBS_REFRESH_EVENT));
      return;
    }

    startRefreshTransition(() => {
      router.refresh();
    });
  };

  const handleRunWorkerNow = async () => {
    try {
      setIsRunningWorker(true);
      const data = await fetchApiJson<any>("/api/reports/worker", {
        method: "POST",
        schoolKey,
        fallbackMessage: "Worker failed.",
      });
      const recoveredNote =
        data.recoveredStale > 0
          ? ` Recovered ${data.recoveredStale} stale job lock(s).`
          : "";
      const waitingNote =
        data.awaitingProviderAck > 0
          ? ` ${data.awaitingProviderAck} job(s) are waiting for provider acknowledgement before retry.`
          : "";

      toast({
        title: "Worker completed",
        description: `Processed ${data.processed}, sent ${data.sent}, and failed ${data.failed}.${recoveredNote}${waitingNote}`,
      });
      if (shouldRefreshMockedData) {
        window.dispatchEvent(new Event(REPORT_JOBS_REFRESH_EVENT));
      } else {
        router.refresh();
      }
    } catch (error: any) {
      toast({
        title: "Worker failed",
        description: error?.message || "Worker run failed.",
        variant: "destructive",
      });
    } finally {
      setIsRunningWorker(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        className="app-button-filter"
        onClick={handleRefresh}
        disabled={isRefreshing || isRunningWorker}
      >
        <RefreshCcw className="h-4 w-4" />
        Refresh
      </Button>
      <Button
        className="app-button-page"
        onClick={() => void handleRunWorkerNow()}
        disabled={isRefreshing || isRunningWorker}
      >
        <Wrench className="h-4 w-4" />
        {isRunningWorker ? "Running Worker..." : "Run Worker Now"}
      </Button>
    </div>
  );
}
