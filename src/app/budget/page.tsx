import type { Metadata } from "next";
import BudgetPlanner from "@/components/BudgetPlanner";

export const metadata: Metadata = {
  title: "OCMN Budget Planner",
  description: "Ohio Church Multiplication Network — a simple financial plan for church planters",
};

export default function Page() {
  return <BudgetPlanner />;
}
