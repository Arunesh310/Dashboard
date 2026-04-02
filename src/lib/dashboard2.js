import * as XLSX from "xlsx";

function asTrimmedString(v) {
  if (v == null) return "";
  return String(v).trim();
}

function asNumber(v) {
  if (v == null || v === "") return 0;
  const n = Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

function asDate(v) {
  if (v == null || v === "") return null;
  if (v instanceof Date && Number.isFinite(v.getTime())) return v;
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    const dt = new Date(Date.UTC(d.y, (d.m ?? 1) - 1, d.d ?? 1, d.H ?? 0, d.M ?? 0, d.S ?? 0));
    return Number.isFinite(dt.getTime()) ? dt : null;
  }
  const s = String(v).trim();
  const dt = new Date(s);
  if (Number.isFinite(dt.getTime())) return dt;
  return null;
}

function monthKey(d) {
  if (!d) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function normalizeRow(r, source) {
  const awb =
    asTrimmedString(r.Awb_number) ||
    asTrimmedString(r.awb_number) ||
    asTrimmedString(r.AWB) ||
    asTrimmedString(r.awb);

  const scanDate = asDate(r["Scan Date"] ?? r.scan_date ?? r.ScanDate ?? r.scanDate);
  const orderDate = asDate(r.Order_date ?? r.order_date ?? r.OrderDate ?? r.orderDate);
  const pickedDate = asDate(r["picked_rto_rts date"] ?? r.picked_rto_rts_date ?? r.pickedDate);

  const orderStatus = asTrimmedString(r.order_status ?? r["Order Status"] ?? r.OrderStatus);
  const price = asNumber(r.price ?? r.Price ?? r.debit_value ?? r["Debit Value"]);

  const issueType = asTrimmedString(r["Issue Type"] ?? r.issue_type ?? r.IssueType);
  const issueCategory = asTrimmedString(r["Issue Category"] ?? r.issue_category ?? r.IssueCategory);

  const node = asTrimmedString(r.Node ?? r.node ?? r.current_location ?? r.Current_location);
  const nodeType = asTrimmedString(r["Node Type"] ?? r.node_type ?? r.NodeType);

  const pod = asTrimmedString(r.pod ?? r["POD Name"] ?? r.PODName ?? r["POD"]);
  const podZone = asTrimmedString(r.zone ?? r["POD Zone"] ?? r.PODZone ?? r["Zone"]);

  const stateHead = asTrimmedString(r["State Head"] ?? r.state_head ?? r.StateHead);
  const client = asTrimmedString(r.Client ?? r.client ?? r.Alpha_client ?? r.AlphaClient);
  const paymentMode = asTrimmedString(r.payment_mode ?? r.PaymentMode ?? r["Payment Mode"]);

  const hub = asTrimmedString(r.hub ?? r.Hub ?? r.Node ?? r.node);
  const szm = asTrimmedString(r.szm ?? r.SZM ?? r.Szm);
  const state = asTrimmedString(r.state ?? r.State);
  const hubType = asTrimmedString(r.hub_type ?? r.HubType);
  const connectOrBaggingType = asTrimmedString(r.connect_or_bagging_type ?? r.ConnectOrBaggingType);
  const movementType = asTrimmedString(r.Movement_type ?? r.movement_type ?? r.MovementType);
  const exceptionType = asTrimmedString(r.exception_type ?? r["exception_type"] ?? r.ExceptionType ?? r["Exception Type"]);
  const exceptionStatus = asTrimmedString(
    r.exception_status ?? r["exception_status"] ?? r.ExceptionStatus ?? r["Exception Status"]
  );
  const exceptionRemarks = asTrimmedString(
    r.exception_remarks ?? r["exception_remarks"] ?? r.ExceptionRemarks ?? r["Exception Remarks"]
  );

  const mmStatus = asTrimmedString(
    r.mm_status ??
      r.MM_Status ??
      r.MMStatus ??
      r.Manifest_status ??
      r.manifest_status ??
      r.manifestStatus ??
      r.Manifest_status
  );
  const typeField = asTrimmedString(r.Type ?? r.type ?? r.Flow ?? r.flow);
  const manifestDestination = asTrimmedString(r.manifest_destination ?? r.Manifest_Destination ?? r.manifestDestination);
  const mmDestination = asTrimmedString(r.mm_destination ?? r.MM_destination ?? r.mmDestination ?? r.MMD);
  const manifestReceivedTime = asTrimmedString(r.manifest_received_time ?? r.Manifest_Received_Time ?? r.manifestReceivedTime);
  const awbNumberException = asTrimmedString(r.awb_number_exception ?? r.Awb_number_exception ?? r.awbException);

  const sourceKey = String(source || "").toLowerCase();
  const typeKey = typeField.toLowerCase();
  const movementKey = movementType.toLowerCase();
  const issueTypeKey = issueType.toLowerCase();

  const flow =
    typeKey.includes("forward") || movementKey.includes("dch") || sourceKey.includes("forward")
      ? "forward"
      : typeKey.includes("reverse") || movementKey.includes("lmodc") || movementKey.includes("lm")
        ? "reverse"
        : "unknown";

  const isBnc =
    sourceKey.includes("b_n_c") ||
    sourceKey.includes("bagging") ||
    connectOrBaggingType.toLowerCase().includes("bagging pendency") ||
    connectOrBaggingType.toLowerCase().includes("connection") ||
    (!manifestDestination && !mmDestination);

  const isBrsnr =
    sourceKey.includes("brsnr") ||
    issueTypeKey.includes("brsnr") ||
    (manifestReceivedTime && issueTypeKey.includes("pendency"));

  const isLossReported =
    exceptionType.toLowerCase() === "loss reported" ||
    sourceKey.includes("lost_reported") ||
    sourceKey.includes("lost reported") ||
    Boolean(awbNumberException);

  const effectiveDate = scanDate ?? orderDate ?? pickedDate;

  const normalized = {
    __source: source,
    awb,
    orderStatus,
    price,
    scanDate,
    orderDate,
    pickedDate,
    month: monthKey(effectiveDate),
    issueType,
    issueCategory,
    node,
    nodeType,
    pod,
    podZone,
    stateHead,
    client,
    paymentMode,
    hub,
    szm,
    state,
    hubType,
    connectOrBaggingType,
    movementType,
    mmStatus,
    flow,
    isBnc,
    isBrsnr,
    isLossReported,
    exceptionType,
    exceptionStatus,
    exceptionRemarks,
    __raw: r,
  };

  return normalized;
}

function sheetToJson(workbook, name) {
  const ws = workbook.Sheets[name];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { defval: "", raw: true });
}

