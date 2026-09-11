import { z } from "zod";
import saved from "../../../../Docs/deployments/sepolia-rescue-service-demo.json";

const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const hash = z.string().regex(/^0x[0-9a-f]{64}$/);
const amount = z.string().regex(/^[0-9]+(\.[0-9]+)?$/);
const text = z.string().min(1).max(2000);
export const rescueOperatorPublicEvidenceSchema = z
  .object({
    verifiedAt: z.string().datetime().nullable(),
    deployment: z
      .object({ tokenAddress: address, escrowAddress: address, commanderAddress: address })
      .strict()
      .nullable(),
    purchase: z
      .object({
        serviceName: text,
        providerAddress: address,
        amount,
        commanderReason: text,
        observation: text,
        serviceSummary: text,
        recommendation: text,
        deliveryHash: hash,
        receiptHash: hash,
        acceptanceHash: hash,
        model: text,
        inputTokens: z.number().int().nonnegative(),
        outputTokens: z.number().int().nonnegative(),
        estimatedModelCostUsd: z.number().nonnegative(),
        fundingTx: hash,
        deliveryTx: hash,
        releaseTx: hash,
        providerBalanceAfter: amount,
      })
      .strict()
      .nullable(),
    refund: z
      .object({ amount, fundingTx: hash, refundTx: hash, commanderBalanceAfter: amount })
      .strict()
      .nullable(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if ((value.purchase || value.refund) && (!value.deployment || !value.verifiedAt))
      ctx.addIssue({
        code: "custom",
        message: "Payment records require verified deployment and verification time",
      });
  });

export function getRescueOperatorPublicEvidence() {
  const parsed = rescueOperatorPublicEvidenceSchema.safeParse(saved);
  return parsed.success
    ? parsed.data
    : { verifiedAt: null, deployment: null, purchase: null, refund: null };
}
