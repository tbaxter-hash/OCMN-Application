// Builds the downloadable Excel workbook: a Summary tab, one tab per budget
// year (live formulas throughout), and a Best Practices tab. Laid out like the
// OCMN Church Budget Template so it reads familiar to treasurers.

import type { Borders, Cell, Fill, Font, Workbook, Worksheet } from "exceljs";
import {
  BEST_PRACTICES,
  EXPENSE_GROUPS,
  GENEROSITY_EXTRA_LINES,
  INCOME_LINES,
  SOURCES,
  num,
  type BudgetLine,
  type BudgetState,
} from "./budget";

const YEARS = 3;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const GIVE_ALL = "All income";
const GIVE_TITHES = "Tithes & offerings only";

// OCMN design-system colors, as ARGB.
const C = {
  ink: "FF111110",
  ink500: "FF726E63",
  ink200: "FFDED8C9",
  ink100: "FFEEEAE0",
  paper: "FFF7F4EE",
  blue: "FF2049B4",
  blue50: "FFEEF3FE",
  ember: "FFEA8A3C",
  ember100: "FFFAE7D2",
  ember700: "FFB85A1D",
  success: "FF1F8A4C",
  danger: "FFC93A3A",
  white: "FFFFFFFF",
};

const MONEY = '"$"#,##0;[Red]-"$"#,##0;"–"';
const PCT = "0%";
// Archivo isn't installed on most machines; Calibri is everywhere Excel is.
const FONT = "Calibri";

const fill = (argb: string): Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const font = (extra: Partial<Font> = {}): Partial<Font> => ({ name: FONT, size: 10, color: { argb: C.ink }, ...extra });
const hair = { style: "thin" as const, color: { argb: C.ink200 } };

