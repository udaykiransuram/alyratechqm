"use client";

import {
  Archive,
  ChevronDown,
  Edit,
  Eye,
  MessageCircle,
} from "lucide-react";

import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

type QuestionPaperDirectoryRowActionsProps = {
  paperId: string;
  selectedAcademicSectionId: string;
  responsesHref: string;
  uploadHref: string;
  classAnalyticsHref: string;
  buildReturnHref: (href: string) => string;
  isSendingReports: boolean;
  isExcelLoading: boolean;
  isDeleting: boolean;
  onSendReports: () => void;
  onDownloadExcel: () => void;
  onArchive: () => void;
};

export default function QuestionPaperDirectoryRowActions({
  paperId,
  selectedAcademicSectionId,
  responsesHref,
  uploadHref,
  classAnalyticsHref,
  buildReturnHref,
  isSendingReports,
  isExcelLoading,
  isDeleting,
  onSendReports,
  onDownloadExcel,
  onArchive,
}: QuestionPaperDirectoryRowActionsProps) {
  const encodedPaperId = encodeURIComponent(paperId);
  const encodedSectionId =
    selectedAcademicSectionId !== "all"
      ? encodeURIComponent(selectedAcademicSectionId)
      : "";

  return (
    <div className="min-w-0 space-y-2">
      <div className="md:hidden space-y-2">
        <Button
          asChild
          variant="outline"
          size="sm"
          className="app-row-action-button app-row-action-button-accent w-full"
        >
          <AppPrefetchLink
            href={buildReturnHref(`/workspace/question-papers/view/${paperId}`)}
            relatedApiPrefetches={[`/api/question-papers/${paperId}`]}
            aria-label="View question paper"
            title="View question paper"
          >
            <Eye className="h-4 w-4" />
            View Paper
          </AppPrefetchLink>
        </Button>
        <details className="group rounded-xl border border-border/60 bg-background/72 px-2.5 py-2">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-1 py-1.5 text-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden">
            More actions
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
          </summary>
          <div className="mt-2 grid gap-2">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="app-row-action-button w-full"
            >
              <AppPrefetchLink
                href={buildReturnHref(`/workspace/question-papers/edit/${paperId}`)}
                relatedApiPrefetches={[
                  `/api/question-papers/${paperId}`,
                  "/api/classes",
                  "/api/sections",
                  "/api/subjects",
                ]}
                aria-label="Edit question paper"
                title="Edit question paper"
              >
                <Edit className="h-4 w-4" />
                Edit Paper
              </AppPrefetchLink>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="app-row-action-button app-row-action-button-danger w-full"
              onClick={onArchive}
              disabled={isDeleting}
              aria-label="Archive question paper"
              title="Archive question paper"
            >
              {isDeleting ? <Spinner /> : <Archive className="h-4 w-4" />}
              Archive Paper
            </Button>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="app-button-compact w-full"
            >
              <AppPrefetchLink
                href={buildReturnHref(responsesHref)}
                relatedApiPrefetches={[
                  `/api/question-paper-response?paper=${encodedPaperId}&summary=1&page=1&limit=40${
                    encodedSectionId ? `&academicSectionId=${encodedSectionId}` : ""
                  }`,
                ]}
              >
                Responses
              </AppPrefetchLink>
            </Button>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="app-button-compact w-full"
            >
              <AppPrefetchLink href={buildReturnHref(uploadHref)}>
                Upload Excel
              </AppPrefetchLink>
            </Button>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="app-button-compact w-full"
            >
              <AppPrefetchLink
                href={buildReturnHref(classAnalyticsHref)}
                relatedApiPrefetches={[
                  `/api/analytics/class-tag-report/${paperId}?groupFields=1${
                    encodedSectionId ? `&academicSectionId=${encodedSectionId}` : ""
                  }`,
                ]}
              >
                Analytics
              </AppPrefetchLink>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="app-button-compact app-button-compact-success w-full"
              onClick={onSendReports}
              disabled={isSendingReports}
            >
              <MessageCircle className="mr-1 h-4 w-4" />
              {isSendingReports ? "Sending..." : "Send Reports"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="app-button-compact w-full"
              onClick={onDownloadExcel}
              disabled={isExcelLoading}
            >
              {isExcelLoading ? "Downloading..." : "Download Excel"}
            </Button>
          </div>
        </details>
      </div>

      <div className="hidden md:flex app-row-action-group">
        <AppPrefetchLink
          href={buildReturnHref(`/workspace/question-papers/view/${paperId}`)}
          relatedApiPrefetches={[`/api/question-papers/${paperId}`]}
        >
          <Button
            variant="outline"
            size="sm"
            className="app-row-action-button"
            aria-label="View question paper"
            title="View question paper"
          >
            <Eye className="h-4 w-4" />
            View
          </Button>
        </AppPrefetchLink>
        <AppPrefetchLink
          href={buildReturnHref(`/workspace/question-papers/edit/${paperId}`)}
          relatedApiPrefetches={[
            `/api/question-papers/${paperId}`,
            "/api/classes",
            "/api/sections",
            "/api/subjects",
          ]}
        >
          <Button
            variant="outline"
            size="sm"
            className="app-row-action-button app-row-action-button-accent"
            aria-label="Edit question paper"
            title="Edit question paper"
          >
            <Edit className="h-4 w-4" />
            Edit
          </Button>
        </AppPrefetchLink>
        <Button
          variant="outline"
          size="sm"
          className="app-row-action-button app-row-action-button-danger"
          onClick={onArchive}
          disabled={isDeleting}
          aria-label="Archive question paper"
          title="Archive question paper"
        >
          {isDeleting ? <Spinner /> : <Archive className="h-4 w-4" />}
          Archive
        </Button>
      </div>
      <div className="hidden gap-2 md:flex md:flex-wrap">
        <AppPrefetchLink
          href={buildReturnHref(responsesHref)}
          relatedApiPrefetches={[
            `/api/question-paper-response?paper=${encodedPaperId}&summary=1&page=1&limit=40${
              encodedSectionId ? `&academicSectionId=${encodedSectionId}` : ""
            }`,
          ]}
          className="w-full md:w-auto"
        >
          <Button
            variant="outline"
            size="sm"
            className="app-button-compact w-full md:w-auto"
          >
            Responses
          </Button>
        </AppPrefetchLink>
        <AppPrefetchLink
          href={buildReturnHref(uploadHref)}
          className="w-full md:w-auto"
        >
          <Button
            variant="outline"
            size="sm"
            className="app-button-compact w-full md:w-auto"
          >
            Upload Excel
          </Button>
        </AppPrefetchLink>
        <AppPrefetchLink
          href={buildReturnHref(classAnalyticsHref)}
          relatedApiPrefetches={[
            `/api/analytics/class-tag-report/${paperId}?groupFields=1${
              encodedSectionId ? `&academicSectionId=${encodedSectionId}` : ""
            }`,
          ]}
          className="w-full md:w-auto"
        >
          <Button
            variant="outline"
            size="sm"
            className="app-button-compact w-full md:w-auto"
          >
            Analytics
          </Button>
        </AppPrefetchLink>
        <Button
          variant="outline"
          size="sm"
          className="app-button-compact app-button-compact-success w-full md:w-auto"
          onClick={onSendReports}
          disabled={isSendingReports}
        >
          <MessageCircle className="mr-1 h-4 w-4" />
          {isSendingReports ? "Sending..." : "Send Reports"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="app-button-compact w-full md:w-auto"
          onClick={onDownloadExcel}
          disabled={isExcelLoading}
        >
          {isExcelLoading ? "Downloading..." : "Download Excel"}
        </Button>
      </div>
    </div>
  );
}
