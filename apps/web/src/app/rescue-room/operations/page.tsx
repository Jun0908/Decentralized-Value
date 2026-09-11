import type { Metadata } from "next";
import { RescueOperatorProof } from "@/components/rescue-operator-proof";
import { getRescueOperatorPublicEvidence } from "@/lib/rescue-operator-public";
import Link from "next/link";

export const metadata: Metadata = {
  title: "AIの雇用・納品・支払い | Rescue Room",
  description:
    "Commanderが別のAIへ依頼し、SepoliaのテストTokenで支払った検証記録。ゲームの成績や大会報酬とは別の証跡です。",
};

export default function RescueOperationsPage() {
  return (
    <>
      <p style={{ padding: "16px 24px" }}>
        <Link href="/rescue-room/submission">提出デモ：納品後の判断とValue Poolまで見る →</Link>
      </p>
      <RescueOperatorProof evidence={getRescueOperatorPublicEvidence()} />
    </>
  );
}
