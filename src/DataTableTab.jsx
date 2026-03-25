import { useMemo } from "react";
import { getRcaValue } from "./lib/columns.js";
import { ISSUE_KIND_LABELS } from "./lib/analytics.js";
import { downloadCsv } from "./lib/csvExport.js";
import { MultiSelectDropdownFilter } from "./MultiSelectDropdownFilter.jsx";

export const DATA_TABLE_PAGE_SIZE = 100;

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
    return "bg-sfx-soft text-sfx-deep ring-1 ring-sfx/25 dark:bg-sfx/15 dark:text-sfx-cta dark:ring-sfx/35";
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
  if (kind === "proper_bagging")
    return "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200/80 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-400/35";
  return "bg-slate-100 text-slate-800 ring-1 ring-slate-200/80 dark:bg-slate-600/35 dark:text-slate-200 dark:ring-slate-500/45";
}

function cctvShowsIcon(raw) {
  if (raw == null || String(raw).trim() === "") return false;
  const s = String(raw).trim().toLowerCase();
  if (["no", "n", "false", "0", "-", "na", "none", "n/a"].includes(s)) return false;
  return true;
}

function stripExportRows(rows, fields) {
  return rows.map((r) => {
    const o = {};
    for (const f of fields) o[f] = r[f] ?? "";
    return o;
  });
}

function CameraIcon({ className = "h-5 w-5" }) {
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
        d="M4 8h4l2-2h4l2 2h4v10H4V8z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
}

