// Builds the bookkeeper's Excel workbook: a Summary tab (by department, by
// location/county, and the figures the Ohio UST-1 return asks for), a Sales
// Detail tab with live formulas, and a Tax Rates tab. A hidden tab holds the
// sales so the file can be opened back into the tool and merged.

import type { Cell, Fill, Font, Workbook, Worksheet } from "exceljs";
import {
  computeSale,
  departmentName,
  locationName,
  num,
  periodLabel,
  rateOf,
  type Filter,
  type Report,
  type SaleEntry,
  type SalesTaxState,
} from "./salesTax";

const DATA_SHEET = "SalesTaxData";
const DETAIL = "Sales Detail";
const INCLUDED = "Tax included";
const ADDED = "Tax added";
const MONEY = '"$"#,##0.00;[Red]-"$"#,##0.00;"–"';
const RATE = "0.000%";
const FONT = "Calibri";

// Same values as the brand tokens at the top of SalesTaxCalculator.module.css, as ARGB.
const C = {
  ink: "FF111110",
  ink500: "FF726E63",
  ink200: "FFDED8C9",
  blue: "FF1F3A68",
  blue50: "FFEEF2F9",
  ember: "FFB5651D",
  ember100: "FFF6E6D4",
  ember700: "FFB5651D",
};

const fill = (argb: string): Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const font = (extra: Partial<Font> = {}): Partial<Font> => ({ name: FONT, size: 10, color: { argb: C.ink }, ...extra });
const hair = { style: "thin" as const, color: { argb: C.ink200 } };

function headerRow(ws: Worksheet, row: number, labels: string[]) {
  const r = ws.getRow(row);
  labels.forEach((label, i) => {
    const cell = r.getCell(i + 1);
    cell.value = label;
    cell.font = font({ bold: true, color: { argb: "FFFFFFFF" } });
    cell.fill = fill(C.ink);
    cell.alignment = { vertical: "middle", horizontal: i === 0 ? "left" : "center", wrapText: true };
  });
  r.height = 30;
}

function sectionTitle(ws: Worksheet, row: number, label: string, width: number) {
  const r = ws.getRow(row);
  r.getCell(1).value = label.toUpperCase();
  for (let c = 1; c <= width; c++) {
    r.getCell(c).fill = fill(C.ember100);
    r.getCell(c).font = font({ bold: true, size: 9, color: { argb: C.ember700 } });
  }
  r.height = 18;
}

function totalRow(ws: Worksheet, row: number, width: number) {
  const r = ws.getRow(row);
  for (let c = 1; c <= width; c++) {
    const cell = r.getCell(c);
    cell.font = font({ bold: true, size: 11 });
    cell.fill = fill(C.blue50);
    cell.border = { top: { style: "medium", color: { argb: C.ink } } };
  }
}

const f = (formula: string, result: number | string): Cell["value"] => ({ formula, result }) as Cell["value"];

function isoToDate(iso: string): Date | string {
  const [y, m, d] = iso.split("-").map(Number);
  return y && m && d ? new Date(Date.UTC(y, m - 1, d)) : iso;
}

// Sales Detail columns.
const COLS = [
  ["Date", 12],
  ["Department", 28],
  ["Location / county", 30],
  ["Item", 32],
  ["Qty", 7],
  ["Unit price", 12],
  ["Amount rung up", 14],
  ["Price basis", 13],
  ["Taxable?", 10],
  ["Exempt reason", 30],
  ["Tax rate", 10],
  ["Sale before tax", 15],
  ["Sales tax", 13],
  ["Total collected", 15],
  ["Notes", 30],
] as const;

