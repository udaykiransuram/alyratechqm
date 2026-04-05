"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { fetchApiJson } from "@/lib/client/api";

type DiaryArchiveButtonProps = {
  entryId: string;
  returnToPath: string;
};

export default function DiaryArchiveButton({
  entryId,
  returnToPath,
}: DiaryArchiveButtonProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [archiving, setArchiving] = useState(false);

  const handleArchive = async () => {
    if (
      typeof window !== "undefined" &&
      !window.confirm("Archive this diary entry? Students will no longer see it.")
    ) {
      return;
    }

    setArchiving(true);

    try {
      await fetchApiJson(`/api/diary/${entryId}`, {
        method: "DELETE",
        fallbackMessage: "Failed to archive the diary entry.",
      });

      toast({
        title: "Diary archived",
        description: "The diary entry is now hidden from normal boards.",
      });

      router.replace(returnToPath);
      router.refresh();
    } catch (error) {
      toast({
        title: "Archive failed",
        description:
          error instanceof Error
            ? error.message
            : "We couldn't archive the diary entry.",
        variant: "destructive",
      });
    } finally {
      setArchiving(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      className="text-destructive hover:text-destructive"
      onClick={() => void handleArchive()}
      disabled={archiving}
    >
      <Trash2 className="h-4 w-4" />
      {archiving ? "Archiving..." : "Archive"}
    </Button>
  );
}
