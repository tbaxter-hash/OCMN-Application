"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  EXEMPT_REASONS,
  OHIO_STATE_RATE,
  SALES_TAX_STORAGE_KEY,
  SOURCES,
  buildReport,
  computeSale,
  departmentName,
  emptySalesTax,
  locationName,
  money,
  monthRange,
  newId,
  num,
  percent,
  periodLabel,
  quarterRange,
  rateOf,
  todayIso,
  usDate,
  type Bucket,
  type Filter,
  type Pricing,
  type SaleEntry,
  type SalesTaxState,
} from "@/lib/salesTax";
import { buildSalesTaxCsv, buildSalesTaxWorkbook, mergeSalesTaxWorkbook } from "@/lib/salesTaxWorkbook";
import styles from "./SalesTaxCalculator.module.css";

const FILTER_KEY = `${SALES_TAX_STORAGE_KEY}-filter`;

function load<T>(key: string, fallback: () => T, valid: (v: unknown) => boolean): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (valid(parsed)) return { ...fallback(), ...parsed };
    }
  } catch {
    // storage unavailable or corrupt — start fresh
  }
  return fallback();
}

const loadState = () =>
  load<SalesTaxState>(SALES_TAX_STORAGE_KEY, emptySalesTax, (v) => !!v && Array.isArray((v as SalesTaxState).entries));
const loadFilter = () =>
  load<Filter>(FILTER_KEY, () => ({ ...monthRange(0), departmentId: "" }), (v) => !!v && typeof v === "object");

type Draft = Omit<SaleEntry, "id">;

function freshDraft(state: SalesTaxState, prev?: Partial<Draft>): Draft {
  const dept = state.departments.some((d) => d.id === prev?.departmentId) ? prev!.departmentId! : state.departments[0]?.id ?? "";
  const loc = state.locations.some((l) => l.id === prev?.locationId) ? prev!.locationId! : state.locations[0]?.id ?? "";
  return {
    date: prev?.date || todayIso(),
    departmentId: dept,
    locationId: loc,
    item: "",
    qty: "1",
    price: "",
    pricing: prev?.pricing ?? state.defaultPricing,
    taxable: true,
    exemptReason: EXEMPT_REASONS[0],
    notes: "",
  };
}

const preloadExcel = () => void import("exceljs");
const noopSubscribe = () => () => {};

