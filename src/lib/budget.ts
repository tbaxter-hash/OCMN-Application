// Budget planner schema and math. Line items follow the OCMN Church Budget
// Template (Profit and Loss Budget Overview), simplified to two numbers per
// line: a one-time launch amount and a typical month.

export const BUDGET_STORAGE_KEY = "ocmn-budget-planner-v1";

// CMN's published matching-fund ceiling (churchmultiplication.net/funding).
export const CMN_MATCH_CAP = 50000;

export interface BudgetLine {
  id: string;
  label: string;
  hint?: string;
}

export interface BudgetGroup {
  id: string;
  label: string;
  intro?: string;
  lines: BudgetLine[];
}

export const INCOME_LINES: BudgetLine[] = [
  { id: "tithes", label: "Tithes & offerings", hint: "Giving from the people you gather. Often small before launch." },
  { id: "partners", label: "Church partners", hint: "Your parent church and any partner churches." },
  { id: "donors", label: "Individual donors", hint: "Monthly ministry partners you raise yourself." },
  { id: "cmn", label: "CMN matching funds", hint: "Church Multiplication Network — up to $50,000, matched to what you raise." },
  { id: "ocmn", label: "OCMN" },
  { id: "fundraising", label: "Fundraising", hint: "Events, campaigns, one-time gifts." },
];

