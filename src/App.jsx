import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "./theme.jsx";
import Papa from "papaparse";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import { detectColumns, getRcaValue } from "./lib/columns.js";
import {
  annotateRows,
  applyFilter,
  countByKind,
  aggregateByField,
  aggregateRca,
  aggregatePocProductivity,
  buildWeeklySeriesForKind,
  buildWeeklyProductivitySeriesForPoc,
  compareLatestWeeks,
  sliceLastWeeks,
  buildWeeklyPivotRows,
  getFilledWeekKeysBetweenMinMax,
  parseFlexibleDate,
  filterRowsForHotspots,
  ISSUE_KIND_LABELS,
} from "./lib/analytics.js";
import { downloadCsv, shortCount } from "./lib/csvExport.js";
import { isSupabaseConfigured } from "./lib/supabaseClient.js";
import { loadSnapshot, saveSnapshot } from "./lib/cloudSnapshot.js";
import { DataTableTab } from "./DataTableTab.jsx";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

ChartJS.defaults.font.family = "'Plus Jakarta Sans', system-ui, sans-serif";

function DownloadIcon({ className = "h-4 w-4" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M12 3v12m0 0l4-4m-4 4L8 11" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M5 15v4a2 2 0 002 2h10a2 2 0 002-2v-4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UploadIcon({ className = "h-5 w-5" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M12 16V4m0 0l4 4m-4-4L8 8" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M4 14v4a2 2 0 002 2h12a2 2 0 002-2v-4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PdfIcon({ className = "h-4 w-4" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path
        d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronDownIcon({ className = "h-5 w-5", expanded }) {
  return (
    <svg
      className={`${className} shrink-0 transition-transform duration-200 ${expanded ? "-rotate-180" : ""}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DownloadBtn({ count, label, variant = "dark", onClick, disabled }) {
  const styles = {
    dark:
      "border border-slate-700/70 bg-gradient-to-b from-slate-700 to-slate-900 text-white shadow-btn hover:from-slate-600 hover:to-slate-800 hover:shadow-md dark:border-slate-600/40 dark:from-slate-600 dark:to-slate-950 dark:shadow-btn-dark dark:hover:from-slate-500 dark:hover:to-slate-900",
    red:
      "border border-red-500/25 bg-gradient-to-b from-red-600 to-red-700 text-white shadow-md shadow-red-900/15 hover:from-red-500 hover:to-red-600",
    amber:
      "border border-amber-400/30 bg-gradient-to-b from-amber-500 to-amber-600 text-white shadow-md shadow-amber-900/10 hover:from-amber-400 hover:to-amber-500",
    blue:
      "border border-blue-500/25 bg-gradient-to-b from-blue-600 to-blue-700 text-white shadow-md shadow-blue-900/15 hover:from-blue-500 hover:to-blue-600",
    slate:
      "border border-slate-200/90 bg-white text-slate-800 shadow-sm hover:border-slate-300 hover:bg-slate-50 dark:border-slate-600/60 dark:bg-slate-800/80 dark:text-slate-100 dark:hover:bg-slate-700/80",
    orange:
      "border border-orange-400/30 bg-gradient-to-b from-orange-500 to-orange-600 text-white shadow-md hover:from-orange-400 hover:to-orange-500",
    outline:
      "border border-slate-200/90 bg-white/95 text-slate-700 shadow-sm backdrop-blur-sm hover:border-slate-300 hover:bg-white dark:border-slate-600/70 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-800/80",
  };
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={label}
      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold transition-all duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 ${styles[variant]}`}
    >
      <span>{shortCount(count)}</span>
      <DownloadIcon className="h-4 w-4 opacity-90" />
    </button>
  );
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === "dark";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={toggleTheme}
      className="group flex max-w-full items-center gap-1.5 rounded-full border border-slate-200/90 bg-white/90 py-1 pl-2 pr-0.5 shadow-btn backdrop-blur-sm transition-all duration-200 hover:border-slate-300 hover:shadow-md active:scale-[0.98] sm:gap-2.5 sm:pl-3 sm:pr-1 dark:border-slate-600/70 dark:bg-slate-800/70 dark:shadow-btn-dark dark:hover:border-slate-500"
    >
      <span className="hidden text-[11px] font-bold uppercase tracking-wide text-slate-500 sm:inline dark:text-slate-400">
        {dark ? "Dark" : "Light"}
      </span>
      <span
        className="relative inline-flex h-8 w-[3.25rem] shrink-0 items-center rounded-full bg-slate-200/90 p-1 ring-1 ring-slate-300/80 transition-colors dark:bg-slate-950/80 dark:ring-slate-700/80"
        aria-hidden
      >
        <span
          className={`absolute left-1 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-md transition-transform duration-300 ease-out dark:bg-slate-700 ${
            dark ? "translate-x-[1.35rem]" : "translate-x-0"
          }`}
        >
          {dark ? (
            <svg className="h-3.5 w-3.5 text-amber-300" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M21.64 13a1 1 0 00-1.05-.14 8.05 8.05 0 01-3.37.73 8.15 8.15 0 01-8.14-8.1 8.59 8.59 0 01.25-2 1 1 0 00-.33-1.05 1 1 0 00-1.09-.21A10 10 0 1022 13.05a1 1 0 00-.36-1.05z" />
            </svg>
          ) : (
            <svg className="h-3.5 w-3.5 text-amber-500" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 18a6 6 0 100-12 6 6 0 000 12zM12 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm0 18a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM4.22 4.22a1 1 0 011.42 0l.7.7a1 1 0 01-1.42 1.42l-.7-.7a1 1 0 010-1.42zm12.72 12.72a1 1 0 011.42 0l.7.7a1 1 0 01-1.42 1.42l-.7-.7a1 1 0 010-1.42zM2 12a1 1 0 011-1h1a1 1 0 110 2H3a1 1 0 01-1-1zm18 0a1 1 0 011-1h1a1 1 0 110 2h-1a1 1 0 01-1-1zM4.22 19.78a1 1 0 010-1.42l.7-.7a1 1 0 111.42 1.42l-.7.7a1 1 0 01-1.42 0zM17.66 6.34a1 1 0 010-1.42l.7-.7a1 1 0 111.42 1.42l-.7.7a1 1 0 01-1.42 0z" />
            </svg>
          )}
        </span>
      </span>
    </button>
  );
}

function zoneBadgeClass(zone) {
  const z = String(zone ?? "").toLowerCase();
  if (z.includes("north"))
    return "bg-sky-100 text-sky-900 ring-1 ring-sky-200/80 dark:bg-sky-500/15 dark:text-sky-200 dark:ring-sky-400/35";
  if (z.includes("east"))
    return "bg-amber-100 text-amber-950 ring-1 ring-amber-200/80 dark:bg-amber-500/15 dark:text-amber-100 dark:ring-amber-400/35";
  if (z.includes("west"))
    return "bg-violet-100 text-violet-900 ring-1 ring-violet-200/80 dark:bg-violet-500/15 dark:text-violet-200 dark:ring-violet-400/35";
  if (z.includes("south"))
    return "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200/80 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-400/35";
  return "bg-slate-100 text-slate-800 ring-1 ring-slate-200/80 dark:bg-slate-600/35 dark:text-slate-200 dark:ring-slate-500/45";
}

function rcaBadgeClass(kind) {
  if (kind === "partial_bagging")
    return "bg-orange-100 text-orange-950 ring-1 ring-orange-200/80 dark:bg-orange-500/15 dark:text-orange-200 dark:ring-orange-400/35";
  if (kind === "multiple_bagging")
    return "bg-amber-100 text-amber-950 ring-1 ring-amber-200/80 dark:bg-amber-500/15 dark:text-amber-100 dark:ring-amber-400/35";
  if (kind === "lm_fraud")
    return "bg-red-100 text-red-900 ring-1 ring-red-200/80 dark:bg-red-500/15 dark:text-red-200 dark:ring-red-400/35";
  if (kind === "camera_issues")
    return "bg-violet-100 text-violet-900 ring-1 ring-violet-200/80 dark:bg-violet-500/15 dark:text-violet-200 dark:ring-violet-400/35";
  if (kind === "unable_to_validate")
    return "bg-yellow-100 text-yellow-950 ring-1 ring-yellow-200/80 dark:bg-yellow-500/15 dark:text-yellow-100 dark:ring-yellow-400/35";
  return "bg-slate-100 text-slate-800 ring-1 ring-slate-200/80 dark:bg-slate-600/35 dark:text-slate-200 dark:ring-slate-500/45";
}

function issueSlice(allRows, pill, issueKind) {
  const issueRows = allRows.filter((r) => r.__kind === issueKind);
  if (pill === "all") return issueRows;
  if (pill === issueKind) return issueRows;
  return [];
}

function downloadAggregateCsv(filename, pairs) {
  const rows = pairs.map(([label, count]) => ({ label, count }));
  downloadCsv(filename, rows, ["label", "count"]);
}

function stripExportRows(rows, fields) {
  return rows.map((r) => {
    const o = {};
    for (const f of fields) o[f] = r[f] ?? "";
    return o;
  });
}

const HOTSPOTS_INITIAL_VISIBLE = 5;
const POC_PRODUCTIVITY_CARD_LIMIT = 10;

function formatPocProductivityPercent(ratio) {
  if (ratio == null || !Number.isFinite(ratio)) return "—";
  return `${(ratio * 100).toFixed(1)}%`;
}

const POC_SPARKLINE_PALETTE = [
  { border: "rgb(13 148 136)", fill: "rgba(13, 148, 136, 0.14)" },
  { border: "rgb(79 70 229)", fill: "rgba(79, 70, 229, 0.14)" },
  { border: "rgb(217 119 6)", fill: "rgba(217, 119, 6, 0.14)" },
  { border: "rgb(8 145 178)", fill: "rgba(8, 145, 178, 0.14)" },
  { border: "rgb(192 38 211)", fill: "rgba(192, 38, 211, 0.12)" },
];

const FILTER_DEFS = [
  { id: "all", label: "All Data" },
  { id: "partial_bagging", label: "Partial Bagging" },
  { id: "lm_fraud", label: "LM Fraud" },
  { id: "no_footage", label: "No Footage" },
  { id: "camera_issues", label: "Camera Issues" },
];

function HorizontalBarChart({ labels, values, color }) {
  const { isDark } = useTheme();
  const barGrid = useMemo(
    () => ({
      color: isDark ? "rgba(148, 163, 184, 0.14)" : "rgba(148, 163, 184, 0.35)",
      borderDash: [4, 4],
    }),
    [isDark]
  );

  const data = useMemo(
    () => ({
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: color,
          borderRadius: 6,
          barThickness: 18,
        },
      ],
    }),
    [labels, values, color]
  );

  const options = useMemo(
    () => ({
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(15, 23, 42, 0.92)",
          padding: 12,
          cornerRadius: 8,
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: { ...barGrid, drawBorder: false },
          ticks: {
            font: { size: 12 },
            color: isDark ? "#94a3b8" : "#64748b",
          },
        },
        y: {
          grid: { display: false, drawBorder: false },
          ticks: {
            font: { size: 12 },
            color: isDark ? "#94a3b8" : "#64748b",
          },
        },
      },
    }),
    [barGrid, isDark]
  );

  return <Bar data={data} options={options} />;
}

