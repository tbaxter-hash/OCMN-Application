import type { Metadata } from "next";
import SalesTaxCalculator from "@/components/SalesTaxCalculator";

export const metadata: Metadata = {
  title: "OMN Sales Tax Calculator",
  description: "Ohio Ministry Network — figure sales tax by department and download a report for the bookkeeper",
};

export default function Page() {
  return <SalesTaxCalculator />;
}
