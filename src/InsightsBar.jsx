function formatBaselineWhen(iso) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function InsightsBar({
  dashboardDiff,
  cameraDiff,
  cameraBaselineInsight,
  onDismissDashboardDiff,
  onDismissCameraDiff,
  onDismissCameraBaselineInsight,
}) {
  const showBaseline = Boolean(cameraBaselineInsight);
  if (!dashboardDiff && !cameraDiff && !showBaseline) return null;

  return (
    <div
      className="border-t border-slate-200/90 bg-slate-50/95 motion-safe:animate-sfx-fade-in motion-reduce:animate-none dark:border-slate-700/80 dark:bg-slate-900/80"
      data-html2pdf-ignore="true"
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-3 py-2 sm:px-5 lg:px-6">
        {cameraBaselineInsight ? (
          <div className="flex flex-col gap-2 rounded-xl border border-emerald-200/90 bg-gradient-to-r from-emerald-50/95 to-white px-3 py-2.5 text-xs text-emerald-950 dark:border-emerald-800/45 dark:from-emerald-950/35 dark:to-slate-900/50 dark:text-emerald-50 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-200/95">
                Camera insight · since last file
              </p>
              <p className="text-[11px] leading-snug text-emerald-900/90 dark:text-emerald-100/85">
                Compared to snapshot from{" "}
                <span className="font-semibold">
                  {formatBaselineWhen(cameraBaselineInsight.baselineSavedAt)}
                </span>
                {cameraBaselineInsight.baselineFileName ? (
                  <>
                    {" "}
                    <span className="text-emerald-800/80 dark:text-emerald-200/70">·</span>{" "}
                    <span className="italic opacity-90">{cameraBaselineInsight.baselineFileName}</span>
                  </>
                ) : null}
              </p>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-semibold">
                {cameraBaselineInsight.offlineToOnlineCount > 0 ? (
                  <span className="text-emerald-800 dark:text-emerald-300">
                    {cameraBaselineInsight.offlineToOnlineCount.toLocaleString()} offline → online
                  </span>
                ) : null}
                {cameraBaselineInsight.notCentralizedToOnlineCount > 0 ? (
                  <span className="text-teal-800 dark:text-teal-300">
                    {cameraBaselineInsight.notCentralizedToOnlineCount.toLocaleString()} not centralized →
                    online
                  </span>
                ) : null}
              </div>
              {cameraBaselineInsight.offlineToOnlineSample.length ? (
                <p
                  className="truncate font-mono text-[10px] text-emerald-900/75 dark:text-emerald-200/75"
                  title={cameraBaselineInsight.offlineToOnlineSample.join(", ")}
                >
                  <span className="font-sans font-semibold">Offline→online:</span>{" "}
                  {cameraBaselineInsight.offlineToOnlineSample.join(", ")}
                  {cameraBaselineInsight.offlineToOnlineCount >
                  cameraBaselineInsight.offlineToOnlineSample.length
                    ? "…"
                    : ""}
                </p>
              ) : null}
              {cameraBaselineInsight.notCentralizedToOnlineSample.length ? (
                <p
                  className="truncate font-mono text-[10px] text-teal-900/80 dark:text-teal-200/75"
                  title={cameraBaselineInsight.notCentralizedToOnlineSample.join(", ")}
                >
                  <span className="font-sans font-semibold">Not centralized→online:</span>{" "}
                  {cameraBaselineInsight.notCentralizedToOnlineSample.join(", ")}
                  {cameraBaselineInsight.notCentralizedToOnlineCount >
                  cameraBaselineInsight.notCentralizedToOnlineSample.length
                    ? "…"
                    : ""}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onDismissCameraBaselineInsight}
              className="shrink-0 self-end rounded-lg border border-emerald-300/80 bg-white/90 px-2 py-1 text-[11px] font-semibold text-emerald-900 hover:bg-white dark:border-emerald-700 dark:bg-slate-900 dark:text-emerald-100 dark:hover:bg-slate-800 sm:self-start"
            >
              Dismiss
            </button>
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
      </div>
    </div>
  );
}
