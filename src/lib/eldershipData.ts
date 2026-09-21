import type { ElderData } from "./eldershipTypes";

// Sample data for the eldership dashboard. Structurally realistic, not live —
// this is the single seam to replace with a real endpoint; no component
// changes should be needed once that lands.
export const ELDER_DATA: ElderData = {
  ytd: { salvations: 1284, baptisms: 417, churches: 11, nations: 6 },
  fund: {
    balance: 486320,
    inflow: 74150,
    outflow: 52880,
    month: "August 2026",
    designations: [
      { label: "Church planting", amount: 210000, color: "var(--indigo-700)" },
      { label: "Global missions", amount: 118500, color: "var(--ember-500)" },
      { label: "Pastor care & sabbatical", amount: 84300, color: "var(--gold-500)" },
      { label: "Leadership training", amount: 46200, color: "var(--plum-600)" },
      { label: "Undesignated reserve", amount: 27320, color: "var(--indigo-400)" },
    ],
    ledger: [
      { date: "Sep 18", memo: "Split (Croatia) — building grant, tranche 2", church: "Split", amount: -18000 },
      { date: "Sep 15", memo: "Network giving — Cincinnati tithe", church: "Cincinnati", amount: 22400 },
      { date: "Sep 12", memo: "Honduras team travel reimbursement", church: "Honduras", amount: -6450 },
      { date: "Sep 09", memo: "Network giving — St. Louis tithe", church: "St. Louis", amount: 9800 },
      { date: "Sep 05", memo: "Cape Town pastor sabbatical stipend", church: "Cape Town", amount: -4200 },
      { date: "Sep 02", memo: "Network giving — Los Angeles tithe", church: "Los Angeles", amount: 11300 },
    ],
  },
  churches: [
    { name: "Peoples Church", city: "Cincinnati, OH", pastor: "Chris Beard", sal: 312, bap: 104, trend: 12, report: "Sep 14", status: "current" },
    { name: "Peoples Church City West", city: "Cincinnati, OH", pastor: "Marcus Hall", sal: 96, bap: 31, trend: 8, report: "Sep 11", status: "current" },
    { name: "Cross & Crown", city: "Cincinnati, OH", pastor: "Dana Whitfield", sal: 74, bap: 22, trend: -3, report: "Aug 29", status: "current" },
    { name: "Peoples Church STL", city: "St. Louis, MO", pastor: "Terrance Boyd", sal: 148, bap: 55, trend: 19, report: "Sep 12", status: "current" },
    { name: "Peoples Church LA", city: "Los Angeles, CA", pastor: "Rosa Iglesias", sal: 131, bap: 47, trend: 6, report: "Sep 08", status: "current" },
    { name: "Peoples Church Columbus", city: "Columbus, OH", pastor: "Andre Coles", sal: 88, bap: 27, trend: 4, report: "Aug 21", status: "due" },
    { name: "Heart to Heart", city: "Columbus, OH", pastor: "Nia Robertson", sal: 63, bap: 18, trend: 2, report: "Sep 02", status: "current" },
    { name: "Peoples Church Cape Town", city: "Cape Town, ZA", pastor: "Sipho Ndlovu", sal: 142, bap: 51, trend: 23, report: "Sep 10", status: "current" },
    { name: "EPC Riviera", city: "Split, HR", pastor: "Ivan Marić", sal: 41, bap: 12, trend: 9, report: "Jul 30", status: "overdue" },
    { name: "Dubai Christian Church", city: "Dubai, AE", pastor: "Joy Mathew", sal: 79, bap: 24, trend: 5, report: "Sep 06", status: "current" },
    { name: "Gateway Honduras", city: "Tegucigalpa, HN", pastor: "Luis Ramírez", sal: 110, bap: 26, trend: 15, report: "Sep 13", status: "current" },
  ],
  timeline: [
    { kind: "announcement", who: "Network office", title: "Q4 eldership gathering moves to Cincinnati", body: "Hosting shifts from St. Louis. Travel stipends open Oct 1 for international elders.", when: "2 hours ago" },
    { kind: "report", who: "Peoples Church Cape Town", title: "August report filed — 23 salvations, 9 baptisms", body: "Second service at 9:30 is at capacity. Requesting counsel on adding a third.", when: "Yesterday" },
    { kind: "decision", who: "Eldership", title: "Split building grant approved — tranche 2 released", body: "Second $18,000 of the $54,000 grant released against the completed roof inspection.", when: "3 days ago" },
    { kind: "report", who: "Peoples Church STL", title: "August report filed — 19 salvations, 7 baptisms", body: "Twelve new serve teams launched out of the summer belonging class.", when: "5 days ago" },
    { kind: "announcement", who: "Network office", title: "Two churches have outstanding August reports", body: "Columbus and EPC Riviera. Reminders sent; Riviera is now 52 days out.", when: "1 week ago" },
    { kind: "decision", who: "Eldership", title: "Dubai Christian Church received into the network", body: "Unanimous. Pastor Joy Mathew joins the elder table effective immediately.", when: "2 weeks ago" },
  ],
  events: [
    { d: "02", m: "Oct", title: "Monthly eldership call", meta: "8:00pm ET · Video · All 11 churches" },
    { d: "11", m: "Oct", title: "Split (Croatia) building dedication", meta: "Split, HR · Travel booked for 4 elders" },
    { d: "24", m: "Oct", title: "Church planting cohort — intake interviews", meta: "Cincinnati · 6 candidate couples" },
    { d: "07", m: "Nov", title: "Q4 eldership gathering", meta: "Cincinnati, OH · Two days · Agenda open" },
    { d: "19", m: "Nov", title: "Honduras missions team sending", meta: "Tegucigalpa · 14 going from 3 churches" },
  ],
  decisions: [
    { title: "Split building grant — tranche 2", date: "Sep 18, 2026", outcome: "Approved", note: "9 for · 0 against · 2 absent" },
    { title: "Dubai Christian Church membership", date: "Sep 04, 2026", outcome: "Approved", note: "Unanimous · 11 present" },
    { title: "Raise planting fund floor to $250k", date: "Aug 21, 2026", outcome: "Held", note: "Revisit at Q4 gathering" },
    { title: "Cape Town third service", date: "Aug 07, 2026", outcome: "Approved", note: "10 for · 1 against" },
    { title: "Shared payroll service for plants", date: "Jul 17, 2026", outcome: "Declined", note: "3 for · 8 against" },
  ],
};

export function formatMoney(n: number): string {
  return (n < 0 ? "−" : "") + "$" + Math.abs(n).toLocaleString("en-US");
}
