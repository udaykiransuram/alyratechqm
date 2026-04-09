"use client";

import {
  Archive,
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
      <div className="app-row-action-group">
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
      <div className="grid gap-2 sm:flex sm:flex-wrap">
        <AppPrefetchLink
          href={buildReturnHref(responsesHref)}
          relatedApiPrefetches={[
            `/api/question-paper-response?paper=${encodedPaperId}&summary=1&page=1&limit=40${
              encodedSectionId ? `&academicSectionId=${encodedSectionId}` : ""
            }`,
          ]}
          className="w-full sm:w-auto"
        >
          <Button
            variant="outline"
            size="sm"
            className="app-button-compact w-full sm:w-auto"
          >
            Responses
          </Button>
        </AppPrefetchLink>
        <AppPrefetchLink
          href={buildReturnHref(uploadHref)}
          className="w-full sm:w-auto"
        >
          <Button
            variant="outline"
            size="sm"
            className="app-button-compact w-full sm:w-auto"
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
          className="w-full sm:w-auto"
        >
          <Button
            variant="outline"
            size="sm"
            className="app-button-compact w-full sm:w-auto"
          >
            Analytics
          </Button>
        </AppPrefetchLink>
        <Button
          variant="outline"
          size="sm"
          className="app-button-compact app-button-compact-success w-full sm:w-auto"
          onClick={onSendReports}
          disabled={isSendingReports}
        >
          <MessageCircle className="mr-1 h-4 w-4" />
          {isSendingReports ? "Sending..." : "Send Reports"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="app-button-compact w-full sm:w-auto"
          onClick={onDownloadExcel}
          disabled={isExcelLoading}
        >
          {isExcelLoading ? "Downloading..." : "Download Excel"}
        </Button>
      </div>
    </div>
  );
}
