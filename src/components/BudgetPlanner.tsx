"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  BEST_PRACTICES,
  BUDGET_STORAGE_KEY,
  EXPENSE_GROUPS,
  GENEROSITY_EXTRA_LINES,
  INCOME_LINES,
  SOURCES,
  budgetCsv,
  computeTotals,
  emptyBudget,
  healthChecks,
  money,
  num,
  type BudgetLine,
  type BudgetState,
  type GivingBase,
  type Pair,
} from "@/lib/budget";
import Sparkle from "./Sparkle";
import styles from "./BudgetPlanner.module.css";

function loadBudget(): BudgetState {
  try {
    const raw = window.localStorage.getItem(BUDGET_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && parsed.lines) return { ...emptyBudget(), ...parsed };
    }
  } catch {
    // storage unavailable or corrupt — start fresh
  }
  return emptyBudget();
}

const noopSubscribe = () => () => {};

// Saved budgets live in localStorage, so the planner only mounts on the client
// — that way the first render already has the saved numbers and never
// mismatches the server HTML.
export default function BudgetPlanner() {
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  return hydrated ? <Planner /> : <div className={styles.page} />;
}

function Planner() {
  const [budget, setBudget] = useState<BudgetState>(loadBudget);

  useEffect(() => {
    try {
      window.localStorage.setItem(BUDGET_STORAGE_KEY, JSON.stringify(budget));
    } catch {
      // storage unavailable — the planner still works for this visit
    }
  }, [budget]);

  const totals = computeTotals(budget);
  const checks = healthChecks(budget, totals);

  const setField = <K extends keyof BudgetState>(key: K, value: BudgetState[K]) =>
    setBudget((b) => ({ ...b, [key]: value }));

  const setLine = (id: string, field: "launch" | "monthly", value: string) =>
    setBudget((b) => ({
      ...b,
      lines: { ...b.lines, [id]: { ...(b.lines[id] ?? { launch: "", monthly: "" }), [field]: value } },
    }));

  const downloadCsv = () => {
    const blob = new Blob(["\uFEFF" + budgetCsv(budget, totals)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(budget.churchName || "ocmn-budget").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${budget.year}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoking in the same tick can cancel the download before it starts.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const reset = () => {
    if (window.confirm("Clear every number and start a new budget?")) setBudget(emptyBudget());
  };

  const lineRow = (l: BudgetLine) => (
    <AmountRow
      key={l.id}
      line={l}
      launch={budget.lines[l.id]?.launch ?? ""}
      monthly={budget.lines[l.id]?.monthly ?? ""}
      onChange={(field, value) => setLine(l.id, field, value)}
    />
  );

  return (
    <div className={styles.page}>
      <header className={styles.topBar}>
        <Link href="/" className={styles.brand}>
          <Image src="/assets/emblem-black-900.png" alt="" width={40} height={40} className={styles.emblem} />
          <span className={styles.brandText}>
            OCMN
            <span>Budget Planner</span>
          </span>
        </Link>
        <div className={styles.actions}>
          <button type="button" className={styles.ghostBtn} onClick={reset}>
            Start over
          </button>
          <button type="button" className={styles.outlineBtn} onClick={downloadCsv}>
            Download CSV
          </button>
          <button type="button" className={styles.primaryBtn} onClick={() => window.print()}>
            Print plan
          </button>
        </div>
      </header>

      <div className={styles.layout}>
        <main className={styles.main}>
          <section className={styles.hero}>
            <span className={styles.pill}>
              Budget <span className="ocmn-accent">Planner</span>
              <Sparkle className={styles.sparkle} />
            </span>
            <h1 className={styles.h1}>
              <span>Count the cost.</span>
              <span className="ocmn-accent">Give from the start.</span>
            </h1>
            <p className={styles.intro}>
              A simple financial plan for your church plant: what launch takes once, what a typical
              month takes after that, and generosity built in from the very first dollar. Your numbers
              save in this browser as you type.
            </p>
            <p className={styles.printOnly}>
              {budget.churchName || "Church Name"} · Budget plan {budget.year}
              {budget.launchDate ? ` · Launch ${budget.launchDate}` : ""}
            </p>
          </section>

          <section className={`${styles.card} ${styles.noPrint}`}>
            <div className={styles.detailsGrid}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Church name</span>
                <input
                  className={styles.input}
                  value={budget.churchName}
                  placeholder="New Life Columbus"
                  onChange={(e) => setField("churchName", e.target.value)}
                />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Budget year</span>
                <input
                  className={styles.input}
                  inputMode="numeric"
                  value={budget.year}
                  onChange={(e) => setField("year", e.target.value)}
                />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Launch date</span>
                <input
                  className={styles.input}
                  value={budget.launchDate}
                  placeholder="Sept 2027"
                  onChange={(e) => setField("launchDate", e.target.value)}
                />
              </label>
            </div>
          </section>

          <section className={styles.section}>
            <SectionHead step="1" title="Generosity" accent="first">
              Before a single expense, decide what you’ll give. It’s figured as a percentage, so it grows
              as your church grows.
            </SectionHead>
            <div className={`${styles.card} ${styles.generosityCard}`}>
              <div className={styles.pctGrid}>
                <PercentField
                  label="Heart for Ohio"
                  sub="Ohio Ministry Network"
                  value={budget.heartPct}
                  onChange={(v) => setField("heartPct", v)}
                />
                <PercentField
                  label="Missions giving"
                  sub="AG World & U.S. Missions"
                  value={budget.missionsPct}
                  onChange={(v) => setField("missionsPct", v)}
                />
              </div>
              <div className={styles.baseRow} role="radiogroup" aria-label="Give on">
                <span className={styles.fieldLabel}>Figure giving on</span>
                {(
                  [
                    ["all", "All income", "Generous from day one, even before offerings come in"],
                    ["tithes", "Tithes & offerings only", "Giving starts when your people start giving"],
                  ] as [GivingBase, string, string][]
                ).map(([id, label, desc]) => (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={budget.givingBase === id}
                    className={`${styles.option} ${budget.givingBase === id ? styles.optionSelected : ""}`}
                    onClick={() => setField("givingBase", id)}
                  >
                    <span className={styles.mark}>{budget.givingBase === id ? "•" : ""}</span>
                    <span>
                      <span className={styles.optionLabel}>{label}</span>
                      <span className={styles.optionDesc}>{desc}</span>
                    </span>
                  </button>
                ))}
              </div>
              <Table>
                <ComputedRow label={`Heart for Ohio (${num(budget.heartPct)}%)`} pair={totals.heart} />
                <ComputedRow label={`Missions giving (${num(budget.missionsPct)}%)`} pair={totals.missions} />
                {GENEROSITY_EXTRA_LINES.map(lineRow)}
                <TotalRow label="Total generosity" pair={totals.generosityTotal} />
              </Table>
            </div>
          </section>

          <section className={styles.section}>
            <SectionHead step="2" title="Income">
              Launch is money raised once to get you to launch Sunday. Monthly is what you can count on in
              a typical month after that.
            </SectionHead>
            <div className={styles.card}>
              <Table>
                {INCOME_LINES.map(lineRow)}
                <TotalRow label="Total income" pair={totals.incomeTotal} />
              </Table>
            </div>
          </section>

          <section className={styles.section}>
            <SectionHead step="3" title="Expenses">
              Put one-time purchases in Launch and recurring costs in Monthly. Leave anything that doesn’t
              apply blank.
            </SectionHead>
            {EXPENSE_GROUPS.map((group) => (
              <div className={styles.card} key={group.id}>
                <h3 className={styles.groupTitle}>{group.label}</h3>
                <Table>
                  {group.lines.map(lineRow)}
                  {group.lines.length > 1 ? (
                    <TotalRow label={`Total ${group.label.toLowerCase()}`} pair={totals.groups[group.id]} />
                  ) : null}
                </Table>
              </div>
            ))}
            <div className={`${styles.card} ${styles.netCard}`}>
              <Table>
                <TotalRow label="Total expenses (including generosity)" pair={totals.expenseTotal} />
                <TotalRow label="Net income (loss)" pair={totals.net} strong />
              </Table>
            </div>
          </section>

          <section className={`${styles.section} ${styles.noPrint}`}>
            <SectionHead step="4" title="Best practices">
              What the Church Multiplication Network and planters across the country have learned about
              funding a new church.
            </SectionHead>
            <div className={styles.practiceGrid}>
              {BEST_PRACTICES.map((p) => (
                <div className={styles.practice} key={p.title}>
                  <h3 className={styles.practiceTitle}>{p.title}</h3>
                  <p className={styles.practiceBody}>{p.body}</p>
                </div>
              ))}
            </div>
            <p className={styles.sources}>
              Sources:{" "}
              {SOURCES.map((s, i) => (
                <span key={s.url}>
                  <a href={s.url} target="_blank" rel="noreferrer">
                    {s.label}
                  </a>
                  {i < SOURCES.length - 1 ? " · " : ""}
                </span>
              ))}
              . CMN figures change — confirm current terms with CMN and OCMN before you apply.
            </p>
          </section>

        </main>

        <aside className={styles.summary}>
          <div className={styles.summaryCard}>
            <span className={styles.eyebrow}>Your plan at a glance</span>
            <SummaryBlock
              title="Launch"
              rows={[
                ["Raised", totals.incomeTotal.launch],
                ["Spent & given", totals.expenseTotal.launch],
              ]}
              net={totals.net.launch}
            />
            <SummaryBlock
              title="A typical month"
              rows={[
                ["Income", totals.incomeTotal.monthly],
                ["Generosity", totals.generosityTotal.monthly],
                ["Expenses", totals.expenseTotal.monthly - totals.generosityTotal.monthly],
              ]}
              net={totals.net.monthly}
            />
            <SummaryBlock
              title="Year one"
              rows={[
                ["Income", totals.annual.income],
                ["Given away", totals.annual.generosity],
              ]}
              net={totals.annual.net}
            />
          </div>

          <div className={`${styles.summaryCard} ${styles.noPrint}`}>
            <span className={styles.eyebrow}>Health check</span>
            <ul className={styles.checks}>
              {checks.map((c) => (
                <li key={c.title} className={styles.check}>
                  <span className={`${styles.checkDot} ${styles[`check_${c.level}`]}`}>
                    {c.level === "good" ? "✓" : c.level === "watch" ? "!" : "i"}
                  </span>
                  <span>
                    <span className={styles.checkTitle}>{c.title}</span>
                    <span className={styles.checkDetail}>{c.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <p className={`${styles.help} ${styles.noPrint}`}>
            Want a second set of eyes? Email <a href="mailto:ocmn@ohioministry.net">ocmn@ohioministry.net</a>{" "}
            or call (614) 396-0700.
          </p>
        </aside>
        <section className={`${styles.signatures} ${styles.printOnly}`}>
          <div className={styles.sigLine}>Pastor’s signature</div>
          <div className={styles.sigLine}>Date</div>
          <div className={styles.sigLine}>Advisory committee member (if applicable)</div>
          <div className={styles.sigLine}>Advisory committee member (if applicable)</div>
          <div className={styles.sigLine}>Advisory committee member (if applicable)</div>
        </section>
      </div>
    </div>
  );
}

function SectionHead({
  step,
  title,
  accent,
  children,
}: {
  step: string;
  title: string;
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.sectionHead}>
      <span className={styles.stepPill}>Step {step}</span>
      <h2 className={styles.h2}>
        {title} {accent ? <span className="ocmn-accent">{accent}</span> : null}
      </h2>
      <p className={styles.sectionIntro}>{children}</p>
    </div>
  );
}

function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.table} role="table">
      <div className={`${styles.row} ${styles.headRow}`} role="row">
        <span role="columnheader">Line</span>
        <span role="columnheader">Launch</span>
        <span role="columnheader">Monthly</span>
        <span role="columnheader" className={styles.yearCol}>
          Year one
        </span>
      </div>
      {children}
    </div>
  );
}

function AmountRow({
  line,
  launch,
  monthly,
  onChange,
}: {
  line: BudgetLine;
  launch: string;
  monthly: string;
  onChange: (field: "launch" | "monthly", value: string) => void;
}) {
  const year = num(launch) + num(monthly) * 12;
  return (
    <div className={styles.row} role="row">
      <span className={styles.lineLabel} role="cell">
        {line.label}
        {line.hint ? <span className={styles.lineHint}>{line.hint}</span> : null}
      </span>
      {(["launch", "monthly"] as const).map((field) => (
        <span role="cell" key={field} className={styles.moneyCell}>
          <span className={styles.dollar}>$</span>
          <input
            className={styles.moneyInput}
            inputMode="decimal"
            aria-label={`${line.label}, ${field}`}
            placeholder="0"
            value={field === "launch" ? launch : monthly}
            onChange={(e) => onChange(field, e.target.value.replace(/[^0-9.,]/g, ""))}
          />
        </span>
      ))}
      <span role="cell" className={`${styles.yearCol} ${styles.amount}`}>
        {year ? money(year) : "—"}
      </span>
    </div>
  );
}

function ComputedRow({ label, pair }: { label: string; pair: Pair }) {
  return (
    <div className={styles.row} role="row">
      <span className={styles.lineLabel} role="cell">
        {label}
        <span className={styles.lineHint}>Figured for you</span>
      </span>
      <span role="cell" className={styles.amount}>
        {money(pair.launch)}
      </span>
      <span role="cell" className={styles.amount}>
        {money(pair.monthly)}
      </span>
      <span role="cell" className={`${styles.yearCol} ${styles.amount}`}>
        {money(pair.launch + pair.monthly * 12)}
      </span>
    </div>
  );
}

function TotalRow({ label, pair, strong }: { label: string; pair: Pair; strong?: boolean }) {
  const cls = (n: number) => `${styles.amount} ${strong && n < 0 ? styles.negative : ""}`;
  const year = pair.launch + pair.monthly * 12;
  return (
    <div className={`${styles.row} ${styles.totalRow} ${strong ? styles.strongRow : ""}`} role="row">
      <span role="cell">{label}</span>
      <span role="cell" className={cls(pair.launch)}>
        {money(pair.launch)}
      </span>
      <span role="cell" className={cls(pair.monthly)}>
        {money(pair.monthly)}
      </span>
      <span role="cell" className={`${styles.yearCol} ${cls(year)}`}>
        {money(year)}
      </span>
    </div>
  );
}

function PercentField({
  label,
  sub,
  value,
  onChange,
}: {
  label: string;
  sub: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className={styles.pctField}>
      <span className={styles.pctLabel}>{label}</span>
      <span className={styles.pctSub}>{sub}</span>
      <span className={styles.pctInputWrap}>
        <input
          className={styles.pctInput}
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
        />
        <span className={styles.pctSign}>%</span>
      </span>
    </label>
  );
}

function SummaryBlock({ title, rows, net }: { title: string; rows: [string, number][]; net: number }) {
  return (
    <div className={styles.summaryBlock}>
      <h3 className={styles.summaryTitle}>{title}</h3>
      {rows.map(([label, value]) => (
        <div className={styles.summaryRow} key={label}>
          <span>{label}</span>
          <span>{money(value)}</span>
        </div>
      ))}
      <div className={`${styles.summaryRow} ${styles.summaryNet}`}>
        <span>Net</span>
        <span className={net < 0 ? styles.negative : styles.positive}>{money(net)}</span>
      </div>
    </div>
  );
}
