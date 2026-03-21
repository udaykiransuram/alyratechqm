"use client";

import { useState } from "react";
import Link from "next/link";
import { Copy, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { useReturnHrefBuilder } from "@/hooks/useReturnNavigation";

export function QuestionPaperToolbar({ paper }: { paper: any }) {
  const { buildReturnHref } = useReturnHrefBuilder("/workspace/question-papers");
  const [showModal, setShowModal] = useState(false);
  const [names, setNames] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  function buildCopyPayload(name: string) {
    const { _id, title, examDate, onlineStartsAt, onlineEndsAt, ...rest } = paper;
    const sections = (paper.sections || []).map((section: any) => ({
      id: section._id || `section-${Math.random()}`,
      name: section.name ?? "",
      description: section.description ?? "",
      defaultMarks: section.marks ?? 1,
      defaultNegativeMarks:
        Array.isArray(section.questions) && section.questions.length > 0
          ? section.questions[0].negativeMarks ?? 0
          : 0,
      questions: (section.questions || []).map((question: any) => {
        const questionObj = typeof question.question === "object" ? question.question : {};
        return {
          question: questionObj,
          marks: question.marks ?? section.marks ?? 1,
          negativeMarks: question.negativeMarks ?? 0,
        };
      }),
    }));

    return {
      ...rest,
      title: name,
      examDate: "",
      onlineStartsAt: "",
      onlineEndsAt: "",
      sections,
      classId: paper.class?._id ?? "",
      subjectId: paper.subject?._id ?? "",
      instructions: paper.instructions ?? "",
      duration: paper.duration ?? 60,
      passingMarks: paper.passingMarks ?? 0,
      onlineEnabled: Boolean(paper.onlineEnabled),
      assignedAcademicSectionIds: (paper.assignedAcademicSections || []).map((section: any) =>
        String(section?._id || section),
      ),
    };
  }

  const handleDialogChange = (nextOpen: boolean) => {
    setShowModal(nextOpen);
    if (!nextOpen && !loading) {
      setNames("");
    }
  };

  const handleCopyMultiple = async () => {
    const nameList = names
      .split("\n")
      .map((name) => name.trim())
      .filter(Boolean);

    if (!nameList.length) {
      toast({
        title: "No names added",
        description: "Enter at least one paper name before creating copies.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/question-papers/copy-multiple", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          papers: nameList.map((name) => buildCopyPayload(name)),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast({
          title: "Copies created",
          description: `${nameList.length} question paper ${nameList.length === 1 ? "copy is" : "copies are"} ready.`,
        });
        setShowModal(false);
        setNames("");
      } else {
        toast({
          title: "Create failed",
          description: data?.message || "Failed to create copies.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Network Error",
        description: "Failed to create copies.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const lineCount = names
    .split("\n")
    .map((name) => name.trim())
    .filter(Boolean).length;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Link href={buildReturnHref(`/workspace/question-papers/edit/${paper._id}`)}>
          <Button variant="secondary">
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
        </Link>
        <Button
          variant="outline"
          onClick={() => {
            const copyPayload = buildCopyPayload("");
            sessionStorage.setItem("questionPaperCopy", JSON.stringify(copyPayload));
            window.location.href = "/workspace/question-papers/create";
          }}
        >
          <Copy className="mr-2 h-4 w-4" />
          Make a Copy
        </Button>
        <Button variant="outline" onClick={() => setShowModal(true)}>
          <Copy className="mr-2 h-4 w-4" />
          Copy Multiple
        </Button>
      </div>

      <Dialog open={showModal} onOpenChange={handleDialogChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader className="text-left">
            <DialogTitle>Copy Multiple</DialogTitle>
            <DialogDescription>
              Enter one name per line to create several copies of this paper in one go.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="app-field-group">
              <label htmlFor="copy-paper-names" className="app-field-label">
                Paper Names
              </label>
              <Textarea
                id="copy-paper-names"
                rows={6}
                className="min-h-[180px]"
                value={names}
                onChange={(event) => setNames(event.target.value)}
                placeholder={"Paper Copy 1\nPaper Copy 2\nPaper Copy 3"}
                disabled={loading}
              />
            </div>

            <div className="app-section flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Each non-empty line becomes a new paper with the same sections, metadata, and instructions.
              </p>
              <span className="shrink-0 text-sm font-medium text-foreground">{lineCount} queued</span>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => handleDialogChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleCopyMultiple} disabled={loading}>
              {loading ? <Spinner /> : "Create Copies"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
