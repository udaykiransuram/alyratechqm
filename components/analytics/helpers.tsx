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