/** @typedef {{ cameraId: string, zone: string, pod: string, rca: string, status: string, isOnline: boolean, isOffline: boolean }} CameraStatusRow */

export function normalizeHeaderKey(h) {
  return String(h ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * @param {string[]} fields
 * @returns {{ alias: string | null, zone: string | null, pod: string | null, remark: string | null, status: string | null }}
 */
export function detectCameraStatusColumns(fields) {
  const byNorm = new Map();
  for (const f of fields) {
    byNorm.set(normalizeHeaderKey(f), f);
  }
  const pick = (...names) => {
    for (const n of names) {
      const k = normalizeHeaderKey(n);
      if (byNorm.has(k)) return byNorm.get(k);
    }
    return null;
  };
  return {
    alias: pick("alias", "camera id", "cameraid", "camera"),
    zone: pick("zone"),
    pod: pick("pod", "p o d"),
    remark: pick("remark", "rca"),
    status: pick("status"),
  };
}

/** @returns {"online" | "offline" | null} */
export function normalizeStatus(raw) {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!s) return null;
  if (s === "online" || s === "on") return "online";
  if (s === "offline" || s === "off") return "offline";
  if (s.includes("offline")) return "offline";
  if (s.includes("online")) return "online";
  return null;
}

/**
 * @param {Record<string, unknown>} raw
 * @param {{ alias: string | null, zone: string | null, pod: string | null, remark: string | null, status: string | null }} cols
 * @returns {CameraStatusRow | null}
 */
export function normalizeCameraStatusRow(raw, cols) {
  if (!cols.alias || !cols.status) return null;
  const cameraId = String(raw[cols.alias] ?? "").trim();
  if (!cameraId) return null;
  const statusRaw = String(raw[cols.status] ?? "").trim();
  if (!statusRaw) return null;
  const zone = cols.zone ? String(raw[cols.zone] ?? "").trim() : "";
  const pod = cols.pod ? String(raw[cols.pod] ?? "").trim() : "";
  const rca = cols.remark ? String(raw[cols.remark] ?? "").trim() : "";
  const st = normalizeStatus(statusRaw);
  if (st === null) return null;
  return {
    cameraId,
    zone,
    pod,
    rca,
    status: st,
    isOnline: st === "online",
    isOffline: st === "offline",
  };
}

/**
 * @param {Record<string, unknown>[]} rawRows
 * @param {{ alias: string | null, zone: string | null, pod: string | null, remark: string | null, status: string | null }} cols
 */
export function buildCameraStatusRows(rawRows, cols) {
  const out = [];
  for (const r of rawRows) {
    const row = normalizeCameraStatusRow(r, cols);
    if (row) out.push(row);
  }
  return out;
}

/**
 * @param {CameraStatusRow[]} rows
 * @param {{ zone: string, pod: string, status: string }} filters
 */
export function filterCameraStatusRows(rows, filters) {
  const { zone, pod, status } = filters;
  return rows.filter((r) => {
    if (zone !== "all" && r.zone !== zone) return false;
    if (pod !== "all" && r.pod !== pod) return false;
    if (status === "all") return true;
    if (status === "online") return r.isOnline;
    if (status === "offline") return r.isOffline;
    return true;
  });
}

/**
 * @param {CameraStatusRow[]} rows
 */
export function summarizeCameras(rows) {
  const total = rows.length;
  let online = 0;
  let offline = 0;
  for (const r of rows) {
    if (r.isOnline) online++;
    else offline++;
  }
  const offlinePct = total ? (offline / total) * 100 : 0;
  const onlinePct = total ? (online / total) * 100 : 0;
  return { total, online, offline, offlinePct, onlinePct };
}

/**
 * @param {CameraStatusRow[]} rows
 */
export function aggregateZone(rows) {
  const m = new Map();
  for (const r of rows) {
    const z = (r.zone || "").trim();
    if (!z) continue;
    if (!m.has(z)) m.set(z, { total: 0, online: 0, offline: 0 });
    const a = m.get(z);
    a.total++;
    if (r.isOnline) a.online++;
    if (r.isOffline) a.offline++;
  }
  return [...m.entries()]
    .map(([zone, v]) => ({
      zone,
      total: v.total,
      online: v.online,
      offline: v.offline,
      offlinePct: v.total ? (v.offline / v.total) * 100 : 0,
    }))
    .sort((a, b) => b.offline - a.offline || String(a.zone).localeCompare(String(b.zone)));
}

/**
 * @param {CameraStatusRow[]} rows
 */
export function aggregatePod(rows) {
  const m = new Map();
  for (const r of rows) {
    const p = (r.pod || "").trim();
    if (!p) continue;
    if (!m.has(p)) m.set(p, { total: 0, online: 0, offline: 0 });
    const a = m.get(p);
    a.total++;
    if (r.isOnline) a.online++;
    if (r.isOffline) a.offline++;
  }
  return [...m.entries()]
    .map(([pod, v]) => ({
      pod,
      total: v.total,
      online: v.online,
      offline: v.offline,
      pct: v.total ? (v.offline / v.total) * 100 : 0,
    }))
    .sort((a, b) => b.offline - a.offline || String(a.pod).localeCompare(String(b.pod)));
}

/**
 * Offline cameras only — group by remark (RCA)
 * @param {CameraStatusRow[]} rows
 */
export function rcaOfflineBreakdown(rows) {
  const m = new Map();
  for (const r of rows) {
    if (!r.isOffline) continue;
    const key = (r.rca || "").trim();
    if (!key) continue;
    m.set(key, (m.get(key) ?? 0) + 1);
  }
  return [...m.entries()]
    .map(([remark, count]) => ({ remark, count }))
    .sort((a, b) => b.count - a.count || a.remark.localeCompare(b.remark));
}

/**
 * RCA rows with share of offline pool and share of current filtered view.
 * @param {CameraStatusRow[]} rows
 * @returns {{ remark: string, count: number, pctOfOffline: number, pctOfView: number }[]}
 */
export function rcaOfflineBreakdownEnriched(rows) {
  const filteredTotal = rows.length;
  let offlineTotal = 0;
  for (const r of rows) {
    if (r.isOffline) offlineTotal++;
  }
  const base = rcaOfflineBreakdown(rows);
  return base.map((x) => ({
    remark: x.remark,
    count: x.count,
    pctOfOffline: offlineTotal ? (x.count / offlineTotal) * 100 : 0,
    pctOfView: filteredTotal ? (x.count / filteredTotal) * 100 : 0,
  }));
}

/**
 * RCA across all cameras in view (not only offline), for comparison exports.
 * @param {CameraStatusRow[]} rows
 */
export function rcaAllBreakdown(rows) {
  const m = new Map();
  for (const r of rows) {
    const key = (r.rca || "").trim();
    if (!key) continue;
    m.set(key, (m.get(key) ?? 0) + 1);
  }
  const total = rows.length;
  return [...m.entries()]
    .map(([remark, count]) => ({
      remark,
      count,
      pctOfView: total ? (count / total) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count || a.remark.localeCompare(b.remark));
}

export function displayStatusLabel(r) {
  return r.isOnline ? "Online" : "Offline";
}

/**
 * @param {CameraStatusRow[]} rows
 */
export function rowsToDetailExport(rows) {
  return rows.map((r) => ({
    Alias: r.cameraId,
    Zone: r.zone,
    POD: r.pod,
    Status: displayStatusLabel(r),
    RCA: (r.rca || "").trim(),
  }));
}

export const CAMERA_DETAIL_FIELDS = ["Alias", "Zone", "POD", "Status", "RCA"];