function issueTrendPillClass(direction) {
  if (direction === "up")
    return "bg-red-50 text-red-950 ring-1 ring-red-200/90 dark:bg-red-950 dark:text-red-50 dark:ring-red-800/90";
  if (direction === "down")
    return "bg-emerald-50 text-emerald-950 ring-1 ring-emerald-200/90 dark:bg-emerald-950 dark:text-emerald-50 dark:ring-emerald-800/90";
  if (direction === "baseline" || direction === "none")
    return "bg-slate-50 text-slate-800 ring-1 ring-slate-200/90 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-600/80";
  return "bg-slate-100 text-slate-900 ring-1 ring-slate-200/90 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-600/80";
}

function productivityTrendPillClass(direction) {
  if (direction === "up")
    return "bg-emerald-50 text-emerald-950 ring-1 ring-emerald-200/90 dark:bg-emerald-950 dark:text-emerald-50 dark:ring-emerald-800/90";
  if (direction === "down")
    return "bg-red-50 text-red-950 ring-1 ring-red-200/90 dark:bg-red-950 dark:text-red-50 dark:ring-red-800/90";
  if (direction === "baseline" || direction === "none" || direction === "flat")
    return "bg-slate-50 text-slate-800 ring-1 ring-slate-200/90 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-600/80";
  return "bg-slate-100 text-slate-900 ring-1 ring-slate-200/90 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-600/80";
}

