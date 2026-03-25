export const ALERTS_STORAGE_KEY = "data-visual-alerts-v1";

/**
 * @typedef {Object} AlertThresholds
 * @property {number} lmFraudMin
 * @property {number} partialBaggingMin
 * @property {number} notCentralizedMin
 * @property {number} zoneOfflinePctMin
 * @property {{ lmFraud: boolean, partialBagging: boolean, notCentralized: boolean, zoneOffline: boolean }} enabled
 */

/** @type {AlertThresholds} */
export const DEFAULT_ALERT_THRESHOLDS = {
  lmFraudMin: 5,
  partialBaggingMin: 20,
  notCentralizedMin: 10,
  zoneOfflinePctMin: 25,
  enabled: {
    lmFraud: true,
    partialBagging: true,
    notCentralized: true,
    zoneOffline: true,
  },
};

function clampInt(n, min, max) {
  const x = Math.round(Number(n));
  if (!Number.isFinite(x)) return min;
  return Math.min(max, Math.max(min, x));
}

/** @returns {AlertThresholds} */
export function normalizeAlertThresholds(raw) {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_ALERT_THRESHOLDS, enabled: { ...DEFAULT_ALERT_THRESHOLDS.enabled } };
  const en = raw.enabled && typeof raw.enabled === "object" ? raw.enabled : {};
  return {
    lmFraudMin: clampInt(raw.lmFraudMin ?? DEFAULT_ALERT_THRESHOLDS.lmFraudMin, 0, 999999),
    partialBaggingMin: clampInt(raw.partialBaggingMin ?? DEFAULT_ALERT_THRESHOLDS.partialBaggingMin, 0, 999999),
    notCentralizedMin: clampInt(raw.notCentralizedMin ?? DEFAULT_ALERT_THRESHOLDS.notCentralizedMin, 0, 999999),
    zoneOfflinePctMin: clampInt(raw.zoneOfflinePctMin ?? DEFAULT_ALERT_THRESHOLDS.zoneOfflinePctMin, 0, 100),
    enabled: {
      lmFraud: Boolean(en.lmFraud ?? DEFAULT_ALERT_THRESHOLDS.enabled.lmFraud),
      partialBagging: Boolean(en.partialBagging ?? DEFAULT_ALERT_THRESHOLDS.enabled.partialBagging),
      notCentralized: Boolean(en.notCentralized ?? DEFAULT_ALERT_THRESHOLDS.enabled.notCentralized),
      zoneOffline: Boolean(en.zoneOffline ?? DEFAULT_ALERT_THRESHOLDS.enabled.zoneOffline),
    },
  };
}

/** @returns {AlertThresholds} */
export function loadAlertThresholds() {
  try {
    const raw = localStorage.getItem(ALERTS_STORAGE_KEY);
    if (!raw) return normalizeAlertThresholds(null);
    return normalizeAlertThresholds(JSON.parse(raw));
  } catch {
    return normalizeAlertThresholds(null);
  }
}

/** @param {AlertThresholds} t */
export function saveAlertThresholds(t) {
  try {
    localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(normalizeAlertThresholds(t)));
  } catch {
    /* ignore */
  }
}

/**
 * @param {Record<string, number>} counts from countByKind
 * @param {AlertThresholds} thresholds
 * @returns {{ id: string, severity: 'warn', message: string }[]}
 */
export function evaluateDashboardAlerts(counts, thresholds) {
  const out = [];
  if (thresholds.enabled.lmFraud && (counts.lm_fraud ?? 0) >= thresholds.lmFraudMin) {
    out.push({
      id: "lm-fraud",
      severity: "warn",
      message: `LM fraud: ${(counts.lm_fraud ?? 0).toLocaleString()} open (≥${thresholds.lmFraudMin})`,
    });
  }
  if (thresholds.enabled.partialBagging && (counts.partial_bagging ?? 0) >= thresholds.partialBaggingMin) {
    out.push({
      id: "partial-bagging",
      severity: "warn",
      message: `Partial bagging: ${(counts.partial_bagging ?? 0).toLocaleString()} (≥${thresholds.partialBaggingMin})`,
    });
  }
  return out;
}

/**
 * @param {{ zone: string, total: number, offline: number, offlinePct: number }[]} zoneAgg from aggregateZone()
 * @param {{ notCentralized: number }} cameraKpis from summarizeCameras
 * @param {AlertThresholds} thresholds
 * @param {{ minCameras?: number }} [opts]
 */
export function evaluateCameraAlerts(zoneAgg, cameraKpis, thresholds, opts = {}) {
  const minCameras = opts.minCameras ?? 3;
  const out = [];
  if (thresholds.enabled.zoneOffline && Array.isArray(zoneAgg)) {
    for (const z of zoneAgg) {
      if (z.total < minCameras || z.offline <= 0) continue;
      if (z.offlinePct >= thresholds.zoneOfflinePctMin) {
        out.push({
          id: `zone-offline-${z.zone}`,
          severity: "warn",
          message: `${z.zone}: ${z.offlinePct.toFixed(1)}% offline (≥${thresholds.zoneOfflinePctMin}%, ${z.offline}/${z.total} cams)`,
        });
      }
    }
  }
  if (
    thresholds.enabled.notCentralized &&
    (cameraKpis.notCentralized ?? 0) >= thresholds.notCentralizedMin
  ) {
    out.push({
      id: "not-centralized",
      severity: "warn",
      message: `Not centralized: ${(cameraKpis.notCentralized ?? 0).toLocaleString()} (≥${thresholds.notCentralizedMin})`,
    });
  }
  return out;
}
