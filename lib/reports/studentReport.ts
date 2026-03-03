type GenerateStudentReportPdfParams = {
  origin: string;
  schoolKey: string;
  responseId: string;
  fileLabel?: string;
};

export async function generateStudentReportPdfAndGetPublicUrl({
  origin,
  schoolKey,
  responseId,
  fileLabel = "student_report",
}: GenerateStudentReportPdfParams) {
  const analyticsUrl = `${origin}/api/analytics/student-tag-report/${responseId}?school=${encodeURIComponent(schoolKey)}`;
  const res = await fetch(analyticsUrl, {
    method: "GET",
    headers: { "x-school-key": schoolKey },
  });

  if (!res.ok) {
    throw new Error(`Failed to generate report PDF (HTTP ${res.status})`);
  }

  // NOTE: On serverless platforms (e.g. Vercel), filesystem is read-only/ephemeral.
  // Return a stable API URL that generates/streams the PDF on-demand.
  return `/api/analytics/student-tag-report/${encodeURIComponent(responseId)}?school=${encodeURIComponent(schoolKey)}`;
}
