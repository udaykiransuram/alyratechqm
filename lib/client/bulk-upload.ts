export type ParsedUploadRow = Record<string, unknown>;

function escapeCsvCell(value: unknown) {
  const normalized = String(value ?? "");
  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
}

export function normalizeUploadKey(key: string) {
  return String(key || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function toUploadLookupKey(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function getUploadCell(row: ParsedUploadRow, ...keys: string[]) {
  for (const key of keys) {
    const normalizedKey = normalizeUploadKey(key);
    if (normalizedKey && normalizedKey in row) {
      return row[normalizedKey];
    }
  }
  return "";
}

export function splitUploadListCell(value: unknown) {
  return String(value ?? "")
    .split(/[|\n;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseUploadBoolean(
  value: unknown,
  defaultValue = false,
) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  if (!normalized) {
    return defaultValue;
  }

  if (["true", "yes", "y", "1", "all"].includes(normalized)) {
    return true;
  }

  if (["false", "no", "n", "0", "none"].includes(normalized)) {
    return false;
  }

  return defaultValue;
}

export function parseUploadDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const excelEpoch = new Date(Math.round((value - 25569) * 86400 * 1000));
    return Number.isNaN(excelEpoch.getTime()) ? undefined : excelEpoch;
  }

  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return undefined;
  }

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export async function parseUploadFile(file: File): Promise<ParsedUploadRow[]> {
  const lowerName = String(file.name || "").toLowerCase();
  if (
    !lowerName.endsWith(".csv") &&
    !lowerName.endsWith(".xlsx") &&
    !lowerName.endsWith(".xls")
  ) {
    throw new Error("Unsupported file type. Upload a CSV or Excel file.");
  }

  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return [];
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });

  return rows.map((row) => {
    const normalizedRow: ParsedUploadRow = {};
    Object.entries(row || {}).forEach(([key, value]) => {
      normalizedRow[normalizeUploadKey(key)] = value;
    });
    return normalizedRow;
  });
}

export function downloadCsvTemplate(
  filename: string,
  headers: string[],
  sampleRows: Array<Array<string | number | boolean | null | undefined>>,
) {
  if (typeof window === "undefined") {
    return;
  }

  const csv = [headers, ...sampleRows]
    .map((row) => row.map((value) => escapeCsvCell(value)).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.URL.revokeObjectURL(url);
}
