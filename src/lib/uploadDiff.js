import { annotateRows, canonicalizeZoneLabel } from "./analytics.js";
import { detectColumns, getRcaValue } from "./columns.js";

const SAMPLE = 8;
const ZONE_CHANGE_CAP = 12;

/** @param {Record<string, unknown>[]} rows */
function dedupeRowsByManifest(rows, colMap, fields) {
  const manifestCol = colMap.manifest;
  if (!manifestCol) return rows;
  const pocCol = colMap.poc;
  const seen = new Set();
  const unique = [];
  for (const r of rows) {
    const manifestId = String(r[manifestCol] ?? "").trim();
    if (!manifestId) continue;
    const remark = getRcaValue(r, colMap, fields).trim().toLowerCase();
    const poc = pocCol ? String(r[pocCol] ?? "").trim().toLowerCase() : "";
    const key = `${manifestId}||${remark}||${poc}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(r);
  }
  return unique;
}

/**
 * Build manifest → { zone, hub } from raw parsed dashboard rows (same logic as App normalized + annotated).
 * @param {Record<string, unknown>[]} dataRows
 * @param {string[]} fields
 * @returns {Map<string, { zone: string, hub: string }>}
 */
export function manifestZoneMapFromDashboardRows(dataRows, fields) {
  const colMap = detectColumns(fields);
  const manifestCol = colMap.manifest;
  const map = new Map();
  if (!manifestCol || !dataRows.length) return map;

  const normalized = dedupeRowsByManifest(dataRows, colMap, fields);
  const annotated = annotateRows(normalized, colMap, fields).filter((r) => r.__kind !== "closed");

  for (const r of annotated) {
    const m = String(r[manifestCol] ?? "").trim();
    if (!m || map.has(m)) continue;
    const zone = colMap.zone ? String(r[colMap.zone] ?? "").trim() : "";
    const hub = colMap.hub ? String(r[colMap.hub] ?? "").trim() : "";
    map.set(m, { zone, hub });
  }
  return map;
}

/**
 * @param {Map<string, { zone: string, hub: string }>|null|undefined} prev
 * @param {Map<string, { zone: string, hub: string }>} next
 */
export function diffDashboardManifestMaps(prev, next) {
  if (!prev || prev.size === 0) {
    return null;
  }

  const prevKeys = new Set(prev.keys());
  const nextKeys = new Set(next.keys());

  const newManifests = [...nextKeys].filter((k) => !prevKeys.has(k));
  const closedManifests = [...prevKeys].filter((k) => !nextKeys.has(k));

  /** @type {{ manifest: string, fromZone: string, toZone: string }[]} */
  const zoneChanges = [];
  for (const m of nextKeys) {
    if (!prevKeys.has(m)) continue;
    const a = prev.get(m);
    const b = next.get(m);
    if (!a || !b) continue;
    const z0 = canonicalizeZoneLabel(a.zone);
    const z1 = canonicalizeZoneLabel(b.zone);
    if (z0 !== z1) {
      zoneChanges.push({ manifest: m, fromZone: a.zone || "—", toZone: b.zone || "—" });
    }
  }

  const newCount = newManifests.length;
  const closedCount = closedManifests.length;
  const zoneChangeCount = zoneChanges.length;
  if (newCount === 0 && closedCount === 0 && zoneChangeCount === 0) return null;

  return {
    newCount,
    closedCount,
    zoneChangeCount,
    newSample: newManifests.slice(0, SAMPLE),
    closedSample: closedManifests.slice(0, SAMPLE),
    zoneChanges: zoneChanges.slice(0, ZONE_CHANGE_CAP),
  };
}

/** @param {import("./cameraStatus.js").CameraStatusRow} r */
function connectivity(r) {
  if (r.isOnline) return "online";
  if (r.isOffline) return "offline";
  return "other";
}

/**
 * @param {import("./cameraStatus.js").CameraStatusRow[]} rows
 * @returns {Map<string, { connectivity: 'online'|'offline'|'other' }>}
 */
export function cameraConnectivityIndex(rows) {
  const m = new Map();
  for (const r of rows) {
    m.set(r.cameraId, { connectivity: connectivity(r) });
  }
  return m;
}

/**
 * @param {Map<string, { connectivity: string }>|null|undefined} prev
 * @param {Map<string, { connectivity: string }>} next
 */
export function diffCameraConnectivityMaps(prev, next) {
  if (!prev || prev.size === 0) return null;

  /** @type {string[]} */
  const added = [];
  /** @type {string[]} */
  const removed = [];
  /** @type {string[]} */
  const onlineToOffline = [];
  /** @type {string[]} */
  const offlineToOnline = [];

  for (const id of next.keys()) {
    if (!prev.has(id)) added.push(id);
  }
  for (const id of prev.keys()) {
    if (!next.has(id)) removed.push(id);
  }

  for (const id of next.keys()) {
    if (!prev.has(id)) continue;
    const a = prev.get(id);
    const b = next.get(id);
    if (!a || !b) continue;
    if (a.connectivity === "online" && b.connectivity === "offline") onlineToOffline.push(id);
    else if (a.connectivity === "offline" && b.connectivity === "online") offlineToOnline.push(id);
  }

  const addedCount = added.length;
  const removedCount = removed.length;
  const onlineToOfflineCount = onlineToOffline.length;
  const offlineToOnlineCount = offlineToOnline.length;
  if (
    addedCount === 0 &&
    removedCount === 0 &&
    onlineToOfflineCount === 0 &&
    offlineToOnlineCount === 0
  ) {
    return null;
  }

  return {
    addedCount,
    removedCount,
    onlineToOfflineCount,
    offlineToOnlineCount,
    addedSample: added.slice(0, SAMPLE),
    removedSample: removed.slice(0, SAMPLE),
    onlineToOfflineSample: onlineToOffline.slice(0, SAMPLE),
    offlineToOnlineSample: offlineToOnline.slice(0, SAMPLE),
  };
}
