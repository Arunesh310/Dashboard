import { getRcaValue, getMovementNormalized, isRcaEmpty } from "./columns.js";

/** @typedef {'all' | 'partial_bagging' | 'lm_fraud' | 'no_footage' | 'camera_issues'} DashboardFilter */

/**
 * @param {string} text
 * @returns {'lm_fraud' | 'partial_bagging' | 'proper_bagging' | 'camera_issues' | 'no_footage' | 'offline' | 'closed' | 'multiple_bagging' | 'unable_to_validate' | 'other'}
 */
export function classifyIssue(text) {
  const t = String(text ?? "").toLowerCase();
  if (!t.trim()) return "other";
  if (t.includes("process breach")) return "lm_fraud";
  if (t.includes("lm fraud") || t.includes("last mile fraud")) return "lm_fraud";
  if (t.includes("fraud") && (t.includes("lm") || t.includes("last mile")))
    return "lm_fraud";
  if (t.includes("debag")) return "multiple_bagging";
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
  pending: "Pending (no RCA)",
  lm_fraud: "LM fraud / Process breach",
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
    const pending = isRcaEmpty(rcaText);
    const movement = getMovementNormalized(r, colMap);
    const kind = pending ? "pending" : classifyIssue(rcaText);
    return { ...r, __kind: kind, __rcaText: rcaText, __pending: pending, __movement: movement };
  });
}

/** Forward: RCA explicitly flags missing short count (theft / process risk). */
export function isFwdNoShortRemark(text) {
  const t = String(text ?? "").toLowerCase();
  return t.includes("no short");
}

/**
 * Forward: short found / validated (excludes "no short" lines so buckets don't double-count).
 */
export function isFwdShortFoundRemark(text) {
  const t = String(text ?? "").toLowerCase();
  if (!t.trim() || t.includes("no short")) return false;
  return t.includes("short found") || t.includes("short validated");
}

/**
 * Forward movement: RCA patterns that suggest hub has freight but scanning/short-count behaviour is off.
 * @deprecated Prefer {@link isFwdShortFoundRemark} / {@link isFwdNoShortRemark} for KPIs.
 */
export function isFwdScanningTheftRca(text) {
  return isFwdShortFoundRemark(text) || isFwdNoShortRemark(text);
}

/** @param {ReturnType<typeof annotateRows>[number]} r */
export function isFwdNoShortRow(r) {
  if (r.__movement !== "fwd" || r.__pending) return false;
  return isFwdNoShortRemark(r.__rcaText ?? "");
}

/** @param {ReturnType<typeof annotateRows>[number]} r */
export function isFwdShortFoundRow(r) {
  if (r.__movement !== "fwd" || r.__pending) return false;
  if (r.__kind === "camera_issues") return false;
  return isFwdShortFoundRemark(r.__rcaText ?? "");
}

/** @param {ReturnType<typeof annotateRows>[number]} r */
export function isFwdCameraRow(r) {
  return r.__movement === "fwd" && !r.__pending && r.__kind === "camera_issues";
}

/**
 * Forward: hub fraud / risk — camera issues, multiple bagging (debagging), or "no short found".
 * Excludes {@link isFwdShortFoundRow} (visibility that the hub has not received the shipment; not this bucket).
 * @param {ReturnType<typeof annotateRows>[number]} r
 */
export function isFwdHubRiskRow(r) {
  if (r.__movement !== "fwd" || r.__pending) return false;
  if (isFwdShortFoundRow(r)) return false;
  if (r.__kind === "camera_issues") return true;
  if (r.__kind === "multiple_bagging") return true;
  return isFwdNoShortRow(r);
}

/**
 * @param {ReturnType<typeof annotateRows>} rows
 * @param {'all' | 'fwd' | 'rev'} movementFilter
 */
export function applyMovementFilter(rows, movementFilter) {
  if (movementFilter === "all") return rows;
  if (movementFilter === "fwd") return rows.filter((r) => r.__movement === "fwd");
  if (movementFilter === "rev") return rows.filter((r) => r.__movement === "rev");
  return rows;
}

/**
 * @param {ReturnType<typeof annotateRows>} rows
 * @param {DashboardFilter} filter
 */
export function applyFilter(rows, filter) {
  if (filter === "all") return rows;
  return rows.filter((r) => r.__kind === filter);
}

/**
 * Count distinct non-empty manifest (bag) IDs in rows — use for KPIs when rows can repeat per bag.
 * @param {Record<string, unknown>[]} rows
 * @param {string | null} manifestCol
 */
export function countUniqueManifests(rows, manifestCol) {
  if (!manifestCol) return rows.length;
  const s = new Set();
  for (const r of rows) {
    const k = String(r[manifestCol] ?? "").trim();
    if (k) s.add(k);
  }
  return s.size;
}