export const EXPENSE_GROUPS: BudgetGroup[] = [
  {
    id: "facilities",
    label: "Facilities & equipment",
    lines: [
      { id: "rent", label: "Rent" },
      { id: "utilities", label: "Utilities" },
      { id: "computers", label: "Computers" },
      { id: "furnishings", label: "Furnishings" },
      { id: "av", label: "Audio / visual" },
      { id: "insurance", label: "Insurance", hint: "General liability before your first public gathering." },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    lines: [
      { id: "financial", label: "Financial services", hint: "Bookkeeping, payroll service, bank fees." },
      { id: "office", label: "Office supplies" },
      { id: "workersComp", label: "Workers’ comp" },
      { id: "advertising", label: "Advertising / promotion" },
      { id: "telephone", label: "Telephone" },
      { id: "website", label: "Website" },
      { id: "software", label: "Software" },
      { id: "hospitality", label: "Hospitality & signage" },
      { id: "backgroundChecks", label: "Volunteer background checks" },
      { id: "postage", label: "Postage" },
      { id: "mileage", label: "Mileage reimbursement" },
    ],
  },
  {
    id: "payroll",
    label: "Payroll",
    lines: [
      { id: "salary", label: "Salary" },
      { id: "housing", label: "Housing allowance" },
      { id: "health", label: "Health insurance" },
      { id: "bap", label: "Business & professional (BAP)", hint: "Conferences, books, ministry travel." },
    ],
  },
  {
    id: "outreach",
    label: "Outreach, evangelism & compassion",
    lines: [
      { id: "literature", label: "Literature" },
      { id: "events", label: "Events" },
      { id: "outreachSupplies", label: "Supplies" },
    ],
  },
  {
    id: "ministries",
    label: "Ministries",
    lines: [
      { id: "nursery", label: "Nursery" },
      { id: "children", label: "Children" },
      { id: "youth", label: "Youth" },
    ],
  },
  {
    id: "leadership",
    label: "Leadership development",
    lines: [
      { id: "resources", label: "Resources", hint: "Books, courses, coaching." },
      { id: "retreats", label: "Events & retreats", hint: "CMN Launch, OCMN cohort, staff retreats." },
    ],
  },
  {
    id: "savings",
    label: "Savings",
    lines: [{ id: "savings", label: "Savings / reserve", hint: "Set aside every month, even a little." }],
  },
];

// Extra generosity lines entered by hand, beside the two percentage-based ones.
export const GENEROSITY_EXTRA_LINES: BudgetLine[] = [
  { id: "multiplication", label: "Church multiplication", hint: "CMN fund repayment or giving toward the next plant." },
  { id: "otherGiving", label: "Other giving" },
];

export type GivingBase = "all" | "tithes";

export interface LineAmounts {
  launch: string;
  monthly: string;
}

export interface BudgetState {
  churchName: string;
  year: string;
  launchDate: string;
  heartPct: string;
  missionsPct: string;
  givingBase: GivingBase;
  lines: Record<string, LineAmounts>;
}

export function emptyBudget(): BudgetState {
  return {
    churchName: "",
    year: String(new Date().getFullYear() + 1),
    launchDate: "",
    heartPct: "3",
    missionsPct: "3",
    givingBase: "all",
    lines: {},
  };
}

export function num(value: string | undefined): number {
  if (!value) return 0;
  const n = parseFloat(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export interface Pair {
  launch: number;
  monthly: number;
}

export interface Totals {
  income: Record<string, Pair>;
  incomeTotal: Pair;
  givingBase: Pair;
  heart: Pair;
  missions: Pair;
  generosityTotal: Pair;
  groups: Record<string, Pair>;
  expenseTotal: Pair;
  net: Pair;
  annual: { income: number; expense: number; net: number; generosity: number };
}

function line(state: BudgetState, id: string): Pair {
  const l = state.lines[id];
  return { launch: num(l?.launch), monthly: num(l?.monthly) };
}

function sum(pairs: Pair[]): Pair {
  return pairs.reduce((acc, p) => ({ launch: acc.launch + p.launch, monthly: acc.monthly + p.monthly }), {
    launch: 0,
    monthly: 0,
  });
}

function pct(base: Pair, percent: number): Pair {
  return { launch: (base.launch * percent) / 100, monthly: (base.monthly * percent) / 100 };
}

export function computeTotals(state: BudgetState): Totals {
  const income: Record<string, Pair> = {};
  INCOME_LINES.forEach((l) => (income[l.id] = line(state, l.id)));
  const incomeTotal = sum(Object.values(income));
  const givingBase = state.givingBase === "tithes" ? income.tithes : incomeTotal;

  const heart = pct(givingBase, num(state.heartPct));
  const missions = pct(givingBase, num(state.missionsPct));
  const generosityTotal = sum([heart, missions, ...GENEROSITY_EXTRA_LINES.map((l) => line(state, l.id))]);

  const groups: Record<string, Pair> = { generosity: generosityTotal };
  EXPENSE_GROUPS.forEach((g) => (groups[g.id] = sum(g.lines.map((l) => line(state, l.id)))));
  const expenseTotal = sum(Object.values(groups));

  const net = { launch: incomeTotal.launch - expenseTotal.launch, monthly: incomeTotal.monthly - expenseTotal.monthly };
  const annualIncome = incomeTotal.launch + incomeTotal.monthly * 12;
  const annualExpense = expenseTotal.launch + expenseTotal.monthly * 12;

  return {
    income,
    incomeTotal,
    givingBase,
    heart,
    missions,
    generosityTotal,
    groups,
    expenseTotal,
    net,
    annual: {
      income: annualIncome,
      expense: annualExpense,
      net: annualIncome - annualExpense,
      generosity: generosityTotal.launch + generosityTotal.monthly * 12,
    },
  };
}

export type CheckLevel = "good" | "watch" | "info";

export interface HealthCheck {
  level: CheckLevel;
  title: string;
  detail: string;
}

export function money(n: number): string {
  const sign = n < 0 ? "−" : "";
  return `${sign}$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
}

function percentOf(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

// Best-practice checks. Each one ties back to guidance in BEST_PRACTICES.
export function healthChecks(state: BudgetState, t: Totals): HealthCheck[] {
  const checks: HealthCheck[] = [];
  const has = (id: string) => {
    const p = line(state, id);
    return p.launch > 0 || p.monthly > 0;
  };
  const monthlyExpense = t.expenseTotal.monthly;
  const anyNumbers = t.incomeTotal.launch + t.incomeTotal.monthly + t.expenseTotal.launch + monthlyExpense > 0;
  if (!anyNumbers) {
    return [
      {
        level: "info",
        title: "Start with income",
        detail: "Enter what you expect to raise, then your costs. Checks appear here as you go.",
      },
    ];
  }

  const heartPct = num(state.heartPct);
  const missionsPct = num(state.missionsPct);
  checks.push(
    heartPct >= 3 && missionsPct > 0
      ? {
          level: "good",
          title: "Generous from day one",
          detail: `${heartPct}% Heart for Ohio and ${missionsPct}% missions — ${money(t.annual.generosity)} given in year one.`,
        }
      : {
          level: "watch",
          title: "Set generosity first",
          detail: "OCMN plants give 3% to Heart for Ohio and give to missions from the very first dollar.",
        },
  );

  if (t.net.monthly >= 0) {
    checks.push({
      level: "good",
      title: "A typical month balances",
      detail: `${money(t.net.monthly)} left over each month after giving and expenses.`,
    });
  } else {
    const gap = -t.net.monthly;
    const cushion = Math.max(t.net.launch, 0);
    const months = Math.floor(cushion / gap);
    checks.push({
      level: "watch",
      title: `Short ${money(gap)} a month`,
      detail:
        cushion > 0
          ? `Leftover launch funds cover about ${months} month${months === 1 ? "" : "s"} of that gap. Plan how giving or partners close it.`
          : "Nothing from launch is left to cover it. Raise more support or trim costs before you commit.",
    });
  }

  if (t.expenseTotal.launch > 0 || t.incomeTotal.launch > 0) {
    checks.push(
      t.net.launch >= 0
        ? { level: "good", title: "Launch costs are funded", detail: `${money(t.net.launch)} left after one-time costs.` }
        : {
            level: "watch",
            title: "Launch costs aren’t funded yet",
            detail: `One-time costs run ${money(-t.net.launch)} past what you’ve raised for launch.`,
          },
    );
  }

  if (monthlyExpense > 0) {
    const reserveMonths = (line(state, "savings").monthly * 12) / monthlyExpense;
    checks.push(
      reserveMonths >= 3
        ? {
            level: "good",
            title: "Building a reserve",
            detail: `Year-one savings would cover about ${reserveMonths.toFixed(1)} months of expenses.`,
          }
        : {
            level: "watch",
            title: "Grow your reserve",
            detail: `Savings cover ${reserveMonths.toFixed(1)} months after a year. Aim for 3–6 months over time.`,
          },
    );

    const payrollShare = percentOf(t.groups.payroll.monthly, monthlyExpense);
    if (t.groups.payroll.monthly === 0) {
      checks.push({
        level: "info",
        title: "No payroll budgeted",
        detail: "Fine if you’re bivocational — just name how your family is provided for.",
      });
    } else if (payrollShare > 60) {
      checks.push({
        level: "watch",
        title: `Payroll is ${payrollShare}% of monthly costs`,
        detail: "Most churches land between 30% and 50%. Above 60% leaves little room for ministry and outreach.",
      });
    } else {
      checks.push({
        level: "good",
        title: `Payroll is ${payrollShare}% of monthly costs`,
        detail: "Within the range most healthy plants hold.",
      });
    }

    const selfSupport = percentOf(t.income.tithes.monthly, monthlyExpense);
    checks.push({
      level: selfSupport >= 100 ? "good" : "info",
      title: selfSupport >= 100 ? "Local giving covers a full month" : `Local giving covers ${selfSupport}% of a month`,
      detail:
        selfSupport >= 100
          ? "Tithes and offerings carry the church on their own."
          : "Outside support should step down as local giving grows. Plan when you reach 100%.",
    });
  }

  if (!has("insurance")) {
    checks.push({
      level: "watch",
      title: "No insurance budgeted",
      detail: "Carry general liability coverage before your first public gathering.",
    });
  }

  if ((has("nursery") || has("children") || has("youth")) && !has("backgroundChecks")) {
    checks.push({
      level: "watch",
      title: "Background checks for kids’ volunteers",
      detail: "You’ve budgeted for children or youth — screen every volunteer who serves them.",
    });
  }

  const cmnTotal = t.income.cmn.launch + t.income.cmn.monthly * 12;
  if (cmnTotal > CMN_MATCH_CAP) {
    checks.push({
      level: "watch",
      title: "CMN funds above the cap",
      detail: `You’ve planned ${money(cmnTotal)}. CMN matching funds currently top out at ${money(CMN_MATCH_CAP)}.`,
    });
  } else if (cmnTotal > 0) {
    const partnerTotal = t.income.partners.launch + t.income.partners.monthly * 12;
    checks.push({
      level: partnerTotal > 0 ? "info" : "watch",
      title: "CMN matching funds",
      detail:
        partnerTotal > 0
          ? "Plan to repay 10% of undesignated monthly income to CMN — the Church multiplication line is a good home for it."
          : "CMN weighs the strength of your primary partner. Add your parent or partner church support.",
    });
  }

  return checks;
}

export interface BestPractice {
  title: string;
  body: string;
}

export const BEST_PRACTICES: BestPractice[] = [
  {
    title: "Give first, from the first dollar",
    body: "Build generosity into the DNA before launch Sunday. OCMN plants give 3% to Heart for Ohio through the Ohio Ministry Network and give to AG World and U.S. Missions. The habits you budget now are the habits your church will keep.",
  },
  {
    title: "Fund the launch well",
    body: "A 2022 survey of more than 2,700 North American planters found attendance tracks closely with what a plant invests at launch and in year one. Plants that grew past 200 averaged about $100,000 in startup costs; plants still under 100 after two years averaged about $10,000.",
  },
  {
    title: "Think in three buckets",
    body: "Most plant budgets split into personnel, operations, and missions. You’ll see ratios like 40/50/10 quoted — hold them loosely. Bivocational, urban, and dinner-church plants look different, so talk with planters in your context.",
  },
  {
    title: "Plan your step-down",
    body: "Outside support is a runway, not a foundation. Set a date when tithes and offerings carry the church, and step partner and network support down toward it.",
  },
  {
    title: "Build a reserve",
    body: "Save every month, even a little. Work toward three months of expenses, then six. A reserve turns a slow summer or a broken sound board into an inconvenience instead of a crisis.",
  },
  {
    title: "Know the CMN matching fund",
    body: "CMN matches funds you raise, up to $50,000, based on readiness, your ministry plan, your assessment, and your primary partner. Apply at least ten weeks before launch; spouses attend CMN Launch. Recipients repay 10% of undesignated monthly income, and funds can’t go toward buildings or long-term capital projects.",
  },
  {
    title: "Keep money above reproach",
    body: "Separate church and personal accounts from day one. Two unrelated people count every offering. Review actuals against this budget monthly with your advisory committee, and have them sign off on the plan.",
  },
  {
    title: "Protect people",
    body: "Budget for liability insurance before you gather publicly, workers’ comp if you have employees, and background checks for anyone serving children or youth.",
  },
];

export const SOURCES = [
  { label: "CMN Matching Fund", url: "https://www.churchmultiplication.net/funding" },
  { label: "CMN FAQ", url: "https://www.churchmultiplication.net/faq" },
  { label: "CMN Launch", url: "https://www.churchmultiplication.net/launch" },
  { label: "Influence — How to finance your church plant", url: "https://influencemagazine.com/practice/how-to-finance-your-church-plant" },
  { label: "NAMB — Developing a church budget", url: "https://www.namb.net/resource/money-matters-developing-church-budget" },
  { label: "Christianity Today — Church planting costs", url: "https://christianitytoday.com/ct/2023/januaryfebruary/church-planting-costs-startup-money-metrics.html" },
  { label: "Aplos — Church plant budgeting guide", url: "https://aplos.com/academy/church-plant-budgeting-guide" },
];

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function budgetCsv(state: BudgetState, t: Totals): string {
  const rows: (string | number)[][] = [];
  const r = (n: number) => Math.round(n * 100) / 100;
  const row = (label: string, p: Pair) => rows.push([label, r(p.launch), r(p.monthly), r(p.launch + p.monthly * 12)]);

  rows.push([state.churchName || "Church Name"]);
  rows.push([`Budget plan — ${state.year}`]);
  rows.push([]);
  rows.push(["", "Launch (one-time)", "Monthly", "Year one total"]);
  rows.push(["Income"]);
  INCOME_LINES.forEach((l) => row(l.label, t.income[l.id]));
  row("Total income", t.incomeTotal);
  rows.push([]);
  rows.push(["Expense"]);
  rows.push(["Generosity"]);
  row(`Heart for Ohio — Ohio Ministry Network (${num(state.heartPct)}%)`, t.heart);
  row(`AG World & U.S. Missions (${num(state.missionsPct)}%)`, t.missions);
  GENEROSITY_EXTRA_LINES.forEach((l) => row(l.label, line(state, l.id)));
  row("Total generosity", t.generosityTotal);
  EXPENSE_GROUPS.forEach((g) => {
    rows.push([g.label]);
    g.lines.forEach((l) => row(l.label, line(state, l.id)));
    row(`Total ${g.label.toLowerCase()}`, t.groups[g.id]);
  });
  rows.push([]);
  row("Total expense", t.expenseTotal);
  row("Net income (loss)", t.net);
  return rows.map((cells) => cells.map(csvCell).join(",")).join("\n");
}
