import type { Metadata } from "next";
import { Archivo, Playfair_Display } from "next/font/google";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  style: ["italic", "normal"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "OCMN Planter Application",
  description: "Ohio Church Multiplication Network — Planter Application",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${archivo.variable} ${playfair.variable}`}>
      <body>{children}</body>
    </html>
  );
}