export function countByKind(rows) {
  const m = {
    pending: 0,
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

/**
 * Reverse: count toward “problematic hub” unless hub is confirmed proper bagging.
 * @param {ReturnType<typeof annotateRows>[number]} r
 */
export function isRevProblemHubRow(r) {
  if (r.__movement !== "rev") return false;
  if (r.__kind === "closed") return false;
  if (r.__kind === "proper_bagging") return false;
  return true;
}

/**
 * Forward: problematic unless pending-only pendency is excluded… include pending.
 * Excludes proper bagging and short found (trusted hub signals).
 * @param {ReturnType<typeof annotateRows>[number]} r
 */
export function isFwdProblemHubRow(r) {
  if (r.__movement !== "fwd") return false;
  if (r.__kind === "closed") return false;
  if (r.__pending) return true;
  if (r.__kind === "proper_bagging") return false;
  if (isFwdShortFoundRow(r)) return false;
  return true;
}

/**
 * Files without a movement column: exclude proper bagging, closed, and FWD-style short found when movement is FWD.
 * @param {ReturnType<typeof annotateRows>[number]} r
 */
export function isProblemHubRowLegacy(r) {
  if (r.__kind === "closed") return false;
  if (r.__kind === "proper_bagging") return false;
  if (r.__movement === "fwd" && !r.__pending && isFwdShortFoundRow(r)) return false;
  return true;
}

export function buildLmFraudOverlapHubs(revRows, fwdRows, hubField, limit = 15) {
  if (!hubField) return [];
  const revCount = new Map();
  const fwdCount = new Map();
  for (const r of revRows) {
    if (r.__kind !== "lm_fraud") continue;
    const h = String(r[hubField] ?? "").trim();
    if (!h) continue;
    revCount.set(h, (revCount.get(h) ?? 0) + 1);
  }
  for (const r of fwdRows) {
    if (r.__kind !== "lm_fraud") continue;
    const h = String(r[hubField] ?? "").trim();
    if (!h) continue;
    fwdCount.set(h, (fwdCount.get(h) ?? 0) + 1);
  }
  const out = [];
  for (const [hub, rev] of revCount) {
    if (!fwdCount.has(hub)) continue;
    const fwd = fwdCount.get(hub) ?? 0;
    out.push({ hub, rev, fwd, total: rev + fwd });
  }
  return out.sort((a, b) => b.total - a.total).slice(0, limit);
}

/**
 * Title-case words so "west", "West", "WEST" map to one bucket for zone charts.
 * @param {string} s
 */
export function canonicalizeZoneLabel(s) {
  const t = String(s ?? "").trim();
  if (!t) return "";
  return t
    .split(/\s+/)
    .map((w) => (w.length ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ""))
    .filter(Boolean)
    .join(" ");
}

/**
 * @param {{ skipEmpty?: boolean; keyNormalizer?: (trimmed: string) => string }} [opts]
 * If `skipEmpty`, rows with blank/null field are omitted (no "Unknown" bucket).
 * `keyNormalizer` groups values (e.g. canonicalizeZoneLabel for zone columns).
 */
export function aggregateByField(rows, fieldKey, limit = 12, opts = {}) {
  const skipEmpty = opts.skipEmpty === true;
  const keyNormalizer = typeof opts.keyNormalizer === "function" ? opts.keyNormalizer : null;
  if (!fieldKey) return [];
  const counts = new Map();
  for (const r of rows) {
    const raw = r[fieldKey];
    const trimmed = raw != null && String(raw).trim() !== "" ? String(raw).trim() : "";
    if (skipEmpty && !trimmed) continue;
    let label;
    if (trimmed) {
      label = keyNormalizer ? keyNormalizer(trimmed) : trimmed;
    } else {
      label = "Unknown";
    }
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

/** Bucket label used by {@link aggregateRca} (shortened RCA text). */
export function rcaAggregateKeyForRow(r) {
  const label =
    r.__rcaText && String(r.__rcaText).trim() !== ""
      ? String(r.__rcaText).trim()
      : "Unknown";
  return label.length > 42 ? `${label.slice(0, 40)}…` : label;
}

/** Rows whose RCA aggregates to the same key as in RCA category charts. */
export function rowsMatchingRcaAggregateKey(rows, key) {
  return rows.filter((r) => rcaAggregateKeyForRow(r) === key);
}

export function aggregateRca(rows, limit = 10) {
  const counts = new Map();
  for (const r of rows) {
    const short = rcaAggregateKeyForRow(r);
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
  const d = new Date(y, m - 1, day, 12, 0, 0, 0);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * @param {unknown} raw
 * @returns {Date | null}
 */
export function parseFlexibleDate(raw) {
  if (raw == null || String(raw).trim() === "") return null;
  const s = String(raw).trim();

  // Any string starting YYYY-MM-DD — local calendar date (avoids UTC midnight shifting day/week)
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const y = +iso[1];
    const mo = +iso[2];
    const d = +iso[3];
    const dt = new Date(y, mo - 1, d, 12, 0, 0, 0);
    if (!Number.isNaN(dt.getTime())) return dt;
  }

  if (/^\d+$/.test(s)) {
    const n = Number(s);
    if (n > 25000 && n < 65000) {
      const ms = Date.UTC(1899, 11, 30) + n * 86400000;
      const d = new Date(ms);
      if (!Number.isNaN(d.getTime())) return d;
    }
  }

  const slash = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (slash) {
    const a = +slash[1];
    const b = +slash[2];
    let y = +slash[3];
    if (y < 100) y += 2000;
    let day;
    let month;
    if (a > 12) {
      day = a;
      month = b;
    } else if (b > 12) {
      month = a;
      day = b;
    } else {
      day = a;
      month = b;
    }
    const dt = new Date(y, month - 1, day, 12, 0, 0, 0);
    if (!Number.isNaN(dt.getTime()) && dt.getFullYear() === y) return dt;
  }

  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d;
  return null;
}

/**
 * Contiguous Monday week keys from earliest to latest week seen in `dateCol` (any row).
 */
export function getFilledWeekKeysBetweenMinMax(rows, dateCol) {
  if (!dateCol) return [];
  let minW = null;
  let maxW = null;
  for (const r of rows) {
    const dt = parseFlexibleDate(r[dateCol]);
    if (!dt) continue;
    const wk = weekKeyFromDate(dt);
    if (!minW || wk < minW) minW = wk;
    if (!maxW || wk > maxW) maxW = wk;
  }
  if (!minW || !maxW) return [];
  const keys = [];
  const [y0, m0, d0] = minW.split("-").map(Number);
  let cur = new Date(y0, m0 - 1, d0, 12, 0, 0, 0);
  const [y1, m1, d1] = maxW.split("-").map(Number);
  const end = new Date(y1, m1 - 1, d1, 12, 0, 0, 0);
  while (cur <= end) {
    keys.push(formatYMDLocal(cur));
    cur.setDate(cur.getDate() + 7);
  }
  return keys;
}

/**
 * @param {ReturnType<typeof annotateRows>} rows
 * @param {string | null} dateCol
 * @param {string} kind
 * @param {string[] | null | undefined} weekKeysFilled If set, one point per week (zeros filled); same keys for every chart.
 * @returns {{ weekKey: string; label: string; count: number }[]}
 */
export function buildWeeklySeriesForKind(rows, dateCol, kind, weekKeysFilled) {
  if (!dateCol) return [];
  const map = new Map();
  for (const r of rows) {
    if (r.__kind !== kind) continue;
    const dt = parseFlexibleDate(r[dateCol]);
    if (!dt) continue;
    const key = weekKeyFromDate(dt);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  const keys =
    weekKeysFilled != null && weekKeysFilled.length
      ? weekKeysFilled
      : [...map.keys()].sort((a, b) => a.localeCompare(b));
  return keys.map((weekKey) => ({
    weekKey,
    label: shortWeekLabel(weekKey),
    count: map.get(weekKey) ?? 0,
  }));
}

/**
 * @param {ReturnType<typeof annotateRows>} rows
 * @param {string | null} dateCol
 * @param {(r: ReturnType<typeof annotateRows>[number]) => boolean} predicate
 * @param {string[] | undefined} weekKeysFilled
 */
export function buildWeeklySeriesForPredicate(rows, dateCol, predicate, weekKeysFilled) {
  if (!dateCol) return [];
  const map = new Map();
  for (const r of rows) {
    if (!predicate(r)) continue;
    const dt = parseFlexibleDate(r[dateCol]);
    if (!dt) continue;
    const key = weekKeyFromDate(dt);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  const keys =
    weekKeysFilled != null && weekKeysFilled.length
      ? weekKeysFilled
      : [...map.keys()].sort((a, b) => a.localeCompare(b));
  return keys.map((weekKey) => ({
    weekKey,
    label: shortWeekLabel(weekKey),
    count: map.get(weekKey) ?? 0,
  }));
}

/**
 * @param {{ weekKey: string; label: string; count: number }[]} series
 */
export function compareLatestWeeks(series) {
  if (!series.length) {
    return {
      direction: "none",
      summary: "No data",
      last: 0,
      prev: null,
      delta: null,
      pct: null,
    };
  }
  const withData = series.filter((x) => x.count > 0);
  if (withData.length === 0) {
    return {
      direction: "none",
      summary: "No data",
      last: 0,
      prev: null,
      delta: null,
      pct: null,
    };
  }
  if (withData.length < 2) {
    const last = withData[withData.length - 1];
    return {
      direction: "baseline",
      summary: `${last.count} · week of ${last.label}`,
      last: last.count,
      prev: null,
      delta: null,
      pct: null,
    };
  }
  const last = withData[withData.length - 1];
  const prev = withData[withData.length - 2];
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
  if (row.__kind === "pending" || row.__pending) return false;
  if (row.__kind === "closed" || row.__kind === "offline") return false;
  const rca = String(row.__rcaText ?? "").trim();
  if (!rca) return false;
  const t = rca.toLowerCase();
  const normalized = t
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (normalized.includes("not centralized") || normalized.includes("not centralised")) return false;
  if (/\bbackup\b.*\bissues?\b/.test(normalized) || normalized.includes("backupissue")) return false;
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
 * `count` is productivity as a percentage (valid RCA ÷ eligible × 100) for sparklines / compareLatestWeeks.
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
          ? Math.round((validRca / totalEligible) * 1000) / 10
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
  const weekKeys = getFilledWeekKeysBetweenMinMax(rows, dateCol);
  if (!weekKeys.length) return [];
  const byKind = {};
  for (const k of TREND_KINDS) {
    byKind[k] = buildWeeklySeriesForKind(rows, dateCol, k, weekKeys);
  }
  return weekKeys.map((wk) => {
    const row = { week_start: wk };
    for (const k of TREND_KINDS) {
      const hit = byKind[k].find((x) => x.weekKey === wk);
      row[k] = hit ? hit.count : 0;
    }
    return row;
  });
}

/** Weekly pivot for forward rows: short found, no short, camera. */
export function buildWeeklyPivotRowsFwd(rows, dateCol) {
  if (!dateCol) return [];
  const fwd = rows.filter((r) => r.__movement === "fwd");
  const weekKeys = getFilledWeekKeysBetweenMinMax(fwd.length ? fwd : rows, dateCol);
  if (!weekKeys.length) return [];
  const shortS = buildWeeklySeriesForPredicate(fwd, dateCol, isFwdShortFoundRow, weekKeys);
  const noShortS = buildWeeklySeriesForPredicate(fwd, dateCol, isFwdNoShortRow, weekKeys);
  const camS = buildWeeklySeriesForPredicate(fwd, dateCol, isFwdCameraRow, weekKeys);
  return weekKeys.map((wk) => {
    const a = shortS.find((x) => x.weekKey === wk);
    const b = noShortS.find((x) => x.weekKey === wk);
    const c = camS.find((x) => x.weekKey === wk);
    return {
      week_start: wk,
      fwd_short_found: a ? a.count : 0,
      fwd_no_short: b ? b.count : 0,
      fwd_camera_issues: c ? c.count : 0,
    };
  });
}

/**
 * Combined pivot when "all movements": REV issue kinds + FWD short buckets per week.
 * @param {ReturnType<typeof annotateRows>} rows
 */
export function buildWeeklyPivotRowsAllMovements(rows, dateCol) {
  if (!dateCol) return [];
  const weekKeys = getFilledWeekKeysBetweenMinMax(rows, dateCol);
  if (!weekKeys.length) return [];
  const rev = rows.filter((r) => r.__movement === "rev");
  const fwd = rows.filter((r) => r.__movement === "fwd");
  const revPartial = buildWeeklySeriesForKind(rev, dateCol, "partial_bagging", weekKeys);
  const revFraud = buildWeeklySeriesForKind(rev, dateCol, "lm_fraud", weekKeys);
  const revCam = buildWeeklySeriesForKind(rev, dateCol, "camera_issues", weekKeys);
  const fwdShort = buildWeeklySeriesForPredicate(fwd, dateCol, isFwdShortFoundRow, weekKeys);
  const fwdNoShort = buildWeeklySeriesForPredicate(fwd, dateCol, isFwdNoShortRow, weekKeys);
  const fwdCam = buildWeeklySeriesForPredicate(fwd, dateCol, isFwdCameraRow, weekKeys);
  return weekKeys.map((wk) => {
    const rp = revPartial.find((x) => x.weekKey === wk);
    const rf = revFraud.find((x) => x.weekKey === wk);
    const rc = revCam.find((x) => x.weekKey === wk);
    const fs = fwdShort.find((x) => x.weekKey === wk);
    const fn = fwdNoShort.find((x) => x.weekKey === wk);
    const fc = fwdCam.find((x) => x.weekKey === wk);
    return {
      week_start: wk,
      rev_partial_bagging: rp ? rp.count : 0,
      rev_lm_fraud: rf ? rf.count : 0,
      rev_camera_issues: rc ? rc.count : 0,
      fwd_short_found: fs ? fs.count : 0,
      fwd_no_short: fn ? fn.count : 0,
      fwd_camera_issues: fc ? fc.count : 0,
    };
  });
}
