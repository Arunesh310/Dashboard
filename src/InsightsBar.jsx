import { useMemo, useState } from "react";
import { normalizeAlertThresholds, saveAlertThresholds } from "./lib/alertThresholds.js";

function Chevron({ open }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
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

export function InsightsBar({
  dashboardAlerts,
  cameraAlerts,
  thresholds,
  onThresholdsChange,
  dashboardDiff,
  cameraDiff,
  onDismissDashboardDiff,
  onDismissCameraDiff,
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  const allAlerts = useMemo(
    () => [...dashboardAlerts, ...cameraAlerts],
    [dashboardAlerts, cameraAlerts]
  );

  const updateThreshold = (patch) => {
    const next = normalizeAlertThresholds({
      ...thresholds,
      ...patch,
      enabled: { ...thresholds.enabled, ...(patch.enabled || {}) },
    });
    onThresholdsChange(next);
    saveAlertThresholds(next);
  };

  return (
    <div
      className="border-t border-slate-200/90 bg-slate-50/95 dark:border-slate-700/80 dark:bg-slate-900/80"
      data-html2pdf-ignore="true"
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-3 py-2 sm:px-5 lg:px-6">
        {allAlerts.length > 0 ? (
          <div
            className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200/90 bg-amber-50/90 px-3 py-2 text-xs text-amber-950 dark:border-amber-800/50 dark:bg-amber-950/35 dark:text-amber-50"
            role="status"
          >
            <span className="inline-flex items-center gap-1 font-bold uppercase tracking-wide text-amber-900 dark:text-amber-200">
              <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-amber-600 px-1 text-[10px] text-white dark:bg-amber-500">
                {allAlerts.length}
              </span>
              Alerts
            </span>
            <ul className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center">
              {allAlerts.map((a) => (
                <li
                  key={a.id}
                  className="rounded-lg bg-white/80 px-2 py-1 text-[11px] font-medium text-amber-950 ring-1 ring-amber-200/80 dark:bg-slate-900/60 dark:text-amber-100 dark:ring-amber-800/60"
                >
                  {a.message}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {dashboardDiff ? (
          <div className="flex flex-col gap-2 rounded-xl border border-sky-200/90 bg-sky-50/90 px-3 py-2 text-xs text-sky-950 dark:border-sky-800/50 dark:bg-sky-950/30 dark:text-sky-100 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1 space-y-1">
              <p className="font-bold text-sky-900 dark:text-sky-200">Dashboard CSV vs previous upload</p>
              <p className="text-[11px] text-sky-800/95 dark:text-sky-200/90">
                <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                  +{dashboardDiff.newCount.toLocaleString()} new
                </span>
                {" · "}
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  −{dashboardDiff.closedCount.toLocaleString()} closed
                </span>
                {" · "}
                <span className="font-semibold text-violet-700 dark:text-violet-300">
                  {dashboardDiff.zoneChangeCount.toLocaleString()} zone change
                  {dashboardDiff.zoneChangeCount === 1 ? "" : "s"}
                </span>
              </p>
              {dashboardDiff.newSample.length ? (
                <p className="truncate text-[10px] text-sky-800/80 dark:text-sky-300/80" title={dashboardDiff.newSample.join(", ")}>
                  <span className="font-semibold">New sample:</span> {dashboardDiff.newSample.join(", ")}
                  {dashboardDiff.newCount > dashboardDiff.newSample.length ? "…" : ""}
                </p>
              ) : null}
              {dashboardDiff.closedSample.length ? (
                <p
                  className="truncate text-[10px] text-sky-800/80 dark:text-sky-300/80"
                  title={dashboardDiff.closedSample.join(", ")}
                >
                  <span className="font-semibold">Closed sample:</span> {dashboardDiff.closedSample.join(", ")}
                  {dashboardDiff.closedCount > dashboardDiff.closedSample.length ? "…" : ""}
                </p>
              ) : null}
              {dashboardDiff.zoneChanges.length ? (
                <ul className="mt-1 max-h-24 overflow-y-auto text-[10px] text-sky-900 dark:text-sky-200/90">
                  {dashboardDiff.zoneChanges.map((z) => (
                    <li key={z.manifest} className="font-mono">
                      {z.manifest}: {z.fromZone} → {z.toZone}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onDismissDashboardDiff}
              className="shrink-0 self-end rounded-lg border border-sky-300/80 bg-white/90 px-2 py-1 text-[11px] font-semibold text-sky-900 hover:bg-white dark:border-sky-700 dark:bg-slate-900 dark:text-sky-100 dark:hover:bg-slate-800 sm:self-start"
            >
              Dismiss
            </button>
          </div>
        ) : null}

        {cameraDiff ? (
          <div className="flex flex-col gap-2 rounded-xl border border-teal-200/90 bg-teal-50/90 px-3 py-2 text-xs text-teal-950 dark:border-teal-800/50 dark:bg-teal-950/30 dark:text-teal-100 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1 space-y-1">
              <p className="font-bold text-teal-900 dark:text-teal-200">Camera CSV vs previous upload</p>
              <p className="text-[11px] text-teal-900/90 dark:text-teal-100/90">
                <span className="font-semibold text-red-700 dark:text-red-300">
                  {cameraDiff.onlineToOfflineCount.toLocaleString()} online → offline
                </span>
                {" · "}
                <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                  {cameraDiff.offlineToOnlineCount.toLocaleString()} offline → online
                </span>
                {" · "}
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  +{cameraDiff.addedCount.toLocaleString()} / −{cameraDiff.removedCount.toLocaleString()} cameras
                </span>
              </p>
              {cameraDiff.onlineToOfflineSample.length ? (
                <p className="truncate font-mono text-[10px] text-teal-800/85 dark:text-teal-300/85" title={cameraDiff.onlineToOfflineSample.join(", ")}>
                  To offline: {cameraDiff.onlineToOfflineSample.join(", ")}
                  {cameraDiff.onlineToOfflineCount > cameraDiff.onlineToOfflineSample.length ? "…" : ""}
                </p>
              ) : null}
              {cameraDiff.offlineToOnlineSample.length ? (
                <p className="truncate font-mono text-[10px] text-teal-800/85 dark:text-teal-300/85" title={cameraDiff.offlineToOnlineSample.join(", ")}>
                  To online: {cameraDiff.offlineToOnlineSample.join(", ")}
                  {cameraDiff.offlineToOnlineCount > cameraDiff.offlineToOnlineSample.length ? "…" : ""}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onDismissCameraDiff}
              className="shrink-0 self-end rounded-lg border border-teal-300/80 bg-white/90 px-2 py-1 text-[11px] font-semibold text-teal-900 hover:bg-white dark:border-teal-700 dark:bg-slate-900 dark:text-teal-100 dark:hover:bg-slate-800 sm:self-start"
            >
              Dismiss
            </button>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setSettingsOpen((o) => !o)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200/90 bg-white/90 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            aria-expanded={settingsOpen}
          >
            Alert thresholds
            <Chevron open={settingsOpen} />
          </button>
        </div>

        {settingsOpen ? (
          <div className="grid gap-3 rounded-xl border border-slate-200/90 bg-white/95 p-3 text-xs dark:border-slate-600 dark:bg-slate-900/90 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="font-medium text-slate-700 dark:text-slate-300">LM fraud ≥ (count)</span>
              <input
                type="number"
                min={0}
                className="rounded-lg border border-slate-200 px-2 py-1.5 dark:border-slate-600 dark:bg-slate-950"
                value={thresholds.lmFraudMin}
                onChange={(e) => updateThreshold({ lmFraudMin: Number(e.target.value) })}
              />
              <label className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                <input
                  type="checkbox"
                  checked={thresholds.enabled.lmFraud}
                  onChange={(e) => updateThreshold({ enabled: { lmFraud: e.target.checked } })}
                />
                Enabled
              </label>
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-medium text-slate-700 dark:text-slate-300">Partial bagging ≥ (count)</span>
              <input
                type="number"
                min={0}
                className="rounded-lg border border-slate-200 px-2 py-1.5 dark:border-slate-600 dark:bg-slate-950"
                value={thresholds.partialBaggingMin}
                onChange={(e) => updateThreshold({ partialBaggingMin: Number(e.target.value) })}
              />
              <label className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                <input
                  type="checkbox"
                  checked={thresholds.enabled.partialBagging}
                  onChange={(e) => updateThreshold({ enabled: { partialBagging: e.target.checked } })}
                />
                Enabled
              </label>
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-medium text-slate-700 dark:text-slate-300">Not centralized ≥ (count)</span>
              <input
                type="number"
                min={0}
                className="rounded-lg border border-slate-200 px-2 py-1.5 dark:border-slate-600 dark:bg-slate-950"
                value={thresholds.notCentralizedMin}
                onChange={(e) => updateThreshold({ notCentralizedMin: Number(e.target.value) })}
              />
              <label className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                <input
                  type="checkbox"
                  checked={thresholds.enabled.notCentralized}
                  onChange={(e) => updateThreshold({ enabled: { notCentralized: e.target.checked } })}
                />
                Enabled
              </label>
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-medium text-slate-700 dark:text-slate-300">Zone offline % ≥ (camera)</span>
              <input
                type="number"
                min={0}
                max={100}
                className="rounded-lg border border-slate-200 px-2 py-1.5 dark:border-slate-600 dark:bg-slate-950"
                value={thresholds.zoneOfflinePctMin}
                onChange={(e) => updateThreshold({ zoneOfflinePctMin: Number(e.target.value) })}
              />
              <label className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                <input
                  type="checkbox"
                  checked={thresholds.enabled.zoneOffline}
                  onChange={(e) => updateThreshold({ enabled: { zoneOffline: e.target.checked } })}
                />
                Enabled
              </label>
            </label>
          </div>
        ) : null}
      </div>
    </div>
  );
}
