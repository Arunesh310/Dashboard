import { useCallback, useMemo, useRef, useState } from "react";
import { useTheme } from "./theme.jsx";
import { MultiSelectDropdownFilter } from "./MultiSelectDropdownFilter.jsx";
import { downloadCsv, shortCount } from "./lib/csvExport.js";
import { Doughnut, Bar, Line } from "react-chartjs-2";
import {
  classifyOpenLost,
  groupAgg,
  monthAgg,
  parsePanIndiaWorkbook,
  sumPrice,
  uniqCountByKey,
} from "./lib/dashboard2.js";

function formatInrCr(n) {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return "₹0";
  const cr = v / 1e7;
  if (Math.abs(cr) >= 1) return `₹${cr.toFixed(2)} Cr`;
  const l = v / 1e5;
  if (Math.abs(l) >= 1) return `₹${l.toFixed(2)} L`;
  return `₹${Math.round(v).toLocaleString("en-IN")}`;
}

function formatInt(n) {
  return shortCount(n ?? 0);
}

function uniqOptions(rows, key) {
  const s = new Set();
  for (const r of rows) {
    const v = String(r[key] ?? "").trim();
    if (v) s.add(v);
  }
  return [...s].sort((a, b) => a.localeCompare(b));
}

function stripExportRows(rows) {
  return rows.map((r) => ({
    source: r.__source,
    awb: r.awb,
    order_status: r.orderStatus,
    price: r.price,
    scan_date: r.scanDate ? r.scanDate.toISOString() : "",
    month: r.month ?? "",
    issue_type: r.issueType,
    issue_category: r.issueCategory,
    node: r.node,
    node_type: r.nodeType,
    pod: r.pod,
    pod_zone: r.podZone,
    state_head: r.stateHead,
    client: r.client,
    payment_mode: r.paymentMode,
    hub: r.hub,
    szm: r.szm,
    state: r.state,
    hub_type: r.hubType,
    connect_or_bagging_type: r.connectOrBaggingType,
    movement_type: r.movementType,
  }));
}

function CardKpi({ label, value, sub }) {
  return (
    <div className="surface-muted rounded-2xl p-4">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">{value}</p>
      {sub ? <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{sub}</p> : null}
    </div>
  );
}

