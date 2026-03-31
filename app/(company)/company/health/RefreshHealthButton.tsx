"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export default function RefreshHealthButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [spinKey, setSpinKey] = useState(0);

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="app-button-compact"
      onClick={() => {
        setSpinKey((value) => value + 1);
        startTransition(() => {
          router.refresh();
        });
      }}
      disabled={isPending}
    >
      <RefreshCw
        key={spinKey}
        className={isPending ? "animate-spin" : ""}
      />
      {isPending ? "Refreshing..." : "Refresh"}
    </Button>
  );
}
