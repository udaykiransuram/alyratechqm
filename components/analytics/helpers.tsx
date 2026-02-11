import * as XLSX from 'xlsx';
import { generateClassAnalyticsExcel } from '@/components/analytics/AnalyticsExportControls';

export function getStatsSum(node: any, key: string): number {
  if (!node || typeof node !== 'object') return 0;
  if (typeof node[key] === 'number') return node[key];
  return Object.values(node)
    .filter(v => typeof v === 'object' && v !== null)
    .reduce((sum, child) => sum + getStatsSum(child, key), 0);
}

export function getStatsStudents(node: any, key: string): { name: string; rollNumber: string }[] {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node[key])) return node[key];
  return Object.values(node)
    .filter(v => typeof v === 'object' && v !== null)
    .flatMap(child => getStatsStudents(child, key));
}

export function sortStatsRows(rows: any[], key: string, direction: 'asc' | 'desc') {
  if (!key) return rows;
  return [...rows].sort((a, b) => {
    const aSum = getStatsSum(a, key);
    const bSum = getStatsSum(b, key);
    return direction === 'asc' ? aSum - bSum : bSum - aSum;
  });
}

export function getGroupLabel(key: string, row: any, groupType?: string) {
  if (groupType) return `${groupType}: ${key}`;
  return key;
}

export function aggregateStudentsByKey(root: any, key: string) {
  const map = new Map<string, { name: string; rollNumber: string; count: number }>();
  function isQuestionNode(n: any) {
    return n && typeof n === 'object' && (typeof n.id === 'string' || typeof n.number === 'number');
  }
  function walk(n: any) {
    if (!n || typeof n !== 'object') return;
    if (isQuestionNode(n) && Array.isArray(n[key])) {
      n[key].forEach((s: any) => {
        const k = `${s.rollNumber}|${s.name}`;
        const c = typeof s.count === 'number' ? s.count : 1;
        if (!map.has(k)) map.set(k, { name: s.name, rollNumber: s.rollNumber, count: c });
        else map.get(k)!.count += c;
      });
      return;
    }
    Object.values(n).forEach((child: any) => {
      if (child && typeof child === 'object') walk(child);
    });
  }
  walk(root);
  return Array.from(map.values());
}

export function consolidateStudentCounts(students: { name: string; rollNumber: string; count?: number }[] = []) {
  const map = new Map<string, { name: string; rollNumber: string; count: number }>();
  students.forEach(s => {
    const key = `${s.rollNumber}|${s.name}`;
    const c = typeof s.count === 'number' ? s.count : 1;
    if (!map.has(key)) map.set(key, { name: s.name, rollNumber: s.rollNumber, count: c });
    else map.get(key)!.count += c;
  });
  return Array.from(map.values());
}

export function getConsolidatedStudentList(
  questionIds: any[] | undefined,
  key: "correctStudents" | "incorrectStudents" | "unattemptedStudents"
): string {
  if (!questionIds || questionIds.length === 0) return "";
  const all: { name: string; rollNumber: string }[] = [];
  questionIds.forEach(q => {
    if (q[key]) all.push(...q[key]);
  });
  const map = new Map<string, { name: string; rollNumber: string; count: number }>();
  all.forEach(s => {
    const k = `${s.rollNumber}|${s.name}`;
    if (!map.has(k)) map.set(k, { ...s, count: 1 });
    else map.get(k)!.count += 1;
  });
  return Array.from(map.values())
    .map(s => `${s.name} (${s.rollNumber}) x${s.count}`)
    .join("; ");
}

// You can also move your walk function here if you want:
export function walkStatsTree(
  node: any,
  groupBy: string[],
  groupFields: { value: string; label: string }[],
  sortStatsRows: Function,
  sortConfig: { key: string; direction: 'asc' | 'desc' },
  callback: (node: any, groupPath: string[]) => void
) {
  function walk(node: any, groupPath: string[] = []) {
    if (!node || typeof node !== "object") return;
    if (
      node.correct !== undefined &&
      node.incorrect !== undefined &&
      node.unattempted !== undefined
    ) {
      callback(node, groupPath);
    }
    const rows = Object.entries(node)
      .filter(([key, value]) => typeof value === "object" && value !== null)
      .map(([key, value]) => ({ key, ...(value as Record<string, any>) }));

    const sortedRows = sortStatsRows(rows, sortConfig.key, sortConfig.direction);

    for (const row of sortedRows) {
      const childNode = node[row.key];
      walk(childNode, [...groupPath, row.key]);
    }
  }
  walk(node, []);
}

