import {
  createRescuePaymentPolicyState,
  reserveRescuePaymentIntent,
  rescuePaymentPolicySchema,
  type RescuePaymentIntent,
  type RescuePaymentPolicy,
  type RescuePaymentPurchase,
} from "@frontier/rescue-room";
import { canonicalProtocolJson } from "@frontier/shared";
import {
  keccak256,
  parseTransaction,
  recoverTransactionAddress,
  stringToHex,
  type Address,
  type Hex,
} from "viem";

export type RescuePaymentOperation =
  | { kind: "approve" | "fund" | "refundExpired" }
  | { kind: "recordDelivery"; deliverableHash: Hex; receiptHash: Hex }
  | { kind: "release"; deliverableHash: Hex; receiptHash: Hex; acceptanceHash: Hex };

export type RescuePaymentExecutorLimits = {
  maximumTotalFeeWei: string;
  maximumTransactionFeeWei: string;
  maximumGas: string;
  maximumFeePerGasWei: string;
  maximumPriorityFeePerGasWei: string;
  requiredConfirmations: number;
};

export type RescuePaymentReceipt = {
  transactionHash: Hex;
  blockHash: Hex;
  blockNumber: string;
  blockTimestampUnixSeconds: string;
  status: "confirmed" | "reverted";
  /** Transfer event AND matching Escrow event are checked for fund/release/refund. */
  verifiedEvent: boolean;
  recipientBalanceAfter?: string;
};

export type RescuePaymentCall = {
  from: Address;
  to: Address;
  data: Hex;
};

export type RescuePaymentRecord = {
  key: Hex;
  policy: RescuePaymentPolicy;
  purchase: RescuePaymentPurchase;
  reservedAtUnixSeconds: number;
  intent: RescuePaymentIntent;
  transactions: Partial<Record<RescuePaymentOperation["kind"], RescuePaymentTransaction>>;
};

export type RescuePaymentTransaction = {
  operation: RescuePaymentOperation;
  call: RescuePaymentCall;
  rawTransaction: Hex;
  transactionHash: Hex;
  nonce: number;
  maximumFeeWei: string;
  status: "prepared" | "broadcast" | "confirmed" | "reverted";
  receipt?: RescuePaymentReceipt;
};

export type RescuePaymentJournalState = {
  version: 1;
  limits: RescuePaymentExecutorLimits | null;
  records: Record<string, RescuePaymentRecord>;
};

/** The lock MUST cover all signers and scopes in this operator's journal, not just an order. */
export interface RescuePaymentDurableStore {
  exclusive<T>(
    run: (state: RescuePaymentJournalState, persist: () => Promise<void>) => Promise<T>,
  ): Promise<T>;
}

/** Trusted operator adapter. prepareSigned MUST sign offline and MUST NOT broadcast. */
export interface RescuePaymentChainPort {
  chainId(): Promise<number>;
  callFor(record: RescuePaymentRecord, operation: RescuePaymentOperation): RescuePaymentCall;
  preflight(record: RescuePaymentRecord, operation: RescuePaymentOperation): Promise<void>;
  pendingNonce(address: Address): Promise<number>;
  prepareSigned(
    call: RescuePaymentCall,
    nonce: number,
    limits: RescuePaymentExecutorLimits,
  ): Promise<Hex>;
  broadcast(rawTransaction: Hex): Promise<Hex>;
  /** Optional exact-hash lookup. Missing support fails closed for expired signed release. */
  knownTransaction?(transactionHash: Hex): Promise<boolean>;
  receipt(
    record: RescuePaymentRecord,
    transaction: RescuePaymentTransaction,
    confirmations: number,
  ): Promise<RescuePaymentReceipt | null>;
}

export function rescuePaymentExecutorHash(value: unknown): Hex {
  return keccak256(stringToHex(canonicalProtocolJson(value)));
}

function same(a: unknown, b: unknown): boolean {
  return canonicalProtocolJson(a) === canonicalProtocolJson(b);
}

function positiveInteger(value: string): bigint {
  if (!/^[1-9][0-9]{0,77}$/.test(value) || BigInt(value) >= 2n ** 256n)
    throw new Error("Invalid payment executor limit");
  return BigInt(value);
}

function validateOperation(operation: RescuePaymentOperation): RescuePaymentOperation {
  // Snapshot once: model objects/getters must never be used across an await boundary.
  const result = JSON.parse(JSON.stringify(operation)) as RescuePaymentOperation;
  const allowed = {
    approve: ["kind"],
    fund: ["kind"],
    refundExpired: ["kind"],
    recordDelivery: ["kind", "deliverableHash", "receiptHash"],
    release: ["kind", "deliverableHash", "receiptHash", "acceptanceHash"],
  }[result.kind];
  if (!allowed || Object.keys(result).length !== allowed.length)
    throw new Error("Invalid payment operation");
  for (const name of allowed) {
    const value = (result as unknown as Record<string, unknown>)[name];
    if (
      name !== "kind" &&
      (typeof value !== "string" || !/^0x[0-9a-f]{64}$/.test(value) || /^0x0+$/.test(value))
    )
      throw new Error("Invalid delivery evidence hash");
  }
  return result;
}

