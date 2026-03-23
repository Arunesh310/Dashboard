import { getRcaValue } from "./columns.js";

/** @typedef {'all' | 'partial_bagging' | 'lm_fraud' | 'no_footage' | 'camera_issues'} DashboardFilter */

/**
 * @param {string} text
 * @returns {'lm_fraud' | 'partial_bagging' | 'proper_bagging' | 'camera_issues' | 'no_footage' | 'offline' | 'closed' | 'multiple_bagging' | 'unable_to_validate' | 'other'}
 */
export function classifyIssue(text) {
  const t = String(text ?? "").toLowerCase();
  if (!t.trim()) return "other";
  if (t.includes("lm fraud") || t.includes("last mile fraud")) return "lm_fraud";
  if (t.includes("fraud") && (t.includes("lm") || t.includes("last mile")))
    return "lm_fraud";
  if (
    t.includes("multiple bagg") ||
    (t.includes("multiple") && t.includes("bagg") && !t.includes("partial bagg"))
  )
    return "multiple_bagging";
  if (
    t.includes("unable to validate") ||
    t.includes("unable validate") ||
    t.includes("cannot validate") ||
    t.includes("could not validate") ||
    t.includes("validation failed") ||
    t.includes("not validated")
  )
    return "unable_to_validate";
  if (t.includes("partial bagg")) return "partial_bagging";
  if (t.includes("proper bagg")) return "proper_bagging";
  if (t.includes("camera issue") || (t.includes("camera") && t.includes("issue")))
    return "camera_issues";
  if (t.includes("cctv") && (t.includes("issue") || t.includes("fault")))
    return "camera_issues";
  if (t.includes("no footage")) return "no_footage";
  if (t.includes("offline")) return "offline";
  if (t.includes("closed")) return "closed";
  if (t.includes("camera")) return "camera_issues";
  return "other";
}

/** Human-readable labels for classified issue kind (Data Table category filter). */
export const ISSUE_KIND_LABELS = {
  lm_fraud: "LM Fraud",
  partial_bagging: "Partial Bagging",
  proper_bagging: "Proper Bagging",
  camera_issues: "Camera issues",
  no_footage: "No Footage",
  offline: "Offline",
  closed: "Closed",
  multiple_bagging: "Multiple Bagging",
  unable_to_validate: "Unable to validate",
  other: "Other",
};

/**
 * @param {Record<string, string>[]} rows
 * @param {{ rca: string | null; hub: string | null; zone: string | null; manifest: string | null; open: string | null }} colMap
 * @param {string[]} fields
 */
export function annotateRows(rows, colMap, fields) {
  return rows.map((r) => {
    const rcaText = getRcaValue(r, colMap, fields);
    const kind = classifyIssue(rcaText);
    return { ...r, __kind: kind, __rcaText: rcaText };
  });
}

/**
 * @param {ReturnType<typeof annotateRows>} rows
 * @param {DashboardFilter} filter
 */
export function applyFilter(rows, filter) {
  if (filter === "all") return rows;
  return rows.filter((r) => r.__kind === filter);
}

export function countByKind(rows) {
  const m = {
    partial_bagging: 0,
    lm_fraud: 0,
    no_footage: 0,
    camera_issues: 0,
    proper_bagging: 0,
    offline: 0,
    closed: 0,
    multiple_bagging: 0,
    unable_to_validate: 0,
    other: 0,
  };
  for (const r of rows) {
    const k = r.__kind;
    if (m[k] !== undefined) m[k] += 1;
  }
  return m;
}

/** RCA types that count toward Issue Hotspots hub ranking. */
export const HOTSPOT_ISSUE_KINDS = [
  "partial_bagging",
  "lm_fraud",
  "camera_issues",
  "multiple_bagging",
  "unable_to_validate",
];

/**
 * @param {ReturnType<typeof annotateRows>} rows
 */
export function filterRowsForHotspots(rows) {
  return rows.filter((r) => HOTSPOT_ISSUE_KINDS.includes(r.__kind));
}

/**
 * @param {{ skipEmpty?: boolean }} [opts] If `skipEmpty`, rows with blank/null field are omitted (no "Unknown" bucket).
 */
