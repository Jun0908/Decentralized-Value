import type { Metadata } from "next";
import { RescueOperatorProof } from "@/components/rescue-operator-proof";
import { getRescueOperatorPublicEvidence } from "@/lib/rescue-operator-public";

export const metadata: Metadata = {
  title: "AIの雇用・納品・支払い | Rescue Room",
  description:
    "Commanderが別のAIへ依頼し、SepoliaのテストTokenで支払った検証記録。ゲームの成績や大会報酬とは別の証跡です。",
};

export default function RescueOperationsPage() {
  return <RescueOperatorProof evidence={getRescueOperatorPublicEvidence()} />;
}
