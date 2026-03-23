function norm(s) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ");
}

function matches(fieldName, aliases) {
  const n = norm(fieldName);
  return aliases.some((a) => {
    const an = norm(a);
    return n === an || n.includes(an) || an.includes(n);
  });
}

/**
 * @param {string[]} fields
 * @returns {{ rca: string | null; hub: string | null; zone: string | null; manifest: string | null; open: string | null; date: string | null; cctv: string | null; poc: string | null }}
 */
export function detectColumns(fields) {
  if (!fields?.length) {
    return {
      rca: null,
      hub: null,
      zone: null,
      manifest: null,
      open: null,
      date: null,
      cctv: null,
      poc: null,
    };
  }

  const pick = (aliases) => fields.find((f) => matches(f, aliases)) ?? null;

  /** Prefer upload-date columns so weekly trends match operational “as of upload”, not incident/created dates. */
  const pickDate = () => {
    const priority = [
      "data uploaded date",
      "data uploaded",
      "uploaded date",
      "upload date",
      "date uploaded",
      "uploaded at",
      "upload_at",
    ];
    for (const p of priority) {
      const hit = fields.find((f) => matches(f, [p]));
      if (hit) return hit;
    }
    return pick([
      "date",
      "week",
      "day",
      "created",
      "created at",
      "created_at",
      "reported",
      "reported date",
      "incident date",
      "event date",
      "timestamp",
      "occurred",
      "observation date",
    ]);
  };

  return {
    rca: pick([
      "rca",
      "root cause",
      "root_cause",
      "category",
      "issue",
      "issue type",
      "issue_type",
      "status detail",
    ]),
    hub: pick(["hub", "location", "site", "warehouse", "center"]),
    zone: pick(["zone", "region", "area"]),
    manifest: pick([
      "manifest",
      "manifest id",
      "awb",
      "shipment id",
      "id",
      "order id",
    ]),
    open: pick(["open", "open count", "opens", "open issues"]),
    date: pickDate(),
    cctv: pick([
      "cctv",
      "cctv flag",
      "has cctv",
      "footage",
      "video",
      "camera feed",
    ]),
    poc: pick([
      "poc",
      "point of contact",
      "point_of_contact",
      "poc name",
      "poc_name",
      "owner",
      "analyst",
      "assigned to",
      "assignee",
    ]),
  };
}

export function getRcaValue(row, colMap, fields) {
  const key = colMap.rca ?? fields[0];
  return row[key] != null ? String(row[key]) : "";
}
