// Sales tax calculator schema and math. Each sale is one line: what was sold,
// which department sold it, where (Ohio rates differ by county), and whether
// the price already had tax in it.

export const SALES_TAX_STORAGE_KEY = "omn-sales-tax-v1";

export interface Department {
  id: string;
  name: string;
}

export interface TaxLocation {
  id: string;
  name: string;
  /** Combined state + county + transit rate, as a percent string ("8" = 8%). */
  rate: string;
}

/** "added": tax goes on top of the price. "included": the price already has tax in it. */
export type Pricing = "added" | "included";

export interface SaleEntry {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  departmentId: string;
  locationId: string;
  item: string;
  qty: string;
  price: string;
  pricing: Pricing;
  taxable: boolean;
  exemptReason: string;
  notes: string;
}

export interface SalesTaxState {
  orgName: string;
  departments: Department[];
  locations: TaxLocation[];
  entries: SaleEntry[];
  defaultPricing: Pricing;
}

export interface Filter {
  /** YYYY-MM-DD, inclusive; blank = open-ended. */
  from: string;
  to: string;
  /** "" = all departments. */
  departmentId: string;
}

export const OHIO_STATE_RATE = 5.75;

export const EXEMPT_REASONS = [
  "Exempt organization (certificate on file)",
  "Purchased for resale (certificate on file)",
  "Shipped out of state",
  "Exempt item",
  "Other",
];

// Starting list only. The team renames, adds, or removes these in the app.
export const DEFAULT_DEPARTMENTS: Department[] = [
  { id: "multiplication", name: "Church Multiplication" },
  { id: "youth", name: "Youth Ministries" },
  { id: "kids", name: "Children’s Ministries" },
  { id: "women", name: "Women’s Ministries" },
  { id: "men", name: "Men’s Ministries" },
  { id: "missions", name: "Missions" },
  { id: "events", name: "Conferences & Events" },
  { id: "school", name: "School of Ministry & Credentials" },
  { id: "resources", name: "Resources & Bookstore" },
  { id: "office", name: "General / Office" },
];

export const DEFAULT_LOCATIONS: TaxLocation[] = [
  // 5.75% state + 1.25% county + 1.0% COTA transit.
  { id: "franklin", name: "Ministry office — Franklin County", rate: "8" },
];

export function emptySalesTax(): SalesTaxState {
  return {
    orgName: "Ohio Ministry Network",
    departments: DEFAULT_DEPARTMENTS.map((d) => ({ ...d })),
    locations: DEFAULT_LOCATIONS.map((l) => ({ ...l })),
    entries: [],
    defaultPricing: "added",
  };
}

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function num(value: string | undefined): number {
  if (!value) return 0;
  const n = parseFloat(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** Rounds to cents, half away from zero — the same as Excel's ROUND(x, 2). */
export function cents(n: number): number {
  const sign = n < 0 ? -1 : 1;
  return (sign * Math.round(Math.abs(n) * 100 + 1e-7)) / 100;
}

export interface SaleMath {
  /** Qty × unit price, as rung up. */
  amount: number;
  /** The sale before tax. */
  net: number;
  tax: number;
  /** What the customer paid. */
  total: number;
  /** Rate as a fraction (0.08). */
  rate: number;
}

export function rateOf(state: SalesTaxState, locationId: string): number {
  const loc = state.locations.find((l) => l.id === locationId);
  return num(loc?.rate) / 100;
}

export function computeSale(
  sale: Pick<SaleEntry, "qty" | "price" | "pricing" | "taxable">,
  rate: number,
): SaleMath {
  const amount = cents(num(sale.qty) * num(sale.price));
  if (!sale.taxable) return { amount, net: amount, tax: 0, total: amount, rate };
  if (sale.pricing === "included") {
    const net = cents(amount / (1 + rate));
    return { amount, net, tax: cents(amount - net), total: amount, rate };
  }
  const tax = cents(amount * rate);
  return { amount, net: amount, tax, total: cents(amount + tax), rate };
}

export interface Bucket {
  net: number;
  exempt: number;
  taxable: number;
  tax: number;
  total: number;
  count: number;
}

const emptyBucket = (): Bucket => ({ net: 0, exempt: 0, taxable: 0, tax: 0, total: 0, count: 0 });

function add(b: Bucket, sale: SaleEntry, m: SaleMath) {
  b.net = cents(b.net + m.net);
  if (sale.taxable) b.taxable = cents(b.taxable + m.net);
  else b.exempt = cents(b.exempt + m.net);
  b.tax = cents(b.tax + m.tax);
  b.total = cents(b.total + m.total);
  b.count++;
}

export interface Report {
  entries: SaleEntry[];
  math: Record<string, SaleMath>;
  totals: Bucket;
  byDepartment: { department: Department; bucket: Bucket }[];
  byLocation: { location: TaxLocation; bucket: Bucket }[];
}

export function filterEntries(state: SalesTaxState, filter: Filter): SaleEntry[] {
  return state.entries
    .filter(
      (e) =>
        (!filter.from || e.date >= filter.from) &&
        (!filter.to || e.date <= filter.to) &&
        (!filter.departmentId || e.departmentId === filter.departmentId),
    )
    .sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? -1 : 1));
}

