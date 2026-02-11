import React, { useMemo, useRef, useState } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getStatsSum, getStatsStudents, buildStudentAreaMetrics } from "./helpers";
import { toPng } from 'html-to-image';

const COLORS = {
  correct: "#22c55e",
  incorrect: "#ef4444",
  unattempted: "#f59e0b",
};

const ChartCard = ({ title, children }: { title: React.ReactNode; children: React.ReactNode }) => (
  <div className="bg-white rounded-xl shadow-lg border border-slate-200/80 h-full flex flex-col transition-shadow hover:shadow-xl">
    <h3 className="text-lg font-semibold text-slate-800 p-5 border-b border-slate-200">{title}</h3>
    <div className="p-4 md:p-6 flex-grow">{children}</div>
  </div>
);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const pld = payload[0];
    const students = pld.payload.students || [];
    return (
      <div className="bg-white/90 backdrop-blur-sm p-3 shadow-lg rounded-lg border border-slate-300 min-w-[220px] max-w-xs">
        <p className="font-bold text-slate-800 mb-1">{label}</p>
        <div className="mb-2 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: pld.color || pld.fill }}></span>
          <span className="text-slate-600">{pld.name}:</span>
          <span className="font-semibold text-slate-800 ml-1">{pld.value}</span>
        </div>
        <div className="text-xs text-slate-700">
          <div className="font-semibold mb-1">Students:</div>
          {students.length > 0 ? (
            <ul className="max-h-64 overflow-y-auto space-y-1">
              {students.map((s: any, i: number) => (
                <li key={i}>
                  {s.name} <span className="text-slate-400">({s.rollNumber})</span>
                </li>
              ))}
            </ul>
          ) : (
            <span className="italic text-slate-400">None</span>
          )}
        </div>
      </div>
    );
  }
  return null;
};

