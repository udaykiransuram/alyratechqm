"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type SummerCrashWhatsappSummaryCardProps = {
  summaryText: string;
};

export default function SummerCrashWhatsappSummaryCard({
  summaryText,
}: SummerCrashWhatsappSummaryCardProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(summaryText);
      setCopied(true);
      window.setTimeout(() => {
        setCopied(false);
      }, 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Card className="app-surface overflow-hidden">
      <CardHeader className="app-section-header">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle>WhatsApp-ready parent summary</CardTitle>
            <p className="text-sm leading-6 text-muted-foreground">
              This version keeps the report simple enough to send to a parent on WhatsApp.
            </p>
          </div>
          <Button
            type="button"
            variant={copied ? "secondary" : "outline"}
            size="sm"
            className="shrink-0"
            onClick={handleCopy}
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy summary"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="app-section-body">
        <div className="rounded-[1.25rem] border border-border/70 bg-background/88 px-4 py-4">
          <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-6 text-foreground">
            {summaryText}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}