function colLetter(n: number): string {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

const sheetName = (year: number) => String(year);
const ref = (sheet: string, cell: string) => `'${sheet}'!${cell}`;

interface YearLayout {
  name: string;
  /** Row numbers of the totals the Summary tab reads. */
  rows: Record<string, number>;
  lineRows: Record<string, number>;
  totalCol: string;
  firstMonthCol: number;
  lastMonthCol: string;
  rateHeart: string;
  rateMissions: string;
  giveOn: string;
  endBalanceCell: string;
}

interface YearOptions {
  index: number;
  year: number;
  prev?: YearLayout;
}

function styleInput(cell: Cell) {
  cell.font = font({ color: { argb: C.blue } });
  cell.fill = fill(C.blue50);
  cell.numFmt = MONEY;
  cell.border = { bottom: hair };
}

function styleMoney(cell: Cell, bold = false) {
  cell.font = font({ bold });
  cell.numFmt = MONEY;
}

function sectionRow(ws: Worksheet, row: number, label: string, lastCol: number) {
  const r = ws.getRow(row);
  r.getCell(1).value = label.toUpperCase();
  for (let c = 1; c <= lastCol; c++) {
    const cell = r.getCell(c);
    cell.fill = fill(C.ember100);
    cell.font = font({ bold: true, size: 9, color: { argb: C.ember700 } });
  }
  r.height = 18;
}

function totalStyle(ws: Worksheet, row: number, lastCol: number, strong = false) {
  const r = ws.getRow(row);
  for (let c = 1; c <= lastCol; c++) {
    const cell = r.getCell(c);
    cell.font = font({ bold: true, size: strong ? 11 : 10 });
    cell.border = { top: { style: strong ? "medium" : "thin", color: { argb: C.ink } } } as Partial<Borders>;
    if (strong) cell.fill = fill(C.blue50);
  }
}

function buildYear(wb: Workbook, state: BudgetState, opts: YearOptions): YearLayout {
  const { index, year, prev } = opts;
  const name = sheetName(year);
  const hasLaunch = index === 0;
  const ws = wb.addWorksheet(name, {
    properties: { tabColor: { argb: index === 0 ? C.blue : C.ember } },
    views: [{ state: "frozen", xSplit: 1, ySplit: 9, showGridLines: false }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 } },
  });
  ws.headerFooter.oddFooter = `&L${state.churchName || "Church plant"} · ${year}&RPage &P of &N`;

  // Column map: A label, [B launch], months, year total.
  const launchCol = hasLaunch ? 2 : 0;
  const firstMonthCol = hasLaunch ? 3 : 2;
  const lastMonthColN = firstMonthCol + 11;
  const totalColN = lastMonthColN + 1;
  const L = colLetter;
  const valueCols = [...(hasLaunch ? [launchCol] : []), ...Array.from({ length: 12 }, (_, i) => firstMonthCol + i)];

  ws.getColumn(1).width = 38;
  if (hasLaunch) ws.getColumn(launchCol).width = 13;
  for (let c = firstMonthCol; c <= lastMonthColN; c++) ws.getColumn(c).width = 10.5;
  ws.getColumn(totalColN).width = 14;

  // Title block
  ws.getCell("A1").value = state.churchName || "Church Name";
  ws.getCell("A1").font = font({ bold: true, size: 18 });
  ws.getCell("A2").value = `Budget plan · Year ${index + 1} · ${year}${hasLaunch && state.launchDate ? ` · Launch ${state.launchDate}` : ""}`;
  ws.getCell("A2").font = font({ size: 11, color: { argb: C.ink500 } });
  ws.getRow(1).height = 26;

  // Assumptions (generosity rates). Later years follow Year 1 unless changed.
  const assumptions: [string, string, (c: Cell) => void][] = [
    ["Heart for Ohio · Ohio Ministry Network", "B4", (c) => {
      c.value = prev ? { formula: ref(prev.name, prev.rateHeart) } : num(state.heartPct) / 100;
      c.numFmt = "0.0%";
    }],
    ["Missions giving · AG World & U.S. Missions", "B5", (c) => {
      c.value = prev ? { formula: ref(prev.name, prev.rateMissions) } : num(state.missionsPct) / 100;
      c.numFmt = "0.0%";
    }],
    ["Figure giving on", "B6", (c) => {
      c.value = prev ? { formula: ref(prev.name, prev.giveOn) } : state.givingBase === "tithes" ? GIVE_TITHES : GIVE_ALL;
      c.dataValidation = { type: "list", allowBlank: false, formulae: [`"${GIVE_ALL},${GIVE_TITHES}"`] };
    }],
  ];
  assumptions.forEach(([label, addr, set], i) => {
    const row = 4 + i;
    const lc = ws.getCell(`A${row}`);
    lc.value = label;
    lc.font = font({ bold: true });
    lc.fill = fill(C.ember100);
    const vc = ws.getCell(addr);
    set(vc);
    vc.font = font({ bold: true, color: { argb: C.blue } });
    vc.fill = fill(C.blue50);
    vc.alignment = { horizontal: "right" };
  });
  ws.mergeCells(`C4:${L(totalColN)}4`);
  ws.getCell("C4").value = "Blue cells are yours to edit. Everything in black is a formula.";
  ws.getCell("C4").font = font({ italic: true, color: { argb: C.ink500 } });

  // Header row
  const HEAD = 8;
  const head = ws.getRow(HEAD);
  head.getCell(1).value = "Line";
  if (hasLaunch) head.getCell(launchCol).value = "Launch";
  MONTHS.forEach((m, i) => (head.getCell(firstMonthCol + i).value = m));
  head.getCell(totalColN).value = `${year} total`;
  for (let c = 1; c <= totalColN; c++) {
    const cell = head.getCell(c);
    cell.fill = fill(C.blue);
    cell.font = font({ bold: true, color: { argb: C.white } });
    cell.alignment = { horizontal: c === 1 ? "left" : "right", vertical: "middle" };
  }
  head.height = 22;
  ws.getRow(9).height = 4;

  let row = 10;
  const lineRows: Record<string, number> = {};
  const rows: Record<string, number> = {};

  const sumAcross = (r: number) => `SUM(${L(valueCols[0])}${r}:${L(lastMonthColN)}${r})`;

  const inputLine = (l: BudgetLine) => {
    const r = ws.getRow(row);
    r.getCell(1).value = l.label;
    r.getCell(1).font = font();
    r.getCell(1).alignment = { indent: 1 };
    if (l.hint) r.getCell(1).note = l.hint;
    const amounts = state.lines[l.id];
    for (const c of valueCols) {
      const cell = r.getCell(c);
      if (c === launchCol) {
        cell.value = num(amounts?.launch);
      } else if (prev) {
        // Start from last year's December; overwrite with this year's plan.
        const prevRow = prev.lineRows[l.id];
        cell.value = { formula: ref(prev.name, `${prev.lastMonthCol}${prevRow}`) };
      } else {
        cell.value = num(amounts?.monthly);
      }
      styleInput(cell);
    }
    const t = r.getCell(totalColN);
    t.value = { formula: sumAcross(row) };
    styleMoney(t, true);
    lineRows[l.id] = row;
    row++;
  };

  const totalLine = (label: string, formulaFor: (col: string) => string, strong = false) => {
    const r = ws.getRow(row);
    r.getCell(1).value = label;
    for (const c of valueCols) {
      const cell = r.getCell(c);
      cell.value = { formula: formulaFor(L(c)) };
      styleMoney(cell, true);
    }
    const t = r.getCell(totalColN);
    t.value = { formula: sumAcross(row) };
    styleMoney(t, true);
    totalStyle(ws, row, totalColN, strong);
    return row++;
  };

  // Income
  sectionRow(ws, row++, "Income", totalColN);
  const incomeStart = row;
  INCOME_LINES.forEach(inputLine);
  const incomeEnd = row - 1;
  rows.income = totalLine("Total income", (c) => `SUM(${c}${incomeStart}:${c}${incomeEnd})`);
  row++;

  // Generosity: percentage lines are formulas off the assumptions above.
  sectionRow(ws, row++, "Generosity", totalColN);
  const genStart = row;
  const tithesRow = lineRows.tithes;
  const giveBase = (c: string) => `IF($B$6="${GIVE_TITHES}",${c}${tithesRow},${c}${rows.income})`;
  for (const [label, rate] of [
    ["Heart for Ohio · Ohio Ministry Network", "$B$4"],
    ["Missions giving · AG World & U.S. Missions", "$B$5"],
  ] as const) {
    const r = ws.getRow(row);
    r.getCell(1).value = label;
    r.getCell(1).font = font();
    r.getCell(1).alignment = { indent: 1 };
    for (const c of valueCols) {
      const cell = r.getCell(c);
      cell.value = { formula: `ROUND(${giveBase(L(c))}*${rate},2)` };
      styleMoney(cell);
    }
    const t = r.getCell(totalColN);
    t.value = { formula: sumAcross(row) };
    styleMoney(t, true);
    row++;
  }
  GENEROSITY_EXTRA_LINES.forEach(inputLine);
  const genEnd = row - 1;
  rows.generosity = totalLine("Total generosity", (c) => `SUM(${c}${genStart}:${c}${genEnd})`);
  row++;

  // Expense groups
  const groupTotals: number[] = [];
  for (const g of EXPENSE_GROUPS) {
    sectionRow(ws, row++, g.label, totalColN);
    const start = row;
    g.lines.forEach(inputLine);
    const end = row - 1;
    groupTotals.push(totalLine(`Total ${g.label.toLowerCase()}`, (c) => `SUM(${c}${start}:${c}${end})`));
    row++;
  }

  // Bottom line
  rows.expense = totalLine(
    "Total expenses (including generosity)",
    (c) => [rows.generosity, ...groupTotals].map((r) => `${c}${r}`).join("+"),
  );
  rows.net = totalLine("Net income (loss)", (c) => `${c}${rows.income}-${c}${rows.expense}`, true);

  // Running cash balance
  rows.balance = row;
  const bal = ws.getRow(row);
  bal.getCell(1).value = prev ? "Cash balance (carried from last year)" : "Cash balance";
  valueCols.forEach((c, i) => {
    const cell = bal.getCell(c);
    const opening = prev ? `${ref(prev.name, prev.endBalanceCell)}+` : "";
    cell.value = { formula: i === 0 ? `${opening}${L(c)}${rows.net}` : `${L(valueCols[i - 1])}${row}+${L(c)}${rows.net}` };
    styleMoney(cell);
    cell.font = font({ italic: true });
  });
  const endBal = bal.getCell(totalColN);
  endBal.value = { formula: `${L(lastMonthColN)}${row}` };
  styleMoney(endBal, true);
  bal.getCell(1).font = font({ italic: true });
  row++;

  // Self-support: how much of each month local giving covers
  rows.coverage = row;
  const cov = ws.getRow(row);
  cov.getCell(1).value = "Local giving covers (tithes ÷ expenses)";
  cov.getCell(1).font = font({ italic: true });
  for (const c of [...valueCols, totalColN]) {
    const cell = cov.getCell(c);
    const col = L(c);
    cell.value = { formula: `IF(${col}${rows.expense}=0,0,${col}${tithesRow}/${col}${rows.expense})` };
    cell.numFmt = PCT;
    cell.font = font({ italic: true, color: { argb: C.ink500 } });
  }
  row++;

  // Green when 100%+, a nudge when under.
  ws.addConditionalFormatting({
    ref: `${L(valueCols[0])}${rows.coverage}:${L(totalColN)}${rows.coverage}`,
    rules: [
      { type: "cellIs", operator: "greaterThan", formulae: ["0.9999"], priority: 1, style: { font: { color: { argb: C.success }, bold: true } } },
    ],
  });

  ws.pageSetup.printTitlesRow = `${HEAD}:${HEAD}`;
  ws.pageSetup.printArea = `A1:${L(totalColN)}${row}`;

  return {
    name,
    rows,
    lineRows,
    totalCol: L(totalColN),
    firstMonthCol,
    lastMonthCol: L(lastMonthColN),
    rateHeart: "B4",
    rateMissions: "B5",
    giveOn: "B6",
    endBalanceCell: `${L(totalColN)}${rows.balance}`,
  };
}

