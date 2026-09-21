export type ChurchStatus = "current" | "due" | "overdue";

export interface Church {
  name: string;
  city: string;
  pastor: string;
  sal: number;
  bap: number;
  trend: number;
  report: string;
  status: ChurchStatus;
}

export interface FundDesignation {
  label: string;
  amount: number;
  color: string;
}

export interface LedgerEntry {
  date: string;
  memo: string;
  church: string;
  amount: number;
}

export interface Fund {
  balance: number;
  inflow: number;
  outflow: number;
  month: string;
  designations: FundDesignation[];
  ledger: LedgerEntry[];
}

export type TimelineKind = "announcement" | "report" | "decision";

export interface TimelineItem {
  kind: TimelineKind;
  who: string;
  title: string;
  body: string;
  when: string;
}

export interface UpcomingEvent {
  d: string;
  m: string;
  title: string;
  meta: string;
}

export type DecisionOutcome = "Approved" | "Held" | "Declined";

export interface Decision {
  title: string;
  date: string;
  outcome: DecisionOutcome;
  note: string;
}

export interface YearToDate {
  salvations: number;
  baptisms: number;
  churches: number;
  nations: number;
}

export interface ElderData {
  ytd: YearToDate;
  fund: Fund;
  churches: Church[];
  timeline: TimelineItem[];
  events: UpcomingEvent[];
  decisions: Decision[];
}