export function departmentName(state: SalesTaxState, id: string): string {
  return state.departments.find((d) => d.id === id)?.name ?? "(removed department)";
}

export function locationName(state: SalesTaxState, id: string): string {
  return state.locations.find((l) => l.id === id)?.name ?? "(removed location)";
}

export function buildReport(state: SalesTaxState, filter: Filter): Report {
  const entries = filterEntries(state, filter);
  const math: Record<string, SaleMath> = {};
  const totals = emptyBucket();
  const dept = new Map<string, Bucket>();
  const loc = new Map<string, Bucket>();
  for (const e of entries) {
    const m = computeSale(e, rateOf(state, e.locationId));
    math[e.id] = m;
    add(totals, e, m);
    if (!dept.has(e.departmentId)) dept.set(e.departmentId, emptyBucket());
    add(dept.get(e.departmentId)!, e, m);
    if (!loc.has(e.locationId)) loc.set(e.locationId, emptyBucket());
    add(loc.get(e.locationId)!, e, m);
  }
  const order = <T extends { id: string }>(list: T[], map: Map<string, Bucket>, fallback: (id: string) => T) => {
    const known = list.filter((x) => map.has(x.id));
    const orphans = [...map.keys()].filter((id) => !list.some((x) => x.id === id)).map(fallback);
    return [...known, ...orphans].map((x) => ({ item: x, bucket: map.get(x.id)! }));
  };
  return {
    entries,
    math,
    totals,
    byDepartment: order(state.departments, dept, (id) => ({ id, name: departmentName(state, id) })).map(
      ({ item, bucket }) => ({ department: item, bucket }),
    ),
    byLocation: order(state.locations, loc, (id) => ({ id, name: locationName(state, id), rate: "0" })).map(
      ({ item, bucket }) => ({ location: item, bucket }),
    ),
  };
}

export function money(n: number): string {
  const sign = n < 0 ? "−" : "";
  return `${sign}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function percent(rate: string): string {
  return `${num(rate).toLocaleString("en-US", { maximumFractionDigits: 4 })}%`;
}

/** "2026-11-04" → "11/04/2026" */
export function usDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${m}/${d}/${y}` : iso;
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function todayIso(): string {
  return isoDate(new Date());
}

/** The current month (offset 0), last month (-1), and so on. */
export function monthRange(offset = 0): { from: string; to: string } {
  const now = new Date();
  return {
    from: isoDate(new Date(now.getFullYear(), now.getMonth() + offset, 1)),
    to: isoDate(new Date(now.getFullYear(), now.getMonth() + offset + 1, 0)),
  };
}

export function quarterRange(offset = 0): { from: string; to: string } {
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3) + offset;
  return {
    from: isoDate(new Date(now.getFullYear(), q * 3, 1)),
    to: isoDate(new Date(now.getFullYear(), q * 3 + 3, 0)),
  };
}

export function periodLabel(filter: Filter): string {
  if (filter.from && filter.to) return `${usDate(filter.from)} – ${usDate(filter.to)}`;
  if (filter.from) return `From ${usDate(filter.from)}`;
  if (filter.to) return `Through ${usDate(filter.to)}`;
  return "All dates";
}

export const SOURCES = [
  { label: "Ohio Dept. of Taxation — Sales & use tax rates", url: "https://tax.ohio.gov/business/ohio-business-taxes/sales-and-use/rates" },
  { label: "Ohio Business Gateway (file the UST-1)", url: "https://gateway.ohio.gov" },
];
