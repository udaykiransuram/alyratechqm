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
    <Card className="overflow-hidden border border-slate-200/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.94)_0%,rgba(255,255,255,0.98)_100%)] shadow-[0_30px_60px_-48px_rgba(15,23,42,0.32)]">
      <CardHeader className="border-b border-slate-200/80 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Parent share version
            </p>
            <CardTitle className="text-[1.35rem] text-slate-950">
              WhatsApp-ready summary
            </CardTitle>
            <p className="text-sm leading-6 text-slate-600">
              A simpler version of the report that can be copied and sent directly to a parent on WhatsApp.
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
      <CardContent className="grid gap-0 p-0 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="bg-[linear-gradient(180deg,rgba(15,23,42,0.98)_0%,rgba(2,6,23,1)_100%)] px-5 py-5 sm:px-6">
          <pre className="whitespace-pre-wrap break-words font-[family:var(--font-ui)] text-[13.5px] leading-6 text-slate-50">
            {summaryText}
          </pre>
        </div>

        <div className="border-t border-slate-200/80 bg-sky-50/72 px-5 py-5 sm:px-6 lg:border-l lg:border-t-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-700/75">
            How to use this
          </p>
          <div className="mt-3 space-y-3 text-sm leading-6 text-slate-700">
            <p>Copy this after reading the full report and send it directly to the parent.</p>
            <p>It keeps the main weak areas, the simple next steps, and the Summer course recommendation in one short format.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