function FuturisticHeader({ title, subtitle, right }) {
  return (
    <div className="surface-card relative overflow-hidden border border-slate-200/80 dark:border-slate-700/60">
      <div className="absolute inset-0 bg-gradient-to-br from-sfx/12 via-transparent to-violet-500/10 dark:from-sfx-cta/10 dark:to-violet-400/10" />
      <div className="relative flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-100 sm:text-xl">
            {title}
          </h2>
          {subtitle ? <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{subtitle}</p> : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
    </div>
  );
}

function PivotTable({ title, rows, dimLabel }) {
  return (
    <div className="surface-card">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{title}</h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Sorted by total AWBs</p>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700 ring-1 ring-slate-200/70 dark:bg-slate-700/40 dark:text-slate-200 dark:ring-slate-600/60">
          {rows.length} rows
        </span>
      </div>
      <div className="-mx-1 overflow-x-auto rounded-xl border border-slate-100 px-1 dark:border-slate-700/60 sm:mx-0 sm:px-0">
        <table className="min-w-full text-left text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-400 sm:text-xs">
              <th className="px-2 py-2 sm:px-3">#</th>
              <th className="px-2 py-2 sm:px-3">{dimLabel}</th>
              <th className="px-2 py-2 sm:px-3">Open</th>
              <th className="px-2 py-2 sm:px-3">Lost</th>
              <th className="px-2 py-2 sm:px-3">Total</th>
              <th className="px-2 py-2 sm:px-3">Debit (₹)</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-2 py-10 text-center text-xs text-slate-500 sm:px-3 sm:text-sm dark:text-slate-500">
                  No data
                </td>
              </tr>
            ) : (
              rows.map((r, idx) => (
                <tr
                  key={`${r.key}-${idx}`}
                  className="border-b border-slate-100 hover:bg-slate-50/80 dark:border-slate-800/80 dark:hover:bg-slate-800/40"
                >
                  <td className="px-2 py-2 text-slate-500 sm:px-3">{idx + 1}</td>
                  <td className="max-w-[14rem] truncate px-2 py-2 font-semibold text-slate-800 sm:px-3 dark:text-slate-200">
                    {r.key}
                  </td>
                  <td className="px-2 py-2 font-semibold tabular-nums text-slate-700 sm:px-3 dark:text-slate-200">{formatInt(r.open)}</td>
                  <td className="px-2 py-2 font-semibold tabular-nums text-red-700 sm:px-3 dark:text-red-300">{formatInt(r.lost)}</td>
                  <td className="px-2 py-2 font-black tabular-nums text-slate-900 sm:px-3 dark:text-slate-100">{formatInt(r.total)}</td>
                  <td className="px-2 py-2 font-semibold tabular-nums text-slate-700 sm:px-3 dark:text-slate-200">{formatInrCr(r.totalValue)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Dashboard2Tab({ dashCsvName }) {
  const { isDark } = useTheme();
  const inputRef = useRef(null);

  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [meta, setMeta] = useState(null);
  const [rows, setRows] = useState([]);

  const [applied, setApplied] = useState({
    source: [],
    podZone: [],
    pod: [],
    stateHead: [],
    nodeType: [],
    month: [],
    issueType: [],
    issueCategory: [],
    client: [],
    paymentMode: [],
  });

  const [draft, setDraft] = useState(applied);

  const options = useMemo(() => {
    if (!rows.length) {
      return {
        source: [],
        podZone: [],
        pod: [],
        stateHead: [],
        nodeType: [],
        month: [],
        issueType: [],
        issueCategory: [],
        client: [],
        paymentMode: [],
      };
    }
    return {
      source: uniqOptions(rows, "__source"),
      podZone: uniqOptions(rows, "podZone"),
      pod: uniqOptions(rows, "pod"),
      stateHead: uniqOptions(rows, "stateHead"),
      nodeType: uniqOptions(rows, "nodeType"),
      month: uniqOptions(rows, "month"),
      issueType: uniqOptions(rows, "issueType"),
      issueCategory: uniqOptions(rows, "issueCategory"),
      client: uniqOptions(rows, "client"),
      paymentMode: uniqOptions(rows, "paymentMode"),
    };
  }, [rows]);

  const filtered = useMemo(() => {
    if (!rows.length) return [];
    const a = applied;
    const has = (arr, v) => (arr.length === 0 ? true : arr.includes(v));
    return rows.filter((r) => {
      if (!has(a.source, r.__source)) return false;
      if (!has(a.podZone, r.podZone)) return false;
      if (!has(a.pod, r.pod)) return false;
      if (!has(a.stateHead, r.stateHead)) return false;
      if (!has(a.nodeType, r.nodeType)) return false;
      if (!has(a.month, r.month ?? "")) return false;
      if (!has(a.issueType, r.issueType)) return false;
      if (!has(a.issueCategory, r.issueCategory)) return false;
      if (!has(a.client, r.client)) return false;
      if (!has(a.paymentMode, r.paymentMode)) return false;
      return true;
    });
  }, [rows, applied]);

  const kpis = useMemo(() => {
    const totalAwb = uniqCountByKey(filtered, "awb");
    const totalValue = sumPrice(filtered);
    let open = 0;
    let lost = 0;
    let openValue = 0;
    let lostValue = 0;
    for (const r of filtered) {
      const t = classifyOpenLost(r.orderStatus);
      if (t === "lost") {
        lost += 1;
        lostValue += r.price || 0;
      } else {
        open += 1;
        openValue += r.price || 0;
      }
    }
    return { totalAwb, totalValue, open, lost, openValue, lostValue };
  }, [filtered]);

  const remarkAgg = useMemo(() => groupAgg(filtered, "issueType", 12), [filtered]);
  const zoneAgg = useMemo(() => groupAgg(filtered, "podZone", 6), [filtered]);
  const payAgg = useMemo(() => groupAgg(filtered, "paymentMode", 6), [filtered]);
  const stateHeadAgg = useMemo(() => groupAgg(filtered, "stateHead", 20), [filtered]);
  const szmAgg = useMemo(() => groupAgg(filtered, "szm", 20), [filtered]);
  const nodeAgg = useMemo(() => groupAgg(filtered, "node", 20), [filtered]);

  const months = useMemo(() => monthAgg(filtered), [filtered]);

  const onPick = useCallback(async (file) => {
    setError("");
    if (!file) return;
    setLoading(true);
    setFileName(file.name);
    try {
      const ab = await file.arrayBuffer();
      const parsed = parsePanIndiaWorkbook(ab);
      setMeta(parsed);
      setRows(parsed.rows);
      const nextApplied = {
        source: [],
        podZone: [],
        pod: [],
        stateHead: [],
        nodeType: [],
        month: [],
        issueType: [],
        issueCategory: [],
        client: [],
        paymentMode: [],
      };
      setApplied(nextApplied);
      setDraft(nextApplied);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not parse workbook.");
    } finally {
      setLoading(false);
    }
  }, []);

  const chartText = isDark ? "#cbd5e1" : "#475569";

  const doughnutOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: chartText, boxWidth: 10, font: { size: 11 } },
        },
      },
    }),
    [chartText]
  );

  const barOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: "rgba(15, 23, 42, 0.92)", padding: 12, cornerRadius: 8 },
      },
      scales: {
        x: { ticks: { color: chartText, font: { size: 11 } }, grid: { display: false } },
        y: { ticks: { color: chartText, font: { size: 11 } } },
      },
    }),
    [chartText]
  );

  const lineOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: chartText, boxWidth: 10, font: { size: 11 } },
        },
        tooltip: { mode: "index", intersect: false },
      },
      interaction: { mode: "index", intersect: false },
      scales: {
        x: { ticks: { color: chartText, font: { size: 11 } }, grid: { display: false } },
        y: { ticks: { color: chartText, font: { size: 11 } } },
      },
    }),
    [chartText]
  );

  return (
    <div className="space-y-5">
      <FuturisticHeader
        title="Dashboard 2.0 — Pan India (combined)"
        subtitle="Upload one Excel workbook containing Forward, BRSNR, and Bagging Connection sheets. Open/Lost is based on Order Status. Debit Value is Price."
        right={
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xlsb,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.binary.macroEnabled.12"
              className="hidden"
              onChange={(e) => onPick(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              className="rounded-xl bg-sfx px-4 py-2 text-sm font-bold text-white shadow-btn transition-all hover:brightness-110 active:scale-[0.98] dark:bg-sfx-cta dark:text-slate-950"
              onClick={() => inputRef.current?.click()}
              disabled={loading}
            >
              {loading ? "Parsing…" : rows.length ? "Upload new workbook" : "Upload workbook"}
            </button>
            {rows.length ? (
              <button
                type="button"
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-btn transition-all hover:bg-slate-50 active:scale-[0.98] dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-200 dark:hover:bg-slate-900/60"
                onClick={() =>
                  downloadCsv(
                    dashCsvName("dashboard2-export"),
                    stripExportRows(filtered),
                    Object.keys(stripExportRows(filtered)[0] ?? { awb: "" })
                  )
                }
              >
                Export filtered CSV
              </button>
            ) : null}
          </div>
        }
      />

      {error ? (
        <div className="surface-card border-l-4 border-red-500">
          <p className="text-sm font-semibold text-red-700 dark:text-red-300">{error}</p>
        </div>
      ) : null}

      {meta ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <CardKpi label="Workbook" value={fileName || "—"} sub={`${meta.sheetNames.length} sheets detected`} />
          <CardKpi label="Combined rows" value={formatInt(meta.counts.total)} sub="Forward + BRSNR + Bagging Connection" />
          <CardKpi label="Forward rows" value={formatInt(meta.counts.Forward)} />
          <CardKpi label="BRSNR + Bagging" value={formatInt(meta.counts.BRSNR + meta.counts.Bagging_Connection)} />
        </div>
      ) : null}

      {rows.length ? (
        <div className="surface-card">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Filters</h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Select filters and apply. Blank selections mean “All”.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white shadow-btn transition-all hover:bg-slate-800 active:scale-[0.98] dark:bg-white dark:text-slate-950"
                onClick={() => setApplied(draft)}
              >
                Apply filters
              </button>
              <button
                type="button"
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-btn transition-all hover:bg-slate-50 active:scale-[0.98] dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-200 dark:hover:bg-slate-900/60"
                onClick={() => {
                  const cleared = Object.fromEntries(Object.keys(applied).map((k) => [k, []]));
                  setDraft(cleared);
                  setApplied(cleared);
                }}
              >
                Reset
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <MultiSelectDropdownFilter
              label="Source"
              options={options.source}
              selected={draft.source}
              setSelected={(v) => setDraft((p) => ({ ...p, source: v }))}
              applied={applied.source}
              onApply={(next) => setApplied((p) => ({ ...p, source: next }))}
            />
            <MultiSelectDropdownFilter
              label="POD Zone"
              options={options.podZone}
              selected={draft.podZone}
              setSelected={(v) => setDraft((p) => ({ ...p, podZone: v }))}
              applied={applied.podZone}
              onApply={(next) => setApplied((p) => ({ ...p, podZone: next }))}
            />
            <MultiSelectDropdownFilter
              label="POD Name"
              options={options.pod}
              selected={draft.pod}
              setSelected={(v) => setDraft((p) => ({ ...p, pod: v }))}
              applied={applied.pod}
              onApply={(next) => setApplied((p) => ({ ...p, pod: next }))}
            />
            <MultiSelectDropdownFilter
              label="Picked month"
              options={options.month}
              selected={draft.month}
              setSelected={(v) => setDraft((p) => ({ ...p, month: v }))}
              applied={applied.month}
              onApply={(next) => setApplied((p) => ({ ...p, month: next }))}
            />
            <MultiSelectDropdownFilter
              label="Node type"
              options={options.nodeType}
              selected={draft.nodeType}
              setSelected={(v) => setDraft((p) => ({ ...p, nodeType: v }))}
              applied={applied.nodeType}
              onApply={(next) => setApplied((p) => ({ ...p, nodeType: next }))}
            />
            <MultiSelectDropdownFilter
              label="State head"
              options={options.stateHead}
              selected={draft.stateHead}
              setSelected={(v) => setDraft((p) => ({ ...p, stateHead: v }))}
              applied={applied.stateHead}
              onApply={(next) => setApplied((p) => ({ ...p, stateHead: next }))}
            />
            <MultiSelectDropdownFilter
              label="Client"
              options={options.client}
              selected={draft.client}
              setSelected={(v) => setDraft((p) => ({ ...p, client: v }))}
              applied={applied.client}
              onApply={(next) => setApplied((p) => ({ ...p, client: next }))}
            />
            <MultiSelectDropdownFilter
              label="Payment mode"
              options={options.paymentMode}
              selected={draft.paymentMode}
              setSelected={(v) => setDraft((p) => ({ ...p, paymentMode: v }))}
              applied={applied.paymentMode}
              onApply={(next) => setApplied((p) => ({ ...p, paymentMode: next }))}
            />
            <MultiSelectDropdownFilter
              label="Issue category"
              options={options.issueCategory}
              selected={draft.issueCategory}
              setSelected={(v) => setDraft((p) => ({ ...p, issueCategory: v }))}
              applied={applied.issueCategory}
              onApply={(next) => setApplied((p) => ({ ...p, issueCategory: next }))}
            />
            <MultiSelectDropdownFilter
              label="Issue type"
              options={options.issueType}
              selected={draft.issueType}
              setSelected={(v) => setDraft((p) => ({ ...p, issueType: v }))}
              applied={applied.issueType}
              onApply={(next) => setApplied((p) => ({ ...p, issueType: next }))}
            />
          </div>
        </div>
      ) : null}

      {rows.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <CardKpi label="Total AWBs" value={formatInt(kpis.totalAwb)} sub={`Debit: ${formatInrCr(kpis.totalValue)}`} />
          <CardKpi label="Open AWBs" value={formatInt(kpis.open)} sub={`Debit: ${formatInrCr(kpis.openValue)}`} />
          <CardKpi label="Lost AWBs" value={formatInt(kpis.lost)} sub={`Debit: ${formatInrCr(kpis.lostValue)}`} />
          <CardKpi label="Filters applied" value={formatInt(filtered.length)} sub="Rows after filtering" />
        </div>
      ) : null}

      {rows.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="surface-card">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Remarks breakdown (Issue Type)</h3>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Top issue types by AWB volume</p>
              </div>
              <button
                type="button"
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-btn transition-all hover:bg-slate-50 active:scale-[0.98] dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-200 dark:hover:bg-slate-900/60"
                onClick={() =>
                  downloadCsv(
                    dashCsvName("dashboard2-remarks-breakdown"),
                    remarkAgg.map((o) => ({ issue_type: o.key, total: o.total, open: o.open, lost: o.lost, debit: o.totalValue })),
                    ["issue_type", "total", "open", "lost", "debit"]
                  )
                }
              >
                Export
              </button>
            </div>
            <div className="h-72 min-h-[16rem]">
              <Bar
                options={barOptions}
                data={{
                  labels: remarkAgg.map((o) => o.key),
                  datasets: [
                    {
                      label: "AWBs",
                      data: remarkAgg.map((o) => o.total),
                      backgroundColor: isDark ? "rgba(56, 189, 248, 0.9)" : "rgba(2, 132, 199, 0.9)",
                      borderRadius: 8,
                    },
                  ],
                }}
              />
            </div>
          </div>

          <div className="surface-card">
            <div className="mb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Monthly trend</h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">AWB count + Debit value over time</p>
            </div>
            <div className="h-72 min-h-[16rem]">
              <Line
                options={lineOptions}
                data={{
                  labels: months.map((m) => m.month),
                  datasets: [
                    {
                      label: "AWBs",
                      data: months.map((m) => m.total),
                      borderColor: isDark ? "rgb(56 189 248)" : "rgb(2 132 199)",
                      backgroundColor: isDark ? "rgba(56, 189, 248, 0.14)" : "rgba(2, 132, 199, 0.12)",
                      fill: true,
                      tension: 0.35,
                    },
                    {
                      label: "Debit (₹)",
                      data: months.map((m) => Math.round(m.value)),
                      borderColor: isDark ? "rgb(168 85 247)" : "rgb(124 58 237)",
                      backgroundColor: isDark ? "rgba(168, 85, 247, 0.12)" : "rgba(124, 58, 237, 0.10)",
                      fill: true,
                      tension: 0.35,
                    },
                  ],
                }}
              />
            </div>
          </div>
        </div>
      ) : null}

      {rows.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="surface-card">
            <div className="mb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Zone split</h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">AWB distribution by POD Zone</p>
            </div>
            <div className="h-72 min-h-[16rem]">
              <Doughnut
                options={doughnutOptions}
                data={{
                  labels: zoneAgg.map((o) => o.key),
                  datasets: [
                    {
                      data: zoneAgg.map((o) => o.total),
                      backgroundColor: [
                        "rgba(13, 148, 136, 0.92)",
                        "rgba(2, 132, 199, 0.92)",
                        "rgba(124, 58, 237, 0.92)",
                        "rgba(217, 119, 6, 0.92)",
                        "rgba(220, 38, 38, 0.92)",
                        "rgba(100, 116, 139, 0.92)",
                      ],
                      borderColor: isDark ? "rgba(30,41,59,0.7)" : "rgba(255,255,255,0.9)",
                      borderWidth: 2,
                    },
                  ],
                }}
              />
            </div>
          </div>

          <div className="surface-card">
            <div className="mb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Payment mode split</h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">AWB distribution by payment mode</p>
            </div>
            <div className="h-72 min-h-[16rem]">
              <Doughnut
                options={doughnutOptions}
                data={{
                  labels: payAgg.map((o) => o.key),
                  datasets: [
                    {
                      data: payAgg.map((o) => o.total),
                      backgroundColor: [
                        "rgba(56, 189, 248, 0.92)",
                        "rgba(168, 85, 247, 0.92)",
                        "rgba(34, 197, 94, 0.92)",
                        "rgba(234, 179, 8, 0.92)",
                        "rgba(244, 63, 94, 0.92)",
                        "rgba(100, 116, 139, 0.92)",
                      ],
                      borderColor: isDark ? "rgba(30,41,59,0.7)" : "rgba(255,255,255,0.9)",
                      borderWidth: 2,
                    },
                  ],
                }}
              />
            </div>
          </div>
        </div>
      ) : null}

      {rows.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <PivotTable title="State Head wise" rows={stateHeadAgg} dimLabel="State head" />
          <PivotTable title="Top SZM" rows={szmAgg} dimLabel="SZM" />
          <div className="lg:col-span-2">
            <PivotTable title="Node wise pivot (top)" rows={nodeAgg} dimLabel="Node" />
          </div>
        </div>
      ) : null}
    </div>
  );
}

