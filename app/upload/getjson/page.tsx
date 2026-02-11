// app/page.tsx
"use client";

import { useState } from "react";
import * as XLSX from "xlsx";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

export default function ImportQuestionsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [payload, setPayload] = useState<{
    questions?: any[];
    studentPaperHtml?: string;
    answerKeyHtml?: string;
    testId?: string;
  }>({});
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [bulkTestId, setBulkTestId] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch("/api/convert", { method: "POST", body: fd });

    // Only parse as JSON if response is JSON
    const contentType = res.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const data = await res.json();
      if (!res.ok) {
        alert(data?.error || "Conversion failed");
        return;
      }
      setPayload(data);
    } else {
      alert("Unexpected response from server.");
    }
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

  async function handleDownloadExcel() {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch("/api/convert?excel=1", {
      method: "POST",
      body: fd,
    });

    if (!res.ok) {
      alert("Excel generation failed");
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "questions.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleDownloadWord() {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch("/api/convert?word=1", {
      method: "POST",
      body: fd,
    });

    if (!res.ok) {
      alert("Word document generation failed");
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "question_paper.docx";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleBulkUpload() {
    if (!payload.questions?.length) {
      alert("No questions to upload. Please convert an Excel first.");
      return;
    }
    // Optionally include testId if present
    const body = payload.testId
      ? { testId: payload.testId, questions: payload.questions }
      : { questions: payload.questions };

    setUploading(true);
    setUploadError(null);

    try {
      const res = await fetch('/api/questions/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setUploadResult(data);

      if (!res.ok) {
        setUploadError(data.message || "Bulk upload failed");
      } else {
        alert("Bulk upload successful!");
        
        if (payload.testId) setBulkTestId(payload.testId);
        // Optionally, show more info or set state here
      }
    } catch (err) {
      setUploadError("Network or server error");
    } finally {
      setUploading(false);
    }
  }

  const hasData = !!payload.questions?.length;

  return (
    <main className="min-h-screen p-6">
      <div className="container space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Question Import & Test Builder</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>1. Upload Excel</CardTitle>
          </CardHeader>
          <div className="px-6 pb-2">
            <Button variant="outline" asChild>
              <a href="/api/convert/template">Download Excel Template</a>
            </Button>
          </div>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex items-center gap-3">
              <Input type="file" accept=".xlsx,.xls" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              <Button type="submit" disabled={!file}>Convert</Button>
            </form>
            {payload.testId && (
              <div className="mt-3 text-sm text-muted-foreground">
                Generated Test ID: <span className="font-mono font-medium text-foreground">{payload.testId}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {hasData && (
          <Card>
            <CardHeader>
              <CardTitle>2. Review & Download</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => dl("questions.json", JSON.stringify({ questions: payload.questions }, null, 2), "application/json")}>Download questions.json</Button>
                <Button variant="outline" onClick={handleDownloadExcel}>Download questions.xlsx</Button>
                <Button variant="outline" onClick={handleDownloadWord}>Download question_paper.docx</Button>
                <Button variant="outline" onClick={() => dl("question_paper.html", payload.studentPaperHtml || "", "text/html")}>Download question_paper.html</Button>
                <Button variant="outline" onClick={() => dl("answersheet.html", payload.answerKeyHtml || "", "text/html")}>Download answersheet.html</Button>
              </div>
              <Separator />
              <details className="border rounded p-3">
                <summary className="cursor-pointer font-medium">Preview (first question)</summary>
                <pre className="mt-3 text-sm overflow-auto">{JSON.stringify(payload.questions?.[0], null, 2)}</pre>
              </details>
            </CardContent>
          </Card>
        )}

        {hasData && (
          <Card>
            <CardHeader>
              <CardTitle>3. Upload to Question Bank</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <Button onClick={handleBulkUpload} disabled={uploading}>{uploading ? 'Uploading…' : 'Upload to Question Bank'}</Button>
                {(bulkTestId || payload.testId) && (
                  <div className="text-sm text-muted-foreground">Uploaded Test ID: <span className="font-mono font-medium text-foreground">{bulkTestId || payload.testId}</span></div>
                )}
              </div>
              {uploadResult && (
                <div className="p-3 rounded border bg-background">
                  <h3 className="font-medium">Upload Result</h3>
                  <pre className="mt-2 text-sm overflow-auto">{JSON.stringify(uploadResult, null, 2)}</pre>
                </div>
              )}
              {uploadError && <div className="p-3 rounded border text-destructive">Error: {uploadError}</div>}
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}

