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
  const lower = new Map(names.map((n) => [String(n).toLowerCase(), n]));

  const pick = (...candidates) => {
    for (const c of candidates) {
      const key = String(c).toLowerCase();
      if (lower.has(key)) return lower.get(key);
    }
    return null;
  };

  const forwardName = pick("forward", "fwd", "forward_20260401_072430");
  const brsnrName = pick("brsnr", "brsnr_20260401_072430");
  const bagConnName = pick("bagging_connection", "bagging connection", "bagging", "bagging_connection_20260401_072430");

  const forwardRows = forwardName ? sheetToJson(wb, forwardName) : [];
  const brsnrRows = brsnrName ? sheetToJson(wb, brsnrName) : [];
  const bagConnRows = bagConnName ? sheetToJson(wb, bagConnName) : [];

  const normForward = forwardRows.map((r) => normalizeRow(r, "Forward"));
  const normBrsnr = brsnrRows.map((r) => normalizeRow(r, "BRSNR"));
  const normBagConn = bagConnRows.map((r) => normalizeRow(r, "Bagging_Connection"));

  const combined = [...normForward, ...normBrsnr, ...normBagConn].filter((r) => r.awb || r.node || r.hub);

  return {
    sheetNames: names,
    counts: {
      Forward: normForward.length,
      BRSNR: normBrsnr.length,
      Bagging_Connection: normBagConn.length,
      total: combined.length,
    },
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

