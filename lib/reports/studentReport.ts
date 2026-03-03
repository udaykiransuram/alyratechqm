import fs from "node:fs/promises";
import path from "node:path";

type GenerateStudentReportPdfParams = {
  origin: string;
  schoolKey: string;
  responseId: string;
  fileLabel?: string;
};

function safeName(input: string) {
  return input.replace(/[^a-zA-Z0-9_-]/g, "_");
}

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

  const bytes = Buffer.from(await res.arrayBuffer());
  const dir = path.join(
    process.cwd(),
    "public",
    "generated-reports",
    schoolKey,
  );
  await fs.mkdir(dir, { recursive: true });

  const fileName = `${safeName(fileLabel)}_${responseId}.pdf`;
  const filePath = path.join(dir, fileName);
  await fs.writeFile(filePath, bytes);

  return `/generated-reports/${encodeURIComponent(schoolKey)}/${encodeURIComponent(fileName)}`;
}