function buildSummary(wb: Workbook, state: BudgetState, years: YearLayout[], startYear: number) {
  const ws = wb.getWorksheet("Summary")!;
  ws.getColumn(1).width = 40;
  for (let i = 0; i < years.length; i++) ws.getColumn(2 + i).width = 16;

  ws.getCell("A1").value = state.churchName || "Church Name";
  ws.getCell("A1").font = font({ bold: true, size: 20 });
  ws.getRow(1).height = 30;
  ws.getCell("A2").value = `Budget plan · ${startYear}–${startYear + years.length - 1}${state.launchDate ? ` · Launch ${state.launchDate}` : ""}`;
  ws.getCell("A2").font = font({ size: 11, color: { argb: C.ink500 } });
  ws.getCell("A3").value = `Prepared with the OCMN Budget Planner on ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;
  ws.getCell("A3").font = font({ size: 9, italic: true, color: { argb: C.ink500 } });

  const HEAD = 5;
  const head = ws.getRow(HEAD);
  head.getCell(1).value = "At a glance";
  years.forEach((y, i) => (head.getCell(2 + i).value = `Year ${i + 1} · ${y.name}`));
  for (let c = 1; c <= years.length + 1; c++) {
    const cell = head.getCell(c);
    cell.fill = fill(C.blue);
    cell.font = font({ bold: true, color: { argb: C.white } });
    cell.alignment = { horizontal: c === 1 ? "left" : "right" };
  }
  head.height = 22;

  const metrics: { label: string; cell: (y: YearLayout) => string; fmt?: string; strong?: boolean }[] = [
    { label: "Total income", cell: (y) => `${y.totalCol}${y.rows.income}` },
    { label: "  Tithes & offerings", cell: (y) => `${y.totalCol}${y.lineRows.tithes}` },
    { label: "  Outside support", cell: (y) => `${y.totalCol}${y.rows.income}-${ref(y.name, `${y.totalCol}${y.lineRows.tithes}`)}` },
    { label: "Generosity given", cell: (y) => `${y.totalCol}${y.rows.generosity}` },
    { label: "Total expenses (including generosity)", cell: (y) => `${y.totalCol}${y.rows.expense}` },
    { label: "Net income (loss)", cell: (y) => `${y.totalCol}${y.rows.net}`, strong: true },
    { label: "Cash balance at year end", cell: (y) => y.endBalanceCell },
    { label: "Local giving covers", cell: (y) => `${y.totalCol}${y.rows.coverage}`, fmt: PCT },
  ];
  metrics.forEach((m, i) => {
    const r = ws.getRow(HEAD + 1 + i);
    r.getCell(1).value = m.label.trim();
    r.getCell(1).alignment = { indent: m.label.startsWith("  ") ? 1 : 0 };
    r.getCell(1).font = font({ bold: !!m.strong });
    years.forEach((y, j) => {
      const cell = r.getCell(2 + j);
      cell.value = { formula: ref(y.name, m.cell(y)) };
      cell.numFmt = m.fmt ?? MONEY;
      cell.font = font({ bold: !!m.strong });
      cell.border = { bottom: hair };
      if (m.strong) cell.fill = fill(C.blue50);
    });
    if (m.strong) r.getCell(1).fill = fill(C.blue50);
  });

  let row = HEAD + metrics.length + 3;
  const notes = [
    "How to use this workbook",
    `• Each year has its own tab at the bottom (${years.map((y) => y.name).join(", ")}). Blue cells are inputs; black cells are formulas.`,
    "• Generosity is figured for you from the rates at the top of each year tab.",
    "• Later years start from the prior year's December amounts. Type over them with your plan.",
    "• The cash balance carries from one year to the next.",
    "• When you're ready, email this file to ocmn@ohioministry.net.",
  ];
  notes.forEach((t, i) => {
    const c = ws.getCell(`A${row}`);
    c.value = t;
    c.font = i === 0 ? font({ bold: true, size: 11 }) : font({ color: { argb: C.ink500 } });
    ws.mergeCells(`A${row}:${colLetter(years.length + 1)}${row}`);
    row++;
  });

  row += 2;
  const sig = ws.getCell(`A${row}`);
  sig.value = "Approval";
  sig.font = font({ bold: true, size: 11 });
  row += 2;
  for (const label of ["Pastor’s signature", "Advisory committee member", "Advisory committee member"]) {
    for (const [col, text] of [["A", label], ["C", "Date"]] as const) {
      const c = ws.getCell(`${col}${row}`);
      c.value = text;
      c.font = font({ size: 9, color: { argb: C.ink500 } });
      c.border = { top: { style: "thin", color: { argb: C.ink } } };
    }
    ws.getCell(`D${row}`).border = { top: { style: "thin", color: { argb: C.ink } } };
    row += 3;
  }

  ws.pageSetup = { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
}

function buildPractices(wb: Workbook) {
  const ws = wb.addWorksheet("Best Practices", {
    properties: { tabColor: { argb: C.ember } },
    views: [{ showGridLines: false }],
  });
  ws.getColumn(1).width = 30;
  ws.getColumn(2).width = 90;
  ws.getCell("A1").value = "Best practices for funding a church plant";
  ws.getCell("A1").font = font({ bold: true, size: 16 });
  let row = 3;
  for (const p of BEST_PRACTICES) {
    const t = ws.getCell(`A${row}`);
    t.value = p.title;
    t.font = font({ bold: true, size: 11 });
    t.alignment = { vertical: "top", wrapText: true };
    const b = ws.getCell(`B${row}`);
    b.value = p.body;
    b.font = font();
    b.alignment = { vertical: "top", wrapText: true };
    ws.getRow(row).height = Math.max(30, Math.ceil(p.body.length / 95) * 14 + 6);
    t.border = b.border = { bottom: hair };
    row++;
  }
  row++;
  ws.getCell(`A${row++}`).value = "Sources";
  ws.getCell(`A${row - 1}`).font = font({ bold: true });
  for (const s of SOURCES) {
    const c = ws.getCell(`A${row}`);
    c.value = { text: s.label, hyperlink: s.url };
    c.font = font({ color: { argb: C.blue }, underline: true });
    ws.mergeCells(`A${row}:B${row}`);
    row++;
  }
}

export async function buildBudgetWorkbook(state: BudgetState): Promise<Blob> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "OCMN Budget Planner";
  wb.created = new Date();
  // Excel recomputes every formula on open, so cached values aren't needed.
  wb.calcProperties.fullCalcOnLoad = true;

  wb.addWorksheet("Summary", {
    properties: { tabColor: { argb: C.ink } },
    views: [{ showGridLines: false }],
  });

  const startYear = parseInt(state.year, 10) || new Date().getFullYear() + 1;
  const years: YearLayout[] = [];
  for (let i = 0; i < YEARS; i++) {
    years.push(buildYear(wb, state, { index: i, year: startYear + i, prev: years[i - 1] }));
  }
  buildSummary(wb, state, years, startYear);
  buildPractices(wb);

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