export function DataTableTab({
  hasData,
  colMapSafe,
  fields,
  exportFields,
  search,
  setSearch,
  zoneFilter,
  setZoneFilter,
  rcaFilter,
  setRcaFilter,
  categoryFilter,
  setCategoryFilter,
  page,
  setPage,
  zoneOptions,
  rcaOptions,
  categoryKinds,
  filteredRows,
  onExportFullDataset,
}) {
  const pageRows = useMemo(() => {
    const start = page * DATA_TABLE_PAGE_SIZE;
    return filteredRows.slice(start, start + DATA_TABLE_PAGE_SIZE);
  }, [filteredRows, page]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / DATA_TABLE_PAGE_SIZE));

  const rangeStart = filteredRows.length === 0 ? 0 : page * DATA_TABLE_PAGE_SIZE + 1;
  const rangeEnd = Math.min((page + 1) * DATA_TABLE_PAGE_SIZE, filteredRows.length);

  const exportRow = (r) => {
    downloadCsv("data-table-row.csv", stripExportRows([r], exportFields), exportFields);
  };

  if (!hasData) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200/90 bg-white/95 px-6 py-16 text-center shadow-card backdrop-blur-sm dark:border-slate-700/50 dark:bg-slate-900/70 dark:shadow-card-dark">
        <p className="text-lg font-medium text-slate-800 dark:text-slate-100">No data loaded</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl space-y-4 px-3 pb-20 pt-4 sm:px-5 sm:pb-16 sm:pt-6 md:px-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="relative min-w-0 flex-1">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="search"
            placeholder="Search manifests, hubs…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200/90 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-sfx focus:outline-none focus:ring-2 focus:ring-sfx/25 dark:border-slate-600/80 dark:bg-slate-900/90 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-sfx dark:focus:ring-sfx/20"
            aria-label="Search manifests and hubs"
          />
        </div>
        <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-3 sm:items-end lg:max-w-4xl lg:shrink-0">
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Zone
            </span>
            <MultiSelectDropdownFilter
              label="Zone"
              options={zoneOptions}
              selected={zoneFilter}
              setSelected={setZoneFilter}
            />
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              RCA
            </span>
            <MultiSelectDropdownFilter
              label="RCA"
              options={rcaOptions}
              selected={rcaFilter}
              setSelected={setRcaFilter}
            />
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Category
            </span>
            <MultiSelectDropdownFilter
              label="Category"
              options={categoryKinds}
              selected={categoryFilter}
              setSelected={setCategoryFilter}
              formatLabel={(k) => ISSUE_KIND_LABELS[k] ?? k}
            />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 shadow-card backdrop-blur-sm dark:border-slate-700/50 dark:bg-slate-900/70 dark:shadow-card-dark">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs text-slate-800 dark:text-slate-200 sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-400 sm:text-xs">
                {colMapSafe.manifest ? (
                  <th className="whitespace-nowrap px-2 py-2.5 sm:px-4 sm:py-3">Manifest</th>
                ) : null}
                {colMapSafe.zone ? (
                  <th className="px-2 py-2.5 sm:px-4 sm:py-3">Zone</th>
                ) : null}
                {colMapSafe.hub ? (
                  <th className="px-2 py-2.5 sm:px-4 sm:py-3">Hub</th>
                ) : null}
                <th className="px-2 py-2.5 sm:px-4 sm:py-3">RCA</th>
                {colMapSafe.open ? (
                  <th className="px-2 py-2.5 sm:px-4 sm:py-3">Open</th>
                ) : null}
                {colMapSafe.cctv ? (
                  <th className="px-2 py-2.5 sm:px-4 sm:py-3">CCTV</th>
                ) : null}
                <th className="w-10 px-2 py-2.5 sm:w-12 sm:px-4 sm:py-3" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-3 py-12 text-center text-xs text-slate-500 sm:px-4 sm:py-14 sm:text-sm dark:text-slate-500"
                  >
                    No records match your filters.
                  </td>
                </tr>
              ) : (
                pageRows.map((r, idx) => (
                  <tr
                    key={
                      colMapSafe.manifest
                        ? `${String(r[colMapSafe.manifest] ?? idx)}-${page}-${idx}`
                        : `${page}-${idx}-${String(r[colMapSafe.hub] ?? "")}`
                    }
                    className="cursor-pointer border-b border-slate-100 transition hover:bg-slate-50/90 dark:border-slate-800/80 dark:hover:bg-slate-800/40"
                    onClick={() => exportRow(r)}
                  >
                    {colMapSafe.manifest ? (
                      <td className="whitespace-nowrap px-2 py-2 sm:px-4 sm:py-2.5 font-mono text-xs text-slate-700 dark:text-slate-300">
                        {r[colMapSafe.manifest] ?? "—"}
                      </td>
                    ) : null}
                    {colMapSafe.zone ? (
                      <td className="px-2 py-2 sm:px-4 sm:py-2.5">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${zoneBadgeClass(
                            r[colMapSafe.zone]
                          )}`}
                        >
                          {r[colMapSafe.zone] ?? "—"}
                        </span>
                      </td>
                    ) : null}
                    {colMapSafe.hub ? (
                      <td className="max-w-[14rem] truncate px-2 py-2 sm:px-4 sm:py-2.5 text-slate-700 dark:text-slate-300">
                        {r[colMapSafe.hub] ?? "—"}
                      </td>
                    ) : null}
                    <td className="px-2 py-2 sm:px-4 sm:py-2.5">
                      <span
                        className={`inline-flex max-w-[16rem] truncate rounded-full px-2.5 py-0.5 text-xs font-semibold ${rcaBadgeClass(
                          r.__kind
                        )}`}
                        title={getRcaValue(r, colMapSafe, fields)}
                      >
                        {getRcaValue(r, colMapSafe, fields) || "—"}
                      </span>
                    </td>
                    {colMapSafe.open ? (
                      <td className="px-2 py-2 sm:px-4 sm:py-2.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            exportRow(r);
                          }}
                          className="w-full text-left font-semibold tabular-nums text-red-600 underline decoration-red-500/35 decoration-dotted underline-offset-2 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                          title="Download this row"
                        >
                          {r[colMapSafe.open] ?? "—"}
                        </button>
                      </td>
                    ) : null}
                    {colMapSafe.cctv ? (
                      <td className="px-2 py-2 sm:px-4 sm:py-2.5 text-sfx dark:text-sfx-cta">
                        {cctvShowsIcon(r[colMapSafe.cctv]) ? (
                          <CameraIcon className="h-5 w-5" aria-label="CCTV available" />
                        ) : (
                          <span className="text-slate-400 dark:text-slate-600">—</span>
                        )}
                      </td>
                    ) : null}
                    <td className="px-2 py-2 sm:px-4 sm:py-2.5">
                      <button
                        type="button"
                        className="rounded-xl border border-slate-200/90 bg-white/90 p-1.5 text-slate-500 shadow-sm transition-all hover:border-slate-300 hover:bg-white hover:text-slate-800 dark:border-slate-600/70 dark:bg-slate-800/80 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                        title="Download full dashboard (all rows)"
                        aria-label="Download full dashboard CSV"
                        onClick={(e) => {
                          e.stopPropagation();
                          onExportFullDataset?.();
                        }}
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

      <div className="flex flex-col gap-2 border-t border-slate-200/80 pt-4 text-xs text-slate-500 dark:border-slate-800/60 dark:text-slate-500 sm:text-sm">
        <p>
          {filteredRows.length === 0
            ? "Showing 0 of 0 records"
            : `Showing ${rangeStart}–${rangeEnd} of ${filteredRows.length.toLocaleString()} records`}
        </p>
      </div>

      {totalPages > 1 ? (
        <div className="flex w-full flex-col items-stretch gap-2 xs:flex-row xs:flex-wrap xs:items-center xs:justify-center">
          <button
            type="button"
            disabled={page <= 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="min-h-[44px] rounded-xl border border-slate-200/90 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition-all hover:bg-slate-50 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-35 sm:min-h-0 dark:border-slate-600/80 dark:bg-slate-900/90 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Previous
          </button>
          <span className="px-2 text-center text-xs text-slate-500 sm:text-sm dark:text-slate-500">
            Page {page + 1} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            className="min-h-[44px] rounded-xl border border-slate-200/90 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition-all hover:bg-slate-50 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-35 sm:min-h-0 dark:border-slate-600/80 dark:bg-slate-900/90 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}