function buildDetail(wb: Workbook, state: SalesTaxState, report: Report) {
  const ws = wb.addWorksheet(DETAIL, {
    properties: { tabColor: { argb: C.blue } },
    views: [{ state: "frozen", ySplit: 1, showGridLines: false }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  ws.columns = COLS.map(([, width]) => ({ width }));
  headerRow(ws, 1, COLS.map(([label]) => label));

  report.entries.forEach((e, i) => {
    const r = i + 2;
    const m = report.math[e.id];
    const row = ws.getRow(r);
    row.values = [
      isoToDate(e.date),
      departmentName(state, e.departmentId),
      locationName(state, e.locationId),
      e.item,
      num(e.qty),
      num(e.price),
      f(`ROUND(E${r}*F${r},2)`, m.amount),
      e.taxable ? (e.pricing === "included" ? INCLUDED : ADDED) : "",
      e.taxable ? "Yes" : "No",
      e.taxable ? "" : e.exemptReason,
      m.rate,
      f(`IF(I${r}="No",G${r},IF(H${r}="${INCLUDED}",ROUND(G${r}/(1+K${r}),2),G${r}))`, m.net),
      f(`IF(I${r}="No",0,IF(H${r}="${INCLUDED}",G${r}-L${r},ROUND(G${r}*K${r},2)))`, m.tax),
      f(`L${r}+M${r}`, m.total),
      e.notes,
    ];
    row.eachCell({ includeEmpty: true }, (cell, c) => {
      cell.font = font();
      cell.border = { bottom: hair };
      if (c === 1) cell.numFmt = "mm/dd/yyyy";
      if ([6, 7, 12, 13, 14].includes(c)) cell.numFmt = MONEY;
      if (c === 11) cell.numFmt = RATE;
      if ([5, 8, 9, 11].includes(c)) cell.alignment = { horizontal: "center" };
    });
  });

  const last = Math.max(report.entries.length + 1, 2);
  const t = last + 1;
  const tr = ws.getRow(t);
  tr.getCell(1).value = "Totals";
  const rungUp = report.entries.reduce((sum, e) => sum + report.math[e.id].amount, 0);
  tr.getCell(7).value = f(`SUM(G2:G${last})`, Math.round(rungUp * 100) / 100);
  for (const [col, key] of [
    ["L", "net"],
    ["M", "tax"],
    ["N", "total"],
  ] as const) {
    const cell = tr.getCell(col);
    cell.value = f(`SUM(${col}2:${col}${last})`, report.totals[key]);
  }
  totalRow(ws, t, COLS.length);
  [7, 12, 13, 14].forEach((c) => (tr.getCell(c).numFmt = MONEY));
  ws.autoFilter = { from: "A1", to: `O${last}` };
  return last;
}

function buildSummary(ws: Worksheet, state: SalesTaxState, report: Report, filter: Filter, last: number) {
  ws.columns = [{ width: 38 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 10 }];
  const col = (letter: string) => `'${DETAIL}'!$${letter}$2:$${letter}$${last}`;
  const W = 7;

  ws.getCell("A1").value = state.orgName || "Ohio Ministry Network";
  ws.getCell("A1").font = font({ bold: true, size: 18 });
  ws.getCell("A2").value = "Sales tax report";
  ws.getCell("A2").font = font({ bold: true, size: 12, color: { argb: C.blue } });
  const dept = filter.departmentId ? departmentName(state, filter.departmentId) : "All departments";
  ws.getCell("A3").value = `Period: ${periodLabel(filter)}  ·  ${dept}`;
  ws.getCell("A4").value = `Prepared ${new Date().toLocaleDateString("en-US")} with the OMN Sales Tax Calculator · ${report.entries.length} sale${report.entries.length === 1 ? "" : "s"}`;
  ws.getCell("A3").font = font();
  ws.getCell("A4").font = font({ color: { argb: C.ink500 }, italic: true });

  const heads = ["", "Sales before tax", "Exempt sales", "Taxable sales", "Sales tax", "Total collected", "Sales"];

  // By department.
  let row = 6;
  sectionTitle(ws, row++, "By department", W);
  headerRow(ws, row++, ["Department", ...heads.slice(1)]);
  const deptStart = row;
  for (const { department, bucket } of report.byDepartment) {
    const r = ws.getRow(row);
    const key = `${col("B")},A${row}`;
    r.values = [
      department.name,
      f(`SUMIFS(${col("L")},${key})`, bucket.net),
      f(`SUMIFS(${col("L")},${key},${col("I")},"No")`, bucket.exempt),
      f(`SUMIFS(${col("L")},${key},${col("I")},"Yes")`, bucket.taxable),
      f(`SUMIFS(${col("M")},${key})`, bucket.tax),
      f(`SUMIFS(${col("N")},${key})`, bucket.total),
      f(`COUNTIFS(${key})`, bucket.count),
    ];
    styleBody(r);
    row++;
  }
  const deptTotal = row;
  sumRow(ws, row++, deptStart, deptTotal - 1, report);

  // By location / county.
  row++;
  sectionTitle(ws, row++, "By location / county — report each county on the UST-1", W);
  headerRow(ws, row++, ["Location / county", "Sales before tax", "Exempt sales", "Taxable sales", "Sales tax", "Total collected", "Rate"]);
  const locStart = row;
  for (const { location, bucket } of report.byLocation) {
    const r = ws.getRow(row);
    const key = `${col("C")},A${row}`;
    r.values = [
      location.name,
      f(`SUMIFS(${col("L")},${key})`, bucket.net),
      f(`SUMIFS(${col("L")},${key},${col("I")},"No")`, bucket.exempt),
      f(`SUMIFS(${col("L")},${key},${col("I")},"Yes")`, bucket.taxable),
      f(`SUMIFS(${col("M")},${key})`, bucket.tax),
      f(`SUMIFS(${col("N")},${key})`, bucket.total),
      num(location.rate) / 100,
    ];
    styleBody(r);
    r.getCell(7).numFmt = RATE;
    row++;
  }
  sumRow(ws, row++, locStart, row - 2, report, false);

  // Return worksheet.
  row++;
  sectionTitle(ws, row++, "Ohio sales tax return (UST-1) worksheet", W);
  const lines: [string, string, number][] = [
    ["Gross sales (before tax)", `B${deptTotal}`, report.totals.net],
    ["Less exempt sales", `C${deptTotal}`, report.totals.exempt],
    ["Net taxable sales", `D${deptTotal}`, report.totals.taxable],
    ["Sales tax collected", `E${deptTotal}`, report.totals.tax],
  ];
  for (const [label, ref, value] of lines) {
    const r = ws.getRow(row++);
    r.getCell(1).value = label;
    r.getCell(2).value = f(ref, value);
    r.getCell(1).font = font({ bold: true });
    r.getCell(2).font = font({ bold: true });
    r.getCell(2).numFmt = MONEY;
    r.getCell(1).border = { bottom: hair };
    r.getCell(2).border = { bottom: hair };
  }
  const note = ws.getRow(row + 1).getCell(1);
  note.value =
    "Rates come from the Tax Rates tab as entered in the calculator. Confirm county rates at tax.ohio.gov before filing; the return, vendor’s discount and any penalties are worked out on the Ohio Business Gateway.";
  note.font = font({ italic: true, size: 9, color: { argb: C.ink500 } });
  ws.mergeCells(row + 1, 1, row + 1, W);
  note.alignment = { wrapText: true, vertical: "top" };
  ws.getRow(row + 1).height = 30;
}

function styleBody(r: ReturnType<Worksheet["getRow"]>) {
  r.eachCell({ includeEmpty: true }, (cell, c) => {
    cell.font = font();
    cell.border = { bottom: hair };
    if (c >= 2 && c <= 6) cell.numFmt = MONEY;
    if (c === 7) cell.alignment = { horizontal: "center" };
  });
}

function sumRow(ws: Worksheet, row: number, from: number, to: number, report: Report, withCount = true) {
  const r = ws.getRow(row);
  r.getCell(1).value = "Total";
  const keys = ["net", "exempt", "taxable", "tax", "total"] as const;
  keys.forEach((k, i) => {
    const letter = String.fromCharCode(66 + i);
    r.getCell(i + 2).value = f(to >= from ? `SUM(${letter}${from}:${letter}${to})` : "0", report.totals[k]);
    r.getCell(i + 2).numFmt = MONEY;
  });
  if (withCount) r.getCell(7).value = f(to >= from ? `SUM(G${from}:G${to})` : "0", report.totals.count);
  totalRow(ws, row, 7);
  for (let c = 2; c <= 6; c++) r.getCell(c).numFmt = MONEY;
  r.getCell(7).alignment = { horizontal: "center" };
}

function buildRates(wb: Workbook, state: SalesTaxState) {
  const ws = wb.addWorksheet("Tax Rates", { views: [{ showGridLines: false }] });
  ws.columns = [{ width: 40 }, { width: 14 }];
  headerRow(ws, 1, ["Location / county", "Combined rate"]);
  state.locations.forEach((l, i) => {
    const r = ws.getRow(i + 2);
    r.values = [l.name, num(l.rate) / 100];
    r.getCell(2).numFmt = RATE;
    r.eachCell((cell) => {
      cell.font = font();
      cell.border = { bottom: hair };
    });
  });
}

interface SavedData {
  version: 1;
  orgName: string;
  departments: SalesTaxState["departments"];
  locations: SalesTaxState["locations"];
  entries: SaleEntry[];
}

const CHUNK = 30000; // Excel cells hold at most 32,767 characters.

export async function buildSalesTaxWorkbook(state: SalesTaxState, report: Report, filter: Filter): Promise<Blob> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "OMN Sales Tax Calculator";
  wb.created = new Date();
  wb.calcProperties.fullCalcOnLoad = true;

  const summary = wb.addWorksheet("Summary", {
    properties: { tabColor: { argb: C.ember } },
    views: [{ showGridLines: false }],
    pageSetup: { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  const last = buildDetail(wb, state, report);
  buildSummary(summary, state, report, filter, last);
  buildRates(wb, state);

  const data = wb.addWorksheet(DATA_SHEET, { state: "veryHidden" });
  const saved: SavedData = {
    version: 1,
    orgName: state.orgName,
    departments: state.departments,
    locations: state.locations,
    entries: report.entries,
  };
  const json = JSON.stringify(saved);
  for (let i = 0; i * CHUNK < json.length; i++) data.getCell(i + 1, 1).value = json.slice(i * CHUNK, (i + 1) * CHUNK);

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export interface MergeResult {
  state: SalesTaxState;
  added: number;
  skipped: number;
}

// Opens a workbook this tool made and merges its sales into the current list,
// so each department can send its file to one person who combines them.
export async function mergeSalesTaxWorkbook(file: File, current: SalesTaxState): Promise<MergeResult> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(await file.arrayBuffer());
  } catch {
    throw new Error("That file couldn’t be opened. Choose an .xlsx file downloaded from the sales tax calculator.");
  }
  const ws = wb.getWorksheet(DATA_SHEET);
  let saved: SavedData;
  try {
    let json = "";
    for (let i = 1; ws && ws.getCell(i, 1).value; i++) json += String(ws.getCell(i, 1).value);
    saved = JSON.parse(json);
    if (!saved || saved.version !== 1 || !Array.isArray(saved.entries)) throw new Error();
  } catch {
    throw new Error("This spreadsheet wasn’t made by the OMN Sales Tax Calculator, so it can’t be opened here.");
  }

  const base = current;
  const departments = [...base.departments];
  for (const d of saved.departments ?? []) if (!departments.some((x) => x.id === d.id)) departments.push(d);
  const locations = [...base.locations];
  for (const l of saved.locations ?? []) if (!locations.some((x) => x.id === l.id)) locations.push(l);

  const ids = new Set(base.entries.map((e) => e.id));
  const fresh = saved.entries.filter((e) => e && e.id && !ids.has(e.id));
  return {
    state: { ...base, departments, locations, entries: [...base.entries, ...fresh] },
    added: fresh.length,
    skipped: saved.entries.length - fresh.length,
  };
}

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** A flat CSV of the sales — handy for importing into accounting software. */
export function buildSalesTaxCsv(state: SalesTaxState, report: Report): Blob {
  const rows: (string | number)[][] = [
    COLS.map(([label]) => label),
    ...report.entries.map((e) => {
      const m = computeSale(e, rateOf(state, e.locationId));
      return [
        e.date,
        departmentName(state, e.departmentId),
        locationName(state, e.locationId),
        e.item,
        e.qty,
        e.price,
        m.amount.toFixed(2),
        e.taxable ? (e.pricing === "included" ? INCLUDED : ADDED) : "",
        e.taxable ? "Yes" : "No",
        e.taxable ? "" : e.exemptReason,
        `${(m.rate * 100).toFixed(3)}%`,
        m.net.toFixed(2),
        m.tax.toFixed(2),
        m.total.toFixed(2),
        e.notes,
      ];
    }),
  ];
  return new Blob(["﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
}
