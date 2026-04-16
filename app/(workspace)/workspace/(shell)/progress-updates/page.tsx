import PageHero from "@/components/layout/PageHero";
import PageShell from "@/components/layout/PageShell";
import ProgressUpdatesFiltersClient from "@/components/progress-updates/ProgressUpdatesFiltersClient";
import ProgressUpdatesDirectoryClient from "@/components/progress-updates/ProgressUpdatesDirectoryClient";
import { getTodayDiaryEntryDate, formatDiaryDateLabel } from "@/lib/diary/shared";
import {
  getProgressUpdatesSupportData,
  listProgressUpdatesDirectory,
} from "@/lib/server/progress-updates";
import { requireWorkspaceStaffSession, resolveWorkspaceListPage } from "@/lib/server/workspace-user-directory";

type ProgressUpdatesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ProgressUpdatesPage({
  searchParams,
}: ProgressUpdatesPageProps) {
  const { schoolKey, viewerId, viewerRole } = await requireWorkspaceStaffSession();
  const resolvedSearchParams = await searchParams;

  const defaultDate = getTodayDiaryEntryDate();
  const selectedDate =
    String(readSearchValue(resolvedSearchParams?.date) || "").trim() || defaultDate;
  const selectedClassId = String(readSearchValue(resolvedSearchParams?.classId) || "all").trim();
  const selectedSectionId = String(readSearchValue(resolvedSearchParams?.sectionId) || "all").trim();
  const searchQuery = String(readSearchValue(resolvedSearchParams?.q) || "").trim();
  const requestedPage = resolveWorkspaceListPage(readSearchValue(resolvedSearchParams?.page));

  const supportData = await getProgressUpdatesSupportData({
    schoolKey,
    viewerId,
    viewerRole,
  });

  const filteredSections =
    selectedClassId !== "all"
      ? supportData.sections.filter((section) => {
          const sectionClassId =
            typeof section.class === "string" ? section.class : section.class?._id || "";
          return !sectionClassId || sectionClassId === selectedClassId;
        })
      : supportData.sections;

  const directory = await listProgressUpdatesDirectory({
    schoolKey,
    viewerId,
    viewerRole,
    date: selectedDate,
    classId: selectedClassId !== "all" ? selectedClassId : undefined,
    sectionId: selectedSectionId !== "all" ? selectedSectionId : undefined,
    query: searchQuery || undefined,
    page: requestedPage,
    limit: 25,
  });

  const selectedClassLabel =
    selectedClassId && selectedClassId !== "all"
      ? supportData.classes.find((item) => item._id === selectedClassId)?.name ||
        "Selected class"
      : "All classes";
  const selectedSectionLabel =
    selectedSectionId && selectedSectionId !== "all"
      ? supportData.sections.find((item) => item._id === selectedSectionId)?.name ||
        "Selected section"
      : "All sections";

  return (
    <PageShell width="wide" padding="standard" className="app-directory-stack">
      <PageHero
        variant="directory"
        eyebrow="Parent Connect"
        title="Progress Updates"
        description="Manage parent WhatsApp contacts and review daily progress summaries at a glance."
        meta={
          <>
            <span className="app-meta-chip">
              {formatDiaryDateLabel(selectedDate) || selectedDate}
            </span>
            <span className="app-meta-chip">{selectedClassLabel}</span>
            <span className="app-meta-chip">{selectedSectionLabel}</span>
          </>
        }
        stats={[
          {
            label: "Students",
            value: String(directory.totalStudents),
            meta: "Students returned by the current filters.",
          },
          {
            label: "Daily updates",
            value: String(directory.rows.filter((row) => row.progress).length),
            meta: "Generated updates for the selected date.",
          },
          {
            label: "Sent",
            value: String(
              directory.rows.filter((row) => row.progress?.digestStatus === "sent").length,
            ),
            meta: "WhatsApp messages successfully delivered.",
          },
          {
            label: "Contacts ready",
            value: String(
              directory.rows.filter((row) => row.student.mobileNumber).length,
            ),
            meta: "Students with a WhatsApp number on record.",
          },
        ]}
      />

      <ProgressUpdatesFiltersClient
        date={selectedDate}
        defaultDate={defaultDate}
        classId={selectedClassId}
        classOptions={supportData.classes.map((item) => ({
          value: item._id,
          label: item.name,
        }))}
        sectionId={selectedSectionId}
        sectionOptions={filteredSections.map((item) => ({
          value: item._id,
          label: item.name,
        }))}
        query={searchQuery}
      />

      <ProgressUpdatesDirectoryClient
        rows={directory.rows}
        date={selectedDate}
        totalStudents={directory.totalStudents}
      />
    </PageShell>
  );
}
