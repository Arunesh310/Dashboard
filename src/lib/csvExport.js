function slugSegment(seg) {
  const s = String(seg ?? "")
    .trim()
    .replace(/\.csv$/gi, "")
    .replace(/\W+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  return s.slice(0, 56) || "x";
}

/** YYYY-MM-DD + slugged segments for readable export names. */
export function buildExportFilename(base, ...segments) {
  const date = new Date().toISOString().slice(0, 10);
  const root = slugSegment(base);
  const extras = segments.map(slugSegment).filter((x) => x && x !== "x");
  return `${[root, date, ...extras].join("_")}.csv`;
}

function escapeCell(v) {
  const s = v == null ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function rowsToCsvString(rows, fields) {
  const header = fields.map(escapeCell).join(",");
  const lines = rows.map((r) => fields.map((f) => escapeCell(r[f])).join(","));
  return [header, ...lines].join("\n");
}

export function downloadCsv(filename, rows, fields) {
  if (!fields?.length) return;
  const csv = rowsToCsvString(rows, fields);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function shortCount(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "0";
  if (x >= 1_000_000)
    return `${(x / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (x >= 1_000) return `${(x / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(Math.round(x));
}
