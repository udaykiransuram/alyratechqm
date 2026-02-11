"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Pencil } from "lucide-react";

export function QuestionPaperToolbar({ paper }: { paper: any }) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [names, setNames] = useState("");
  const [loading, setLoading] = useState(false);

  // Helper to build the copy payload (same as your Make a Copy logic)
  function buildCopyPayload(name: string) {
    const { _id, title, examDate, ...rest } = paper;
    const sections = (paper.sections || []).map((section: any) => ({
      id: section._id || `section-${Math.random()}`,
      name: section.name ?? "",
      description: section.description ?? "",
      defaultMarks: section.marks ?? 1,
      defaultNegativeMarks:
        Array.isArray(section.questions) && section.questions.length > 0
          ? section.questions[0].negativeMarks ?? 0
          : 0,
      questions: (section.questions || []).map((q: any) => {
        const questionObj = typeof q.question === "object" ? q.question : {};
        return {
          question: questionObj,
          marks: q.marks ?? section.marks ?? 1,
          negativeMarks: q.negativeMarks ?? 0,
        };
      }),
    }));

    return {
      ...rest,
      title: name,
      examDate: "",
      sections,
      classId: paper.class?._id ?? "",
      subjectId: paper.subject?._id ?? "",
      instructions: paper.instructions ?? "",
      duration: paper.duration ?? 60,
      passingMarks: paper.passingMarks ?? 0,
    };
  }

  // Handler for Copy Multiple
  const handleCopyMultiple = async () => {
    setLoading(true);
    const nameList = names
      .split("\n")
      .map(n => n.trim())
      .filter(Boolean);

    if (!nameList.length) {
      setLoading(false);
      return;
    }

    // Send all payloads to the backend
    const res = await fetch("/api/question-papers/copy-multiple", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        papers: nameList.map(name => buildCopyPayload(name)),
      }),
    });

    setLoading(false);
    if (res.ok) {
      alert("Copies created!");
      setShowModal(false);
      setNames("");
    } else {
      alert("Failed to create copies.");
    }
  };

  return (
    <div className="flex gap-2 mt-8">
      <Link href={`/question-paper/edit/${paper._id}`}>
        <Button variant="secondary">
          <Pencil className="mr-2 h-4 w-4" /> Edit
        </Button>
      </Link>
      <Button
        variant="outline"
        onClick={() => {
          const copyPayload = buildCopyPayload("");
          sessionStorage.setItem("questionPaperCopy", JSON.stringify(copyPayload));
          window.location.href = "/question-paper/create";
        }}
      >
        <Copy className="mr-2 h-4 w-4" /> Make a Copy
      </Button>
      <Button variant="outline" onClick={() => setShowModal(true)}>
        <Copy className="mr-2 h-4 w-4" /> Copy Multiple
      </Button>
      {showModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-lg w-full max-w-md">
            <h2 className="text-lg font-bold mb-2">Copy Multiple</h2>
            <p className="mb-2 text-sm text-muted-foreground">
              Enter one name per line for each new question paper:
            </p>
            <textarea
              className="w-full border rounded p-2 mb-4"
              rows={5}
              value={names}
              onChange={e => setNames(e.target.value)}
              placeholder="Paper Copy 1&#10;Paper Copy 2&#10;Paper Copy 3"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleCopyMultiple} disabled={loading}>
                {loading ? "Creating..." : "Create Copies"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}