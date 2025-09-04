// app/page.tsx
"use client";

import { useState } from "react";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [payload, setPayload] = useState<{
    questions?: any[];
    studentPaperHtml?: string;
    answerKeyHtml?: string;
  }>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch("/api/convert", { method: "POST", body: fd });
    const data = await res.json();

    if (!res.ok) {
      alert(data?.error || "Conversion failed");
      return;
    }
    setPayload(data);
  }

  function dl(filename: string, content: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  const hasData = !!payload.questions?.length;

  return (
    <main className="min-h-screen p-8 flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Excel → Questions JSON + Paper/AnswerKey HTML</h1>

      <form onSubmit={handleSubmit} className="flex items-center gap-4">
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="border rounded p-2"
        />
        <button
          type="submit"
          disabled={!file}
          className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
        >
          Convert
        </button>
      </form>

      {hasData && (
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-3">
            <button
              className="px-3 py-2 rounded border"
              onClick={() =>
                dl("questions.json", JSON.stringify({ questions: payload.questions }, null, 2), "application/json")
              }
            >
              Download questions.json
            </button>

            <button
              className="px-3 py-2 rounded border"
              onClick={() =>
                dl("question_paper.html", payload.studentPaperHtml || "", "text/html")
              }
            >
              Download question_paper.html
            </button>

            <button
              className="px-3 py-2 rounded border"
              onClick={() =>
                dl("answersheet.html", payload.answerKeyHtml || "", "text/html")
              }
            >
              Download answersheet.html
            </button>
          </div>

          <details className="border rounded p-3">
            <summary className="cursor-pointer font-medium">Preview (first question)</summary>
            <pre className="mt-3 text-sm overflow-auto">
{JSON.stringify(payload.questions?.[0], null, 2)}
            </pre>
          </details>
        </section>
      )}
    </main>
  );
}
