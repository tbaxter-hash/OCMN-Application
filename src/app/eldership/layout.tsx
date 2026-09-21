import type { Metadata } from "next";
import { Inter } from "next/font/google";
import scope from "@/components/eldership/tokens.module.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Eldership Dashboard — Peoples Church Network",
  description: "Network eldership overview — stats, fund, churches, updates, decisions.",
};

export default function EldershipLayout({ children }: LayoutProps<"/eldership">) {
  return <div className={`${inter.variable} ${scope.scope}`}>{children}</div>;
}
