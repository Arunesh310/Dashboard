import { cameraInsightIndex } from "./uploadDiff.js";

const KEY = "data-visual-camera-baseline-v1";

const C_KEY = { online: "o", offline: "f", other: "x" };
const C_REV = { o: "online", f: "offline", x: "other" };

/**
 * @returns {{ savedAt: string, fileName: string, map: Map<string, { connectivity: string, notCentralized: boolean }> } | null}
 */
export function loadCameraBaseline() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o || o.v !== 1 || !o.cams || typeof o.savedAt !== "string") return null;
    const map = new Map();
    for (const [id, cell] of Object.entries(o.cams)) {
      if (!cell || typeof cell.c !== "string") continue;
      map.set(id, {
        connectivity: C_REV[cell.c] || "other",
        notCentralized: Boolean(cell.nc),
      });
    }
    return {
      savedAt: o.savedAt,
      fileName: typeof o.fileName === "string" ? o.fileName : "",
      map,
    };
  } catch {
    return null;
  }
}

/**
 * @param {import("./cameraStatus.js").CameraStatusRow[]} rows
 * @param {string} fileName
 */
export function saveCameraBaseline(rows, fileName) {
  try {
    const idx = cameraInsightIndex(rows);
    const cams = {};
    for (const [id, v] of idx) {
      cams[id] = { c: C_KEY[v.connectivity] || "x", nc: v.notCentralized ? 1 : 0 };
    }
    localStorage.setItem(
      KEY,
      JSON.stringify({
        v: 1,
        savedAt: new Date().toISOString(),
        fileName: fileName || "camera.csv",
        cams,
      })
    );
  } catch {
    /* quota / private mode */
  }
}

export function clearCameraBaseline() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