/**
 * Operator-only orchestration, NOT an HTTP authentication boundary. Purchases must come
 * from the trusted evaluator. Actual service acceptance hashes must come from a trusted
 * validator, not the model or simulator. This module does not judge clinical/protocol truth.
 *
 * All operator transactions for these signers must use the same journal. External wallet
 * activity, deleting/copying the journal, or using another host bypasses nonce/fee accounting.
 * Refunds intentionally do not replenish this local conservative cumulative budget.
 */
export function createRescuePaymentExecutor(options: {
  store: RescuePaymentDurableStore;
  chain: RescuePaymentChainPort;
  limits: RescuePaymentExecutorLimits;
}) {
  const limits = structuredClone(options.limits);
  for (const [key, value] of Object.entries(limits)) {
    if (key !== "requiredConfirmations") positiveInteger(value as string);
  }
  if (!Number.isSafeInteger(limits.requiredConfirmations) || limits.requiredConfirmations < 1)
    throw new Error("At least one receipt confirmation is required");
  if (positiveInteger(limits.maximumTransactionFeeWei) > positiveInteger(limits.maximumTotalFeeWei))
    throw new Error("Transaction fee exceeds total fee ceiling");

  function bindLimits(state: RescuePaymentJournalState) {
    if (
      state.version !== 1 ||
      !state.records ||
      Array.isArray(state.records) ||
      (!state.limits && Object.keys(state.records).length > 0)
    )
      throw new Error("Invalid payment journal state");
    if (state.limits && !same(state.limits, limits))
      throw new Error("Payment journal limits changed; operator reconciliation required");
    state.limits = limits;
  }

  async function validateSignedCall(raw: Hex, call: RescuePaymentCall, nonce: number) {
    if (!raw.startsWith("0x02")) throw new Error("Only EIP-1559 payment transactions are allowed");
    const parsed = parseTransaction(raw);
    const signer = await recoverTransactionAddress({
      serializedTransaction: raw as `0x02${string}`,
    });
    if (
      !Number.isSafeInteger(nonce) ||
      nonce < 0 ||
      parsed.type !== "eip1559" ||
      parsed.chainId !== 11155111 ||
      signer.toLowerCase() !== call.from.toLowerCase() ||
      parsed.to?.toLowerCase() !== call.to.toLowerCase() ||
      parsed.data !== call.data ||
      (parsed.value ?? 0n) !== 0n ||
      parsed.nonce !== nonce ||
      !parsed.gas ||
      !parsed.maxFeePerGas ||
      parsed.maxPriorityFeePerGas === undefined ||
      parsed.gas > BigInt(limits.maximumGas) ||
      parsed.maxFeePerGas > BigInt(limits.maximumFeePerGasWei) ||
      parsed.maxPriorityFeePerGas > BigInt(limits.maximumPriorityFeePerGasWei) ||
      parsed.maxPriorityFeePerGas > parsed.maxFeePerGas
    )
      throw new Error("Signed transaction violates the fixed payment call or fee policy");
    return parsed.gas * parsed.maxFeePerGas;
  }

  function validateReceipt(
    receipt: RescuePaymentReceipt,
    transaction: RescuePaymentTransaction,
    record: RescuePaymentRecord,
  ) {
    if (
      receipt.transactionHash !== transaction.transactionHash ||
      !/^0x[0-9a-f]{64}$/.test(receipt.blockHash) ||
      !/^(0|[1-9][0-9]*)$/.test(receipt.blockNumber) ||
      !/^(0|[1-9][0-9]*)$/.test(receipt.blockTimestampUnixSeconds) ||
      !["confirmed", "reverted"].includes(receipt.status) ||
      (receipt.status === "confirmed" && !receipt.verifiedEvent)
    )
      throw new Error("Payment receipt evidence mismatch");
    if (
      transaction.operation.kind === "release" &&
      receipt.status === "confirmed" &&
      BigInt(receipt.blockTimestampUnixSeconds) > BigInt(record.intent.args.deadline)
    )
      throw new Error("Release mined after deadline cannot be reported paid");
  }

  /** A JSON checksum detects torn/corrupt writes, not semantic substitution. Rebuild every
   * intent and recover every signature on resume; never trust serialized fee/nonce/call fields.
   * This still cannot authenticate omitted history or a wholly replaced operator policy.
   * Protect the journal and retain backups; the process-local API is not a policy authority.
   */
  async function validateRestoredState(state: RescuePaymentJournalState) {
    const groups = new Map<string, RescuePaymentRecord[]>();
    for (const [key, record] of Object.entries(state.records)) {
      const policy = rescuePaymentPolicySchema.parse(record.policy);
      if (!same(policy, record.policy)) throw new Error("Noncanonical stored payment policy");
      const expectedKey = rescuePaymentExecutorHash({
        chainId: 11155111,
        commander: policy.commanderWallet,
        context: record.purchase.order.episodeContextHash,
        orderId: record.purchase.order.orderId,
      });
      if (key !== expectedKey || record.key !== expectedKey)
        throw new Error("Payment journal reservation key mismatch");
      const scope = `${policy.commanderWallet}:${record.purchase.order.episodeContextHash}`;
      groups.set(scope, [...(groups.get(scope) ?? []), record]);
    }
    let totalFee = 0n;
    const signerNonces = new Set<string>();
    for (const records of groups.values()) {
      const policy = records[0]!.policy;
      let local = createRescuePaymentPolicyState(policy);
      for (const record of records.sort((a, b) =>
        Number(BigInt(a.purchase.policyNonce) - BigInt(b.purchase.policyNonce)),
      )) {
        if (!same(record.policy, policy))
          throw new Error("Wallet Episode has conflicting stored policies");
        const replay = reserveRescuePaymentIntent(
          policy,
          local,
          record.purchase,
          record.reservedAtUnixSeconds,
        );
        if (replay.reused || !same(replay.intent, record.intent))
          throw new Error("Payment journal intent mismatch");
        local = replay.state;
        for (const [kind, transaction] of Object.entries(record.transactions)) {
          const operation = validateOperation(transaction.operation);
          if (
            kind !== operation.kind ||
            !["prepared", "broadcast", "confirmed", "reverted"].includes(transaction.status)
          )
            throw new Error("Invalid stored payment transaction state");
          const expectedCall = options.chain.callFor(record, operation);
          if (!same(expectedCall, transaction.call))
            throw new Error("Stored payment call does not match reserved intent");
          const fee = await validateSignedCall(
            transaction.rawTransaction,
            expectedCall,
            transaction.nonce,
          );
          if (
            transaction.transactionHash !== keccak256(transaction.rawTransaction) ||
            transaction.maximumFeeWei !== String(fee) ||
            fee > BigInt(limits.maximumTransactionFeeWei)
          )
            throw new Error("Stored payment hash or fee metadata mismatch");
          const nonceKey = `${expectedCall.from.toLowerCase()}:${transaction.nonce}`;
          if (signerNonces.has(nonceKey))
            throw new Error("Duplicate signer nonce in payment journal");
          signerNonces.add(nonceKey);
          totalFee += fee;
          if (["confirmed", "reverted"].includes(transaction.status)) {
            if (!transaction.receipt || transaction.receipt.status !== transaction.status)
              throw new Error("Stored payment confirmation lacks corresponding receipt");
            validateReceipt(transaction.receipt, transaction, record);
          } else if (transaction.receipt)
            throw new Error("Unconfirmed stored payment has stale receipt");
        }
      }
    }
    if (totalFee > BigInt(limits.maximumTotalFeeWei))
      throw new Error("Stored payment gas budget exceeded");
  }

  async function requireSepolia() {
    if ((await options.chain.chainId()) !== 11155111)
      throw new Error("Payment executor requires Ethereum Sepolia");
  }

  return {
    async reserve(policyInput: unknown, purchaseInput: RescuePaymentPurchase, now: number) {
      const policy = rescuePaymentPolicySchema.parse(policyInput);
      const purchase = structuredClone(purchaseInput);
      return options.store.exclusive(async (state, persist) => {
        bindLimits(state);
        await validateRestoredState(state);
        const context = purchase.order.episodeContextHash;
        const scope = Object.values(state.records).filter(
          (r) =>
            r.policy.commanderWallet === policy.commanderWallet &&
            r.intent.args.episodeContextHash === context,
        );
        // Different policy/escrow/token does not open another budget for the same wallet+episode.
        if (scope.some((r) => !same(r.policy, policy)))
          throw new Error("Wallet Episode already has a different payment policy");
        let local = createRescuePaymentPolicyState(policy);
        for (const record of scope.sort((a, b) =>
          Number(BigInt(a.purchase.policyNonce) - BigInt(b.purchase.policyNonce)),
        )) {
          const replay = reserveRescuePaymentIntent(
            policy,
            local,
            record.purchase,
            record.reservedAtUnixSeconds,
          );
          if (!same(replay.intent, record.intent))
            throw new Error("Payment journal intent mismatch");
          local = replay.state;
        }
        const key = rescuePaymentExecutorHash({
          chainId: 11155111,
          commander: policy.commanderWallet,
          context,
          orderId: purchase.order.orderId,
        });
        const previous = state.records[key];
        if (previous) {
          if (!same(previous.purchase, purchase) || !same(previous.policy, policy))
            throw new Error("Conflicting Payment Order retry");
          // Identical status queries/retries remain valid after the policy expires.
          return structuredClone(previous);
        }
        const { intent } = reserveRescuePaymentIntent(policy, local, purchase, now);
        const record: RescuePaymentRecord = {
          key,
          policy,
          purchase,
          reservedAtUnixSeconds: now,
          intent,
          transactions: {},
        };
        state.records[key] = record;
        await persist();
        return structuredClone(record);
      });
    },

    async inspect(key: Hex) {
      return options.store.exclusive(async (state) => {
        bindLimits(state);
        await validateRestoredState(state);
        return structuredClone(state.records[key] ?? null);
      });
    },

    async execute(key: Hex, operationInput: RescuePaymentOperation, now: number) {
      const operation = validateOperation(operationInput);
      if (!Number.isSafeInteger(now) || now < 0) throw new Error("Invalid wall clock");
      return options.store.exclusive(async (state, persist) => {
        bindLimits(state);
        await validateRestoredState(state);
        const record = state.records[key];
        if (!record) throw new Error("Unknown payment reservation");
        await requireSepolia();
        let transaction = record.transactions[operation.kind];
        if (transaction && !same(transaction.operation, operation))
          throw new Error("Conflicting payment operation retry");
        if (!transaction) {
          const competingDisposition =
            operation.kind === "refundExpired"
              ? record.transactions.release
              : operation.kind === "release" || operation.kind === "recordDelivery"
                ? record.transactions.refundExpired
                : undefined;
          if (competingDisposition && competingDisposition.status !== "reverted")
            throw new Error(
              "Another payment disposition is signed; reconcile it before proceeding",
            );
          if (
            ["approve", "fund", "recordDelivery"].includes(operation.kind) &&
            (now >= record.policy.validUntilUnixSeconds ||
              now >= record.intent.args.deadline ||
              now < record.policy.validFromUnixSeconds)
          )
            throw new Error("Payment authorization expired or not active");
          if (operation.kind === "release" && now >= record.intent.args.deadline)
            throw new Error("Expired delivery must be refunded, not released");
          if (operation.kind === "refundExpired" && now <= record.intent.args.deadline)
            throw new Error("Payment refund deadline not reached");
          await options.chain.preflight(record, operation);
          const call = options.chain.callFor(record, operation);
          const pending = await options.chain.pendingNonce(call.from);
          const prior = Object.values(state.records)
            .flatMap((r) => Object.values(r.transactions))
            .filter((t) => t.call.from.toLowerCase() === call.from.toLowerCase());
          const nonce = Math.max(pending, ...prior.map((t) => t.nonce + 1));
          if (!Number.isSafeInteger(nonce) || nonce < 0) throw new Error("Invalid signer nonce");
          const raw = await options.chain.prepareSigned(call, nonce, limits);
          const fee = await validateSignedCall(raw, call, nonce);
          const reservedFees = Object.values(state.records)
            .flatMap((r) => Object.values(r.transactions))
            .reduce((sum, t) => sum + BigInt(t.maximumFeeWei), 0n);
          if (
            fee > BigInt(limits.maximumTransactionFeeWei) ||
            reservedFees + fee > BigInt(limits.maximumTotalFeeWei)
          )
            throw new Error("Payment gas budget exceeded");
          transaction = {
            operation,
            call,
            rawTransaction: raw,
            transactionHash: keccak256(raw),
            nonce,
            maximumFeeWei: String(fee),
            status: "prepared",
          };
          record.transactions[operation.kind] = transaction;
          // Critical crash boundary. No network broadcast is allowed before durable fsync.
          await persist();
        }
        // Always reconcile even an earlier confirmed receipt: a reorg must not remain paid.
        const receipt = await options.chain.receipt(
          record,
          transaction,
          limits.requiredConfirmations,
        );
        if (receipt) {
          validateReceipt(receipt, transaction, record);
          transaction.receipt = receipt;
          transaction.status = receipt.status;
          await persist();
          return structuredClone(transaction);
        }
        delete transaction.receipt;
        transaction.status = "prepared";
        await persist();
        if (
          operation.kind === "release" &&
          now > record.intent.args.deadline &&
          !(await options.chain.knownTransaction?.(transaction.transactionHash))
        )
          throw new Error(
            "Expired signed release is not known on chain; operator reconciliation required",
          );
        // Ambiguous RPC failure intentionally leaves prepared raw bytes for identical retry.
        const sentHash = await options.chain.broadcast(transaction.rawTransaction);
        if (sentHash !== transaction.transactionHash) throw new Error("Broadcast hash mismatch");
        transaction.status = "broadcast";
        await persist();
        return structuredClone(transaction);
      });
    },
  };
}
