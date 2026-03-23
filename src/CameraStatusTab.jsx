import { forwardRef, useMemo } from "react";
import { Bar, Doughnut } from "react-chartjs-2";
import { useTheme } from "./theme.jsx";
import {
  aggregatePod,
  aggregateZone,
  filterCameraStatusRows,
  rcaOfflineBreakdownEnriched,
  rcaAllBreakdown,
  summarizeCameras,
} from "./lib/cameraStatus.js";
import { downloadCsv, shortCount } from "./lib/csvExport.js";

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

function rcaPillClass(remark) {
  const s = String(remark ?? "").toLowerCase();
  if (s === "unknown" || s === "—" || s === "")
    return "bg-slate-100 text-slate-800 ring-1 ring-slate-200/80 dark:bg-slate-600/35 dark:text-slate-200 dark:ring-slate-500/45";
  if (s.includes("power") || s.includes("electric"))
    return "bg-amber-100 text-amber-950 ring-1 ring-amber-200/80 dark:bg-amber-500/15 dark:text-amber-100 dark:ring-amber-400/35";
  if (s.includes("network") || s.includes("link") || s.includes("cable"))
    return "bg-sky-100 text-sky-900 ring-1 ring-sky-200/80 dark:bg-sky-500/15 dark:text-sky-200 dark:ring-sky-400/35";
  if (s.includes("hardware") || s.includes("fault") || s.includes("defect"))
    return "bg-red-100 text-red-900 ring-1 ring-red-200/80 dark:bg-red-500/15 dark:text-red-200 dark:ring-red-400/35";
  return "bg-violet-100 text-violet-900 ring-1 ring-violet-200/80 dark:bg-violet-500/15 dark:text-violet-200 dark:ring-violet-400/35";
}

