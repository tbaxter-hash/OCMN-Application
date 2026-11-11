# OCMN Planter Application

A multi-step church-planting application for the Ohio Church Multiplication Network
(OCMN). Applicants pick one of three paths (Church Planter / Dinner Church Planter /
Parent Church) on a welcome screen, then work through only the sections that apply,
with progress saved as they go and a review-everything step before submitting.

Built with Next.js (App Router) and TypeScript. See `docs/design-handoff.md` for the
full design spec this implementation was built from.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Current state

- **Question schema**: `src/lib/questions.ts` — 21 steps, 122 questions, ported
  verbatim from the design handoff's `questions.js`, with the same branching
  predicates (`needsCred`, `notParent`).
- **Persistence**: browser `localStorage` only, under the key `ocmn-planter-app-v1`.
  There is no backend yet — nothing is transmitted anywhere on submit.
- **Screens**: Welcome, Form (sidebar + question steps), Review & submit,
  Confirmation — in `src/components/`.

## Budget planner (`/budget`)

A simple financial plan for church planters, built from the OCMN Church Budget
Template (Profit and Loss Budget Overview). Each line takes two numbers — a one-time
launch amount and a typical month — and the planner works out year-one totals.

- **Generosity first**: 3% Heart for Ohio (Ohio Ministry Network) and missions giving
  (AG World & U.S. Missions, 3% by default) are figured automatically as a percentage
  of income — all income by default, or tithes & offerings only.
- **Health check**: live best-practice checks (monthly balance, launch funding,
  reserve, payroll share, local-giving self-support, insurance, background checks,
  CMN matching-fund cap).
- **Best practices** from CMN and national church-planting sources, with links.
- **Download Excel** builds a formatted workbook (`src/lib/budgetWorkbook.ts`, using
  ExcelJS): a Summary tab, one tab per year for three years with live formulas
  (generosity rates, totals, carried-over cash balance, local-giving coverage), and a
  Best Practices tab.
- **Submit to OCMN** opens an email to ocmn@ohioministry.net for the planter to attach
  the downloaded file to — there is no upload yet.
- **Open saved plan** loads a downloaded workbook back into the planner (a hidden
  `PlannerData` tab holds the plan; amounts and rates edited on the first year's tab
  in Excel are picked up too), so a plan can be edited on another computer.
- **Print PDF** prints the plan (or saves it as a PDF from the print dialog).
- Print with pastor and two advisory-committee signature lines.
- Schema, math, and checks live in `src/lib/budget.ts`; saved in `localStorage`
  under `ocmn-budget-planner-v1`.

## Sales tax calculator (`/sales-tax`)

For the Ohio Ministry Network team to log products sold and figure Ohio sales tax,
then hand a report to the bookkeeper.

- **Department selector** on every sale, and a department filter on the report. The
  starting department list is a placeholder — rename, add, or remove departments under
  Setup (a department with sales on it can be renamed but not removed).
- **Locations & tax rates**: Ohio's rate is 5.75% state plus county (and transit) tax,
  so each sale picks where it was sold. Defaults to the ministry office in Franklin
  County at 8%; add a location for events held in other counties.
- **Tax added or tax included**: a price can be before tax (tax goes on top) or a round
  price that already includes tax (tax is backed out). Tax rounds to the cent per sale,
  half away from zero, matching Excel's `ROUND`.
- **Exempt sales** with a reason (exempt organization, resale, shipped out of state…).
- **Review**: filter by period (this/last month, this/last quarter, custom) and
  department; the sidebar shows gross, exempt and taxable sales and tax collected,
  broken out by department and by county.
- **Download for bookkeeper** builds an Excel workbook (`src/lib/salesTaxWorkbook.ts`):
  a Summary tab (by department, by county, and a UST-1 return worksheet), a Sales
  Detail tab with live formulas and filters, and a Tax Rates tab. **Download CSV**
  gives a flat file for importing into accounting software. **Print** prints the report.
- **Open / merge file** loads a downloaded workbook back in and adds any sales not
  already present, so each department can send its file to one person who combines
  them. Edits made in Excel aren't read back; the hidden `SalesTaxData` tab is used.
- A **quick calculator** in the sidebar works out tax on an amount without saving.
- Math lives in `src/lib/salesTax.ts`; saved in `localStorage` under
  `ocmn-sales-tax-v1`. Nothing is sent anywhere.

## Explainer videos

Two spots play a Cloudflare Stream video via a modal (`src/components/VideoModal.tsx`,
`VideoButton.tsx`): a "Watch: Welcome to OCMN" button on the welcome screen, and a
"Watch the explainer" card that appears on the AG credentials step once someone answers
that they don't hold credentials yet, explaining what the pre-application involves.

Both video IDs are blank in `src/lib/videos.ts` — until they're filled in, the modal
shows a "video coming soon" placeholder instead of a broken embed. See that file's
comments for exactly what to paste in once the videos are uploaded to Cloudflare Stream.

## Known gaps (see `docs/design-handoff.md` for detail)

A production build still needs, at minimum:

- Server-side persistence keyed to an applicant (so someone can resume on another
  device), most simply via magic-link email accounts.
- A real submission endpoint and notification to the OCMN team.
- Role-gated (and ideally encrypted) access to the AG credentialing answers —
  the UI promises these are seen only by the credentialing team.
- Actually emailing the three references, or changing the copy that promises it.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run start` — run the production build
- `npm run lint` — ESLint