// Build per-student area metrics based on current grouping
// Returns a Map keyed by `${rollNumber}|${name}` with an array of rows: { area: string, correct: number, total: number, percent: number }
export function buildStudentAreaMetrics(
  stats: any,
  groupBy: string[],
  groupFields: { value: string; label: string }[],
  sortConfig: { key: string; direction: 'asc' | 'desc' },
  options?: { singleStudent?: { name: string; roll: string } }
) {
  const studentMap = new Map<string, { name: string; roll: string; rows: Map<string, { area: string; correct: number; incorrect: number; unattempted: number; total: number }> }>();

  function getGroupHeaders() {
    return groupBy.map(g => {
      const field = groupFields.find(f => f.value === g);
      return field ? field.label : g;
    });
  }

  function walk(node: any, groupPath: string[] = []) {
    if (!node || typeof node !== 'object') return;
    // If this node has questionIds arrays, use them to count per-student
    const correctQ = node.correctQuestionIds;
    const incorrectQ = node.incorrectQuestionIds;
    const unattemptedQ = node.unattemptedQuestionIds;
    const hasQuestions = Array.isArray(correctQ) || Array.isArray(incorrectQ) || Array.isArray(unattemptedQ);
    if (hasQuestions) {
      const groupHeaders = getGroupHeaders();
      const areaLabel = groupPath.reduce((acc, val, idx) => {
        const header = groupHeaders[idx] || `Group${idx + 1}`;
        return acc.length ? `${acc} / ${header}: ${val}` : `${header}: ${val}`;
      }, '');

      const bump = (name: string, roll: string, status: 'correct' | 'incorrect' | 'unattempted') => {
        const key = `${roll}|${name}`;
        if (!studentMap.has(key)) studentMap.set(key, { name, roll, rows: new Map() });
        const entry = studentMap.get(key)!;
        if (!entry.rows.has(areaLabel)) entry.rows.set(areaLabel, { area: areaLabel || 'Overall', correct: 0, incorrect: 0, unattempted: 0, total: 0 });
        const row = entry.rows.get(areaLabel)!;
        row.total += 1;
        if (status === 'correct') row.correct += 1;
        else if (status === 'incorrect') row.incorrect += 1;
        else row.unattempted += 1;
      };

      const safeIter = (arr: any[] | undefined, key: 'correctStudents'|'incorrectStudents'|'unattemptedStudents', status: 'correct'|'incorrect'|'unattempted') => {
        if (!Array.isArray(arr)) return;
        arr.forEach((q: any) => {
          const students = Array.isArray(q?.[key]) ? q[key] : [];
          students.forEach((s: any) => bump(s.name, s.rollNumber, status));
        });
      };

      safeIter(correctQ, 'correctStudents', 'correct');
      safeIter(incorrectQ, 'incorrectStudents', 'incorrect');
      safeIter(unattemptedQ, 'unattemptedStudents', 'unattempted');

      // Fallback for single-student analytics where question objects do not contain per-student arrays
      if (options?.singleStudent) {
        const key = `${options.singleStudent.roll}|${options.singleStudent.name}`;
        if (!studentMap.has(key)) studentMap.set(key, { name: options.singleStudent.name, roll: options.singleStudent.roll, rows: new Map() });
        const entry = studentMap.get(key)!;
        if (!entry.rows.has(areaLabel)) entry.rows.set(areaLabel, { area: areaLabel || 'Overall', correct: 0, incorrect: 0, unattempted: 0, total: 0 });
        const row = entry.rows.get(areaLabel)!;
        const correctCount = Math.max(0, typeof node.correct === 'number' ? node.correct : 0);
        const incorrectCount = Math.max(0, typeof node.incorrect === 'number' ? node.incorrect : 0);
        const unattemptedCount = Math.max(0, typeof node.unattempted === 'number' ? node.unattempted : 0);
        const totalCount = correctCount + incorrectCount + unattemptedCount;
        row.total += totalCount;
        row.correct += correctCount;
        row.incorrect += incorrectCount;
        row.unattempted += unattemptedCount;
      }
    }

    // Recurse into children in a sorted manner
    const rows = Object.entries(node)
      .filter(([key, value]) => typeof value === 'object' && value !== null)
      .map(([key, value]) => ({ key, ...(value as Record<string, any>) }));
    const sortedRows = sortStatsRows(rows, sortConfig.key, sortConfig.direction);
    for (const row of sortedRows) {
      const childNode = (node as any)[row.key];
      walk(childNode, [...groupPath, row.key]);
    }
  }

  walk(stats, []);

  // Finalize percent for each row
  return new Map(
    Array.from(studentMap.entries()).map(([k, v]) => {
      const finalized = Array.from(v.rows.values()).map(r => ({
        area: r.area,
        correct: r.correct,
        incorrect: r.incorrect,
        unattempted: r.unattempted,
        total: r.total,
        percent: r.total > 0 ? Number(((r.correct / r.total) * 100).toFixed(2)) : 0,
      }));
      return [k, { name: v.name, roll: v.roll, rows: finalized }];
    })
  );
}

export async function downloadDefaultClassAnalyticsExcel(paperId: string, numTags: number = 5, returnBlob = false) {
  const fieldsRes = await fetch(`/api/analytics/class-tag-report/${paperId}?groupFields=1`);
  const fieldsData = await fieldsRes.json();
  const groupFields = fieldsData.fields || [];
  const selectedFields = groupFields.slice(0, numTags).map((f: any) => f.value);
  const searchParams = new URLSearchParams();
  searchParams.set('json', '1');
  searchParams.set('groupBy', selectedFields.join(','));
  const analyticsRes = await fetch(`/api/analytics/class-tag-report/${paperId}?${searchParams.toString()}`);
  const analyticsData = await analyticsRes.json();
  const stats = analyticsData.stats || {};
  // generate workbook and ensure correct typing; cast because generateClassAnalyticsExcel may be untyped
  const workbook = (generateClassAnalyticsExcel(
    stats,
    selectedFields,
    groupFields,
    { key: '', direction: 'desc' },
    'class_analytics_default.xlsx'
  ) as unknown) as XLSX.WorkBook;
  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/octet-stream' });
  if (returnBlob) return blob;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'class_analytics_default.xlsx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

