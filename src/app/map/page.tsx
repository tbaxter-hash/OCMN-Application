import type { Metadata } from "next";
import ChurchMapApp from "@/components/church-map/ChurchMapApp";

export const metadata: Metadata = {
  title: "OMN Church Map",
  description: "Ohio Ministry Network churches by region and area, with presbyters and county insights",
};

export default function Page() {
  return <ChurchMapApp />;
}