function DownloadBtn({ count, label, variant = "dark", onClick, disabled }) {
  const styles = {
    dark:
      "border border-slate-700/70 bg-gradient-to-b from-slate-700 to-slate-900 text-white shadow-btn hover:from-slate-600 hover:to-slate-800 hover:shadow-md dark:border-slate-600/40 dark:from-slate-600 dark:to-slate-950 dark:shadow-btn-dark dark:hover:from-slate-500 dark:hover:to-slate-900",
    blue:
      "border border-blue-500/25 bg-gradient-to-b from-blue-600 to-blue-700 text-white shadow-md shadow-blue-900/15 hover:from-blue-500 hover:to-blue-600",
    slate:
      "border border-slate-200/90 bg-white text-slate-800 shadow-sm hover:border-slate-300 hover:bg-slate-50 dark:border-slate-600/60 dark:bg-slate-800/80 dark:text-slate-100 dark:hover:bg-slate-700/80",
    outline:
      "border border-slate-200/90 bg-white/95 text-slate-700 shadow-sm hover:border-slate-300 hover:bg-white dark:border-slate-600/70 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-800/80",
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

function KpiDownload({ title, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="absolute right-3 top-3 rounded-xl border border-slate-200/90 bg-white/80 p-1.5 text-slate-500 shadow-sm transition-all hover:border-slate-300 hover:bg-white hover:text-slate-800 sm:right-4 sm:top-4 sm:p-2 dark:border-slate-600/70 dark:bg-slate-800/60 dark:text-slate-400 dark:hover:border-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
    >
      <DownloadIcon className="h-4 w-4" />
    </button>
  );
}

function ZoneOfflineBarChart({ labels, values }) {
  const { isDark } = useTheme();
  const color = "rgb(234 88 12)";
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
    [labels, values]
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
          callbacks: {
            label: (ctx) => ` ${Number(ctx.raw).toFixed(1)}% offline`,
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          max: 100,
          grid: { ...barGrid, drawBorder: false },
          ticks: {
            font: { size: 12 },
            color: isDark ? "#94a3b8" : "#64748b",
            callback: (v) => `${v}%`,
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

function filterLabel(v, allLabel = "All") {
  if (v === "all" || v === "") return allLabel;
  return v || "—";
}

export const CameraStatusTab = forwardRef(function CameraStatusTab(
  {
    allRows,
    zoneOptions,
    podOptions,
    zoneFilter,
    setZoneFilter,
    podFilter,
    setPodFilter,
    statusFilter,
    setStatusFilter,
    onDownloadDetailed,
    onDownloadFiltered,
  },
  ref
) {
  const { isDark } = useTheme();

  const filtered = useMemo(
    () =>
      filterCameraStatusRows(allRows, {
        zone: zoneFilter,
        pod: podFilter,
        status: statusFilter,
      }),
    [allRows, zoneFilter, podFilter, statusFilter]
  );

  const onlineRows = useMemo(() => filtered.filter((r) => r.isOnline), [filtered]);
  const offlineRows = useMemo(() => filtered.filter((r) => r.isOffline), [filtered]);

  const kpis = useMemo(() => summarizeCameras(filtered), [filtered]);
  const zoneAgg = useMemo(() => aggregateZone(filtered), [filtered]);
  const podAgg = useMemo(() => aggregatePod(filtered), [filtered]);
  const rcaOfflineEnriched = useMemo(() => rcaOfflineBreakdownEnriched(filtered), [filtered]);
  const rcaAllView = useMemo(() => rcaAllBreakdown(filtered), [filtered]);

  const selectClass =
    "w-full min-w-0 rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 xs:min-w-[7.5rem] xs:w-auto sm:min-w-[8.5rem] dark:border-slate-600/80 dark:bg-slate-900/90 dark:text-slate-200 dark:focus:border-blue-400 dark:focus:ring-blue-400/25";

  const donutData = useMemo(
    () => ({
      labels: ["Online", "Offline"],
      datasets: [
        {
          data: [kpis.online, kpis.offline],
          backgroundColor: ["#16a34a", "#dc2626"],
          borderWidth: 2,
          borderColor: isDark ? "#0f172a" : "#ffffff",
          hoverOffset: 6,
        },
      ],
    }),
    [kpis, isDark]
  );

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
          callbacks: {
            label: (ctx) => {
              const total = (ctx.dataset.data || []).reduce((a, b) => a + b, 0);
              const n = Number(ctx.raw) || 0;
              const pct = total ? ((n / total) * 100).toFixed(1) : "0";
              return ` ${n.toLocaleString()} (${pct}%)`;
            },
          },
        },
      },
    }),
    [isDark]
  );

  const zoneBarLabels = useMemo(() => zoneAgg.map((z) => z.zone), [zoneAgg]);
  const zoneBarValues = useMemo(() => zoneAgg.map((z) => z.offlinePct), [zoneAgg]);

  const downloadZoneRow = (zone) => {
    const subset = filtered.filter((r) => (r.zone || "—") === zone);
    onDownloadFiltered(subset, `camera-status-zone-${String(zone).replace(/\W+/g, "_")}.csv`);
  };

  const downloadPodRow = (pod) => {
    const subset = filtered.filter((r) => (r.pod || "—") === pod);
    onDownloadFiltered(subset, `camera-status-pod-${String(pod).replace(/\W+/g, "_")}.csv`);
  };

  const downloadRcaOfflineRow = (remark) => {
    const subset = offlineRows.filter((r) => (r.rca || "").trim() === remark);
    const safe = String(remark).replace(/\W+/g, "_").slice(0, 80);
    onDownloadFiltered(subset, `camera-status-rca-offline-${safe}.csv`);
  };

  const exportSnapshotSummary = () => {
    downloadCsv(
      "camera-status-snapshot-summary.csv",
      [
        {
          Scope: "Current view",
          Zone_filter: filterLabel(zoneFilter),
          POD_filter: filterLabel(podFilter),
          Status_filter: filterLabel(statusFilter, "All statuses"),
          Total_cameras: kpis.total,
          Online: kpis.online,
          Offline: kpis.offline,
          Offline_pct: Math.round(kpis.offlinePct * 100) / 100,
          Online_pct: Math.round(kpis.onlinePct * 100) / 100,
          Unique_RCA_offline: rcaOfflineEnriched.length,
        },
      ],
      [
        "Scope",
        "Zone_filter",
        "POD_filter",
        "Status_filter",
        "Total_cameras",
        "Online",
        "Offline",
        "Offline_pct",
        "Online_pct",
        "Unique_RCA_offline",
      ]
    );
  };

  const exportStatusMix = () => {
    downloadCsv(
      "camera-status-connectivity-mix.csv",
      [
        { Status: "Online", Count: kpis.online, Pct_of_view: Math.round(kpis.onlinePct * 100) / 100 },
        { Status: "Offline", Count: kpis.offline, Pct_of_view: Math.round(kpis.offlinePct * 100) / 100 },
      ],
      ["Status", "Count", "Pct_of_view"]
    );
  };

  const exportZoneChartData = () => {
    downloadCsv(
      "camera-status-zone-offline-pct-chart-data.csv",
      zoneAgg.map((z) => ({
        Zone: z.zone,
        Offline_pct: Math.round(z.offlinePct * 100) / 100,
        Offline_count: z.offline,
        Total: z.total,
      })),
      ["Zone", "Offline_pct", "Offline_count", "Total"]
    );
  };

  const exportRcaOfflineDetailed = () => {
    downloadCsv(
      "camera-status-rca-offline-full.csv",
      rcaOfflineEnriched.map((x) => ({
        RCA_Remark: x.remark,
        Offline_cameras: x.count,
        Pct_of_all_offline: Math.round(x.pctOfOffline * 100) / 100,
        Pct_of_current_view: Math.round(x.pctOfView * 100) / 100,
      })),
      ["RCA_Remark", "Offline_cameras", "Pct_of_all_offline", "Pct_of_current_view"]
    );
  };

  const exportRcaAllCameras = () => {
    downloadCsv(
      "camera-status-rca-all-cameras.csv",
      rcaAllView.map((x) => ({
        RCA_Remark: x.remark,
        Cameras: x.count,
        Pct_of_current_view: Math.round(x.pctOfView * 100) / 100,
      })),
      ["RCA_Remark", "Cameras", "Pct_of_current_view"]
    );
  };

  if (!allRows.length) {
    return (
      <div ref={ref}>
        <div className="surface-card px-4 py-8 text-center text-sm text-slate-600 sm:px-6 sm:py-10 dark:text-slate-400">
          <p className="font-medium text-slate-800 dark:text-slate-100">No camera status file loaded</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} className="space-y-4 sm:space-y-5">
      <div className="surface-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 sm:text-lg">Filters</h2>
          <div className="flex flex-wrap gap-2 sm:shrink-0 sm:justify-end">
            <button
              type="button"
              onClick={exportSnapshotSummary}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 dark:border-slate-600/70 dark:bg-slate-800/80 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              <DownloadIcon className="h-3.5 w-3.5" />
              Snapshot CSV
            </button>
          </div>
        </div>
        <div className="mt-4 grid w-full grid-cols-1 gap-2 xs:grid-cols-2 sm:flex sm:flex-wrap">
          <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
            <span className="text-slate-600 dark:text-slate-400">Zone</span>
            <select
              value={zoneFilter}
              onChange={(e) => setZoneFilter(e.target.value)}
              className={selectClass}
              aria-label="Filter by zone"
            >
              <option value="all">All</option>
              {zoneOptions.map((z) => (
                <option key={z} value={z}>
                  {z || "—"}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
            <span className="text-slate-600 dark:text-slate-400">POD</span>
            <select
              value={podFilter}
              onChange={(e) => setPodFilter(e.target.value)}
              className={selectClass}
              aria-label="Filter by POD"
            >
              <option value="all">All</option>
              {podOptions.map((p) => (
                <option key={p} value={p}>
                  {p || "—"}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
            <span className="text-slate-600 dark:text-slate-400">Status</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={selectClass}
              aria-label="Filter by status"
            >
              <option value="all">All</option>
              <option value="online">Online</option>
              <option value="offline">Offline</option>
            </select>
          </label>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            title: "Total Cameras",
            value: kpis.total,
            sub: "Current view",
            icon: "📹",
            tone: "text-blue-600 dark:text-blue-400",
            onDl: () => onDownloadFiltered(filtered, "camera-status-all-in-view.csv"),
            dlTitle: "Download all cameras in current view",
          },
          {
            title: "Online",
            value: kpis.online,
            sub: `${kpis.onlinePct.toFixed(1)}% of view`,
            icon: "✓",
            tone: "text-emerald-600 dark:text-emerald-400",
            onDl: () => onDownloadFiltered(onlineRows, "camera-status-online.csv"),
            dlTitle: "Download online cameras",
          },
          {
            title: "Offline",
            value: kpis.offline,
            sub: `${kpis.offlinePct.toFixed(1)}% of view`,
            icon: "✕",
            tone: "text-red-600 dark:text-red-400",
            onDl: () => onDownloadFiltered(offlineRows, "camera-status-offline.csv"),
            dlTitle: "Download offline cameras",
          },
          {
            title: "Offline %",
            value: `${kpis.offlinePct.toFixed(1)}%`,
            sub: "Of current view",
            icon: "%",
            tone: "text-orange-600 dark:text-orange-400",
            onDl: () =>
              downloadCsv(
                "camera-status-offline-rate-summary.csv",
                [
                  {
                    View_total: kpis.total,
                    Online: kpis.online,
                    Offline: kpis.offline,
                    Offline_pct: Math.round(kpis.offlinePct * 100) / 100,
                  },
                ],
                ["View_total", "Online", "Offline", "Offline_pct"]
              ),
            dlTitle: "Download offline rate summary (CSV)",
          },
        ].map((k) => (
          <div key={k.title} className="surface-card relative">
            <KpiDownload title={k.dlTitle} onClick={k.onDl} />
            <div className="flex items-start gap-2 pr-11 sm:gap-3 sm:pr-14">
              <span className="shrink-0 text-xl sm:text-2xl">{k.icon}</span>
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{k.title}</p>
                <p
                  className={`mt-1 text-2xl font-bold tabular-nums tracking-tight xs:text-3xl ${k.tone}`}
                >
                  {typeof k.value === "number" ? k.value.toLocaleString() : k.value}
                </p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{k.sub}</p>
              </div>
            </div>
          </div>
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="surface-card">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 sm:text-lg">
              Connectivity mix
            </h2>
            <DownloadBtn
              count={2}
              variant="outline"
              label="Download chart data (Online / Offline)"
              onClick={exportStatusMix}
            />
          </div>
          <div className="mx-auto h-52 w-full max-w-md xs:h-56 sm:h-64">
            {kpis.total ? (
              <Doughnut data={donutData} options={donutOptions} />
            ) : (
              <p className="flex h-full items-center justify-center text-slate-500 dark:text-slate-500">
                No data
              </p>
            )}
          </div>
        </div>
        <div className="surface-card">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 sm:text-lg">
              Zone offline %
            </h2>
            <DownloadBtn
              count={zoneAgg.length}
              variant="outline"
              label="Download zone offline % data"
              onClick={exportZoneChartData}
            />
          </div>
          <div className="h-52 min-h-[13rem] w-full min-w-0 sm:h-64">
            {zoneBarLabels.length ? (
              <ZoneOfflineBarChart labels={zoneBarLabels} values={zoneBarValues} />
            ) : (
              <p className="flex h-full items-center justify-center text-slate-500 dark:text-slate-500">
                No data
              </p>
            )}
          </div>
        </div>
      </div>

      <section className="surface-card">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 sm:text-lg">
            Zone-wise summary
          </h2>
          <DownloadBtn
            count={zoneAgg.length}
            variant="blue"
            label="Download zone summary CSV"
            onClick={() =>
              downloadCsv(
                "camera-status-zone-summary.csv",
                zoneAgg.map((z) => ({
                  Zone: z.zone,
                  Total_Cameras: z.total,
                  Online: z.online,
                  Offline: z.offline,
                  Offline_pct: Math.round(z.offlinePct * 100) / 100,
                })),
                ["Zone", "Total_Cameras", "Online", "Offline", "Offline_pct"]
              )
            }
          />
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-200/90 dark:border-slate-700/60">
          <div className="max-h-[min(22rem,55vh)] overflow-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100/95 text-xs font-semibold uppercase tracking-wide text-slate-600 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-800/95 dark:text-slate-400">
                  <th className="px-3 py-2.5">Zone</th>
                  <th className="px-3 py-2.5 text-right tabular-nums">Total</th>
                  <th className="px-3 py-2.5 text-right tabular-nums">Online</th>
                  <th className="px-3 py-2.5 text-right tabular-nums">Offline</th>
                  <th className="px-3 py-2.5 text-right tabular-nums">Offline %</th>
                  <th className="w-12 px-3 py-2.5 text-right" aria-label="Download" />
                </tr>
              </thead>
              <tbody>
                {zoneAgg.map((z) => (
                  <tr
                    key={z.zone}
                    className="cursor-pointer border-b border-slate-100 transition hover:bg-slate-50/90 dark:border-slate-800/80 dark:hover:bg-slate-800/40"
                    onClick={() => downloadZoneRow(z.zone)}
                    title="Download zone cameras"
                  >
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${zoneBadgeClass(
                          z.zone
                        )}`}
                      >
                        {z.zone}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300">
                      {z.total.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                      {z.online.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-red-600 dark:text-red-400">
                      {z.offline.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-orange-700 dark:text-orange-400">
                      {z.offlinePct.toFixed(1)}%
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        className="rounded-xl border border-slate-200/90 bg-white/90 p-1.5 text-slate-500 shadow-sm transition-all hover:bg-white dark:border-slate-600/70 dark:bg-slate-800/80 dark:hover:bg-slate-800"
                        title="Download rows for this zone"
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadZoneRow(z.zone);
                        }}
                      >
                        <DownloadIcon className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="surface-card">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 sm:text-lg">
            POD-wise summary
          </h2>
          <DownloadBtn
            count={podAgg.length}
            variant="slate"
            label="Download POD summary CSV"
            onClick={() =>
              downloadCsv(
                "camera-status-pod-summary.csv",
                podAgg.map((p) => ({
                  POD: p.pod,
                  Total_Cameras: p.total,
                  Online: p.online,
                  Offline: p.offline,
                  Offline_pct: Math.round(p.pct * 100) / 100,
                })),
                ["POD", "Total_Cameras", "Online", "Offline", "Offline_pct"]
              )
            }
          />
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-200/90 dark:border-slate-700/60">
          <div className="max-h-[min(22rem,55vh)] overflow-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100/95 text-xs font-semibold uppercase tracking-wide text-slate-600 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-800/95 dark:text-slate-400">
                  <th className="px-3 py-2.5">POD</th>
                  <th className="px-3 py-2.5 text-right tabular-nums">Total</th>
                  <th className="px-3 py-2.5 text-right tabular-nums">Online</th>
                  <th className="px-3 py-2.5 text-right tabular-nums">Offline</th>
                  <th className="px-3 py-2.5 text-right tabular-nums">Offline %</th>
                  <th className="w-12 px-3 py-2.5 text-right" aria-label="Download" />
                </tr>
              </thead>
              <tbody>
                {podAgg.map((p) => (
                  <tr
                    key={p.pod}
                    className="cursor-pointer border-b border-slate-100 transition hover:bg-slate-50/90 dark:border-slate-800/80 dark:hover:bg-slate-800/40"
                    onClick={() => downloadPodRow(p.pod)}
                    title="Download POD cameras"
                  >
                    <td className="max-w-[14rem] truncate px-3 py-2 font-medium text-slate-900 dark:text-slate-100">
                      {p.pod}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300">
                      {p.total.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                      {p.online.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-red-600 dark:text-red-400">
                      {p.offline.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-orange-700 dark:text-orange-400">
                      {p.pct.toFixed(1)}%
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        className="rounded-xl border border-slate-200/90 bg-white/90 p-1.5 text-slate-500 shadow-sm transition-all hover:bg-white dark:border-slate-600/70 dark:bg-slate-800/80 dark:hover:bg-slate-800"
                        title="Download rows for this POD"
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadPodRow(p.pod);
                        }}
                      >
                        <DownloadIcon className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="surface-card">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 sm:text-lg">
            RCA / Remark — offline cameras
          </h2>
          <div className="flex flex-wrap gap-2 lg:shrink-0 lg:justify-end">
            <DownloadBtn
              count={rcaOfflineEnriched.length}
              variant="slate"
              label="Download RCA offline table (full metrics)"
              onClick={exportRcaOfflineDetailed}
            />
            <DownloadBtn
              count={rcaAllView.length}
              variant="outline"
              label="RCA across all cameras in view"
              onClick={exportRcaAllCameras}
            />
          </div>
        </div>
        {rcaOfflineEnriched.length === 0 ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">No data.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200/90 dark:border-slate-700/60">
            <div className="max-h-[min(28rem,60vh)] overflow-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100/95 text-[10px] font-semibold uppercase tracking-wide text-slate-600 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-800/95 dark:text-slate-400 sm:text-xs">
                    <th className="px-3 py-2.5">RCA (Remark)</th>
                    <th className="px-3 py-2.5 text-right tabular-nums">Offline #</th>
                    <th className="px-3 py-2.5 text-right tabular-nums">% of offline</th>
                    <th className="px-3 py-2.5 text-right tabular-nums">% of view</th>
                    <th className="w-28 px-3 py-2.5 text-left">Share</th>
                    <th className="w-12 px-3 py-2.5 text-right" aria-label="Download" />
                  </tr>
                </thead>
                <tbody>
                  {rcaOfflineEnriched.map((x) => (
                    <tr
                      key={x.remark}
                      className="cursor-pointer border-b border-slate-100 transition hover:bg-slate-50/90 dark:border-slate-800/80 dark:hover:bg-slate-800/40"
                      onClick={() => downloadRcaOfflineRow(x.remark)}
                      title="Download RCA cameras (offline)"
                    >
                      <td className="max-w-[min(100vw,14rem)] px-3 py-2.5 sm:max-w-md">
                        <span
                          className={`inline-flex max-w-full rounded-full px-2.5 py-1 text-xs font-semibold ${rcaPillClass(
                            x.remark
                          )}`}
                          title={x.remark}
                        >
                          <span className="truncate">{x.remark}</span>
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                        {x.count.toLocaleString()}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-300">
                        {x.pctOfOffline.toFixed(1)}%
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-400">
                        {x.pctOfView.toFixed(1)}%
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="h-2 w-full max-w-[6rem] overflow-hidden rounded-full bg-slate-200/90 dark:bg-slate-700/80">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-orange-500 to-red-500"
                            style={{ width: `${Math.min(100, x.pctOfOffline)}%` }}
                            title={`${x.pctOfOffline.toFixed(1)}% of offline pool`}
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <button
                          type="button"
                          className="rounded-xl border border-slate-200/90 bg-white/90 p-1.5 text-slate-500 shadow-sm transition-all hover:bg-white dark:border-slate-600/70 dark:bg-slate-800/80 dark:hover:bg-slate-800"
                          title="Download offline cameras with this RCA"
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadRcaOfflineRow(x.remark);
                          }}
                        >
                          <DownloadIcon className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <div className="flex flex-col items-stretch gap-3 rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-50/90 to-white px-4 py-4 dark:from-blue-950/30 dark:to-slate-900/40 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Detailed export</p>
        <button
          type="button"
          onClick={onDownloadDetailed}
          className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl border border-blue-500/25 bg-gradient-to-b from-blue-600 to-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-900/20 transition-all duration-200 hover:from-blue-500 hover:to-blue-600 active:scale-[0.98] dark:shadow-btn-dark sm:min-h-0"
        >
          Download detailed data
          <DownloadIcon className="h-4 w-4 shrink-0" />
        </button>
      </div>
    </div>
  );
});

CameraStatusTab.displayName = "CameraStatusTab";
