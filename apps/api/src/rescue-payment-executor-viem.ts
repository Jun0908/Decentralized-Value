import {
  encodeFunctionData,
  erc20Abi,
  keccak256,
  parseAbi,
  parseEventLogs,
  TransactionReceiptNotFoundError,
  TransactionNotFoundError,
  type Address,
  type Hex,
  type LocalAccount,
  type PublicClient,
} from "viem";
import type {
  RescuePaymentChainPort,
  RescuePaymentOperation,
  RescuePaymentRecord,
} from "./rescue-payment-executor";

export const rescuePaymentExecutorEscrowAbi = parseAbi([
  "function paymentToken() view returns (address)",
  "function maximumOrderAmount() view returns (uint256)",
  "function maximumEpisodeAmount() view returns (uint256)",
  "function policyExecutor() view returns (address)",
  "function deliveryAttestor() view returns (address)",
  "function allowedProviders(address) view returns (bool)",
  "function getOrder(address commander, bytes32 orderId) view returns ((address commander, address provider, bytes32 episodeContextHash, bytes32 commanderActionHash, bytes32 serviceManifestHash, uint256 amount, uint64 deadline, bytes32 deliverableHash, bytes32 receiptHash, bytes32 acceptanceHash, uint8 state))",
  "function fundOrder(bytes32 orderId, address provider, uint256 amount, uint64 deadline, bytes32 episodeContextHash, bytes32 commanderActionHash, bytes32 serviceManifestHash)",
  "function recordDelivery(bytes32 orderId, address commander, address provider, bytes32 episodeContextHash, bytes32 commanderActionHash, bytes32 serviceManifestHash, bytes32 deliverableHash, bytes32 receiptHash)",
  "function release(bytes32 orderId, address commander, bytes32 acceptanceHash)",
  "function refundExpired(bytes32 orderId, address commander)",
  "event ServiceOrderFunded(bytes32 indexed orderId, bytes32 indexed episodeContextHash, address indexed commander, address provider, address token, uint256 amount, uint64 deadline, bytes32 commanderActionHash, bytes32 serviceManifestHash)",
  "event ServiceDeliverableRecorded(bytes32 indexed orderId, address indexed commander, address indexed provider, bytes32 deliverableHash, bytes32 receiptHash, bytes32 serviceManifestHash)",
  "event ServicePaymentReleased(bytes32 indexed orderId, address indexed commander, address indexed provider, uint256 amount, bytes32 acceptanceHash)",
  "event ServicePaymentRefunded(bytes32 indexed orderId, address indexed commander, uint256 amount)",
]);

const sameAddress = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/**
 * Real RPC adapter, no automatic wallet/key/env discovery. Runtime code hashes are trusted
 * deployment inputs (including immutables), NOT read-and-trusted from an arbitrary RPC.
 * LocalAccount.signTransaction signs offline; all sending is exclusively broadcast().
 */
