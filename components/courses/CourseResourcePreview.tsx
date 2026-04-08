"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Maximize2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function getFileExtension(source?: string | null) {
  if (!source) return "";
  const normalized = source.split("?")[0].split("#")[0];
  const parts = normalized.split(".");
  if (parts.length < 2) return "";
  return parts.pop()!.toLowerCase();
}

function isVideoExtension(extension: string) {
  return ["mp4", "webm", "mov", "m4v"].includes(extension);
}

type CourseResourcePreviewProps = {
  title?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  caption?: string | null;
  showPreviewButton?: boolean;
};

export default function CourseResourcePreview({
  title,
  fileUrl,
  fileName,
  caption,
  showPreviewButton = false,
}: CourseResourcePreviewProps) {
  const [open, setOpen] = useState(false);
  const [pdfPage, setPdfPage] = useState(1);
  const [pdfPageInput, setPdfPageInput] = useState("1");
  const [pdfNumPages, setPdfNumPages] = useState<number | null>(null);
  const [pdfThumbs, setPdfThumbs] = useState<string[]>([]);
  const [pdfThumbsLoading, setPdfThumbsLoading] = useState(false);

  const preview = useMemo(() => {
    const normalizedFileUrl = String(fileUrl || "").trim();
    const sourceName = String(fileName || normalizedFileUrl || "").trim();
    const extension = getFileExtension(sourceName || normalizedFileUrl);
    const isPdf = extension === "pdf";
    const isDocx = extension === "docx";
    const isVideo = isVideoExtension(extension);
    const docxPreviewUrl = isDocx
      ? `/api/courses/docx-preview?url=${encodeURIComponent(normalizedFileUrl)}`
      : null;

    return {
      normalizedFileUrl,
      sourceName,
      extension,
      isPdf,
      isDocx,
      isVideo,
      pdfBaseUrl: isPdf ? `${normalizedFileUrl}#page=` : null,
      docxPreviewUrl,
    };
  }, [fileUrl, fileName]);

  useEffect(() => {
    if (!preview.isPdf || !preview.normalizedFileUrl) {
      return;
    }

    let cancelled = false;
    setPdfThumbs([]);
    setPdfNumPages(null);
    setPdfPage(1);
    setPdfPageInput("1");

    const loadPdf = async () => {
      try {
        setPdfThumbsLoading(true);
        const pdfjs = await import("pdfjs-dist/build/pdf");
        pdfjs.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.3.93/pdf.worker.min.js";
        const task = pdfjs.getDocument(preview.normalizedFileUrl);
        const doc = await task.promise;
        if (cancelled) return;
        setPdfNumPages(doc.numPages);

        const maxThumbs = Math.min(doc.numPages, 8);
        const thumbUrls: string[] = [];
        for (let pageIndex = 1; pageIndex <= maxThumbs; pageIndex += 1) {
          const page = await doc.getPage(pageIndex);
          if (cancelled) return;
          const viewport = page.getViewport({ scale: 0.2 });
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          if (!context) {
            continue;
          }
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          await page.render({ canvasContext: context, viewport }).promise;
          thumbUrls.push(canvas.toDataURL("image/png"));
        }
        if (!cancelled) {
          setPdfThumbs(thumbUrls);
        }
      } catch {
        if (!cancelled) {
          setPdfThumbs([]);
          setPdfNumPages(null);
        }
      } finally {
        if (!cancelled) {
          setPdfThumbsLoading(false);
        }
      }
    };

    void loadPdf();

    return () => {
      cancelled = true;
    };
  }, [preview.isPdf, preview.normalizedFileUrl]);

  if (!preview.normalizedFileUrl) {
    return (
      <div className="app-course-panel">
        <p className="text-sm text-muted-foreground">Resource file is unavailable.</p>
      </div>
    );
  }

  const previewLabel = preview.isPdf
    ? "Preview PDF"
    : preview.isDocx
      ? "Preview DOCX"
      : preview.isVideo
        ? "Preview Video"
        : null;

  const safePdfPage = Math.max(1, pdfNumPages ? Math.min(pdfPage, pdfNumPages) : pdfPage);

  return (
    <div className="app-course-panel space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">
            {title || "Resource"}
          </p>
          {preview.sourceName ? (
            <p className="text-sm text-muted-foreground">{preview.sourceName}</p>
          ) : null}
          {caption ? <p className="text-sm text-muted-foreground">{caption}</p> : null}
        </div>
        <Button
          asChild
          variant="outline"
          className="app-button-compact-secondary app-course-action-button"
        >
          <a href={preview.normalizedFileUrl} target="_blank" rel="noreferrer">
            Download
            <Download className="h-4 w-4" />
          </a>
        </Button>
      </div>

      {previewLabel ? (
        <details className="app-course-resource-preview">
          <summary className="app-course-resource-summary">{previewLabel}</summary>
          <div className="app-course-resource-iframe-shell">
            {preview.isVideo ? (
              <video
                className="app-course-resource-iframe"
                controls
                preload="metadata"
                src={preview.normalizedFileUrl}
              />
            ) : (
              <iframe
                title="Resource preview"
                className="app-course-resource-iframe"
                src={
                  preview.isPdf
                    ? `${preview.pdfBaseUrl}${safePdfPage}`
                    : preview.docxPreviewUrl || ""
                }
                loading="lazy"
              />
            )}
          </div>
          {preview.isPdf ? (
            <div className="app-course-resource-pagination">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="app-button-compact-secondary app-course-action-button"
                onClick={() => {
                  setPdfPage((current) => Math.max(1, current - 1));
                  setPdfPageInput(String(Math.max(1, safePdfPage - 1)));
                }}
                disabled={safePdfPage <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </Button>
              <span className="app-course-resource-page-indicator">
                Page {safePdfPage}
                {pdfNumPages ? ` of ${pdfNumPages}` : ""}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="app-button-compact-secondary app-course-action-button"
                onClick={() => {
                  setPdfPage((current) =>
                    pdfNumPages ? Math.min(pdfNumPages, current + 1) : current + 1,
                  );
                  setPdfPageInput(String(safePdfPage + 1));
                }}
                disabled={pdfNumPages ? safePdfPage >= pdfNumPages : false}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
              <div className="app-course-resource-jump">
                <label className="app-course-resource-jump-label" htmlFor="course-pdf-jump">
                  Jump to
                </label>
                <input
                  id="course-pdf-jump"
                  type="number"
                  min={1}
                  max={pdfNumPages || undefined}
                  value={pdfPageInput}
                  onChange={(event) => setPdfPageInput(event.target.value)}
                  onBlur={() => {
                    const next = Math.max(1, Number(pdfPageInput || 1));
                    setPdfPage(pdfNumPages ? Math.min(pdfNumPages, next) : next);
                    setPdfPageInput(String(pdfNumPages ? Math.min(pdfNumPages, next) : next));
                  }}
                  className="app-course-resource-jump-input"
                />
              </div>
            </div>
          ) : null}
          <div className="mt-2 flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="app-button-compact-secondary app-course-action-button"
              onClick={() => setOpen(true)}
            >
              Full screen
              <Maximize2 className="h-4 w-4" />
            </Button>
            {showPreviewButton ? (
              <Button
                type="button"
                variant="outline"
                className="app-button-compact-secondary app-course-action-button"
                onClick={() => setOpen(true)}
              >
                Preview
              </Button>
            ) : null}
          </div>
        </details>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="app-resource-modal">
          <DialogHeader>
            <DialogTitle>{title || "Resource preview"}</DialogTitle>
          </DialogHeader>
          <div className="app-resource-modal-frame">
            {preview.isVideo ? (
              <video
                className="app-resource-modal-iframe"
                controls
                preload="metadata"
                src={preview.normalizedFileUrl}
              />
            ) : (
              <div className="app-resource-modal-layout">
                {preview.isPdf ? (
                  <aside className="app-resource-modal-sidebar">
                    <div className="app-resource-modal-sidebar-header">
                      <span className="app-course-resource-page-indicator">
                        Pages
                      </span>
                      {pdfThumbsLoading ? (
                        <span className="text-xs text-muted-foreground">Loading...</span>
                      ) : null}
                    </div>
                    <div className="app-resource-modal-thumbs">
                      {pdfThumbs.map((thumb, index) => {
                        const pageNumber = index + 1;
                        return (
                          <button
                            key={`thumb-${thumb}-${pageNumber}`}
                            type="button"
                            className={[
                              "app-resource-thumb",
                              safePdfPage === pageNumber ? "is-active" : "",
                            ]
                              .join(" ")
                              .trim()}
                            onClick={() => {
                              setPdfPage(pageNumber);
                              setPdfPageInput(String(pageNumber));
                            }}
                          >
                            <img src={thumb} alt={`Page ${pageNumber}`} />
                            <span>Page {pageNumber}</span>
                          </button>
                        );
                      })}
                    </div>
                  </aside>
                ) : null}
                <div className="app-resource-modal-main">
                  {preview.isPdf ? (
                    <div className="app-resource-modal-toolbar">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="app-button-compact-secondary app-course-action-button"
                        onClick={() => {
                          setPdfPage((current) => Math.max(1, current - 1));
                          setPdfPageInput(String(Math.max(1, safePdfPage - 1)));
                        }}
                        disabled={safePdfPage <= 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Prev
                      </Button>
                      <span className="app-course-resource-page-indicator">
                        Page {safePdfPage}
                        {pdfNumPages ? ` of ${pdfNumPages}` : ""}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="app-button-compact-secondary app-course-action-button"
                        onClick={() => {
                          setPdfPage((current) =>
                            pdfNumPages ? Math.min(pdfNumPages, current + 1) : current + 1,
                          );
                          setPdfPageInput(String(safePdfPage + 1));
                        }}
                        disabled={pdfNumPages ? safePdfPage >= pdfNumPages : false}
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <div className="app-course-resource-jump">
                        <label
                          className="app-course-resource-jump-label"
                          htmlFor="course-pdf-jump-modal"
                        >
                          Jump to
                        </label>
                        <input
                          id="course-pdf-jump-modal"
                          type="number"
                          min={1}
                          max={pdfNumPages || undefined}
                          value={pdfPageInput}
                          onChange={(event) => setPdfPageInput(event.target.value)}
                          onBlur={() => {
                            const next = Math.max(1, Number(pdfPageInput || 1));
                            setPdfPage(pdfNumPages ? Math.min(pdfNumPages, next) : next);
                            setPdfPageInput(String(pdfNumPages ? Math.min(pdfNumPages, next) : next));
                          }}
                          className="app-course-resource-jump-input"
                        />
                      </div>
                    </div>
                  ) : null}
                  <iframe
                    title="Resource full screen"
                    className="app-resource-modal-iframe"
                    src={
                      preview.isPdf
                        ? `${preview.pdfBaseUrl}${safePdfPage}`
                        : preview.docxPreviewUrl || ""
                    }
                  />
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