function slug(s: string) {
  return s.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking in the same tick can cancel the download before it starts.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// Sales live in localStorage, so the calculator only mounts on the client.
export default function SalesTaxCalculator() {
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  return hydrated ? <Calculator /> : <div className={styles.page} />;
}

function Calculator() {
  const [state, setState] = useState<SalesTaxState>(loadState);
  const [filter, setFilter] = useState<Filter>(loadFilter);
  const [draft, setDraft] = useState<Draft>(() => freshDraft(state, { departmentId: filter.departmentId }));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftError, setDraftError] = useState("");
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLElement>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(SALES_TAX_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // storage unavailable — the tool still works for this visit
    }
  }, [state]);

  useEffect(() => {
    try {
      window.localStorage.setItem(FILTER_KEY, JSON.stringify(filter));
    } catch {
      // ignore
    }
  }, [filter]);

  const report = buildReport(state, filter);
  const preview = computeSale(draft, rateOf(state, draft.locationId));
  const filterDept = filter.departmentId ? departmentName(state, filter.departmentId) : "All departments";

  const setDraftField = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraftError("");
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const saveDraft = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.departmentId) return setDraftError("Pick a department.");
    if (!draft.locationId) return setDraftError("Add a location and tax rate first, under Departments & tax rates.");
    if (!draft.date) return setDraftError("Enter the date of the sale.");
    if (!num(draft.qty) || !num(draft.price)) return setDraftError("Enter a quantity and a price.");
    const entry: SaleEntry = { ...draft, item: draft.item.trim() || "Sale", id: editingId ?? newId() };
    setState((s) => ({
      ...s,
      entries: editingId ? s.entries.map((x) => (x.id === editingId ? entry : x)) : [...s.entries, entry],
    }));
    if (!editingId && ((filter.from && entry.date < filter.from) || (filter.to && entry.date > filter.to) ||
      (filter.departmentId && filter.departmentId !== entry.departmentId))) {
      setNotice({ tone: "success", text: `Saved. It’s outside the period or department you’re viewing, so it isn’t in the list below.` });
    }
    setEditingId(null);
    setDraft(freshDraft(state, draft));
  };

  const editEntry = (entry: SaleEntry) => {
    const { id, ...rest } = entry;
    setEditingId(id);
    setDraft(rest);
    setDraftError("");
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(freshDraft(state, draft));
  };

  const deleteEntry = (entry: SaleEntry) => {
    if (!window.confirm(`Delete “${entry.item}” from ${usDate(entry.date)}?`)) return;
    setState((s) => ({ ...s, entries: s.entries.filter((x) => x.id !== entry.id) }));
    if (editingId === entry.id) cancelEdit();
  };

  const fileBase = () =>
    [
      "sales-tax",
      filter.departmentId ? slug(departmentName(state, filter.departmentId)) : "all-departments",
      filter.from || "start",
      "to",
      filter.to || todayIso(),
    ].join("-");

  const downloadExcel = async () => {
    try {
      const name = `${fileBase()}.xlsx`;
      saveBlob(await buildSalesTaxWorkbook(state, report, filter), name);
      setNotice({ tone: "success", text: `Downloaded ${name} (${report.entries.length} sales). Send it to the bookkeeper.` });
    } catch {
      setNotice({ tone: "error", text: "The download didn’t start. Try again, or use a different browser." });
    }
  };

  const downloadCsv = () => {
    const name = `${fileBase()}.csv`;
    saveBlob(buildSalesTaxCsv(state, report), name);
    setNotice({ tone: "success", text: `Downloaded ${name}.` });
  };

  const openFile = async (file: File) => {
    try {
      const { state: merged, added, skipped } = await mergeSalesTaxWorkbook(file, state);
      setState(merged);
      setNotice({
        tone: "success",
        text:
          `Added ${added} sale${added === 1 ? "" : "s"} from ${file.name}.` +
          (skipped ? ` ${skipped} ${skipped === 1 ? "was" : "were"} already here and skipped.` : "") +
          (added ? " Widen the period to All dates if you don’t see them." : ""),
      });
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof Error ? e.message : "That file couldn’t be opened." });
    }
  };

  const reset = () => {
    if (!window.confirm("Delete every sale saved in this browser? Departments and tax rates are kept.")) return;
    setState((s) => ({ ...s, entries: [] }));
    setEditingId(null);
  };

  const presets: [string, { from: string; to: string }][] = [
    ["This month", monthRange(0)],
    ["Last month", monthRange(-1)],
    ["This quarter", quarterRange(0)],
    ["Last quarter", quarterRange(-1)],
    ["All dates", { from: "", to: "" }],
  ];

  return (
    <div className={styles.page}>
      <header className={styles.topBar}>
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            OMN
          </span>
          <span className={styles.brandText}>
            Ohio Ministry Network
            <span>Sales Tax Calculator</span>
          </span>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.ghostBtn} onClick={reset}>
            Clear sales
          </button>
          <button
            type="button"
            className={styles.ghostBtn}
            onClick={() => fileInput.current?.click()}
            onPointerEnter={preloadExcel}
          >
            Open / merge file
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) openFile(file);
            }}
          />
          <button type="button" className={styles.outlineBtn} onClick={() => window.print()}>
            Print
          </button>
          <button type="button" className={styles.outlineBtn} onClick={downloadCsv}>
            Download CSV
          </button>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={downloadExcel}
            onPointerEnter={preloadExcel}
            onFocus={preloadExcel}
          >
            Download for bookkeeper
          </button>
        </div>
      </header>

      {notice ? (
        <div
          className={`${styles.note} ${notice.tone === "error" ? styles.noteError : ""} ${styles.noPrint}`}
          role={notice.tone === "error" ? "alert" : "status"}
        >
          <span>{notice.text}</span>
          <button type="button" className={styles.ghostBtn} onClick={() => setNotice(null)}>
            Dismiss
          </button>
        </div>
      ) : null}

      <div className={styles.layout}>
        <main className={styles.main}>
          <section className={styles.hero}>
            <span className={styles.pill}>
              Sales tax
            </span>
            <h1 className={styles.h1}>
              <span>Every sale counted.</span>
              <span className={styles.h1Sub}>Every cent reported.</span>
            </h1>
            <p className={styles.intro}>
              Log what each department sells — books, merchandise, event tables — and the tax is
              figured for you, whether it was added at the register or already in the price. Pick a
              period and download a report the bookkeeper can file from. Sales save in this browser as
              you go.
            </p>
            <p className={styles.printOnly}>
              {state.orgName} · Sales tax report · {periodLabel(filter)} · {filterDept}
            </p>
          </section>

          <section className={`${styles.section} ${styles.noPrint}`} ref={formRef}>
            <SectionHead eyebrow="Step 1" title={editingId ? "Edit a" : "Add a"} accent="sale">
              One line per item or per register total. Selling a table’s worth at an event? Enter the
              day’s total with quantity 1.
            </SectionHead>
            <form className={`${styles.card} ${styles.formCard}`} onSubmit={saveDraft}>
              <div className={styles.formGrid}>
                <label className={`${styles.field} ${styles.deptField}`}>
                  <span className={styles.fieldLabel}>Department</span>
                  <select
                    className={styles.input}
                    value={draft.departmentId}
                    onChange={(e) => setDraftField("departmentId", e.target.value)}
                  >
                    {state.departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                    {!state.departments.some((d) => d.id === draft.departmentId) && draft.departmentId ? (
                      <option value={draft.departmentId}>{departmentName(state, draft.departmentId)}</option>
                    ) : null}
                  </select>
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Date</span>
                  <input
                    type="date"
                    className={styles.input}
                    value={draft.date}
                    onChange={(e) => setDraftField("date", e.target.value)}
                  />
                </label>
                <label className={`${styles.field} ${styles.span2}`}>
                  <span className={styles.fieldLabel}>Item</span>
                  <input
                    className={styles.input}
                    value={draft.item}
                    placeholder="Youth convention T-shirts"
                    onChange={(e) => setDraftField("item", e.target.value)}
                  />
                </label>
                <label className={`${styles.field} ${styles.span2}`}>
                  <span className={styles.fieldLabel}>Where it was sold</span>
                  <select
                    className={styles.input}
                    value={draft.locationId}
                    onChange={(e) => setDraftField("locationId", e.target.value)}
                  >
                    {state.locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} — {percent(l.rate)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Quantity</span>
                  <input
                    className={styles.input}
                    inputMode="decimal"
                    value={draft.qty}
                    onChange={(e) => setDraftField("qty", e.target.value.replace(/[^0-9.-]/g, ""))}
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Price each</span>
                  <span className={styles.moneyCell}>
                    <span className={styles.dollar}>$</span>
                    <input
                      className={`${styles.input} ${styles.moneyInput}`}
                      inputMode="decimal"
                      placeholder="0.00"
                      value={draft.price}
                      onChange={(e) => setDraftField("price", e.target.value.replace(/[^0-9.,-]/g, ""))}
                    />
                  </span>
                </label>
              </div>

              <div className={styles.choiceRow}>
                <span className={styles.fieldLabel}>Is this sale taxable?</span>
                <div className={styles.segmented} role="radiogroup" aria-label="Taxable">
                  {[
                    [true, "Taxable"],
                    [false, "Exempt"],
                  ].map(([value, label]) => (
                    <button
                      key={String(value)}
                      type="button"
                      role="radio"
                      aria-checked={draft.taxable === value}
                      className={`${styles.segment} ${draft.taxable === value ? styles.segmentOn : ""}`}
                      onClick={() => setDraftField("taxable", value as boolean)}
                    >
                      {label as string}
                    </button>
                  ))}
                </div>
              </div>

              {draft.taxable ? (
                <div className={styles.choiceRow}>
                  <span className={styles.fieldLabel}>The price you entered</span>
                  <div className={styles.options} role="radiogroup" aria-label="Price basis">
                    {(
                      [
                        ["added", "Is before tax", "Tax is added on top at checkout"],
                        ["included", "Already includes tax", "A round price like $20 — tax is backed out of it"],
                      ] as [Pricing, string, string][]
                    ).map(([id, label, desc]) => (
                      <button
                        key={id}
                        type="button"
                        role="radio"
                        aria-checked={draft.pricing === id}
                        className={`${styles.option} ${draft.pricing === id ? styles.optionSelected : ""}`}
                        onClick={() => {
                          setDraftField("pricing", id);
                          setState((s) => ({ ...s, defaultPricing: id }));
                        }}
                      >
                        <span className={styles.mark}>{draft.pricing === id ? "•" : ""}</span>
                        <span>
                          <span className={styles.optionLabel}>{label}</span>
                          <span className={styles.optionDesc}>{desc}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Why it’s exempt</span>
                  <select
                    className={styles.input}
                    value={draft.exemptReason}
                    onChange={(e) => setDraftField("exemptReason", e.target.value)}
                  >
                    {EXEMPT_REASONS.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                  <span className={styles.hint}>Keep the buyer’s exemption certificate (STEC B) with your records.</span>
                </label>
              )}

              <label className={styles.field}>
                <span className={styles.fieldLabel}>Notes (optional)</span>
                <input
                  className={styles.input}
                  value={draft.notes}
                  placeholder="Receipt #, buyer, event name…"
                  onChange={(e) => setDraftField("notes", e.target.value)}
                />
              </label>

              <div className={styles.previewBar}>
                <div className={styles.previewFigures}>
                  <Figure label="Before tax" value={preview.net} />
                  <Figure
                    label={draft.taxable ? `Sales tax (${(preview.rate * 100).toFixed(2).replace(/\.?0+$/, "")}%)` : "Sales tax"}
                    value={preview.tax}
                    accent
                  />
                  <Figure label="Customer pays" value={preview.total} strong />
                </div>
                <div className={styles.formActions}>
                  {draftError ? (
                    <span className={styles.error} role="alert">
                      {draftError}
                    </span>
                  ) : null}
                  {editingId ? (
                    <button type="button" className={styles.ghostBtn} onClick={cancelEdit}>
                      Cancel
                    </button>
                  ) : null}
                  <button type="submit" className={styles.primaryBtn}>
                    {editingId ? "Save changes" : "Add sale"}
                  </button>
                </div>
              </div>
            </form>
          </section>

          <section className={styles.section}>
            <SectionHead eyebrow="Step 2" title="Review" accent="sales">
              Choose the reporting period and department. The summary, Excel download and printout all
              follow what you pick here.
            </SectionHead>
            <div className={`${styles.card} ${styles.filterCard} ${styles.noPrint}`}>
              <div className={styles.filterGrid}>
                <label className={`${styles.field} ${styles.span2}`}>
                  <span className={styles.fieldLabel}>Department</span>
                  <select
                    className={styles.input}
                    value={filter.departmentId}
                    onChange={(e) => setFilter((f) => ({ ...f, departmentId: e.target.value }))}
                  >
                    <option value="">All departments</option>
                    {state.departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>From</span>
                  <input
                    type="date"
                    className={styles.input}
                    value={filter.from}
                    onChange={(e) => setFilter((f) => ({ ...f, from: e.target.value }))}
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Through</span>
                  <input
                    type="date"
                    className={styles.input}
                    value={filter.to}
                    onChange={(e) => setFilter((f) => ({ ...f, to: e.target.value }))}
                  />
                </label>
              </div>
              <div className={styles.presets}>
                {presets.map(([label, range]) => {
                  const on = filter.from === range.from && filter.to === range.to;
                  return (
                    <button
                      key={label}
                      type="button"
                      className={`${styles.chip} ${on ? styles.chipOn : ""}`}
                      aria-pressed={on}
                      onClick={() => setFilter((f) => ({ ...f, ...range }))}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className={styles.card}>
              {report.entries.length === 0 ? (
                <p className={styles.empty}>
                  No sales for {filterDept.toLowerCase() === "all departments" ? "any department" : filterDept} in{" "}
                  {periodLabel(filter).toLowerCase()}.
                  {state.entries.length ? " Try a wider period." : " Add your first sale above."}
                </p>
              ) : (
                <div className={styles.salesTable} role="table">
                  <div className={`${styles.saleRow} ${styles.headRow}`} role="row">
                    <span role="columnheader">Date</span>
                    <span role="columnheader">Sale</span>
                    <span role="columnheader">Before tax</span>
                    <span role="columnheader">Tax</span>
                    <span role="columnheader">Collected</span>
                    <span role="columnheader" className={styles.noPrint}>
                      <span className={styles.srOnly}>Actions</span>
                    </span>
                  </div>
                  {report.entries.map((e) => {
                    const m = report.math[e.id];
                    return (
                      <div className={styles.saleRow} role="row" key={e.id}>
                        <span role="cell" className={styles.dateCell}>
                          {usDate(e.date)}
                        </span>
                        <span role="cell" className={styles.saleCell}>
                          <span className={styles.saleItem}>
                            {e.item}
                            {num(e.qty) !== 1 ? (
                              <span className={styles.qty}>
                                {" "}
                                · {e.qty} × {money(num(e.price))}
                              </span>
                            ) : null}
                          </span>
                          <span className={styles.saleMeta}>
                            {departmentName(state, e.departmentId)} · {locationName(state, e.locationId)}
                          </span>
                          <span className={styles.tags}>
                            {e.taxable ? (
                              <span className={styles.tag}>{e.pricing === "included" ? "Tax included" : "Tax added"}</span>
                            ) : (
                              <span className={`${styles.tag} ${styles.tagExempt}`}>Exempt · {e.exemptReason}</span>
                            )}
                            {e.notes ? <span className={styles.saleNotes}>{e.notes}</span> : null}
                          </span>
                        </span>
                        <span role="cell" className={styles.amount} data-label="Before tax">
                          {money(m.net)}
                        </span>
                        <span role="cell" className={styles.amount} data-label="Tax">
                          {money(m.tax)}
                        </span>
                        <span role="cell" className={`${styles.amount} ${styles.amountStrong}`} data-label="Collected">
                          {money(m.total)}
                        </span>
                        <span role="cell" className={`${styles.rowActions} ${styles.noPrint}`}>
                          <button type="button" className={styles.linkBtn} onClick={() => editEntry(e)}>
                            Edit
                          </button>
                          <button type="button" className={`${styles.linkBtn} ${styles.danger}`} onClick={() => deleteEntry(e)}>
                            Delete
                          </button>
                        </span>
                      </div>
                    );
                  })}
                  <div className={`${styles.saleRow} ${styles.totalRow}`} role="row">
                    <span role="cell" />
                    <span role="cell">
                      Total · {report.totals.count} sale{report.totals.count === 1 ? "" : "s"}
                    </span>
                    <span role="cell" className={styles.amount} data-label="Before tax">
                      {money(report.totals.net)}
                    </span>
                    <span role="cell" className={styles.amount} data-label="Tax">
                      {money(report.totals.tax)}
                    </span>
                    <span role="cell" className={styles.amount} data-label="Collected">
                      {money(report.totals.total)}
                    </span>
                    <span role="cell" className={styles.noPrint} />
                  </div>
                </div>
              )}
            </div>
          </section>

          <Setup state={state} setState={setState} />
        </main>

        <aside className={styles.summary}>
          <div className={styles.summaryCard}>
            <span className={styles.eyebrow}>For the bookkeeper</span>
            <div>
              <h3 className={styles.summaryTitle}>{filterDept}</h3>
              <p className={styles.summaryPeriod}>{periodLabel(filter)}</p>
            </div>
            <div className={styles.summaryBlock}>
              <SummaryRow label="Gross sales (before tax)" value={report.totals.net} />
              <SummaryRow label="Less exempt sales" value={report.totals.exempt} />
              <SummaryRow label="Taxable sales" value={report.totals.taxable} />
              <div className={`${styles.summaryRow} ${styles.summaryNet}`}>
                <span>Sales tax collected</span>
                <span>{money(report.totals.tax)}</span>
              </div>
              <SummaryRow label="Total collected" value={report.totals.total} muted />
            </div>
            {report.byDepartment.length > 1 ? (
              <Breakdown
                title="Tax by department"
                rows={report.byDepartment.map((d) => [d.department.name, d.bucket])}
              />
            ) : null}
            {report.byLocation.length > 0 ? (
              <Breakdown
                title="Tax by county — file each on the UST-1"
                rows={report.byLocation.map((l) => [`${l.location.name} (${percent(l.location.rate)})`, l.bucket])}
              />
            ) : null}
            <button
              type="button"
              className={`${styles.primaryBtn} ${styles.noPrint}`}
              onClick={downloadExcel}
              onPointerEnter={preloadExcel}
            >
              Download Excel report
            </button>
          </div>

          <QuickCalc state={state} />

          <p className={`${styles.help} ${styles.noPrint}`}>
            Rates change. Confirm county rates with the{" "}
            {SOURCES.map((s, i) => (
              <span key={s.url}>
                <a href={s.url} target="_blank" rel="noreferrer">
                  {s.label}
                </a>
                {i < SOURCES.length - 1 ? " and the " : ""}
              </span>
            ))}
            . This tool helps you organize sales. It isn’t tax advice.
          </p>
        </aside>
      </div>
    </div>
  );
}

function SectionHead({
  eyebrow,
  title,
  accent,
  children,
}: {
  eyebrow: string;
  title: string;
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.sectionHead}>
      <span className={styles.stepPill}>{eyebrow}</span>
      <h2 className={styles.h2}>
        {title} {accent}
      </h2>
      <p className={styles.sectionIntro}>{children}</p>
    </div>
  );
}

function Figure({ label, value, accent, strong }: { label: string; value: number; accent?: boolean; strong?: boolean }) {
  return (
    <div className={`${styles.figure} ${accent ? styles.figureAccent : ""} ${strong ? styles.figureStrong : ""}`}>
      <span className={styles.figureLabel}>{label}</span>
      <span className={styles.figureValue}>{money(value)}</span>
    </div>
  );
}

function SummaryRow({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className={`${styles.summaryRow} ${muted ? styles.summaryMuted : ""}`}>
      <span>{label}</span>
      <span>{money(value)}</span>
    </div>
  );
}

function Breakdown({ title, rows }: { title: string; rows: [string, Bucket][] }) {
  return (
    <div className={styles.summaryBlock}>
      <h4 className={styles.breakdownTitle}>{title}</h4>
      {rows.map(([label, b]) => (
        <div className={styles.summaryRow} key={label}>
          <span className={styles.breakdownLabel}>{label}</span>
          <span>{money(b.tax)}</span>
        </div>
      ))}
    </div>
  );
}

// A scratch calculator for the register: no sale is saved.
function QuickCalc({ state }: { state: SalesTaxState }) {
  const [amount, setAmount] = useState("");
  const [locationId, setLocationId] = useState(state.locations[0]?.id ?? "");
  const rate = rateOf(state, locationId);
  const added = computeSale({ qty: "1", price: amount, pricing: "added", taxable: true }, rate);
  const included = computeSale({ qty: "1", price: amount, pricing: "included", taxable: true }, rate);
  return (
    <div className={`${styles.summaryCard} ${styles.noPrint}`}>
      <span className={styles.eyebrow}>Quick calculator</span>
      <div className={styles.quickGrid}>
        <span className={styles.moneyCell}>
          <span className={styles.dollar}>$</span>
          <input
            className={`${styles.input} ${styles.moneyInput}`}
            inputMode="decimal"
            placeholder="0.00"
            aria-label="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.,]/g, ""))}
          />
        </span>
        <select
          className={styles.input}
          aria-label="Location"
          value={locationId}
          onChange={(e) => setLocationId(e.target.value)}
        >
          {state.locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name} — {percent(l.rate)}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.summaryBlock}>
        <h4 className={styles.breakdownTitle}>If that’s before tax</h4>
        <SummaryRow label="Tax to add" value={added.tax} />
        <SummaryRow label="Charge" value={added.total} />
      </div>
      <div className={styles.summaryBlock}>
        <h4 className={styles.breakdownTitle}>If tax is already in it</h4>
        <SummaryRow label="Tax inside" value={included.tax} />
        <SummaryRow label="Sale before tax" value={included.net} />
      </div>
    </div>
  );
}

function Setup({
  state,
  setState,
}: {
  state: SalesTaxState;
  setState: React.Dispatch<React.SetStateAction<SalesTaxState>>;
}) {
  const [newDept, setNewDept] = useState("");
  const [newLoc, setNewLoc] = useState({ name: "", rate: String(OHIO_STATE_RATE) });
  const used = (key: "departmentId" | "locationId", id: string) => state.entries.filter((e) => e[key] === id).length;

  const addDept = () => {
    const name = newDept.trim();
    if (!name) return;
    setState((s) => ({ ...s, departments: [...s.departments, { id: newId(), name }] }));
    setNewDept("");
  };
  const addLoc = () => {
    const name = newLoc.name.trim();
    if (!name || !num(newLoc.rate)) return;
    setState((s) => ({ ...s, locations: [...s.locations, { id: newId(), name, rate: newLoc.rate }] }));
    setNewLoc({ name: "", rate: String(OHIO_STATE_RATE) });
  };

  return (
    <section className={`${styles.section} ${styles.noPrint}`}>
      <SectionHead eyebrow="Setup" title="Departments &" accent="tax rates">
        Shared by everyone using this browser. A department or location with sales on it can be
        renamed but not removed.
      </SectionHead>
      <details className={`${styles.card} ${styles.setupCard}`}>
        <summary className={styles.setupSummary}>
          Departments <span className={styles.count}>{state.departments.length}</span>
        </summary>
        <div className={styles.setupBody}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Organization name on reports</span>
            <input
              className={styles.input}
              value={state.orgName}
              onChange={(e) => setState((s) => ({ ...s, orgName: e.target.value }))}
            />
          </label>
          {state.departments.map((d) => {
            const n = used("departmentId", d.id);
            return (
              <div className={styles.setupRow} key={d.id}>
                <input
                  className={styles.input}
                  aria-label="Department name"
                  value={d.name}
                  onChange={(e) =>
                    setState((s) => ({
                      ...s,
                      departments: s.departments.map((x) => (x.id === d.id ? { ...x, name: e.target.value } : x)),
                    }))
                  }
                />
                <span className={styles.usedCount}>{n ? `${n} sale${n === 1 ? "" : "s"}` : ""}</span>
                <button
                  type="button"
                  className={`${styles.linkBtn} ${styles.danger}`}
                  disabled={n > 0 || state.departments.length === 1}
                  onClick={() => setState((s) => ({ ...s, departments: s.departments.filter((x) => x.id !== d.id) }))}
                >
                  Remove
                </button>
              </div>
            );
          })}
          <div className={styles.setupRow}>
            <input
              className={styles.input}
              placeholder="New department"
              value={newDept}
              onChange={(e) => setNewDept(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addDept();
                }
              }}
            />
            <span />
            <button type="button" className={styles.outlineBtn} onClick={addDept}>
              Add
            </button>
          </div>
        </div>
      </details>

      <details className={`${styles.card} ${styles.setupCard}`}>
        <summary className={styles.setupSummary}>
          Locations & tax rates <span className={styles.count}>{state.locations.length}</span>
        </summary>
        <div className={styles.setupBody}>
          <p className={styles.hint}>
            Ohio’s rate is {OHIO_STATE_RATE}% state tax plus the county (and any transit) rate. Sales at
            the office use the office’s county. Sales at an event elsewhere in Ohio use the county where
            the event is held — add a location for it. Changing a rate changes the tax on every sale at
            that location, so add a new location when a rate changes instead.
          </p>
          {state.locations.map((l) => {
            const n = used("locationId", l.id);
            return (
              <div className={`${styles.setupRow} ${styles.locRow}`} key={l.id}>
                <input
                  className={styles.input}
                  aria-label="Location name"
                  value={l.name}
                  onChange={(e) =>
                    setState((s) => ({
                      ...s,
                      locations: s.locations.map((x) => (x.id === l.id ? { ...x, name: e.target.value } : x)),
                    }))
                  }
                />
                <span className={styles.rateWrap}>
                  <input
                    className={`${styles.input} ${styles.rateInput}`}
                    aria-label={`${l.name} rate`}
                    inputMode="decimal"
                    value={l.rate}
                    onChange={(e) =>
                      setState((s) => ({
                        ...s,
                        locations: s.locations.map((x) =>
                          x.id === l.id ? { ...x, rate: e.target.value.replace(/[^0-9.]/g, "") } : x,
                        ),
                      }))
                    }
                  />
                  %
                </span>
                <span className={styles.usedCount}>{n ? `${n} sale${n === 1 ? "" : "s"}` : ""}</span>
                <button
                  type="button"
                  className={`${styles.linkBtn} ${styles.danger}`}
                  disabled={n > 0 || state.locations.length === 1}
                  onClick={() => setState((s) => ({ ...s, locations: s.locations.filter((x) => x.id !== l.id) }))}
                >
                  Remove
                </button>
              </div>
            );
          })}
          <div className={`${styles.setupRow} ${styles.locRow}`}>
            <input
              className={styles.input}
              placeholder="Event — Delaware County"
              value={newLoc.name}
              onChange={(e) => setNewLoc((l) => ({ ...l, name: e.target.value }))}
            />
            <span className={styles.rateWrap}>
              <input
                className={`${styles.input} ${styles.rateInput}`}
                aria-label="New location rate"
                inputMode="decimal"
                value={newLoc.rate}
                onChange={(e) => setNewLoc((l) => ({ ...l, rate: e.target.value.replace(/[^0-9.]/g, "") }))}
              />
              %
            </span>
            <span />
            <button type="button" className={styles.outlineBtn} onClick={addLoc}>
              Add
            </button>
          </div>
        </div>
      </details>
    </section>
  );
}
