import type { Metadata } from "next";
import { CliGuide } from "@/components/cli-guide";

export const metadata: Metadata = {
  title: "SDK & CLI Guide | Frontier Protocol",
  description:
    "Local CLI setup, public Practice, comparable results, and saved Disaster Response submissions.",
};

export default function CliGuidePage() {
  return <CliGuide />;
}
