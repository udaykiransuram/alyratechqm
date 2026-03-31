"use client";

import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useBackNavigation } from "@/hooks/useReturnNavigation";
import { cn } from "@/lib/utils";

type ReturnBackButtonProps = {
  fallbackPath: string;
  label?: string;
  className?: string;
};

export default function ReturnBackButton({
  fallbackPath,
  label = "Back",
  className,
}: ReturnBackButtonProps) {
  const { navigateBack } = useBackNavigation(fallbackPath);

  return (
    <Button
      type="button"
      variant="outline"
      onClick={navigateBack}
      className={cn("app-button-back", className)}
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </Button>
  );
}
