import type { Metadata } from "next";
import PopOutStudio from "@/components/PopOutStudio";

export const metadata: Metadata = {
  title: "OCMN Pop-out Photo Studio",
  description: "Turn photos into 3D pop-out images that step out of a fixed rounded frame",
};

export default function Page() {
  return <PopOutStudio />;
}
