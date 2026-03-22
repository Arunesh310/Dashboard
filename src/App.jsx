import { useCallback, useEffect, useMemo, useState } from "react";
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
  buildWeeklySeriesForKind,
  compareLatestWeeks,
  sliceLastWeeks,
  buildWeeklyPivotRows,
  parseFlexibleDate,
  filterRowsForHotspots,
  ISSUE_KIND_LABELS,
} from "./lib/analytics.js";
import { downloadCsv, shortCount } from "./lib/csvExport.js";
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
ChartJS.defaults.color = "#475569";

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

function DownloadBtn({ count, label, variant = "dark", onClick, disabled }) {
  const styles = {
    dark: "bg-slate-900 text-white hover:bg-slate-800",
    red: "bg-red-600 text-white hover:bg-red-700",
    amber: "bg-amber-500 text-white hover:bg-amber-600",
    blue: "bg-blue-600 text-white hover:bg-blue-700",
    slate: "bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-200",
    orange: "bg-orange-500 text-white hover:bg-orange-600",
    outline: "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50",
  };
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={label}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold shadow-sm transition disabled:opacity-40 ${styles[variant]}`}
    >
      <span>{shortCount(count)}</span>
      <DownloadIcon className="h-4 w-4 opacity-90" />
    </button>
  );
}

function zoneBadgeClass(zone) {
  const z = String(zone ?? "").toLowerCase();
  if (z.includes("north")) return "bg-sky-100 text-sky-800 ring-1 ring-sky-200";
  if (z.includes("east")) return "bg-amber-100 text-amber-900 ring-1 ring-amber-200";
  if (z.includes("west")) return "bg-violet-100 text-violet-800 ring-1 ring-violet-200";
  if (z.includes("south")) return "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200";
  return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
}

function rcaBadgeClass(kind) {
  if (kind === "partial_bagging")
    return "bg-orange-100 text-orange-900 ring-1 ring-orange-200";
  if (kind === "multiple_bagging")
    return "bg-amber-100 text-amber-950 ring-1 ring-amber-200";
  if (kind === "lm_fraud") return "bg-red-100 text-red-800 ring-1 ring-red-200";
  if (kind === "camera_issues")
    return "bg-violet-100 text-violet-800 ring-1 ring-violet-200";
  if (kind === "unable_to_validate")
    return "bg-yellow-100 text-yellow-950 ring-1 ring-yellow-200";
  return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
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

const FILTER_DEFS = [
  { id: "all", label: "All Data" },
  { id: "partial_bagging", label: "Partial Bagging" },
  { id: "lm_fraud", label: "LM Fraud" },
  { id: "no_footage", label: "No Footage" },
  { id: "camera_issues", label: "Camera Issues" },
];

const barGrid = {
  color: "rgba(148, 163, 184, 0.35)",
  borderDash: [4, 4],
};

function HorizontalBarChart({ labels, values, color }) {
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
          ticks: { font: { size: 12 } },
        },
        y: {
          grid: { display: false, drawBorder: false },
          ticks: { font: { size: 12 } },
        },
      },
    }),
    []
  );

  return <Bar data={data} options={options} />;
}

/** For issue metrics, “up” means worsening (more cases). */
function issueTrendPillClass(direction) {
  if (direction === "up") return "bg-red-50 text-red-800 ring-1 ring-red-100";
  if (direction === "down") return "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100";
  if (direction === "baseline" || direction === "none")
    return "bg-slate-50 text-slate-600 ring-1 ring-slate-200";
  return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
}

function TrendSparkline({ series, borderColor, fillColor }) {
  const trimmed = useMemo(() => sliceLastWeeks(series, 10), [series]);
  const data = useMemo(
    () => ({
      labels: trimmed.map((x) => x.label),
      datasets: [
        {
          label: "Cases",
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
    [trimmed, borderColor, fillColor]
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
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { maxRotation: 45, minRotation: 0, font: { size: 10 } },
        },
        y: {
          beginAtZero: true,
          ticks: { precision: 0, font: { size: 10 } },
          grid: { color: "rgba(148,163,184,0.2)" },
        },
      },
    }),
    [trimmed]
  );

  if (!trimmed.length) {
    return (
      <div className="flex h-36 items-center justify-center text-xs text-slate-400">
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

  useEffect(() => {
    setHotspotsExpanded(false);
  }, [filter, fileName]);

  useEffect(() => {
    setDataTablePage(0);
  }, [dataTableSearch, dataTableZone, dataTableRca, dataTableCategory, fileName]);

  const colMapSafe = colMap ?? detectColumns(fields);

  const annotated = useMemo(
    () => annotateRows(rows, colMapSafe, fields),
    [rows, colMapSafe, fields]
  );

  const filtered = useMemo(
    () => applyFilter(annotated, filter),
    [annotated, filter]
  );

  const counts = useMemo(() => countByKind(annotated), [annotated]);

  const kpis = useMemo(() => {
    const total = annotated.length;
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
  }, [annotated, counts]);

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
    return {
      dateCol: dc,
      partial: buildWeeklySeriesForKind(annotated, dc, "partial_bagging"),
      fraud: buildWeeklySeriesForKind(annotated, dc, "lm_fraud"),
      camera: buildWeeklySeriesForKind(annotated, dc, "camera_issues"),
    };
  }, [annotated, colMapSafe.date]);

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

  const zonePairs = useMemo(
    () => aggregateByField(filtered, colMapSafe.zone, 8),
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

  /** Problematic RCAs only: not closed, not proper bagging, non-blank; sorted date → Open desc. */
  const recentIssuesSorted = useMemo(() => {
    const withRca = filtered.filter((r) => {
      if (r.__kind === "closed" || r.__kind === "proper_bagging") return false;
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
          borderColor: "#fff",
          hoverOffset: 6,
        },
      ],
    };
  }, [zonePairs]);

  const donutOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      cutout: "62%",
      plugins: {
        legend: {
          position: "bottom",
          labels: { boxWidth: 12, padding: 16, font: { size: 12 } },
        },
        tooltip: {
          backgroundColor: "rgba(15, 23, 42, 0.92)",
          padding: 12,
          cornerRadius: 8,
        },
      },
    }),
    []
  );

  const onParsed = useCallback((res, name) => {
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

  const handleFile = useCallback((file) => {
    if (!file?.name?.toLowerCase().endsWith(".csv")) {
      setError("Please upload a .csv file.");
      return;
    }
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        if (res.errors?.length) {
          setError(res.errors[0].message || "Could not parse CSV.");
          return;
        }
        onParsed(res, file.name);
      },
      error: (err) => setError(err.message || "Read failed."),
    });
  }, [onParsed]);

  const exportFields = fields;

  const pillCount = (id) => {
    if (id === "all") return annotated.length;
    return annotated.filter((r) => r.__kind === id).length;
  };

  const missingRca = !colMapSafe.rca;
  const missingDate = annotated.length > 0 && !colMapSafe.date;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950 text-slate-100 shadow-md shadow-black/30">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="min-w-0 shrink-0">
            <h1 className="text-lg font-bold tracking-tight sm:text-xl">CCTV Dashboard</h1>
            <p className="text-xs text-slate-400">Real-time monitoring · local analysis</p>
            {fileName ? (
              <p className="mt-1 truncate text-xs text-slate-500">
                {fileName} · {annotated.length.toLocaleString()} rows
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <nav className="flex rounded-lg bg-slate-900 p-1" role="tablist" aria-label="Main views">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "dashboard"}
                onClick={() => setActiveTab("dashboard")}
                className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${
                  activeTab === "dashboard"
                    ? "bg-blue-600 text-white shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Dashboard
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "data"}
                onClick={() => setActiveTab("data")}
                className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${
                  activeTab === "data"
                    ? "bg-blue-600 text-white shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Data Table
              </button>
            </nav>
            <label
              className="flex cursor-pointer items-center justify-center rounded-lg border border-slate-700 p-2 text-slate-300 transition hover:border-slate-600 hover:bg-slate-800 hover:text-white"
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
            <button
              type="button"
              onClick={handleReset}
              disabled={!annotated.length}
              title="Clear loaded data"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-slate-800 disabled:opacity-35"
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
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow hover:bg-blue-500"
              >
                <span>Export ({shortCount(dataTableFiltered.length)})</span>
                <DownloadIcon className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>
        {error ? (
          <div className="border-t border-amber-900/40 bg-amber-950/60 px-4 py-2 text-center text-sm text-amber-100 sm:px-6">
            {error}
          </div>
        ) : null}
      </header>

      <main
        className={
          activeTab === "data"
            ? "min-h-[calc(100vh-3.5rem)] bg-slate-950 pb-16"
            : "mx-auto max-w-6xl space-y-5 bg-slate-50 px-4 py-6 pb-16 sm:px-6"
        }
      >
        {activeTab === "dashboard" ? (
          <>
            {!annotated.length ? (
              <div className="rounded-xl border border-slate-200 bg-white px-6 py-10 text-center text-slate-600 shadow-card">
                <p className="font-medium text-slate-800">No file loaded</p>
                <p className="mt-2 text-sm text-slate-600">
                  Use the <strong>upload</strong> button in the header to choose a CSV. Typical columns:{" "}
                  <strong>RCA</strong>, <strong>Hub</strong>, <strong>Zone</strong>,{" "}
                  <strong>Manifest</strong>, optional <strong>Date</strong> for weekly trends.
                </p>
              </div>
            ) : null}

            {missingRca && annotated.length ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            No <strong>RCA</strong> column detected. Classification uses the first column:{" "}
            <strong>{fields[0]}</strong>. Rename or add an RCA column for best results.
          </div>
        ) : null}

        {missingDate && annotated.length ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
            Add a <strong>Date</strong> column (aliases: <em>Created</em>, <em>Reported</em>,{" "}
            <em>Event date</em>, <em>Timestamp</em>, …) to unlock{" "}
            <span className="font-medium text-slate-800">week-over-week trends</span> for Partial
            Bagging, LM Fraud, and Camera issues.
          </div>
        ) : null}

        {annotated.length ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-700">
                    ⚠
                  </span>
                  <div>
                    <p className="font-semibold text-red-900">LM Fraud detected</p>
                    <p className="text-sm text-red-800">{counts.lm_fraud} cases in file</p>
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
              <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-800">
                    !
                  </span>
                  <div>
                    <p className="font-semibold text-amber-950">High Partial Bagging</p>
                    <p className="text-sm text-amber-900">
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

            <div className="flex flex-wrap gap-2">
              {FILTER_DEFS.map((p) => {
                const active = filter === p.id;
                const c = pillCount(p.id);
                return (
                  <div
                    key={p.id}
                    className={`flex items-center gap-1 rounded-full border px-1 py-1 pl-3 shadow-sm ${
                      active
                        ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setFilter(p.id)}
                      className="py-1 text-sm font-semibold text-slate-800"
                    >
                      {p.label}{" "}
                      <span className="font-normal text-slate-500">({shortCount(c)})</span>
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
                  sub: "All loaded rows",
                  icon: "📊",
                  tone: "text-blue-600",
                  dl: () =>
                    downloadCsv("all-records.csv", stripExportRows(annotated, exportFields), exportFields),
                },
                {
                  title: "Proper Bagging",
                  value: kpis.proper,
                  sub: `${kpis.properRate}% rate`,
                  icon: "✓",
                  tone: "text-emerald-600",
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
                  tone: "text-orange-600",
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
                  tone: "text-red-600",
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
                  tone: "text-violet-600",
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
                  tone: "text-slate-800",
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
                <div
                  key={k.title}
                  className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-card"
                >
                  <button
                    type="button"
                    onClick={k.dl}
                    className="absolute right-4 top-4 rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50"
                    title="Download this segment"
                  >
                    <DownloadIcon className="h-4 w-4" />
                  </button>
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{k.icon}</span>
                    <div>
                      <p className="text-sm font-medium text-slate-500">{k.title}</p>
                      <p className={`mt-1 text-3xl font-bold tracking-tight ${k.tone}`}>
                        {k.value.toLocaleString()}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">{k.sub}</p>
                    </div>
                  </div>
                </div>
              ))}
            </section>

            {weeklyByIssue.dateCol ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Weekly trends</h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Week starts Monday · compared to the previous week with data · column{" "}
                      <span className="font-semibold text-slate-800">{weeklyByIssue.dateCol}</span>
                    </p>
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
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
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
                          className="flex flex-col rounded-xl border border-slate-100 bg-slate-50/80 p-4"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
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
                              className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-50"
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
                          <p className="mt-1 text-xs text-slate-500">
                            Latest week: <span className="font-semibold text-slate-700">{trend.last}</span>
                            {trend.prev != null ? (
                              <>
                                {" "}
                                · Prior:{" "}
                                <span className="font-semibold text-slate-700">{trend.prev}</span>
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

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-slate-900">Zone Distribution</h2>
                <DownloadBtn
                  count={filtered.length}
                  variant="blue"
                  label="Download zone summary"
                  onClick={() => downloadAggregateCsv("zone-summary.csv", zonePairs)}
                />
              </div>
              <div className="grid gap-6 lg:grid-cols-2 lg:items-center">
                <div className="h-64">
                  {zonePairs.length ? <Doughnut data={donutData} options={donutOptions} /> : (
                    <p className="flex h-full items-center justify-center text-slate-500">
                      No zone column or empty filter.
                    </p>
                  )}
                </div>
                <ul className="space-y-2">
                  {zonePairs.map(([z, n]) => (
                    <li
                      key={z}
                      className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
                    >
                      <span className="font-medium text-slate-800">{z}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-600">{shortCount(n)}</span>
                        <button
                          type="button"
                          className="rounded-lg border border-slate-200 p-1 text-slate-500 hover:bg-white"
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

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-slate-900">RCA Categories</h2>
                <DownloadBtn
                  count={rcaPairs.reduce((s, [, v]) => s + v, 0)}
                  variant="blue"
                  label="Download RCA summary"
                  onClick={() => downloadAggregateCsv("rca-summary.csv", rcaPairs)}
                />
              </div>
              <div className="h-80">
                {rcaPairs.length ? (
                  <HorizontalBarChart
                    labels={rcaPairs.map(([l]) => l)}
                    values={rcaPairs.map(([, v]) => v)}
                    color="rgba(37, 99, 235, 0.85)"
                  />
                ) : (
                  <p className="flex h-full items-center justify-center text-slate-500">
                    No data for current filter.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Issue Hotspots</h2>
                  <p className="mt-1 max-w-xl text-sm text-slate-600">
                    Hubs ranked by count of{" "}
                    <span className="font-medium text-slate-800">
                      Partial Bagging, LM Fraud, Camera issues, Multiple bagging
                    </span>
                    , and <span className="font-medium text-slate-800">Unable to validate</span>{" "}
                    only (top 15). Respects your filter pills above. Showing{" "}
                    {hotspotsHasMore && !hotspotsExpanded
                      ? `first ${HOTSPOTS_INITIAL_VISIBLE} of ${hotspotPairs.length}`
                      : `${hotspotPairs.length}`}{" "}
                    hub{hotspotPairs.length === 1 ? "" : "s"}.
                  </p>
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
                    className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                          i === 0 ? "bg-orange-100 text-orange-800" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {i + 1}
                      </span>
                      <span className="font-medium text-slate-800">{hub}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums text-slate-600">{n}</span>
                      <button
                        type="button"
                        className="rounded-lg border border-slate-200 p-1 text-slate-500 hover:bg-slate-50"
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
                  className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
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

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Recent Issues</h2>
                  <p className="mt-1 max-w-2xl text-sm text-slate-600">
                    Problematic issues only: excludes <span className="font-medium text-slate-800">closed</span>,{" "}
                    <span className="font-medium text-slate-800">proper bagging</span>, and blank RCAs. Sorted
                    descending:{" "}
                    <span className="font-medium text-slate-800">
                      {colMapSafe.date
                        ? `newest ${colMapSafe.date} first`
                        : colMapSafe.open
                          ? `highest ${colMapSafe.open} first`
                          : "original order among ties"}
                    </span>
                    {colMapSafe.date && colMapSafe.open
                      ? `, then by ${colMapSafe.open}`
                      : null}
                    . Showing up to 12 rows.
                  </p>
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
              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {colMapSafe.manifest ? <th className="px-3 py-2">Manifest</th> : null}
                      {colMapSafe.hub ? <th className="px-3 py-2">Hub</th> : null}
                      {colMapSafe.zone ? <th className="px-3 py-2">Zone</th> : null}
                      <th className="px-3 py-2">RCA</th>
                      {colMapSafe.open ? <th className="px-3 py-2">Open</th> : null}
                      <th className="px-3 py-2"> </th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={10}
                          className="px-3 py-10 text-center text-sm text-slate-500"
                        >
                          No problematic rows (non-closed, non-proper-bagging, non-blank RCA) for this filter.
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
                          className="border-b border-slate-100 hover:bg-slate-50/80"
                        >
                          {colMapSafe.manifest ? (
                            <td className="px-3 py-2 font-mono text-xs text-slate-800">
                              {r[colMapSafe.manifest] ?? "—"}
                            </td>
                          ) : null}
                          {colMapSafe.hub ? (
                            <td className="px-3 py-2 text-slate-700">{r[colMapSafe.hub] ?? "—"}</td>
                          ) : null}
                          {colMapSafe.zone ? (
                            <td className="px-3 py-2">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${zoneBadgeClass(
                                  r[colMapSafe.zone]
                                )}`}
                              >
                                {r[colMapSafe.zone] ?? "—"}
                              </span>
                            </td>
                          ) : null}
                          <td className="px-3 py-2">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${rcaBadgeClass(
                                r.__kind
                              )}`}
                            >
                              {getRcaValue(r, colMapSafe, fields) || "—"}
                            </span>
                          </td>
                          {colMapSafe.open ? (
                            <td className="px-3 py-2 font-semibold text-red-600 tabular-nums">
                              {r[colMapSafe.open] ?? "—"}
                            </td>
                          ) : null}
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              className="rounded-lg border border-slate-200 p-1 text-slate-500 hover:bg-white"
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
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
          <span>{icon}</span>
          {title}
        </h2>
        <div className="flex flex-wrap gap-2">
          <DownloadBtn
            count={summaryTotal}
            variant="slate"
            label="Summary CSV"
            onClick={onDownloadSummary}
          />
          <DownloadBtn count={rowCount} variant="orange" label="Rows CSV" onClick={onDownloadRows} />
        </div>
      </div>
      <div className="h-72">
        {pairs.length ? (
          <HorizontalBarChart
            labels={pairs.map(([l]) => l)}
            values={pairs.map(([, v]) => v)}
            color={color}
          />
        ) : (
          <p className="flex h-full items-center justify-center text-slate-500">
            No rows for this issue with the current filter.
          </p>
        )}
      </div>
    </div>
  );
}