export function parsePanIndiaWorkbook(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: "array", cellDates: true, dense: true });
  const names = wb.SheetNames ?? [];
  const sheetCounts = {};
  const combined = [];
  for (const sheetName of names) {
    const sheetRows = sheetToJson(wb, sheetName);
    const normalized = sheetRows.map((r) => normalizeRow(r, sheetName));
    sheetCounts[sheetName] = normalized.length;
    for (const row of normalized) {
      if (row.awb || row.node || row.hub) combined.push(row);
    }
  }

  return {
    sheetNames: names,
    counts: {
      total: combined.length,
    },
    sheetCounts,
    rows: combined,
  };
}

export function classifyOpenLost(orderStatus) {
  const s = asTrimmedString(orderStatus).toLowerCase();
  if (!s) return "open";
  if (s.includes("lost")) return "lost";
  if (s === "lost") return "lost";
  return "open";
}

export function uniqCountByKey(rows, key) {
  const set = new Set();
  for (const r of rows) {
    const v = r[key];
    if (v) set.add(v);
  }
  return set.size;
}

export function sumPrice(rows) {
  let s = 0;
  for (const r of rows) s += r.price || 0;
  return s;
}

export function groupAgg(rows, dimKey, limit = 15) {
  const m = new Map();
  for (const r of rows) {
    const k = asTrimmedString(r[dimKey]) || "Unknown";
    if (!m.has(k)) m.set(k, { key: k, total: 0, open: 0, lost: 0, totalValue: 0, openValue: 0, lostValue: 0 });
    const o = m.get(k);
    const status = classifyOpenLost(r.orderStatus);
    o.total += 1;
    o.totalValue += r.price || 0;
    if (status === "lost") {
      o.lost += 1;
      o.lostValue += r.price || 0;
    } else {
      o.open += 1;
      o.openValue += r.price || 0;
    }
  }
  return [...m.values()].sort((a, b) => b.total - a.total).slice(0, limit);
}

export function monthAgg(rows) {
  const m = new Map();
  for (const r of rows) {
    const k = r.month || "Unknown";
    if (!m.has(k)) m.set(k, { month: k, total: 0, lost: 0, open: 0, value: 0 });
    const o = m.get(k);
    const status = classifyOpenLost(r.orderStatus);
    o.total += 1;
    o.value += r.price || 0;
    if (status === "lost") o.lost += 1;
    else o.open += 1;
  }
  return [...m.values()].sort((a, b) => String(a.month).localeCompare(String(b.month)));
}

export function groupAggWithRates(rows, dimKey, limit = 15, minTotal = 25) {
  const base = groupAgg(rows, dimKey, Number.POSITIVE_INFINITY);
  const enriched = base
    .map((o) => {
      const lostRate = o.total > 0 ? o.lost / o.total : 0;
      const avgPrice = o.total > 0 ? o.totalValue / o.total : 0;
      return { ...o, lostRate, avgPrice };
    })
    .filter((o) => o.total >= minTotal);
  enriched.sort((a, b) => b.lostRate - a.lostRate || b.total - a.total);
  return enriched.slice(0, limit);
}

export function stackedTop(rows, dimKey, limit = 10) {
  const agg = groupAgg(rows, dimKey, limit);
  return {
    labels: agg.map((o) => o.key),
    open: agg.map((o) => o.open),
    lost: agg.map((o) => o.lost),
    total: agg.map((o) => o.total),
  };
}