export function aggregateByField(rows, fieldKey, limit = 12, opts = {}) {
  const skipEmpty = opts.skipEmpty === true;
  if (!fieldKey) return [];
  const counts = new Map();
  for (const r of rows) {
    const raw = r[fieldKey];
    const trimmed = raw != null && String(raw).trim() !== "" ? String(raw).trim() : "";
    if (skipEmpty && !trimmed) continue;
    const label = trimmed || "Unknown";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

export function aggregateRca(rows, limit = 10) {
  const counts = new Map();
  for (const r of rows) {
    const label =
      r.__rcaText && r.__rcaText.trim() !== ""
        ? r.__rcaText.trim()
        : "Unknown";
    const short =
      label.length > 42 ? `${label.slice(0, 40)}…` : label;
    counts.set(short, (counts.get(short) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

/** @param {Date} date */
export function formatYMDLocal(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

/** Monday-start week in local timezone. */
export function toWeekStartLocal(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function weekKeyFromDate(date) {
  return formatYMDLocal(toWeekStartLocal(date));
}

export function shortWeekLabel(weekKey) {
  const [y, m, day] = weekKey.split("-").map(Number);
  if (!y || !m || !day) return weekKey;
  const d = new Date(y, m - 1, day);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * @param {unknown} raw
 * @returns {Date | null}
 */
export function parseFlexibleDate(raw) {
  if (raw == null || String(raw).trim() === "") return null;
  const s = String(raw).trim();
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    if (n > 25000 && n < 65000) {
      const ms = Date.UTC(1899, 11, 30) + n * 86400000;
      const d = new Date(ms);
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  let d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d;
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) {
    let a = +m[1];
    let b = +m[2];
    let y = +m[3];
    if (y < 100) y += 2000;
    d = new Date(y, b - 1, a);
    if (!Number.isNaN(d.getTime())) return d;
    d = new Date(y, a - 1, b);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

/**
 * @param {ReturnType<typeof annotateRows>} rows
 * @param {string | null} dateCol
 * @param {string} kind
 * @returns {{ weekKey: string; label: string; count: number }[]}
 */
export function buildWeeklySeriesForKind(rows, dateCol, kind) {
  if (!dateCol) return [];
  const map = new Map();
  for (const r of rows) {
    if (r.__kind !== kind) continue;
    const dt = parseFlexibleDate(r[dateCol]);
    if (!dt) continue;
    const key = weekKeyFromDate(dt);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([weekKey, count]) => ({
      weekKey,
      label: shortWeekLabel(weekKey),
      count,
    }));
}

/**
 * @param {{ weekKey: string; label: string; count: number }[]} series
 */
export function compareLatestWeeks(series) {
  if (!series.length) {
    return {
      direction: "none",
      summary: "No dated rows for this issue type",
      last: 0,
      prev: null,
      delta: null,
      pct: null,
    };
  }
  const last = series[series.length - 1];
  if (series.length < 2) {
    return {
      direction: "baseline",
      summary: `${last.count} in week of ${last.label} · add more weeks to see trend`,
      last: last.count,
      prev: null,
      delta: null,
      pct: null,
    };
  }
  const prev = series[series.length - 2];
  const delta = last.count - prev.count;
  const pct =
    prev.count === 0
      ? last.count === 0
        ? 0
        : 100
      : (delta / prev.count) * 100;
  let direction = "flat";
  if (delta > 0) direction = "up";
  else if (delta < 0) direction = "down";
  const arrow = direction === "up" ? "↑" : direction === "down" ? "↓" : "→";
  const pctStr = `${delta >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
  const summary =
    direction === "flat"
      ? `${arrow} Flat vs prior week (${prev.count} → ${last.count})`
      : `${arrow} ${pctStr} vs prior week (${prev.count} → ${last.count})`;
  return {
    direction,
    summary,
    last: last.count,
    prev: prev.count,
    delta,
    pct,
    arrow,
  };
}

export function sliceLastWeeks(series, maxWeeks) {
  if (series.length <= maxWeeks) return series;
  return series.slice(-maxWeeks);
}

/**
 * Valid RCA for POC productivity denominator: not Offline,
 * non-blank RCA, and RCA text does not contain not centralized/centralised or backup issue.
 */
export function hasValidRcaForPocProductivity(row) {
  if (row.__kind === "closed" || row.__kind === "offline") return false;
  const rca = String(row.__rcaText ?? "").trim();
  if (!rca) return false;
  const t = rca.toLowerCase();
  if (t.includes("not centralized") || t.includes("not centralised")) return false;
  if (t.includes("backup issue")) return false;
  return true;
}

/**
 * Per-POC productivity: all rows with a POC count as eligible.
 * Productivity = validRca / totalEligible.
 * @param {ReturnType<typeof annotateRows>} rows
 * @param {string | null} pocCol
 * @returns {{ poc: string; totalEligible: number; validRca: number; productivityRatio: number | null }[]}
 */
export function aggregatePocProductivity(rows, pocCol) {
  if (!pocCol) return [];
  const byPoc = new Map();
  for (const r of rows) {
    const raw = r[pocCol];
    const poc =
      raw != null && String(raw).trim() !== "" ? String(raw).trim() : null;
    if (!poc) continue;
    const agg = byPoc.get(poc) ?? { totalEligible: 0, validRca: 0 };
    agg.totalEligible += 1;
    if (hasValidRcaForPocProductivity(r)) agg.validRca += 1;
    byPoc.set(poc, agg);
  }
  return [...byPoc.entries()]
    .map(([poc, { totalEligible, validRca }]) => ({
      poc,
      totalEligible,
      validRca,
      productivityRatio:
        totalEligible > 0
          ? Math.round((validRca / totalEligible) * 1000) / 1000
          : null,
    }))
    .sort((a, b) => b.totalEligible - a.totalEligible);
}

/**
 * Weekly productivity ratio for one POC: valid RCA cases in week ÷ total cases in week.
 * `count` is the ratio for compareLatestWeeks / sparklines (y-axis).
 * @param {ReturnType<typeof annotateRows>} rows
 * @param {string | null} dateCol
 * @param {string | null} pocCol
 * @param {string} pocValue
 * @returns {{ weekKey: string; label: string; count: number; totalEligible: number; validRca: number }[]}
 */
export function buildWeeklyProductivitySeriesForPoc(
  rows,
  dateCol,
  pocCol,
  pocValue
) {
  if (!dateCol || !pocCol) return [];
  const target = String(pocValue).trim();
  const byWeek = new Map();
  for (const r of rows) {
    const raw = r[pocCol];
    const poc =
      raw != null && String(raw).trim() !== "" ? String(raw).trim() : "";
    if (poc !== target) continue;
    const dt = parseFlexibleDate(r[dateCol]);
    if (!dt) continue;
    const wk = weekKeyFromDate(dt);
    const cur = byWeek.get(wk) ?? { totalEligible: 0, validRca: 0 };
    cur.totalEligible += 1;
    if (hasValidRcaForPocProductivity(r)) cur.validRca += 1;
    byWeek.set(wk, cur);
  }
  return [...byWeek.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([weekKey, { totalEligible, validRca }]) => ({
      weekKey,
      label: shortWeekLabel(weekKey),
      totalEligible,
      validRca,
      count:
        totalEligible > 0
          ? Math.round((validRca / totalEligible) * 1000) / 1000
          : 0,
    }))
    .filter((x) => x.validRca > 0);
}

const TREND_KINDS = ["partial_bagging", "lm_fraud", "camera_issues"];

/**
 * Pivot table rows for CSV export.
 * @param {ReturnType<typeof annotateRows>} rows
 * @param {string | null} dateCol
 */
export function buildWeeklyPivotRows(rows, dateCol) {
  if (!dateCol) return [];
  const byKind = {};
  const weekSet = new Set();
  for (const k of TREND_KINDS) {
    byKind[k] = buildWeeklySeriesForKind(rows, dateCol, k);
    byKind[k].forEach((x) => weekSet.add(x.weekKey));
  }
  const weeks = [...weekSet].sort();
  return weeks.map((wk) => {
    const row = { week_start: wk };
    for (const k of TREND_KINDS) {
      const hit = byKind[k].find((x) => x.weekKey === wk);
      row[k] = hit ? hit.count : 0;
    }
    return row;
  });
}
