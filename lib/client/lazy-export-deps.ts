type ToPngFn = (typeof import("html-to-image"))["toPng"];
type XlsxModule = typeof import("xlsx");
type JsPdfClass = (typeof import("jspdf"))["default"];
type AutoTableFn = (typeof import("jspdf-autotable"))["default"];
type BenchmarkExportModule = typeof import("@/lib/analytics/benchmarkExport");

let toPngPromise: Promise<ToPngFn> | null = null;
let xlsxPromise: Promise<XlsxModule> | null = null;
let pdfDepsPromise: Promise<{
  jsPDF: JsPdfClass;
  autoTable: AutoTableFn;
}> | null = null;
let benchmarkExportPromise: Promise<BenchmarkExportModule> | null = null;

export function loadToPng() {
  if (!toPngPromise) {
    toPngPromise = import("html-to-image").then((mod) => mod.toPng);
  }
  return toPngPromise;
}

export function loadXlsx() {
  if (!xlsxPromise) {
    xlsxPromise = import("xlsx");
  }
  return xlsxPromise;
}

export function loadPdfDeps() {
  if (!pdfDepsPromise) {
    pdfDepsPromise = Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]).then(([jspdfMod, autoTableMod]) => ({
      jsPDF: jspdfMod.default,
      autoTable: autoTableMod.default,
    }));
  }
  return pdfDepsPromise;
}

export function loadBenchmarkExport() {
  if (!benchmarkExportPromise) {
    benchmarkExportPromise = import("@/lib/analytics/benchmarkExport");
  }
  return benchmarkExportPromise;
}