const OverallPerformancePieChart = ({ stats, title }: { stats: any; title: string }) => {
  const total = getStatsSum(stats, "correct") + getStatsSum(stats, "incorrect") + getStatsSum(stats, "unattempted");
  if (total === 0) return null;

  const data = [
    { name: "Correct", value: getStatsSum(stats, "correct"), students: getStatsStudents(stats, "correctStudents") },
    { name: "Incorrect", value: getStatsSum(stats, "incorrect"), students: getStatsStudents(stats, "incorrectStudents") },
    { name: "Unattempted", value: getStatsSum(stats, "unattempted"), students: getStatsStudents(stats, "unattemptedStudents") },
  ].filter((d) => d.value > 0);

  return (
    <ChartCard title={<span>{title}</span>}>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            outerRadius={110}
            innerRadius={60}
            fill="#8884d8"
            dataKey="value"
            paddingAngle={5}
            label={({ name, percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[entry.name.toLowerCase() as keyof typeof COLORS]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend iconType="circle" />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
};

const GroupedPerformanceBarChart = ({ stats, groupBy }: { stats: Record<string, any>; groupBy: string }) => {
  const chartData = Object.entries(stats)
    .filter(([, value]) => typeof value === "object" && value !== null && "correct" in value)
    .map(([key, value]) => ({
      name: key,
      Correct: value.correct,
      Incorrect: value.incorrect,
      Unattempted: value.unattempted,
    }));

  if (chartData.length === 0) return null;

  const chartWidth = Math.max(chartData.length * 140, 700);

  return (
    <ChartCard title={`Performance by ${groupBy}`}>
      <div className="w-full overflow-x-auto">
        <div style={{ minWidth: chartWidth }}>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="name"
                stroke="#475569"
                tick={(props) => {
                  const { x, y, payload } = props;
                  return (
                    <text
                      x={x}
                      y={y}
                      dy={16}
                      textAnchor="end"
                      fontSize={12}
                      transform={`rotate(-45, ${x}, ${y})`}
                      fill="#475569"
                    >
                      {payload.value}
                    </text>
                  );
                }}
                interval={0}
                height={70}
              />
              <YAxis stroke="#475569" tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(241, 245, 249, 0.6)" }} />
              <Legend iconType="circle" />
              <Bar dataKey="Correct" stackId="a" fill={COLORS.correct} radius={[4, 4, 0, 0]} />
              <Bar dataKey="Incorrect" stackId="a" fill={COLORS.incorrect} />
              <Bar dataKey="Unattempted" stackId="a" fill={COLORS.unattempted} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </ChartCard>
  );
};

type ChartViewProps = {
  stats: any;
  groupBy: string[];
  groupFields?: { value: string; label: string }[];
  paperTitle?: string;
  mode?: 'class' | 'student';
  studentName?: string;
  rollNumber?: string;
};

const ChartView = ({ stats, groupBy, groupFields = [], paperTitle = '', mode = 'class', studentName, rollNumber }: ChartViewProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const allPieChartsRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  if (!stats || Object.keys(stats).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-10 bg-white rounded-lg shadow-md border border-slate-200/80 text-center">
        <svg className="w-16 h-16 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
        </svg>
        <p className="mt-4 text-lg font-semibold text-slate-600">No Chart Data Available</p>
        <p className="text-sm text-slate-400">Try adjusting the filters or group by options.</p>
      </div>
    );
  }

  function getFirstLevelGroups(statsObj: any): [string, any][] {
    return Object.entries(statsObj).filter(
      ([, value]) =>
        typeof value === "object" &&
        value !== null &&
        ("correct" in value || Object.values(value).some((v: any) => v && typeof v === "object" && "correct" in v))
    );
  }

  if (!groupBy || groupBy.length === 0) {
    const overallStats = {
      correct: getStatsSum(stats, "correct"),
      incorrect: getStatsSum(stats, "incorrect"),
      unattempted: getStatsSum(stats, "unattempted"),
    };
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-6">
        <OverallPerformancePieChart stats={overallStats} title="Overall Performance" />
      </div>
    );
  }

  const firstLevelGroups = getFirstLevelGroups(stats);

  const barChartStats: Record<string, any> = {};
  firstLevelGroups.forEach(([key, value]) => {
    if ("correct" in value) {
      barChartStats[key] = value;
    } else {
      barChartStats[key] = {
        correct: getStatsSum(value, "correct"),
        incorrect: getStatsSum(value, "incorrect"),
        unattempted: getStatsSum(value, "unattempted"),
      };
    }
  });

  // Download chart view as image (the visible chart container only)
  async function handleDownloadChartImage() {
    if (!chartContainerRef.current) return;
    try {
      setDownloading(true);
      const dataUrl = await toPng(chartContainerRef.current, {
        cacheBust: true,
        background: '#ffffff',
        pixelRatio: 2,
      });
      const a = document.createElement('a');
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const base = mode === 'student' && studentName ? `student-${studentName}` : 'class';
      const paper = paperTitle ? `-${paperTitle}` : '';
      a.download = `${base}${paper}-chart-${ts}.png`;
      a.href = dataUrl;
      a.click();
    } catch (e) {
      console.error('Failed to download chart image', e);
    } finally {
      setDownloading(false);
    }
  }

  // Generate remedial PDF rows using helper
  function generateRemedialDocForStudent(name: string, roll: string, rows: { area: string; correct: number; total: number; percent: number }[]) {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(`${paperTitle ? `Paper: ${paperTitle}` : ''}`, 14, 16);
    doc.setFontSize(16);
    doc.text(`Remedial Sheet - ${name} (${roll})`, 14, 26);
    autoTable(doc, {
      head: [["Area", "Correct", "Total", "% Correct"]],
      body: rows.map(r => [r.area || 'Overall', String(r.correct), String(r.total), `${r.percent}%`]),
      startY: 34,
      styles: { fontSize: 11 },
      headStyles: { fillColor: [34, 197, 94] },
      columnStyles: { 0: { cellWidth: 120 } },
    });
    return doc;
  }

  async function handleDownloadRemedials() {
    try {
      setDownloading(true);
      const metrics = buildStudentAreaMetrics(stats, groupBy, groupFields, { key: '', direction: 'desc' });
      if (mode === 'student') {
        // Single student expected
        const key = `${rollNumber || ''}|${studentName || ''}`;
        const entry = metrics.get(key);
        const rows = entry?.rows || [];
        const doc = generateRemedialDocForStudent(studentName || 'Student', rollNumber || '', rows);
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const paper = paperTitle ? `${paperTitle}-` : '';
        doc.save(`${paper}${studentName || 'student'}-remedial-${ts}.pdf`);
      } else {
        // Class-level: ZIP multiple PDFs
        const JSZip = (await import('jszip')).default;
        const zip = new JSZip();
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const base = paperTitle ? `${paperTitle}-` : '';
        for (const [, v] of metrics.entries()) {
          const doc = generateRemedialDocForStudent(v.name, v.roll, v.rows);
          const blob = doc.output('blob');
          const filename = `${base}${v.name}-remedial-${ts}.pdf`;
          zip.file(filename, blob as any);
        }
        const content = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${base}remedials-${ts}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error('Failed to generate remedials', e);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-12 mt-6" ref={chartContainerRef}>
      <GroupedPerformanceBarChart stats={barChartStats} groupBy={groupBy[0]} />
      <div>
        <h2 className="text-2xl font-bold text-slate-800 mb-6">Detailed Breakdown by {groupBy[0]}</h2>
        <div className="flex flex-wrap gap-2 justify-end mb-4">
          <button
            onClick={handleDownloadChartImage}
            disabled={downloading}
            className="px-4 py-2 bg-blue-600 disabled:opacity-60 text-white rounded hover:bg-blue-700 text-sm font-semibold shadow transition"
            title="Download Chart Image"
          >
            {downloading ? 'Preparing...' : 'Download Chart Image'}
          </button>
          <button
            onClick={handleDownloadRemedials}
            disabled={downloading}
            className="px-4 py-2 bg-green-600 disabled:opacity-60 text-white rounded hover:bg-green-700 text-sm font-semibold shadow transition"
            title={mode === 'student' ? 'Download Remedial PDF' : 'Download All Remedials (ZIP)'}
          >
            {mode === 'student' ? (downloading ? 'Preparing...' : 'Download Remedial PDF') : (downloading ? 'Preparing...' : 'Download All Remedials (ZIP)')}
          </button>
        </div>
        <div ref={allPieChartsRef}>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {firstLevelGroups.map(([key, value]) => {
              let statsForPie: any;
              if ("correct" in value) {
                statsForPie = value;
              } else {
                statsForPie = {
                  correct: getStatsSum(value, "correct"),
                  incorrect: getStatsSum(value, "incorrect"),
                  unattempted: getStatsSum(value, "unattempted"),
                };
              }
              return <OverallPerformancePieChart key={key} stats={statsForPie} title={`Performance: ${key}`} />;
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChartView;