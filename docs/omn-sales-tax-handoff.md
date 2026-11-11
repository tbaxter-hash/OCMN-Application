# OMN Sales Tax Calculator — handoff spec

You're picking up a working tool. This file says what it does and why, with the exact
rules, so you can keep building it or rebuild it somewhere else.

## Context

- **Who it's for:** staff at the **Ohio Ministry Network (OMN)**, the Ohio district of the
  Assemblies of God. Departments sell products such as books, merchandise and event-table
  items, and need to collect and report Ohio sales tax.
- **What they asked for:** "a tool to help the Ohio Ministry Network team calculate sales
  tax on products sold — need a department selector, etc — will need to download
  calculated data for the bookkeeper."
- **Branding:** brand it **OMN** only. It was first built inside the OCMN (Ohio Church
  Multiplication Network) planter-application repo, and all OCMN branding (logo, fonts,
  sparkle mark, palette) has been stripped. Don't bring it back.
- **Where the reference version lives:** repo `tbaxter-hash/OCMN-Application`, branch
  `claude/great-babbage-lnj0kx`, route `/sales-tax`. Next.js 16 App Router, React 19,
  TypeScript, ExcelJS 4.4.0. The files:

  | File | What's in it |
  | --- | --- |
  | `src/lib/salesTax.ts` | Types, defaults, tax math, report and filter helpers |
  | `src/lib/salesTaxWorkbook.ts` | Excel builder, Excel merge/reopen, CSV builder |
  | `src/components/SalesTaxCalculator.tsx` | The whole UI, a client component |
  | `src/components/SalesTaxCalculator.module.css` | Styles; brand tokens at the top |
  | `src/app/sales-tax/page.tsx` | Route and metadata |

## What it does

1. **Add a sale.** The fields are:
   - department (a select)
   - date
   - item
   - where it was sold (a location with a tax rate)
   - quantity
   - price each
   - taxable or exempt
   - if taxable, whether the price is **before tax** or **already includes tax**
   - if exempt, a reason
   - notes

   A live preview shows the price before tax, the sales tax and what the customer pays.
   After a sale is added, the date, department, location and price setting carry over to
   the next entry, for fast batch entry. Existing sales can be edited or deleted.
2. **Review sales.** Filter by department ("All departments" or one) and date range. Preset
   chips cover This month, Last month, This quarter, Last quarter and All dates; the
   default is the current month. The list shows date, item (with qty × price), department,
   location, tags (Tax added / Tax included / Exempt · reason), before tax, tax, collected,
   and a totals row.
3. **The "For the bookkeeper" side panel** always reflects the current filter. It shows
   gross sales before tax, less exempt sales, taxable sales, **sales tax collected**
   (highlighted) and total collected. Below that come the tax by department and the tax
   by county.
4. **Downloads:**
   - **Download for bookkeeper** (.xlsx, see below)
   - **Download CSV** (flat; UTF-8 with BOM so Excel opens it cleanly)
   - **Print** (print stylesheet: the summary plus the sales list, no form)

   All three respect the current filter. The file name is
   `sales-tax-{department-slug|all-departments}-{from|start}-to-{to|today}.xlsx`.
5. **Open / merge file.** Load an .xlsx this tool made. Its sales are **added** to the
   current list, and any sale whose id is already present is skipped. That way each
   department can send its file to one person who combines them. Departments and
   locations from the file are added if missing. Edits made in Excel are **not** read
   back; only the hidden data tab is used.
6. **Quick calculator** (side panel). Enter an amount and pick a location. It shows the
   tax to add and the total to charge, and also the tax inside the amount and the sale
   before tax. Nothing is saved.
7. **Setup** (collapsible):
   - The organization name used on reports.
   - Departments: add, rename, remove.
   - Locations and tax rates: add, rename, change the rate, remove.

   A department or location that has sales can't be removed (it can be renamed), and the
   last remaining one can't be removed.

Data is stored in `localStorage` only:
- `omn-sales-tax-v1` holds the state.
- `omn-sales-tax-v1-filter` holds the filter.

There's no backend, no login, and nothing is sent anywhere. The UI only renders after
hydration (`useSyncExternalStore`), so the first render already has the saved data.

## Data model

```ts
interface Department { id: string; name: string }
interface TaxLocation { id: string; name: string; rate: string } // percent string, "8" = 8%
type Pricing = "added" | "included";
interface SaleEntry {
  id: string;            // crypto.randomUUID()
  date: string;          // YYYY-MM-DD
  departmentId: string;
  locationId: string;
  item: string;          // blank saves as "Sale"
  qty: string;           // may be negative for refunds
  price: string;
  pricing: Pricing;
  taxable: boolean;
  exemptReason: string;
  notes: string;
}
interface SalesTaxState {
  orgName: string;       // default "Ohio Ministry Network"
  departments: Department[];
  locations: TaxLocation[];
  entries: SaleEntry[];
  defaultPricing: Pricing; // remembers the last choice
}
interface Filter { from: string; to: string; departmentId: string } // "" = open / all
```

**Default departments.** These are placeholders; nobody has confirmed OMN's real list.
- Church Multiplication
- Youth Ministries
- Children’s Ministries
- Women’s Ministries
- Men’s Ministries
- Missions
- Conferences & Events
- School of Ministry & Credentials
- Resources & Bookstore
- General / Office

**Default location:** "Ministry office — Franklin County" at **8%**, made up of 5.75% state
+ 1.25% county + 1.0% COTA transit. This rate needs checking against tax.ohio.gov.

**Exempt reasons:**
- Exempt organization (certificate on file)
- Purchased for resale (certificate on file)
- Shipped out of state
- Exempt item
- Other

The UI reminds staff to keep the buyer's STEC B certificate.

## Tax math (the part that must stay exact)

- Tax is rounded **per sale line** to the cent, **half away from zero**, the same as
  Excel's `ROUND(x, 2)`.
- `amount = round(qty × price)`
- **Exempt:** net = amount, tax = 0, total = amount.
- **Tax added:** net = amount, tax = round(amount × rate), total = net + tax.
- **Tax included:** total = amount, net = round(amount / (1 + rate)), tax = amount − net.
- **Totals:**
  - gross sales before tax = Σ net
  - exempt sales = Σ net where exempt
  - taxable sales = Σ net where taxable
  - tax = Σ tax
  - total collected = Σ total

```ts
export function cents(n: number): number {
  const sign = n < 0 ? -1 : 1;
  return (sign * Math.round(Math.abs(n) * 100 + 1e-7)) / 100;
}

export function computeSale(sale, rate /* fraction, 0.08 */) {
  const amount = cents(num(sale.qty) * num(sale.price));
  if (!sale.taxable) return { amount, net: amount, tax: 0, total: amount, rate };
  if (sale.pricing === "included") {
    const net = cents(amount / (1 + rate));
    return { amount, net, tax: cents(amount - net), total: amount, rate };
  }
  const tax = cents(amount * rate);
  return { amount, net: amount, tax, total: cents(amount + tax), rate };
}
```

**Ohio specifics this relies on:**
- The rate is 5.75% state plus the county (and transit) rate.
- Sales at the office use the office's county.
- Sales at an event elsewhere in Ohio use the county where the event is held, so staff
  add a location for it.
- The return (UST-1) is filed per county.
- Changing a location's rate re-figures every sale at that location. The UI tells staff
  to add a new location when a rate changes instead of editing the old one.

**Possible improvement:** store the rate on each sale when it's saved, so a later rate
change can't alter past sales.

## Test cases (expected results, verified in the app and in recalculated Excel)

| Sale | Location | Before tax | Tax | Collected |
| --- | --- | --- | --- | --- |
| Books, 3 × $14.99, tax added, Church Multiplication | Franklin 8% | 44.97 | 3.60 | 48.57 |
| T-shirts, 1 × $20, tax included, Youth | Franklin 8% | 18.52 | 1.48 | 20.00 |
| Bulk to church, 1 × $100, exempt, Missions | Franklin 8% | 100.00 | 0.00 | 100.00 |
| Camp store, 1 × $250, tax added, Youth | Knox 7.25% | 250.00 | 18.13 | 268.13 |
| **Totals** | | **413.49** (exempt 100.00, taxable 313.49) | **23.21** | **436.70** |

- **By department:** Church Multiplication $3.60, Youth $19.61, Missions $0.00.
- **By county:** Franklin $5.08 (taxable $63.49), Knox $18.13.
- **Merge:** opening the same file twice adds 4 sales the first time and skips all 4 the
  second time.

## Excel workbook ("Download for bookkeeper")

- Built with ExcelJS, imported dynamically so it loads only when needed.
- Every formula is written with a correct cached result, and `fullCalcOnLoad` is on.
- The formulas were checked by stripping every cached value and recalculating in
  LibreOffice: the results matched the table above.
- Font is Calibri.

### Tab 1: Summary (first tab, portrait, fit to width)

- **Header rows:**
  - A1: org name
  - A2: "Sales tax report"
  - A3: "Period: … · {department or All departments}"
  - A4: prepared date and sale count
- **BY DEPARTMENT table.** Columns: Department | Sales before tax | Exempt sales | Taxable
  sales | Sales tax | Total collected | Sales. Each cell is a `SUMIFS`/`COUNTIFS` over the
  Sales Detail tab, keyed on the department name in column A. A Total row follows.
- **BY LOCATION / COUNTY table.** The same columns, but the last one is Rate. Keyed on the
  location name. A Total row follows.
- **OHIO SALES TAX RETURN (UST-1) WORKSHEET:**
  - Gross sales (before tax)
  - Less exempt sales
  - Net taxable sales
  - Sales tax collected

  Each line references the department Total row.
- **Footnote:** confirm rates at tax.ohio.gov before filing; the return, the vendor's
  discount and any penalties are worked out on the Ohio Business Gateway.

### Tab 2: Sales Detail

- Frozen header row, autofilter, landscape.
- Columns:
  - A Date (real date, `mm/dd/yyyy`)
  - B Department
  - C Location / county
  - D Item
  - E Qty
  - F Unit price
  - G Amount rung up = `ROUND(E*F,2)`
  - H Price basis ("Tax added" / "Tax included"; blank if exempt)
  - I Taxable? (Yes/No)
  - J Exempt reason
  - K Tax rate (fraction, `0.000%`)
  - L Sale before tax = `IF(I="No",G,IF(H="Tax included",ROUND(G/(1+K),2),G))`
  - M Sales tax = `IF(I="No",0,IF(H="Tax included",G-L,ROUND(G*K,2)))`
  - N Total collected = `L+M`
  - O Notes
- A Totals row sums columns G, L, M and N.

### Tab 3: Tax Rates

Location and combined rate.

### Hidden tab `SalesTaxData` (veryHidden)

- Holds JSON: `{ version: 1, orgName, departments, locations, entries }`, containing only
  the exported entries.
- The JSON is split across A1, A2, … in 30,000-character chunks, because Excel cells cap
  at 32,767 characters.
- Merge reads and concatenates the chunks until it reaches an empty cell.

## CSV

- Same 15 columns as Sales Detail.
- Values are computed (no formulas); dates are ISO.
- The rate is written as `8.000%`.

## Look and feel

- **Layout:**
  - Sticky top bar with a text mark "OMN" and the words "Ohio Ministry Network / Sales
    Tax Calculator".
  - Actions: Clear sales, Open / merge file, Print, Download CSV, and **Download for
    bookkeeper** as the primary button.
  - A two-column body: the main column, plus a 320px sticky side panel.
  - On screens under 1000px the side panel stacks above the main column.
  - Under 700px the sales table turns into stacked cards with labelled amounts.
  - The page has no horizontal scroll at 390px.
- **Hero:** "Every sale counted." / "Every cent reported."
- **Section heads:** "Step 1 · Add a sale", "Step 2 · Review sales", "Setup · Departments &
  tax rates".
- **Brand tokens** sit at the top of the CSS module, on `.page`. Replace them with OMN's
  official colors and font; I don't have those. The current values are neutral
  placeholders:
  ```css
  --brand: #1f3a68; --brand-dark: #142847; --brand-mid: #3a5a94;
  --brand-soft: #d6dff0; --brand-tint: #eef2f9;
  --accent: #b5651d; --accent-soft: #f6e6d4; --accent-line: #e8c7a2;
  --brand-font: system-ui, ...;
  ```
  The workbook has a matching `C` color map in `salesTaxWorkbook.ts`; update it at the
  same time.
- **Inherited from the host app:** the neutral ink/paper grays and the radius and shadow
  variables (`--ink-*`, `--paper-*`, `--radius-*`, `--shadow-*`, `--success-*`,
  `--warning-*`, `--danger-600`) come from the host app's `globals.css`. Define them if
  you move the tool.
- **Disclaimer copy:** "This tool helps you organize sales. It isn't tax advice." It sits
  next to links to the Ohio Dept. of Taxation rates page and the Ohio Business Gateway.

## Open questions for the OMN team

1. What are the real department names?
2. What address and county is the office in, and is 8% (Franklin) correct?
3. Do sales need to be shared across staff computers? The tool is per-browser today. A
   small backend or shared database would remove the need for merging files.
4. Does the bookkeeper want a particular CSV layout, for example a QuickBooks import
   format?
5. Should the logo and brand colors come from an OMN style guide?
6. Should each department's sales be reported separately, or is one combined return
   enough? The tool supports both.