function TrendSparkline({
  series,
  borderColor,
  fillColor,
  datasetLabel = "Cases",
  valueSuffix = "",
  ySuggestedMax,
  yTickPrecision,
}) {
  const { isDark } = useTheme();
  const trimmed = useMemo(() => sliceLastWeeks(series, 10), [series]);
  const data = useMemo(
    () => ({
      labels: trimmed.map((x) => x.label),
      datasets: [
        {
          label: datasetLabel,
          data: trimmed.map((x) => x.count),
          borderColor,
          backgroundColor: fillColor,
          fill: true,
          tension: 0.35,
          pointRadius: 3,
          pointHoverRadius: 5,
          borderWidth: 2,
        },
      ],
    }),
    [trimmed, borderColor, fillColor, datasetLabel]
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(15, 23, 42, 0.92)",
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            title(items) {
              const i = items[0]?.dataIndex;
              if (i == null) return "";
              const wk = trimmed[i]?.weekKey;
              return wk ? `Week of ${wk}` : "";
            },
            label(ctx) {
              const i = ctx.dataIndex;
              const pt = trimmed[i];
              const v = ctx.parsed.y;
              if (
                pt &&
                typeof pt.totalEligible === "number" &&
                typeof pt.validRca === "number"
              ) {
                return `Productivity: ${typeof v === "number" ? v.toFixed(1) : v}% (${pt.validRca.toLocaleString()} valid RCA / ${pt.totalEligible.toLocaleString()} eligible)`;
              }
              return valueSuffix
                ? `${datasetLabel}: ${v}${valueSuffix}`
                : `${datasetLabel}: ${v}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            maxRotation: 45,
            minRotation: 0,
            font: { size: 10 },
            color: isDark ? "#94a3b8" : "#64748b",
          },
        },
        y: {
          beginAtZero: true,
          suggestedMax: ySuggestedMax,
          ticks: {
            precision:
              yTickPrecision ??
              (ySuggestedMax != null ? 1 : 0),
            font: { size: 10 },
            color: isDark ? "#94a3b8" : "#64748b",
          },
          grid: {
            color: isDark ? "rgba(148,163,184,0.12)" : "rgba(148,163,184,0.2)",
          },
        },
      },
    }),
    [trimmed, isDark, datasetLabel, valueSuffix, ySuggestedMax, yTickPrecision]
  );

  if (!trimmed.length) {
    return (
      <div className="flex h-36 items-center justify-center text-xs text-slate-500 dark:text-slate-500">
        No weekly data yet
      </div>
    );
  }

  return (
    <div className="h-36 w-full">
      <Line data={data} options={options} />
    </div>
  );
}

export default function App() {
  const { isDark } = useTheme();
  const [fileName, setFileName] = useState("");
  const [fields, setFields] = useState([]);
  const [colMap, setColMap] = useState(null);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [hotspotsExpanded, setHotspotsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [dataTableSearch, setDataTableSearch] = useState("");
  const [dataTableZone, setDataTableZone] = useState("all");
  const [dataTableRca, setDataTableRca] = useState("all");
  const [dataTableCategory, setDataTableCategory] = useState("all");
  const [dataTablePage, setDataTablePage] = useState(0);
  const [pocProductivityExpanded, setPocProductivityExpanded] = useState(false);
  const [pdfExporting, setPdfExporting] = useState(false);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudSyncing, setCloudSyncing] = useState(false);
  const [cloudUpdatedAt, setCloudUpdatedAt] = useState(null);
  const exportRootRef = useRef(null);

  useEffect(() => {
    ChartJS.defaults.color = isDark ? "#94a3b8" : "#475569";
    ChartJS.defaults.borderColor = isDark
      ? "rgba(148, 163, 184, 0.18)"
      : "rgba(15, 23, 42, 0.08)";
  }, [isDark]);

  useEffect(() => {
    setHotspotsExpanded(false);
  }, [filter, fileName]);

  useEffect(() => {
    setDataTablePage(0);
  }, [dataTableSearch, dataTableZone, dataTableRca, dataTableCategory, fileName]);

  const colMapSafe = colMap ?? detectColumns(fields);

  const normalizedRows = useMemo(() => {
    const manifestCol = colMapSafe.manifest;
    if (!manifestCol) return rows;
    const pocCol = colMapSafe.poc;
    const seen = new Set();
    const unique = [];
    for (const r of rows) {
      const manifestId = String(r[manifestCol] ?? "").trim();
      if (!manifestId) continue;
      const remark = getRcaValue(r, colMapSafe, fields).trim().toLowerCase();
      const poc = pocCol ? String(r[pocCol] ?? "").trim().toLowerCase() : "";
      const key = `${manifestId}||${remark}||${poc}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(r);
    }
    return unique;
  }, [rows, colMapSafe, fields]);

  const annotated = useMemo(
    () =>
      annotateRows(normalizedRows, colMapSafe, fields).filter((r) => r.__kind !== "closed"),
    [normalizedRows, colMapSafe, fields]
  );

  const filtered = useMemo(
    () => applyFilter(annotated, filter),
    [annotated, filter]
  );

  const counts = useMemo(() => countByKind(annotated), [annotated]);

  const uniqueManifestCount = useMemo(() => {
    const manifestCol = colMapSafe.manifest;
    if (!manifestCol) return null;
    const manifests = new Set();
    for (const r of annotated) {
      const code = String(r[manifestCol] ?? "").trim();
      if (code) manifests.add(code);
    }
    return manifests.size;
  }, [annotated, colMapSafe.manifest]);

  const kpis = useMemo(() => {
    const total = uniqueManifestCount ?? annotated.length;
    const proper = counts.proper_bagging;
    const partial = counts.partial_bagging;
    const fraud = counts.lm_fraud;
    const camera = counts.camera_issues;
    const noFootage = counts.no_footage;
    const issueLike =
      partial +
      fraud +
      camera +
      noFootage +
      counts.offline +
      counts.multiple_bagging +
      counts.unable_to_validate +
      counts.other;
    return {
      total,
      proper,
      partial,
      fraud,
      camera,
      noFootage,
      issueLike,
      properRate: total ? ((proper / total) * 100).toFixed(1) : "0",
      issueRate: total ? ((issueLike / total) * 100).toFixed(1) : "0",
    };
  }, [annotated, counts, uniqueManifestCount]);

  const weeklyWeekKeys = useMemo(() => {
    const dc = colMapSafe.date;
    if (!dc) return [];
    return getFilledWeekKeysBetweenMinMax(annotated, dc);
  }, [annotated, colMapSafe.date]);

  const weeklyByIssue = useMemo(() => {
    const dc = colMapSafe.date;
    if (!dc) {
      return {
        dateCol: null,
        partial: [],
        fraud: [],
        camera: [],
      };
    }
    const wk = weeklyWeekKeys.length ? weeklyWeekKeys : null;
    return {
      dateCol: dc,
      partial: buildWeeklySeriesForKind(annotated, dc, "partial_bagging", wk ?? undefined),
      fraud: buildWeeklySeriesForKind(annotated, dc, "lm_fraud", wk ?? undefined),
      camera: buildWeeklySeriesForKind(annotated, dc, "camera_issues", wk ?? undefined),
    };
  }, [annotated, colMapSafe.date, weeklyWeekKeys]);

  const weeklyParseableCount = useMemo(() => {
    const dc = colMapSafe.date;
    if (!dc) return 0;
    let n = 0;
    for (const r of annotated) {
      if (parseFlexibleDate(r[dc])) n += 1;
    }
    return n;
  }, [annotated, colMapSafe.date]);

  const weeklyPivotRows = useMemo(
    () => (colMapSafe.date ? buildWeeklyPivotRows(annotated, colMapSafe.date) : []),
    [annotated, colMapSafe.date]
  );

  const pocProductivityList = useMemo(
    () => aggregatePocProductivity(annotated, colMapSafe.poc),
    [annotated, colMapSafe.poc]
  );

  const pocProductivityTop = useMemo(
    () => pocProductivityList.slice(0, POC_PRODUCTIVITY_CARD_LIMIT),
    [pocProductivityList]
  );

  const pocProductivityAggregates = useMemo(() => {
    let totalEligible = 0;
    let validRca = 0;
    for (const r of pocProductivityList) {
      totalEligible += r.totalEligible;
      validRca += r.validRca;
    }
    return {
      totalEligible,
      validRca,
      overallProductivityRatio:
        totalEligible > 0
          ? Math.round((validRca / totalEligible) * 1000) / 1000
          : null,
      pocCount: pocProductivityList.length,
    };
  }, [pocProductivityList]);

  const zonePairs = useMemo(
    () => aggregateByField(filtered, colMapSafe.zone, 8, { skipEmpty: true }),
    [filtered, colMapSafe.zone]
  );

  const rcaPairs = useMemo(() => aggregateRca(filtered, 8), [filtered]);

  const hotspotRows = useMemo(
    () => filterRowsForHotspots(filtered),
    [filtered]
  );

  const hotspotPairs = useMemo(
    () => aggregateByField(hotspotRows, colMapSafe.hub, 15),
    [hotspotRows, colMapSafe.hub]
  );

  const hotspotsVisiblePairs = useMemo(
    () =>
      hotspotsExpanded
        ? hotspotPairs
        : hotspotPairs.slice(0, HOTSPOTS_INITIAL_VISIBLE),
    [hotspotsExpanded, hotspotPairs]
  );

  const hotspotsHasMore = hotspotPairs.length > HOTSPOTS_INITIAL_VISIBLE;

  const partialHub = useMemo(
    () =>
      aggregateByField(
        issueSlice(annotated, filter, "partial_bagging"),
        colMapSafe.hub,
        10
      ),
    [annotated, filter, colMapSafe.hub]
  );

  const fraudHub = useMemo(
    () =>
      aggregateByField(
        issueSlice(annotated, filter, "lm_fraud"),
        colMapSafe.hub,
        10
      ),
    [annotated, filter, colMapSafe.hub]
  );

  const cameraHub = useMemo(
    () =>
      aggregateByField(
        issueSlice(annotated, filter, "camera_issues"),
        colMapSafe.hub,
        10
      ),
    [annotated, filter, colMapSafe.hub]
  );

  const recentIssuesSorted = useMemo(() => {
    const withRca = filtered.filter((r) => {
      if (r.__kind === "proper_bagging") return false;
      const text = getRcaValue(r, colMapSafe, fields);
      return text != null && String(text).trim() !== "";
    });
    const dateCol = colMapSafe.date;
    const openCol = colMapSafe.open;
    return [...withRca].sort((a, b) => {
      if (dateCol) {
        const da = parseFlexibleDate(a[dateCol]);
        const db = parseFlexibleDate(b[dateCol]);
        const ta = da ? da.getTime() : Number.NEGATIVE_INFINITY;
        const tb = db ? db.getTime() : Number.NEGATIVE_INFINITY;
        if (tb !== ta) return tb - ta;
      }
      if (openCol) {
        const oa = Number(String(a[openCol] ?? "").replace(/,/g, ""));
        const ob = Number(String(b[openCol] ?? "").replace(/,/g, ""));
        const na = Number.isFinite(oa) ? oa : 0;
        const nb = Number.isFinite(ob) ? ob : 0;
        if (nb !== na) return nb - na;
      }
      return 0;
    });
  }, [filtered, fields, colMapSafe.rca, colMapSafe.date, colMapSafe.open]);

  const recentRows = useMemo(
    () => recentIssuesSorted.slice(0, 12),
    [recentIssuesSorted]
  );

  const dataTableZoneOptions = useMemo(() => {
    const z = colMapSafe.zone;
    if (!z) return [];
    const set = new Set();
    for (const r of annotated) {
      const v = r[z];
      if (v != null && String(v).trim()) set.add(String(v).trim());
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [annotated, colMapSafe.zone]);

  const dataTableRcaOptions = useMemo(() => {
    const set = new Set();
    for (const r of annotated) {
      const v = getRcaValue(r, colMapSafe, fields).trim();
      if (v) set.add(v);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [annotated, colMapSafe, fields]);

  const dataTableCategoryKinds = useMemo(() => {
    const set = new Set(annotated.map((r) => r.__kind));
    return [...set].sort((a, b) =>
      (ISSUE_KIND_LABELS[a] ?? a).localeCompare(ISSUE_KIND_LABELS[b] ?? b)
    );
  }, [annotated]);

  const dataTableFiltered = useMemo(() => {
    const q = dataTableSearch.trim().toLowerCase();
    const m = colMapSafe.manifest;
    const h = colMapSafe.hub;
    const z = colMapSafe.zone;
    return annotated.filter((r) => {
      if (dataTableZone !== "all") {
        const zv = z ? String(r[z] ?? "").trim() : "";
        if (zv !== dataTableZone) return false;
      }
      if (dataTableRca !== "all") {
        const rv = getRcaValue(r, colMapSafe, fields).trim();
        if (rv !== dataTableRca) return false;
      }
      if (dataTableCategory !== "all" && r.__kind !== dataTableCategory) return false;
      if (q) {
        const manifestMatch = m && String(r[m] ?? "").toLowerCase().includes(q);
        const hubMatch = h && String(r[h] ?? "").toLowerCase().includes(q);
        if (!manifestMatch && !hubMatch) return false;
      }
      return true;
    });
  }, [
    annotated,
    colMapSafe,
    fields,
    dataTableSearch,
    dataTableZone,
    dataTableRca,
    dataTableCategory,
  ]);

  const donutData = useMemo(() => {
    const labels = zonePairs.map(([l]) => l);
    const data = zonePairs.map(([, v]) => v);
    const palette = ["#2563eb", "#ea580c", "#16a34a", "#7c3aed", "#0d9488", "#db2777", "#ca8a04", "#4f46e5"];
    return {
      labels,
      datasets: [
        {
          data,
          backgroundColor: labels.map((_, i) => palette[i % palette.length]),
          borderWidth: 2,
          borderColor: isDark ? "#0f172a" : "#ffffff",
          hoverOffset: 6,
        },
      ],
    };
  }, [zonePairs, isDark]);

  const donutOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      cutout: "62%",
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            boxWidth: 12,
            padding: 16,
            font: { size: 12 },
            color: isDark ? "#cbd5e1" : "#475569",
          },
        },
        tooltip: {
          backgroundColor: "rgba(15, 23, 42, 0.92)",
          padding: 12,
          cornerRadius: 8,
        },
      },
    }),
    [isDark]
  );

  const ingestParsed = useCallback((res, name) => {
    setError("");
    const f = res.meta.fields?.filter(Boolean) ?? [];
    if (!f.length) {
      setError("No columns found. Use a header row in your CSV.");
      return;
    }
    const data = (res.data ?? []).filter((r) =>
      f.some((key) => r[key] != null && String(r[key]).trim() !== "")
    );
    if (!data.length) {
      setError("No data rows in file.");
      return;
    }
    setFields(f);
    setColMap(detectColumns(f));
    setRows(data);
    setFileName(name);
    setFilter("all");
    setDataTableSearch("");
    setDataTableZone("all");
    setDataTableRca("all");
    setDataTableCategory("all");
    setDataTablePage(0);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let cancelled = false;
    (async () => {
      setCloudLoading(true);
      try {
        const row = await loadSnapshot();
        if (cancelled || !row?.csv_text?.trim()) return;
        Papa.parse(row.csv_text, {
          header: true,
          skipEmptyLines: true,
          complete: (res) => {
            if (cancelled) return;
            if (res.errors?.length) {
              setError(res.errors[0].message || "Could not parse cloud CSV.");
              return;
            }
            ingestParsed(res, row.file_name || "shared.csv");
            setCloudUpdatedAt(row.updated_at || new Date().toISOString());
          },
          error: (err) => {
            if (!cancelled) setError(err.message || "Cloud CSV read failed.");
          },
        });
      } catch (e) {
        if (!cancelled) setError(e.message || "Could not load cloud data.");
      } finally {
        if (!cancelled) setCloudLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ingestParsed]);

  const handleReset = useCallback(() => {
    setRows([]);
    setFields([]);
    setColMap(null);
    setFileName("");
    setError("");
    setFilter("all");
    setDataTableSearch("");
    setDataTableZone("all");
    setDataTableRca("all");
    setDataTableCategory("all");
    setDataTablePage(0);
    setActiveTab("dashboard");
  }, []);

  const handleExportPdf = useCallback(async () => {
    const el = exportRootRef.current;
    if (!el) return;
    setPdfExporting(true);
    try {
      window.scrollTo(0, 0);
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      );
      const { default: html2pdf } = await import("html2pdf.js");
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      await html2pdf()
        .set({
          margin: [10, 10, 10, 10],
          filename: `cctv-dashboard-${stamp}.pdf`,
          image: { type: "jpeg", quality: 0.95 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            logging: false,
            scrollY: -window.scrollY,
            scrollX: -window.scrollX,
            ignoreElements: (node) =>
              node instanceof HTMLElement &&
              node.getAttribute("data-html2pdf-ignore") === "true",
            onclone: (clonedDoc) => {
              clonedDoc.querySelectorAll("header").forEach((h) => {
                h.style.position = "relative";
                h.style.top = "0";
                h.style.zIndex = "0";
              });
            },
          },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
          pagebreak: { mode: ["css", "legacy"] },
        })
        .from(el)
        .save();
    } catch (err) {
      console.error(err);
      alert(
        "Could not create the PDF. If the page is very long, try zooming out or use the browser Print dialog → Save as PDF."
      );
    } finally {
      setPdfExporting(false);
    }
  }, []);

  const handleFile = useCallback(
    (file) => {
      if (!file?.name?.toLowerCase().endsWith(".csv")) {
        setError("Please upload a .csv file.");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const csvText = String(reader.result ?? "");
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          complete: async (res) => {
            if (res.errors?.length) {
              setError(res.errors[0].message || "Could not parse CSV.");
              return;
            }
            ingestParsed(res, file.name);
            if (isSupabaseConfigured()) {
              setCloudSyncing(true);
              try {
                await saveSnapshot(csvText, file.name);
                setCloudUpdatedAt(new Date().toISOString());
              } catch (e) {
                setError(
                  e.message ||
                    "Saved locally, but cloud sync failed. Check env keys and Supabase policies."
                );
              } finally {
                setCloudSyncing(false);
              }
            }
          },
          error: (err) => setError(err.message || "Read failed."),
        });
      };
      reader.onerror = () => setError("Could not read file.");
      reader.readAsText(file);
    },
    [ingestParsed]
  );

  const exportFields = fields;

  const pillCount = (id) => {
    if (id === "all") return annotated.length;
    return annotated.filter((r) => r.__kind === id).length;
  };

  const missingRca = !colMapSafe.rca;
  const missingDate = annotated.length > 0 && !colMapSafe.date;

  return (
    <div
      ref={exportRootRef}
      className="min-h-screen min-w-0 bg-slate-50 transition-colors duration-200 dark:bg-slate-950"
    >
      <header className="sticky top-0 z-50 border-b border-slate-200/90 bg-white/85 pt-[env(safe-area-inset-top,0px)] text-slate-900 shadow-sm backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/90 dark:text-slate-100 dark:shadow-[0_8px_32px_rgb(0_0_0/0.35)]">
        <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-3 px-3 py-3 sm:px-5 lg:flex-row lg:items-center lg:justify-between lg:px-6">
          <div className="min-w-0 flex-1">
            <h1 className="bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-base font-bold tracking-tight text-transparent dark:from-white dark:to-slate-400 xs:text-lg sm:text-xl">
              LM ODC - CCTV Dashboard
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 sm:text-xs">
              {isSupabaseConfigured()
                ? cloudLoading
                  ? "Loading shared snapshot from Supabase…"
                  : cloudSyncing
                    ? "Saving snapshot to Supabase…"
                    : "Cloud sync — latest upload is shared with everyone using this app"
                : "Real-time monitoring · local analysis"}
            </p>
            {cloudUpdatedAt && isSupabaseConfigured() && !cloudLoading ? (
              <p className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">
                Snapshot updated{" "}
                {new Date(cloudUpdatedAt).toLocaleString(undefined, {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </p>
            ) : null}
            {fileName ? (
              <p className="mt-1 truncate text-[11px] text-slate-500 dark:text-slate-500 sm:text-xs">
                {fileName} · {annotated.length.toLocaleString()} rows
              </p>
            ) : null}
          </div>
          <div className="flex min-w-0 w-full flex-col gap-2 xs:flex-row xs:flex-wrap xs:items-center xs:justify-between lg:w-auto lg:max-w-none lg:justify-end">
            <nav
              className="grid w-full min-w-0 grid-cols-2 gap-1 rounded-xl border border-slate-200/80 bg-slate-100/80 p-1 shadow-inner dark:border-slate-800/80 dark:bg-slate-900/90 xs:flex xs:w-auto xs:flex-none"
              role="tablist"
              aria-label="Main views"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "dashboard"}
                onClick={() => setActiveTab("dashboard")}
                className={`rounded-lg px-2 py-2.5 text-center text-xs font-semibold transition-all duration-200 sm:px-3.5 sm:py-2 sm:text-sm ${
                  activeTab === "dashboard"
                    ? "bg-white text-blue-700 shadow-md ring-1 ring-slate-200/80 dark:bg-gradient-to-b dark:from-blue-600 dark:to-blue-700 dark:text-white dark:shadow-btn-dark dark:ring-blue-500/30"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                Dashboard
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "data"}
                onClick={() => setActiveTab("data")}
                className={`rounded-lg px-2 py-2.5 text-center text-xs font-semibold transition-all duration-200 sm:px-3.5 sm:py-2 sm:text-sm ${
                  activeTab === "data"
                    ? "bg-white text-blue-700 shadow-md ring-1 ring-slate-200/80 dark:bg-gradient-to-b dark:from-blue-600 dark:to-blue-700 dark:text-white dark:shadow-btn-dark dark:ring-blue-500/30"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                Data Table
              </button>
            </nav>
            <div className="flex w-full min-w-0 flex-wrap items-center justify-center gap-1.5 xs:w-auto xs:justify-end sm:gap-2">
            <label
              className="btn-header-icon cursor-pointer"
              title="Upload CSV"
            >
              <UploadIcon />
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = "";
                }}
              />
            </label>
            <ThemeToggle />
            <button
              type="button"
              data-html2pdf-ignore="true"
              onClick={handleExportPdf}
              disabled={pdfExporting}
              aria-busy={pdfExporting}
              title="Download this page as PDF (layout, charts, and tables as shown)"
              className="btn-header-ghost"
            >
              <PdfIcon className="h-4 w-4" />
              <span className="hidden sm:inline">
                {pdfExporting ? "Building PDF…" : "Export PDF"}
              </span>
              <span className="sm:hidden">{pdfExporting ? "…" : "PDF"}</span>
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={!annotated.length}
              title="Clear loaded data"
              className="btn-header-ghost"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <path
                  d="M4 4v6h6M20 20v-6h-6M5 19A9 9 0 0019 5M19 19a9 9 0 00-14-4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Reset
            </button>
            {activeTab === "data" && annotated.length > 0 ? (
              <button
                type="button"
                onClick={() =>
                  downloadCsv(
                    "data-table-export.csv",
                    stripExportRows(dataTableFiltered, exportFields),
                    exportFields
                  )
                }
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-blue-500/25 bg-gradient-to-b from-blue-600 to-blue-700 px-3 py-2 text-xs font-semibold text-white shadow-md shadow-blue-900/20 transition-all duration-200 hover:from-blue-500 hover:to-blue-600 active:scale-[0.98] sm:min-h-0 sm:gap-2 sm:px-3.5 sm:text-sm dark:shadow-btn-dark"
              >
                <span>
                  <span className="sm:hidden">CSV</span>
                  <span className="hidden sm:inline">
                    Export ({shortCount(dataTableFiltered.length)})
                  </span>
                </span>
                <DownloadIcon className="h-4 w-4 shrink-0" />
              </button>
            ) : null}
            </div>
          </div>
        </div>
        {error ? (
          <div className="border-t border-amber-200/80 bg-amber-50 px-3 py-2 text-center text-xs text-amber-950 sm:px-6 sm:text-sm dark:border-amber-900/50 dark:bg-amber-950/50 dark:text-amber-100">
            {error}
          </div>
        ) : null}
      </header>

      <main
        className={
          activeTab === "data"
            ? "min-h-[calc(100vh-3.5rem)] w-full min-w-0 bg-slate-100 pb-20 dark:bg-slate-950 sm:pb-16"
            : "mx-auto w-full min-w-0 max-w-6xl space-y-4 bg-slate-100/80 px-3 py-4 pb-20 sm:space-y-5 sm:px-5 sm:py-6 sm:pb-16 md:px-6 dark:bg-transparent"
        }
      >
        {activeTab === "dashboard" ? (
          <>
            {!annotated.length ? (
              <div className="surface-card px-4 py-8 text-center text-sm text-slate-600 sm:px-6 sm:py-10 dark:text-slate-400">
                <p className="font-medium text-slate-800 dark:text-slate-100">No file loaded</p>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  Use the <strong className="text-slate-900 dark:text-slate-200">upload</strong> button in
                  the header to choose a CSV. Typical columns:{" "}
                  <strong className="text-slate-900 dark:text-slate-200">RCA</strong>,{" "}
                  <strong className="text-slate-900 dark:text-slate-200">Hub</strong>,{" "}
                  <strong className="text-slate-900 dark:text-slate-200">Zone</strong>,{" "}
                  <strong className="text-slate-900 dark:text-slate-200">Manifest</strong>, optional{" "}
                  <strong className="text-slate-900 dark:text-slate-200">Date</strong> for weekly trends.
                </p>
              </div>
            ) : null}

            {missingRca && annotated.length ? (
          <div className="rounded-xl border border-amber-200/90 bg-amber-50/95 px-4 py-3 text-sm text-amber-950 shadow-sm dark:border-amber-500/25 dark:bg-amber-950/35 dark:text-amber-100">
            No <strong>RCA</strong> column detected. Classification uses the first column:{" "}
            <strong>{fields[0]}</strong>. Rename or add an RCA column for best results.
          </div>
        ) : null}

        {missingDate && annotated.length ? (
          <div className="rounded-xl border border-dashed border-slate-300/90 bg-white/90 px-4 py-3 text-sm text-slate-600 shadow-sm dark:border-slate-600/60 dark:bg-slate-900/60 dark:text-slate-300">
            Add a <strong className="text-slate-800 dark:text-slate-100">Date</strong> column (aliases:{" "}
            <em>Created</em>, <em>Reported</em>, <em>Event date</em>, <em>Timestamp</em>, …) to unlock{" "}
            <span className="font-medium text-slate-800 dark:text-slate-100">week-over-week trends</span>{" "}
            for Partial Bagging, LM Fraud, and Camera issues.
          </div>
        ) : null}

        {annotated.length ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-3 rounded-2xl border border-red-200/90 bg-gradient-to-br from-red-50 to-white p-4 shadow-card dark:border-red-500/20 dark:from-red-950/50 dark:to-slate-900/40 dark:shadow-card-dark sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-lg text-red-700 shadow-inner dark:bg-red-500/20 dark:text-red-300">
                    ⚠
                  </span>
                  <div>
                    <p className="font-semibold text-red-900 dark:text-red-100">LM Fraud detected</p>
                    <p className="text-sm text-red-800 dark:text-red-200/90">{counts.lm_fraud} cases in file</p>
                  </div>
                </div>
                <DownloadBtn
                  count={issueSlice(annotated, "all", "lm_fraud").length}
                  label="Download LM fraud rows"
                  variant="red"
                  onClick={() =>
                    downloadCsv(
                      "lm-fraud-rows.csv",
                      stripExportRows(issueSlice(annotated, "all", "lm_fraud"), exportFields),
                      exportFields
                    )
                  }
                />
              </div>
              <div className="flex flex-col gap-3 rounded-2xl border border-amber-200/90 bg-gradient-to-br from-amber-50 to-white p-4 shadow-card dark:border-amber-500/20 dark:from-amber-950/40 dark:to-slate-900/40 dark:shadow-card-dark sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-lg font-bold text-amber-800 shadow-inner dark:bg-amber-500/20 dark:text-amber-200">
                    !
                  </span>
                  <div>
                    <p className="font-semibold text-amber-950 dark:text-amber-100">High Partial Bagging</p>
                    <p className="text-sm text-amber-900 dark:text-amber-200/90">
                      {counts.partial_bagging} cases in file
                    </p>
                  </div>
                </div>
                <DownloadBtn
                  count={issueSlice(annotated, "all", "partial_bagging").length}
                  label="Download partial bagging rows"
                  variant="amber"
                  onClick={() =>
                    downloadCsv(
                      "partial-bagging-rows.csv",
                      stripExportRows(
                        issueSlice(annotated, "all", "partial_bagging"),
                        exportFields
                      ),
                      exportFields
                    )
                  }
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {FILTER_DEFS.map((p) => {
                const active = filter === p.id;
                const c = pillCount(p.id);
                return (
                  <div
                    key={p.id}
                    className={`flex min-w-0 w-full flex-col gap-2 rounded-xl border px-2 py-2 shadow-sm transition-all xs:flex-row xs:items-center xs:gap-1 xs:rounded-full xs:px-1 xs:py-1 xs:pl-3 sm:w-auto ${
                      active
                        ? "border-blue-500/80 bg-blue-50 ring-2 ring-blue-200/80 dark:border-blue-500/50 dark:bg-blue-950/50 dark:ring-blue-500/30"
                        : "border-slate-200/90 bg-white/95 dark:border-slate-700/70 dark:bg-slate-900/70"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setFilter(p.id)}
                      className="min-w-0 py-1 text-left text-sm font-semibold text-slate-800 xs:text-center dark:text-slate-100 sm:text-center"
                    >
                      {p.label}{" "}
                      <span className="font-normal text-slate-500 dark:text-slate-400">({shortCount(c)})</span>
                    </button>
                    <DownloadBtn
                      count={c}
                      variant="slate"
                      label={`Download ${p.label}`}
                      onClick={() =>
                        downloadCsv(
                          `${p.id}-filter.csv`,
                          stripExportRows(applyFilter(annotated, p.id), exportFields),
                          exportFields
                        )
                      }
                    />
                  </div>
                );
              })}
            </div>

            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  title: "Total Records",
                  value: kpis.total,
                  sub: colMapSafe.manifest
                    ? `Unique ${colMapSafe.manifest} values`
                    : "All loaded rows",
                  icon: "📊",
                  tone: "text-blue-600 dark:text-blue-400",
                  dl: () =>
                    downloadCsv("all-records.csv", stripExportRows(annotated, exportFields), exportFields),
                },
                {
                  title: "Proper Bagging",
                  value: kpis.proper,
                  sub: `${kpis.properRate}% rate`,
                  icon: "✓",
                  tone: "text-emerald-600 dark:text-emerald-400",
                  dl: () =>
                    downloadCsv(
                      "proper-bagging.csv",
                      stripExportRows(
                        annotated.filter((r) => r.__kind === "proper_bagging"),
                        exportFields
                      ),
                      exportFields
                    ),
                },
                {
                  title: "Partial Bagging",
                  value: kpis.partial,
                  sub: "Watchlist",
                  icon: "📦",
                  tone: "text-orange-600 dark:text-orange-400",
                  dl: () =>
                    downloadCsv(
                      "partial-bagging-kpi.csv",
                      stripExportRows(
                        annotated.filter((r) => r.__kind === "partial_bagging"),
                        exportFields
                      ),
                      exportFields
                    ),
                },
                {
                  title: "LM Fraud",
                  value: kpis.fraud,
                  sub: "Escalations",
                  icon: "⚠",
                  tone: "text-red-600 dark:text-red-400",
                  dl: () =>
                    downloadCsv(
                      "lm-fraud-kpi.csv",
                      stripExportRows(
                        annotated.filter((r) => r.__kind === "lm_fraud"),
                        exportFields
                      ),
                      exportFields
                    ),
                },
                {
                  title: "Camera / CCTV issues",
                  value: kpis.camera,
                  sub: "Hardware / feed",
                  icon: "📹",
                  tone: "text-violet-600 dark:text-violet-400",
                  dl: () =>
                    downloadCsv(
                      "camera-issues.csv",
                      stripExportRows(
                        annotated.filter((r) => r.__kind === "camera_issues"),
                        exportFields
                      ),
                      exportFields
                    ),
                },
                {
                  title: "Total Issues",
                  value: kpis.issueLike,
                  sub: `${kpis.issueRate}% of records`,
                  icon: "✕",
                  tone: "text-slate-800 dark:text-slate-100",
                  dl: () =>
                    downloadCsv(
                      "total-issues.csv",
                      stripExportRows(
                        annotated.filter((r) =>
                          [
                            "partial_bagging",
                            "lm_fraud",
                            "camera_issues",
                            "no_footage",
                            "offline",
                            "multiple_bagging",
                            "unable_to_validate",
                            "other",
                          ].includes(r.__kind)
                        ),
                        exportFields
                      ),
                      exportFields
                    ),
                },
              ].map((k) => (
                <div key={k.title} className="surface-card relative">
                  <button
                    type="button"
                    onClick={k.dl}
                    className="absolute right-3 top-3 rounded-xl border border-slate-200/90 bg-white/80 p-1.5 text-slate-500 shadow-sm transition-all hover:border-slate-300 hover:bg-white hover:text-slate-800 sm:right-4 sm:top-4 sm:p-2 dark:border-slate-600/70 dark:bg-slate-800/60 dark:text-slate-400 dark:hover:border-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                    title="Download this segment"
                  >
                    <DownloadIcon className="h-4 w-4" />
                  </button>
                  <div className="flex items-start gap-2 pr-11 sm:gap-3 sm:pr-14">
                    <span className="shrink-0 text-xl sm:text-2xl">{k.icon}</span>
                    <div>
                      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{k.title}</p>
                      <p
                        className={`mt-1 text-2xl font-bold tabular-nums tracking-tight xs:text-3xl ${k.tone}`}
                      >
                        {k.value.toLocaleString()}
                      </p>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{k.sub}</p>
                    </div>
                  </div>
                </div>
              ))}
            </section>

            <div className="surface-card">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <button
                  type="button"
                  onClick={() => setPocProductivityExpanded((v) => !v)}
                  className="flex min-w-0 w-full flex-1 items-start gap-2 rounded-xl p-1 text-left transition-colors hover:bg-slate-50/90 sm:w-auto dark:hover:bg-slate-800/40"
                  aria-expanded={pocProductivityExpanded}
                  aria-controls="poc-productivity-details"
                  id="poc-productivity-toggle"
                >
                  <ChevronDownIcon
                    className="mt-0.5 h-5 w-5 text-slate-500 dark:text-slate-400"
                    expanded={pocProductivityExpanded}
                  />
                  <span className="min-w-0">
                    <span className="block text-base font-bold leading-snug text-slate-900 dark:text-slate-100 sm:text-lg">
                      POC productivity{" "}
                      <span className="font-semibold text-slate-500 dark:text-slate-400">(POC)</span>
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-slate-500 dark:text-slate-500 sm:text-xs">
                      {pocProductivityExpanded ? "Hide" : "Show"} charts
                    </span>
                  </span>
                </button>
                <div
                  className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                  role="presentation"
                >
                  {colMapSafe.poc && pocProductivityList.length > 0 ? (
                    <DownloadBtn
                      count={pocProductivityList.length}
                      variant="blue"
                      label="Download POC productivity summary"
                      onClick={() =>
                        downloadCsv(
                          "poc-productivity-summary.csv",
                          pocProductivityList.map((r) => ({
                            poc: r.poc,
                            total_eligible: r.totalEligible,
                            valid_rca: r.validRca,
                            productivity_pct:
                              r.productivityRatio != null
                                ? Math.round(r.productivityRatio * 10000) / 100
                                : "",
                          })),
                          ["poc", "total_eligible", "valid_rca", "productivity_pct"]
                        )
                      }
                    />
                  ) : null}
                </div>
              </div>

              {!colMapSafe.poc ? (
                <p className="mt-4 rounded-xl border border-dashed border-slate-300/90 bg-slate-50/80 px-4 py-6 text-sm text-slate-600 dark:border-slate-600/60 dark:bg-slate-800/30 dark:text-slate-400">
                  Add a column named <strong className="text-slate-800 dark:text-slate-200">POC</strong>,{" "}
                  <strong className="text-slate-800 dark:text-slate-200">Point of contact</strong>,{" "}
                  <strong className="text-slate-800 dark:text-slate-200">Owner</strong>, or{" "}
                  <strong className="text-slate-800 dark:text-slate-200">Assignee</strong> to enable this view.
                </p>
              ) : pocProductivityList.length === 0 ? (
                <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
                  No rows with a POC value in column <strong>{colMapSafe.poc}</strong>.
                </p>
              ) : (
                <>
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl border border-slate-200/90 bg-gradient-to-br from-emerald-50/90 to-white px-4 py-3 dark:border-emerald-900/40 dark:from-emerald-950/40 dark:to-slate-900/30">
                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300/90">
                        Overall productivity
                      </p>
                      <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                        {formatPocProductivityPercent(pocProductivityAggregates.overallProductivityRatio)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200/90 bg-slate-50/90 px-4 py-3 dark:border-slate-700/60 dark:bg-slate-800/40">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Total eligible
                      </p>
                      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
                        {pocProductivityAggregates.totalEligible.toLocaleString()}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200/90 bg-slate-50/90 px-4 py-3 dark:border-slate-700/60 dark:bg-slate-800/40">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Valid RCA cases
                      </p>
                      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
                        {pocProductivityAggregates.validRca.toLocaleString()}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200/90 bg-slate-50/90 px-4 py-3 dark:border-slate-700/60 dark:bg-slate-800/40">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        POCs in scope
                      </p>
                      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
                        {pocProductivityAggregates.pocCount.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 overflow-hidden rounded-xl border border-slate-200/90 dark:border-slate-700/60">
                    <div className="max-h-[min(22rem,55vh)] overflow-auto">
                      <table className="min-w-full text-left text-sm">
                        <thead>
                          <tr className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100/95 text-xs font-semibold uppercase tracking-wide text-slate-600 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-800/95 dark:text-slate-400">
                            <th className="px-3 py-2.5">POC</th>
                            <th className="px-3 py-2.5 text-right tabular-nums">Eligible</th>
                            <th className="px-3 py-2.5 text-right tabular-nums">Valid RCA</th>
                            <th className="px-3 py-2.5 text-right tabular-nums">Productivity %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pocProductivityList.map((row) => (
                            <tr
                              key={row.poc}
                              className="border-b border-slate-100 dark:border-slate-800/80"
                            >
                              <td className="max-w-[12rem] truncate px-3 py-2 font-medium text-slate-900 dark:text-slate-100">
                                {row.poc}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300">
                                {row.totalEligible.toLocaleString()}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300">
                                {row.validRca.toLocaleString()}
                              </td>
                              <td className="px-3 py-2 text-right font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                                {formatPocProductivityPercent(row.productivityRatio)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div
                    id="poc-productivity-details"
                    role="region"
                    aria-labelledby="poc-productivity-toggle"
                    hidden={!pocProductivityExpanded}
                    className={pocProductivityExpanded ? "mt-5 border-t border-slate-200/90 pt-5 dark:border-slate-700/60" : "hidden"}
                  >
                    <div className="space-y-4">
                      {pocProductivityTop.map((row, idx) => {
                        const series =
                          colMapSafe.date &&
                          buildWeeklyProductivitySeriesForPoc(
                            annotated,
                            colMapSafe.date,
                            colMapSafe.poc,
                            row.poc
                          );
                        const trend =
                          series && series.length
                            ? compareLatestWeeks(sliceLastWeeks(series, 52))
                            : {
                                direction: "none",
                                summary: colMapSafe.date
                                  ? "No weekly rows with valid RCA & parseable dates"
                                  : "Add a date column for weekly trends",
                                last:
                                  row.productivityRatio != null
                                    ? row.productivityRatio * 100
                                    : 0,
                                prev: null,
                              };
                        const colors = POC_SPARKLINE_PALETTE[idx % POC_SPARKLINE_PALETTE.length];
                        return (
                          <div
                            key={row.poc}
                            className="surface-muted flex flex-col gap-3 p-4 lg:flex-row lg:items-stretch lg:justify-between"
                          >
                            <div className="min-w-0 shrink-0 lg:max-w-sm">
                              <h3 className="truncate text-base font-bold text-slate-900 dark:text-slate-100">
                                {row.poc}
                              </h3>
                              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                                Eligible{" "}
                                <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-200">
                                  {row.totalEligible.toLocaleString()}
                                </span>
                                {" · "}
                                Valid RCA{" "}
                                <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-200">
                                  {row.validRca.toLocaleString()}
                                </span>
                                {" · "}
                                <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                                  {formatPocProductivityPercent(row.productivityRatio)}
                                </span>
                              </p>
                              <p
                                className={`mt-2 inline-flex w-fit max-w-full rounded-full px-2.5 py-1 text-xs font-semibold ${productivityTrendPillClass(
                                  trend.direction
                                )}`}
                              >
                                {trend.summary}
                              </p>
                            </div>
                            <div className="min-h-[9rem] min-w-0 flex-1 lg:max-w-xl">
                              {series && series.length > 0 ? (
                                <TrendSparkline
                                  series={series}
                                  borderColor={colors.border}
                                  fillColor={colors.fill}
                                  datasetLabel="Productivity %"
                                  yTickPrecision={1}
                                  ySuggestedMax={100}
                                />
                              ) : (
                                <div className="flex h-36 items-center justify-center rounded-xl border border-dashed border-slate-200/80 text-xs text-slate-500 dark:border-slate-600/60 dark:text-slate-500">
                                  {colMapSafe.date
                                    ? "No weekly rows with valid RCA & parseable dates for this POC."
                                    : "Add a date column to chart weekly productivity ratio."}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>

            {weeklyByIssue.dateCol ? (
              <div className="surface-card">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 sm:text-lg">
                      Weekly trends
                    </h2>
                  </div>
                  <DownloadBtn
                    count={weeklyPivotRows.length}
                    variant="blue"
                    label="Download weekly pivot CSV"
                    onClick={() =>
                      downloadCsv(
                        "weekly-trends-partial-fraud-camera.csv",
                        weeklyPivotRows,
                        ["week_start", "partial_bagging", "lm_fraud", "camera_issues"]
                      )
                    }
                  />
                </div>
                {weeklyParseableCount === 0 ? (
                  <p className="rounded-lg border border-amber-200/90 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-500/25 dark:bg-amber-950/35 dark:text-amber-100">
                    No values in <strong>{weeklyByIssue.dateCol}</strong> parsed as dates. Try
                    ISO dates (2025-03-15), DD/MM/YYYY, or Excel serial numbers.
                  </p>
                ) : (
                  <div className="grid gap-4 lg:grid-cols-3">
                    {[
                      {
                        title: "Partial Bagging",
                        icon: "📦",
                        series: weeklyByIssue.partial,
                        border: "rgb(234 88 12)",
                        fill: "rgba(234, 88, 12, 0.12)",
                        file: "weekly-partial-bagging.csv",
                        col: "partial_bagging_count",
                      },
                      {
                        title: "LM Fraud",
                        icon: "⚠",
                        series: weeklyByIssue.fraud,
                        border: "rgb(220 38 38)",
                        fill: "rgba(220, 38, 38, 0.12)",
                        file: "weekly-lm-fraud.csv",
                        col: "lm_fraud_count",
                      },
                      {
                        title: "Camera issues",
                        icon: "📹",
                        series: weeklyByIssue.camera,
                        border: "rgb(124 58 237)",
                        fill: "rgba(124, 58, 237, 0.12)",
                        file: "weekly-camera-issues.csv",
                        col: "camera_issues_count",
                      },
                    ].map((m) => {
                      const trend = compareLatestWeeks(m.series);
                      return (
                        <div
                          key={m.title}
                          className="surface-muted flex flex-col p-4"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
                              <span>{m.icon}</span>
                              {m.title}
                            </h3>
                            <button
                              type="button"
                              onClick={() =>
                                downloadCsv(
                                  m.file,
                                  m.series.map((s) => ({
                                    week_start: s.weekKey,
                                    [m.col]: s.count,
                                  })),
                                  ["week_start", m.col]
                                )
                              }
                              className="rounded-xl border border-slate-200/90 bg-white p-2 text-slate-500 shadow-sm transition-all hover:bg-slate-50 dark:border-slate-600/70 dark:bg-slate-800/80 dark:hover:bg-slate-800"
                              title="Download this series"
                            >
                              <DownloadIcon className="h-4 w-4" />
                            </button>
                          </div>
                          <p
                            className={`mt-2 inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${issueTrendPillClass(
                              trend.direction
                            )}`}
                          >
                            {trend.summary}
                          </p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
                            Latest week:{" "}
                            <span className="font-semibold text-slate-700 dark:text-slate-300">{trend.last}</span>
                            {trend.prev != null ? (
                              <>
                                {" "}
                                · Prior:{" "}
                                <span className="font-semibold text-slate-700 dark:text-slate-300">
                                  {trend.prev}
                                </span>
                              </>
                            ) : null}
                          </p>
                          <div className="mt-3 flex-1">
                            <TrendSparkline
                              series={m.series}
                              borderColor={m.border}
                              fillColor={m.fill}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}

            <div className="surface-card">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 sm:text-lg">
                  Zone Distribution
                </h2>
                <DownloadBtn
                  count={filtered.length}
                  variant="blue"
                  label="Download zone summary"
                  onClick={() => downloadAggregateCsv("zone-summary.csv", zonePairs)}
                />
              </div>
              <div className="grid gap-6 lg:grid-cols-2 lg:items-center">
                <div className="mx-auto h-52 w-full max-w-md xs:h-56 sm:h-64">
                  {zonePairs.length ? <Doughnut data={donutData} options={donutOptions} /> : (
                    <p className="flex h-full items-center justify-center text-slate-500 dark:text-slate-500">
                      No zone column or empty filter.
                    </p>
                  )}
                </div>
                <ul className="space-y-2">
                  {zonePairs.map(([z, n]) => (
                    <li
                      key={z}
                      className="surface-muted flex items-center justify-between px-3 py-2"
                    >
                      <span className="font-medium text-slate-800 dark:text-slate-200">{z}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-600 dark:text-slate-400">{shortCount(n)}</span>
                        <button
                          type="button"
                          className="rounded-xl border border-slate-200/90 bg-white/90 p-1.5 text-slate-500 shadow-sm transition-all hover:bg-white dark:border-slate-600/70 dark:bg-slate-800/80 dark:hover:bg-slate-800"
                          title={`Download rows for ${z}`}
                          onClick={() =>
                            downloadCsv(
                              `zone-${String(z).replace(/\W+/g, "_")}.csv`,
                              stripExportRows(
                                filtered.filter(
                                  (r) =>
                                    String(r[colMapSafe.zone] ?? "").trim() ===
                                    String(z).trim()
                                ),
                                exportFields
                              ),
                              exportFields
                            )
                          }
                        >
                          <DownloadIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="surface-card">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 sm:text-lg">
                  RCA Categories
                </h2>
                <DownloadBtn
                  count={rcaPairs.reduce((s, [, v]) => s + v, 0)}
                  variant="blue"
                  label="Download RCA summary"
                  onClick={() => downloadAggregateCsv("rca-summary.csv", rcaPairs)}
                />
              </div>
              <div className="h-56 min-h-[14rem] w-full min-w-0 sm:h-72 md:h-80">
                {rcaPairs.length ? (
                  <HorizontalBarChart
                    labels={rcaPairs.map(([l]) => l)}
                    values={rcaPairs.map(([, v]) => v)}
                    color="rgba(37, 99, 235, 0.85)"
                  />
                ) : (
                  <p className="flex h-full items-center justify-center text-slate-500 dark:text-slate-500">
                    No data for current filter.
                  </p>
                )}
              </div>
            </div>

            <div className="surface-card">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Issue Hotspots</h2>
                </div>
                <DownloadBtn
                  count={hotspotPairs.reduce((s, [, v]) => s + v, 0)}
                  variant="outline"
                  label="Download hotspot list"
                  onClick={() => downloadAggregateCsv("issue-hotspots.csv", hotspotPairs)}
                />
              </div>
              <ol className="space-y-2" aria-label="Issue hotspots by hub">
                {hotspotsVisiblePairs.map(([hub, n], i) => (
                  <li
                    key={hub}
                    className="surface-muted flex items-center justify-between px-3 py-2"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                          i === 0
                            ? "bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-200"
                            : "bg-slate-100 text-slate-600 dark:bg-slate-700/50 dark:text-slate-300"
                        }`}
                      >
                        {i + 1}
                      </span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">{hub}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums text-slate-600 dark:text-slate-400">{n}</span>
                      <button
                        type="button"
                        className="rounded-xl border border-slate-200/90 bg-white/90 p-1.5 text-slate-500 shadow-sm transition-all hover:bg-white dark:border-slate-600/70 dark:bg-slate-800/80 dark:hover:bg-slate-800"
                        onClick={() =>
                          downloadCsv(
                            `hub-${String(hub).replace(/\W+/g, "_")}-hotspot-rcas.csv`,
                            stripExportRows(
                              hotspotRows.filter(
                                (r) =>
                                  String(r[colMapSafe.hub] ?? "").trim() ===
                                  String(hub).trim()
                              ),
                              exportFields
                            ),
                            exportFields
                          )
                        }
                      >
                        <DownloadIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
              {hotspotsHasMore ? (
                <button
                  type="button"
                  className="mt-3 w-full rounded-xl border border-slate-200/90 bg-slate-50/90 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-100 dark:border-slate-600/70 dark:bg-slate-800/50 dark:text-slate-200 dark:hover:bg-slate-800"
                  aria-expanded={hotspotsExpanded}
                  onClick={() => setHotspotsExpanded((v) => !v)}
                >
                  {hotspotsExpanded
                    ? `Show top ${HOTSPOTS_INITIAL_VISIBLE} only`
                    : `Show all ${hotspotPairs.length} hubs`}
                </button>
              ) : null}
            </div>

            <div className="grid gap-4 lg:grid-cols-1">
              <ChartCard
                title="Partial Bagging by Hub"
                icon="📦"
                pairs={partialHub}
                color="rgba(234, 88, 12, 0.9)"
                onDownloadSummary={() =>
                  downloadAggregateCsv("partial-bagging-by-hub-summary.csv", partialHub)
                }
                onDownloadRows={() =>
                  downloadCsv(
                    "partial-bagging-by-hub-rows.csv",
                    stripExportRows(
                      issueSlice(annotated, filter, "partial_bagging"),
                      exportFields
                    ),
                    exportFields
                  )
                }
                rowCount={issueSlice(annotated, filter, "partial_bagging").length}
              />
              <ChartCard
                title="LM Fraud by Hub"
                icon="⚠"
                pairs={fraudHub}
                color="rgba(220, 38, 38, 0.9)"
                onDownloadSummary={() =>
                  downloadAggregateCsv("lm-fraud-by-hub-summary.csv", fraudHub)
                }
                onDownloadRows={() =>
                  downloadCsv(
                    "lm-fraud-by-hub-rows.csv",
                    stripExportRows(
                      issueSlice(annotated, filter, "lm_fraud"),
                      exportFields
                    ),
                    exportFields
                  )
                }
                rowCount={issueSlice(annotated, filter, "lm_fraud").length}
              />
              <ChartCard
                title="Camera Issues by Hub"
                icon="📹"
                pairs={cameraHub}
                color="rgba(124, 58, 237, 0.9)"
                onDownloadSummary={() =>
                  downloadAggregateCsv("camera-issues-by-hub-summary.csv", cameraHub)
                }
                onDownloadRows={() =>
                  downloadCsv(
                    "camera-issues-by-hub-rows.csv",
                    stripExportRows(
                      issueSlice(annotated, filter, "camera_issues"),
                      exportFields
                    ),
                    exportFields
                  )
                }
                rowCount={issueSlice(annotated, filter, "camera_issues").length}
              />
            </div>

            <div className="surface-card">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 sm:text-lg">
                    Recent Issues
                  </h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <DownloadBtn
                    count={recentIssuesSorted.length}
                    variant="dark"
                    label="Download problematic issues (sorted)"
                    onClick={() =>
                      downloadCsv(
                        "recent-issues-problematic-sorted.csv",
                        stripExportRows(recentIssuesSorted, exportFields),
                        exportFields
                      )
                    }
                  />
                </div>
              </div>
              <div className="-mx-1 overflow-x-auto rounded-xl border border-slate-100 px-1 dark:border-slate-700/60 sm:mx-0 sm:px-0">
                <table className="min-w-full text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-400 sm:text-xs">
                      {colMapSafe.manifest ? <th className="px-2 py-2 sm:px-3">Manifest</th> : null}
                      {colMapSafe.hub ? <th className="px-2 py-2 sm:px-3">Hub</th> : null}
                      {colMapSafe.zone ? <th className="px-2 py-2 sm:px-3">Zone</th> : null}
                      <th className="px-2 py-2 sm:px-3">RCA</th>
                      {colMapSafe.open ? <th className="px-2 py-2 sm:px-3">Open</th> : null}
                      <th className="px-2 py-2 sm:px-3"> </th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={10}
                          className="px-2 py-10 text-center text-xs text-slate-500 sm:px-3 sm:text-sm dark:text-slate-500"
                        >
                          No problematic rows (non–proper-bagging, non-blank RCA) for this filter.
                        </td>
                      </tr>
                    ) : (
                      recentRows.map((r, idx) => (
                        <tr
                          key={
                            colMapSafe.manifest
                              ? `${String(r[colMapSafe.manifest] ?? idx)}-${idx}`
                              : `${idx}-${String(r[colMapSafe.hub] ?? "")}-${getRcaValue(r, colMapSafe, fields)}`
                          }
                          className="border-b border-slate-100 hover:bg-slate-50/80 dark:border-slate-800/80 dark:hover:bg-slate-800/40"
                        >
                          {colMapSafe.manifest ? (
                            <td className="max-w-[8rem] truncate px-2 py-2 font-mono text-[10px] text-slate-800 sm:max-w-none sm:px-3 sm:text-xs dark:text-slate-200">
                              {r[colMapSafe.manifest] ?? "—"}
                            </td>
                          ) : null}
                          {colMapSafe.hub ? (
                            <td className="max-w-[6rem] truncate px-2 py-2 text-slate-700 sm:max-w-[10rem] sm:px-3 md:max-w-none dark:text-slate-300">
                              {r[colMapSafe.hub] ?? "—"}
                            </td>
                          ) : null}
                          {colMapSafe.zone ? (
                            <td className="px-2 py-2 sm:px-3">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${zoneBadgeClass(
                                  r[colMapSafe.zone]
                                )}`}
                              >
                                {r[colMapSafe.zone] ?? "—"}
                              </span>
                            </td>
                          ) : null}
                          <td className="max-w-[9rem] px-2 py-2 sm:max-w-[14rem] sm:px-3">
                            <span
                              className={`inline-flex max-w-full truncate rounded-full px-2 py-0.5 text-[10px] font-semibold sm:px-2.5 sm:text-xs ${rcaBadgeClass(
                                r.__kind
                              )}`}
                            >
                              {getRcaValue(r, colMapSafe, fields) || "—"}
                            </span>
                          </td>
                          {colMapSafe.open ? (
                            <td className="px-2 py-2 font-semibold tabular-nums text-red-600 sm:px-3 dark:text-red-400">
                              {r[colMapSafe.open] ?? "—"}
                            </td>
                          ) : null}
                          <td className="px-2 py-2 sm:px-3">
                            <button
                              type="button"
                              className="rounded-lg border border-slate-200/90 bg-white/90 p-1 text-slate-500 shadow-sm transition-all hover:bg-white sm:rounded-xl sm:p-1.5 dark:border-slate-600/70 dark:bg-slate-800/80 dark:hover:bg-slate-800"
                              title="Download this row"
                              onClick={() =>
                                downloadCsv(
                                  "issue-row.csv",
                                  stripExportRows([r], exportFields),
                                  exportFields
                                )
                              }
                            >
                              <DownloadIcon className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : null}
        </>
        ) : (
          <DataTableTab
            hasData={annotated.length > 0}
            colMapSafe={colMapSafe}
            fields={fields}
            exportFields={exportFields}
            search={dataTableSearch}
            setSearch={setDataTableSearch}
            zoneFilter={dataTableZone}
            setZoneFilter={setDataTableZone}
            rcaFilter={dataTableRca}
            setRcaFilter={setDataTableRca}
            categoryFilter={dataTableCategory}
            setCategoryFilter={setDataTableCategory}
            page={dataTablePage}
            setPage={setDataTablePage}
            zoneOptions={dataTableZoneOptions}
            rcaOptions={dataTableRcaOptions}
            categoryKinds={dataTableCategoryKinds}
            filteredRows={dataTableFiltered}
          />
        )}
      </main>
    </div>
  );
}

function ChartCard({
  title,
  icon,
  pairs,
  color,
  onDownloadSummary,
  onDownloadRows,
  rowCount,
}) {
  const summaryTotal = pairs.reduce((s, [, v]) => s + v, 0);
  return (
    <div className="surface-card">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <h2 className="flex min-w-0 items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100 sm:text-lg">
          <span className="shrink-0">{icon}</span>
          <span className="min-w-0 leading-snug">{title}</span>
        </h2>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <DownloadBtn
            count={summaryTotal}
            variant="slate"
            label="Summary CSV"
            onClick={onDownloadSummary}
          />
          <DownloadBtn count={rowCount} variant="orange" label="Rows CSV" onClick={onDownloadRows} />
        </div>
      </div>
      <div className="h-52 min-h-[13rem] w-full min-w-0 sm:h-64 md:h-72">
        {pairs.length ? (
          <HorizontalBarChart
            labels={pairs.map(([l]) => l)}
            values={pairs.map(([, v]) => v)}
            color={color}
          />
        ) : (
          <p className="flex h-full items-center justify-center text-slate-500 dark:text-slate-500">
            No rows for this issue with the current filter.
          </p>
        )}
      </div>
    </div>
  );
}
