"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  const [pdfDoc, setPdfDoc] = useState<any | null>(null);
  const [pdfRenderError, setPdfRenderError] = useState<string | null>(null);
  const [inlineOpen, setInlineOpen] = useState(false);
  const [inlinePageImages, setInlinePageImages] = useState<string[]>([]);
  const [inlinePagesLoading, setInlinePagesLoading] = useState(false);
  const inlineCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const inlineContainerRef = useRef<HTMLDivElement | null>(null);
  const modalContainerRef = useRef<HTMLDivElement | null>(null);
  const modalPageRefs = useRef<Array<HTMLDivElement | null>>([]);
  const pdfRenderTokenRef = useRef(0);
  const [modalPageImages, setModalPageImages] = useState<string[]>([]);
  const [modalPagesLoading, setModalPagesLoading] = useState(false);

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
    setPdfDoc(null);
    setPdfRenderError(null);
    setModalPageImages([]);
    setInlinePageImages([]);

    const loadPdf = async () => {
      try {
        setPdfThumbsLoading(true);
        const pdfjs = await import("pdfjs-dist/build/pdf");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const task = pdfjs.getDocument(preview.normalizedFileUrl);
        const doc = await task.promise;
        if (cancelled) return;
        setPdfDoc(doc);
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
      } catch (error) {
        if (!cancelled) {
          setPdfThumbs([]);
          setPdfNumPages(null);
          setPdfDoc(null);
          setPdfRenderError(
            (error as Error | null)?.message || "Unable to preview this PDF.",
          );
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

  const previewLabel = preview.isPdf
    ? "Preview PDF"
    : preview.isDocx
      ? "Preview DOCX"
      : preview.isVideo
        ? "Preview Video"
        : null;

  const safePdfPage = Math.max(1, pdfNumPages ? Math.min(pdfPage, pdfNumPages) : pdfPage);

  useEffect(() => {
    if (!preview.isPdf || !pdfDoc) {
      return;
    }

    let cancelled = false;
    const token = (pdfRenderTokenRef.current += 1);

    const renderPage = async (
      canvas: HTMLCanvasElement | null,
      container: HTMLDivElement | null,
    ) => {
      if (!canvas || !container) return;
      const page = await pdfDoc.getPage(safePdfPage);
      if (cancelled || token !== pdfRenderTokenRef.current) return;
      const baseViewport = page.getViewport({ scale: 1 });
      const containerWidth = Math.max(container.clientWidth, 320);
      const widthScale = containerWidth / baseViewport.width;
      const targetScale = Math.min(2.4, Math.max(0.9, widthScale));
      const viewport = page.getViewport({ scale: targetScale });
      const outputScale = window.devicePixelRatio || 1;
      const context = canvas.getContext("2d");
      if (!context) return;

      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      context.setTransform(outputScale, 0, 0, outputScale, 0, 0);

      await page.render({ canvasContext: context, viewport }).promise;
    };

    setPdfRenderError(null);
    void renderPage(inlineCanvasRef.current, inlineContainerRef.current).catch((error) => {
      if (!cancelled) {
        setPdfRenderError(
          (error as Error | null)?.message || "Unable to preview this PDF.",
        );
      }
    });

    return () => {
      cancelled = true;
    };
  }, [preview.isPdf, pdfDoc, safePdfPage]);

  useEffect(() => {
    if (!preview.isPdf || !pdfDoc || !inlineOpen) {
      return;
    }

    let cancelled = false;
    setInlinePagesLoading(true);
    setInlinePageImages([]);

    const renderInlinePages = async () => {
      try {
        const container = inlineContainerRef.current;
        const containerWidth = Math.max(container?.clientWidth || 0, 480);
        const maxPages = Math.min(pdfNumPages || 0, 6);
        const images: string[] = [];
        for (let pageIndex = 1; pageIndex <= maxPages; pageIndex += 1) {
          const page = await pdfDoc.getPage(pageIndex);
          if (cancelled) return;
          const baseViewport = page.getViewport({ scale: 1 });
          const targetScale = Math.min(
            1.8,
            Math.max(0.9, (containerWidth / baseViewport.width) * 0.98),
          );
          const viewport = page.getViewport({ scale: targetScale });
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          if (!context) {
            images.push("");
            continue;
          }
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          await page.render({ canvasContext: context, viewport }).promise;
          images.push(canvas.toDataURL("image/png"));
        }
        if (!cancelled) {
          setInlinePageImages(images);
        }
      } catch (error) {
        if (!cancelled) {
          setPdfRenderError(
            (error as Error | null)?.message || "Unable to preview this PDF.",
          );
        }
      } finally {
        if (!cancelled) {
          setInlinePagesLoading(false);
        }
      }
    };

    void renderInlinePages();

    return () => {
      cancelled = true;
    };
  }, [inlineOpen, pdfDoc, pdfNumPages, preview.isPdf]);

  useEffect(() => {
    if (!preview.isPdf || !pdfDoc || !open) {
      return;
    }

    let cancelled = false;
    setModalPagesLoading(true);
    setModalPageImages([]);

    const renderAllPages = async () => {
      try {
        const container = modalContainerRef.current;
        const containerWidth = Math.max(container?.clientWidth || 0, 600);
        const images: string[] = [];
        for (let pageIndex = 1; pageIndex <= (pdfNumPages || 0); pageIndex += 1) {
          const page = await pdfDoc.getPage(pageIndex);
          if (cancelled) return;
          const baseViewport = page.getViewport({ scale: 1 });
          const targetScale = Math.min(
            2.2,
            Math.max(0.95, (containerWidth / baseViewport.width) * 1.02),
          );
          const viewport = page.getViewport({ scale: targetScale });
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          if (!context) {
            images.push("");
            continue;
          }
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          await page.render({ canvasContext: context, viewport }).promise;
          images.push(canvas.toDataURL("image/png"));
        }
        if (!cancelled) {
          setModalPageImages(images);
        }
      } catch (error) {
        if (!cancelled) {
          setPdfRenderError(
            (error as Error | null)?.message || "Unable to preview this PDF.",
          );
        }
      } finally {
        if (!cancelled) {
          setModalPagesLoading(false);
        }
      }
    };

    void renderAllPages();

    return () => {
      cancelled = true;
    };
  }, [open, pdfDoc, pdfNumPages, preview.isPdf]);

  if (!preview.normalizedFileUrl) {
    return (
      <div className="app-course-panel">
        <p className="text-sm text-muted-foreground">Resource file is unavailable.</p>
      </div>
    );
  }

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
        <details
          className="app-course-resource-preview"
          onToggle={(event) => {
            const target = event.currentTarget as HTMLDetailsElement;
            setInlineOpen(Boolean(target.open));
          }}
        >
          <summary className="app-course-resource-summary">{previewLabel}</summary>
          <div className="app-course-resource-iframe-shell" ref={inlineContainerRef}>
            {preview.isVideo ? (
              <video
                className="app-course-resource-iframe"
                controls
                preload="metadata"
                src={preview.normalizedFileUrl}
              />
            ) : preview.isPdf ? (
              <div className="app-course-resource-scroll">
                {inlinePagesLoading ? (
                  <p className="app-course-resource-error">Loading preview…</p>
                ) : null}
                {pdfRenderError ? (
                  <p className="app-course-resource-error">{pdfRenderError}</p>
                ) : null}
                {inlinePageImages.map((src, index) => (
                  <div key={`inline-page-${index + 1}`} className="app-course-resource-page">
                    <img src={src} alt={`Page ${index + 1}`} />
                    <span>Page {index + 1}</span>
                  </div>
                ))}
              </div>
            ) : (
              <iframe
                title="Resource preview"
                className="app-course-resource-iframe"
                src={preview.docxPreviewUrl || ""}
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

      <Dialog open={!preview.isPdf && open} onOpenChange={setOpen}>
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
                            <Image
                              src={thumb}
                              alt={`Page ${pageNumber}`}
                              width={160}
                              height={208}
                              unoptimized
                              className="w-full rounded-md border border-border/60 bg-background"
                            />
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
                      <span className="app-course-resource-page-indicator">
                        Page {safePdfPage}
                        {pdfNumPages ? ` of ${pdfNumPages}` : ""}
                      </span>
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
                            const target = modalPageRefs.current[next - 1];
                            if (target) {
                              target.scrollIntoView({ behavior: "smooth", block: "start" });
                            }
                          }}
                          className="app-course-resource-jump-input"
                        />
                      </div>
                    </div>
                  ) : null}
                  {preview.isPdf ? (
                    <div
                      className="app-resource-modal-scroll"
                      ref={modalContainerRef}
                    >
                      {modalPagesLoading ? (
                        <p className="app-course-resource-error">
                          Loading full document…
                        </p>
                      ) : null}
                      {pdfRenderError ? (
                        <p className="app-course-resource-error">{pdfRenderError}</p>
                      ) : null}
                      {modalPageImages.map((src, index) => (
                        <div
                          key={`pdf-page-${index + 1}`}
                          ref={(node) => {
                            modalPageRefs.current[index] = node;
                          }}
                          className="app-resource-modal-page"
                        >
                          <img src={src} alt={`Page ${index + 1}`} />
                          <span>Page {index + 1}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <iframe
                      title="Resource full screen"
                      className="app-resource-modal-iframe"
                      src={preview.docxPreviewUrl || ""}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {preview.isPdf && open && typeof document !== "undefined"
        ? createPortal(
            <div className="app-resource-fullscreen">
              <div className="app-resource-fullscreen-bar">
                <div className="app-resource-fullscreen-title">
                  {title || "Resource preview"}
                </div>
                <div className="flex items-center gap-2">
                  <div className="app-course-resource-jump">
                    <label
                      className="app-course-resource-jump-label"
                      htmlFor="course-pdf-jump-fullscreen"
                    >
                      Jump to
                    </label>
                    <input
                      id="course-pdf-jump-fullscreen"
                      type="number"
                      min={1}
                      max={pdfNumPages || undefined}
                      value={pdfPageInput}
                      onChange={(event) => setPdfPageInput(event.target.value)}
                      onBlur={() => {
                        const next = Math.max(1, Number(pdfPageInput || 1));
                        setPdfPage(pdfNumPages ? Math.min(pdfNumPages, next) : next);
                        setPdfPageInput(
                          String(pdfNumPages ? Math.min(pdfNumPages, next) : next),
                        );
                        const target = modalPageRefs.current[next - 1];
                        if (target) {
                          target.scrollIntoView({ behavior: "smooth", block: "start" });
                        }
                      }}
                      className="app-course-resource-jump-input"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="app-button-compact-secondary app-course-action-button"
                    onClick={() => setOpen(false)}
                  >
                    Close
                  </Button>
                </div>
              </div>
              <div className="app-resource-fullscreen-scroll" ref={modalContainerRef}>
                {modalPagesLoading ? (
                  <p className="app-course-resource-error">Loading full document…</p>
                ) : null}
                {pdfRenderError ? (
                  <p className="app-course-resource-error">{pdfRenderError}</p>
                ) : null}
                {modalPageImages.map((src, index) => (
                  <div
                    key={`pdf-fullscreen-page-${index + 1}`}
                    ref={(node) => {
                      modalPageRefs.current[index] = node;
                    }}
                    className="app-resource-modal-page"
                  >
                    <img src={src} alt={`Page ${index + 1}`} />
                    <span>Page {index + 1}</span>
                  </div>
                ))}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