export function createRescuePaymentViemChain(options: {
  publicClient: PublicClient;
  accounts: {
    commander: LocalAccount;
    policyExecutor: LocalAccount;
    deliveryAttestor: LocalAccount;
  };
  expectedTokenCodeHash: Hex;
  expectedEscrowCodeHash: Hex;
}): RescuePaymentChainPort {
  const client = options.publicClient;
  const accounts = options.accounts;
  if (new Set(Object.values(accounts).map((a) => a.address.toLowerCase())).size !== 3)
    throw new Error("Commander, Executor and Attestor must be distinct wallets");
  for (const hash of [options.expectedTokenCodeHash, options.expectedEscrowCodeHash]) {
    if (!/^0x[0-9a-f]{64}$/.test(hash) || /^0x0+$/.test(hash))
      throw new Error("Expected deployment code hash required");
  }

  function callFor(record: RescuePaymentRecord, operation: RescuePaymentOperation) {
    const intent = record.intent;
    const a = intent.args;
    const commander = intent.commanderWallet as Address;
    const escrow = intent.escrowAddress as Address;
    if (!sameAddress(commander, accounts.commander.address))
      throw new Error("Commander signer does not match policy");
    if (operation.kind === "approve")
      return {
        from: commander,
        to: intent.tokenAddress as Address,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: "approve",
          args: [escrow, BigInt(record.policy.maximumEpisodeAmount)],
        }),
      };
    if (operation.kind === "fund")
      return {
        from: commander,
        to: escrow,
        data: encodeFunctionData({
          abi: rescuePaymentExecutorEscrowAbi,
          functionName: "fundOrder",
          args: [
            a.orderId,
            a.provider as Address,
            BigInt(a.amount),
            BigInt(a.deadline),
            a.episodeContextHash,
            a.commanderActionHash,
            a.serviceManifestHash,
          ],
        }),
      };
    if (operation.kind === "recordDelivery")
      return {
        from: accounts.deliveryAttestor.address,
        to: escrow,
        data: encodeFunctionData({
          abi: rescuePaymentExecutorEscrowAbi,
          functionName: "recordDelivery",
          args: [
            a.orderId,
            commander,
            a.provider as Address,
            a.episodeContextHash,
            a.commanderActionHash,
            a.serviceManifestHash,
            operation.deliverableHash,
            operation.receiptHash,
          ],
        }),
      };
    if (operation.kind === "release")
      return {
        from: accounts.policyExecutor.address,
        to: escrow,
        data: encodeFunctionData({
          abi: rescuePaymentExecutorEscrowAbi,
          functionName: "release",
          args: [a.orderId, commander, operation.acceptanceHash],
        }),
      };
    return {
      from: commander,
      to: escrow,
      data: encodeFunctionData({
        abi: rescuePaymentExecutorEscrowAbi,
        functionName: "refundExpired",
        args: [a.orderId, commander],
      }),
    };
  }

  return {
    chainId: () => client.getChainId(),
    callFor,
    pendingNonce: (address) => client.getTransactionCount({ address, blockTag: "pending" }),
    async preflight(record, operation) {
      const intent = record.intent;
      const a = intent.args;
      const escrow = intent.escrowAddress as Address;
      const token = intent.tokenAddress as Address;
      const commander = intent.commanderWallet as Address;
      callFor(record, operation);
      if (
        record.policy.services.some((s) =>
          Object.values(accounts).some((account) =>
            sameAddress(s.providerAddress, account.address),
          ),
        )
      )
        throw new Error("Service providers must be distinct from operator roles");
      const [tokenCode, escrowCode, block] = await Promise.all([
        client.getCode({ address: token }),
        client.getCode({ address: escrow }),
        client.getBlock(),
      ]);
      if (
        !tokenCode ||
        !escrowCode ||
        keccak256(tokenCode) !== options.expectedTokenCodeHash ||
        keccak256(escrowCode) !== options.expectedEscrowCodeHash
      )
        throw new Error("Deployed payment runtime code hash mismatch");
      const read = <
        N extends
          | "paymentToken"
          | "policyExecutor"
          | "deliveryAttestor"
          | "maximumOrderAmount"
          | "maximumEpisodeAmount",
      >(
        functionName: N,
      ) =>
        client.readContract({ address: escrow, abi: rescuePaymentExecutorEscrowAbi, functionName });
      const [paymentToken, executor, attestor, orderLimit, episodeLimit, allowed, decimals, order] =
        await Promise.all([
          read("paymentToken"),
          read("policyExecutor"),
          read("deliveryAttestor"),
          read("maximumOrderAmount"),
          read("maximumEpisodeAmount"),
          client.readContract({
            address: escrow,
            abi: rescuePaymentExecutorEscrowAbi,
            functionName: "allowedProviders",
            args: [a.provider as Address],
          }),
          client.readContract({ address: token, abi: erc20Abi, functionName: "decimals" }),
          client.readContract({
            address: escrow,
            abi: rescuePaymentExecutorEscrowAbi,
            functionName: "getOrder",
            args: [commander, a.orderId],
          }),
        ]);
      if (
        !sameAddress(paymentToken, token) ||
        !sameAddress(executor, accounts.policyExecutor.address) ||
        !sameAddress(attestor, accounts.deliveryAttestor.address) ||
        !allowed ||
        decimals !== 6 ||
        orderLimit < BigInt(record.policy.maximumOrderAmount) ||
        episodeLimit < BigInt(record.policy.maximumEpisodeAmount)
      )
        throw new Error("Deployed payment role, token, provider or limits mismatch");
      if (
        ["approve", "fund", "recordDelivery"].includes(operation.kind) &&
        (block.timestamp < BigInt(record.policy.validFromUnixSeconds) ||
          block.timestamp >= BigInt(record.policy.validUntilUnixSeconds) ||
          block.timestamp >= BigInt(a.deadline))
      )
        throw new Error("Payment authorization expired at chain time");
      if (operation.kind === "approve" || operation.kind === "fund") {
        if (order.state !== 0)
          throw new Error(
            "Order already exists on chain; reconcile instead of preparing another transaction",
          );
        if (operation.kind === "fund") {
          const [balance, allowance] = await Promise.all([
            client.readContract({
              address: token,
              abi: erc20Abi,
              functionName: "balanceOf",
              args: [commander],
            }),
            client.readContract({
              address: token,
              abi: erc20Abi,
              functionName: "allowance",
              args: [commander, escrow],
            }),
          ]);
          if (balance < BigInt(a.amount) || allowance < BigInt(a.amount))
            throw new Error("Insufficient confirmed token balance or allowance");
        }
        return;
      }
      if (
        !sameAddress(order.commander, commander) ||
        !sameAddress(order.provider, a.provider) ||
        order.amount !== BigInt(a.amount) ||
        order.deadline !== BigInt(a.deadline) ||
        order.episodeContextHash !== a.episodeContextHash ||
        order.commanderActionHash !== a.commanderActionHash ||
        order.serviceManifestHash !== a.serviceManifestHash
      )
        throw new Error("Onchain Order does not match the reserved Game Order");
      if (operation.kind === "recordDelivery" && order.state !== 1)
        throw new Error("Delivery requires a funded Order");
      if (
        operation.kind === "release" &&
        (order.state !== 2 ||
          order.deliverableHash !== operation.deliverableHash ||
          order.receiptHash !== operation.receiptHash ||
          block.timestamp >= BigInt(a.deadline))
      )
        throw new Error("Release requires matching timely accepted delivery evidence");
      if (
        operation.kind === "refundExpired" &&
        (![1, 2].includes(order.state) || block.timestamp <= BigInt(a.deadline))
      )
        throw new Error("Refund requires an expired funded or delivered Order");
    },
    async prepareSigned(call, nonce, limits) {
      const account = Object.values(accounts).find((a) => sameAddress(a.address, call.from));
      if (!account) throw new Error("Unknown payment signer");
      const [estimatedGas, fees] = await Promise.all([
        client.estimateGas({ account, to: call.to, data: call.data, value: 0n }),
        client.estimateFeesPerGas({ type: "eip1559", chain: null }),
      ]);
      const gas = (estimatedGas * 120n + 99n) / 100n;
      if (
        gas > BigInt(limits.maximumGas) ||
        fees.maxFeePerGas > BigInt(limits.maximumFeePerGasWei) ||
        fees.maxPriorityFeePerGas > BigInt(limits.maximumPriorityFeePerGasWei)
      )
        throw new Error("Network fee estimate exceeds payment policy; no transaction signed");
      return account.signTransaction({
        type: "eip1559",
        chainId: 11155111,
        to: call.to,
        data: call.data,
        value: 0n,
        nonce,
        gas,
        maxFeePerGas: fees.maxFeePerGas,
        maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
      });
    },
    async broadcast(serializedTransaction) {
      try {
        return await client.sendRawTransaction({ serializedTransaction });
      } catch (error) {
        // "Already known", lost response, or mined-but-underconfirmed retries. Never infer
        // acceptance from an error string; resolve this exact signed transaction's hash.
        const hash = keccak256(serializedTransaction);
        try {
          const known = await client.getTransaction({ hash });
          if (known.hash === hash) return hash;
        } catch {
          /* Unknown transaction: retain durable bytes and the original failure. */
        }
        throw error;
      }
    },
    async knownTransaction(hash) {
      try {
        return (await client.getTransaction({ hash })).hash === hash;
      } catch (error) {
        if (error instanceof TransactionNotFoundError) return false;
        throw error;
      }
    },
    async receipt(record, transaction, confirmations) {
      let receipt;
      try {
        receipt = await client.getTransactionReceipt({ hash: transaction.transactionHash });
      } catch (error) {
        if (error instanceof TransactionReceiptNotFoundError) return null;
        throw error;
      }
      const [head, block] = await Promise.all([
        client.getBlockNumber({ cacheTime: 0 }),
        client.getBlock({ blockNumber: receipt.blockNumber }),
      ]);
      if (
        block.hash !== receipt.blockHash ||
        head - receipt.blockNumber + 1n < BigInt(confirmations)
      )
        return null;
      const base = {
        transactionHash: receipt.transactionHash,
        blockHash: receipt.blockHash,
        blockNumber: String(receipt.blockNumber),
        blockTimestampUnixSeconds: String(block.timestamp),
      };
      if (receipt.status === "reverted")
        return { ...base, status: "reverted", verifiedEvent: false };
      const { intent } = record;
      const a = intent.args;
      const operation = transaction.operation;
      const escrowLogs = receipt.logs.filter((log) =>
        sameAddress(log.address, intent.escrowAddress),
      );
      const tokenLogs = receipt.logs.filter((log) => sameAddress(log.address, intent.tokenAddress));
      const events = parseEventLogs({
        abi: rescuePaymentExecutorEscrowAbi,
        logs: escrowLogs,
        strict: true,
      });
      let verified = false;
      if (operation.kind === "approve") {
        verified = parseEventLogs({
          abi: erc20Abi,
          eventName: "Approval",
          logs: tokenLogs,
          strict: true,
        }).some(
          ({ args }) =>
            sameAddress(args.owner, intent.commanderWallet) &&
            sameAddress(args.spender, intent.escrowAddress) &&
            args.value === BigInt(record.policy.maximumEpisodeAmount),
        );
      } else if (operation.kind === "fund") {
        verified = events.some(
          (e) =>
            e.eventName === "ServiceOrderFunded" &&
            e.args.orderId === a.orderId &&
            e.args.episodeContextHash === a.episodeContextHash &&
            sameAddress(e.args.commander, intent.commanderWallet) &&
            sameAddress(e.args.provider, a.provider) &&
            sameAddress(e.args.token, intent.tokenAddress) &&
            e.args.amount === BigInt(a.amount) &&
            e.args.deadline === BigInt(a.deadline) &&
            e.args.commanderActionHash === a.commanderActionHash &&
            e.args.serviceManifestHash === a.serviceManifestHash,
        );
      } else if (operation.kind === "recordDelivery") {
        verified = events.some(
          (e) =>
            e.eventName === "ServiceDeliverableRecorded" &&
            e.args.orderId === a.orderId &&
            sameAddress(e.args.commander, intent.commanderWallet) &&
            sameAddress(e.args.provider, a.provider) &&
            e.args.deliverableHash === operation.deliverableHash &&
            e.args.receiptHash === operation.receiptHash &&
            e.args.serviceManifestHash === a.serviceManifestHash,
        );
      } else if (operation.kind === "release") {
        verified = events.some(
          (e) =>
            e.eventName === "ServicePaymentReleased" &&
            e.args.orderId === a.orderId &&
            sameAddress(e.args.commander, intent.commanderWallet) &&
            sameAddress(e.args.provider, a.provider) &&
            e.args.amount === BigInt(a.amount) &&
            e.args.acceptanceHash === operation.acceptanceHash,
        );
      } else {
        verified = events.some(
          (e) =>
            e.eventName === "ServicePaymentRefunded" &&
            e.args.orderId === a.orderId &&
            sameAddress(e.args.commander, intent.commanderWallet) &&
            e.args.amount === BigInt(a.amount),
        );
      }
      if (["fund", "release", "refundExpired"].includes(operation.kind)) {
        const from = operation.kind === "fund" ? intent.commanderWallet : intent.escrowAddress;
        const to =
          operation.kind === "fund"
            ? intent.escrowAddress
            : operation.kind === "release"
              ? a.provider
              : intent.commanderWallet;
        const transfer = parseEventLogs({
          abi: erc20Abi,
          eventName: "Transfer",
          logs: tokenLogs,
          strict: true,
        }).some(
          ({ args }) =>
            sameAddress(args.from, from) &&
            sameAddress(args.to, to) &&
            args.value === BigInt(a.amount),
        );
        if (!verified || !transfer)
          throw new Error("Missing matching Escrow and token Transfer receipt evidence");
        const balance = await client.readContract({
          address: intent.tokenAddress as Address,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [to as Address],
          blockNumber: receipt.blockNumber,
        });
        return {
          ...base,
          status: "confirmed",
          verifiedEvent: true,
          recipientBalanceAfter: String(balance),
        };
      }
      if (!verified) throw new Error("Missing matching payment receipt event");
      return { ...base, status: "confirmed", verifiedEvent: true };
    },
  };
}
