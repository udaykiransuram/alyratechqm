type GenerateStudentReportPdfParams = {
  origin: string;
  schoolKey: string;
  responseId: string;
  fileLabel?: string;
};

export async function generateStudentReportPdfAndGetPublicUrl({
  origin: _origin,
  schoolKey,
  responseId,
  fileLabel = "student_report",
}: GenerateStudentReportPdfParams) {
  // NOTE: On serverless platforms (e.g. Vercel), filesystem is read-only/ephemeral.
  // Return a stable API URL that generates/streams the PDF on-demand.
  void fileLabel;
  return `/api/analytics/student-tag-report/${encodeURIComponent(responseId)}?school=${encodeURIComponent(schoolKey)}`;
}
