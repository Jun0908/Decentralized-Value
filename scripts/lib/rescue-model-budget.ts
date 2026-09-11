import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { persistNewJson } from "./rescue-operator-chain";

/** Operator holds the outer exclusive workflow lock. No refunds for uncertain model calls. */
export async function withRescueModelBudget<T>(
  directory: string,
  label: string,
  requestHash: string,
  execute: () => Promise<T>,
): Promise<T> {
  if (!/^[a-z0-9-]{1,100}$/.test(label)) throw new Error("INVALID_MODEL_LABEL");
  if (!/^0x[0-9a-f]{64}$/.test(requestHash)) throw new Error("INVALID_MODEL_REQUEST_HASH");
  const reservationPath = resolve(directory, `${label}.reservation.json`);
  const resultPath = resolve(directory, `${label}.result.json`);
  const reservations = existsSync(directory)
    ? readdirSync(directory).filter((f) => f.endsWith(".reservation.json"))
    : [];
  // Ten single-turn calls at most. 0.50 USD per attempt is deliberately conservative for
  // fixed gpt-5.6-luna, <=32k input characters, <=700 output tokens, zero retries/tools.
  if (reservations.length > 10) throw new Error("MODEL_BUDGET_EXHAUSTED");
  for (const file of reservations) {
    const record = JSON.parse(readFileSync(resolve(directory, file), "utf8"));
    if (
      record.schemaVersion !== "rescue-model-budget-v1" ||
      record.reservedUsdCents !== 50 ||
      record.totalLimitUsdCents !== 500 ||
      record.model !== "gpt-5.6-luna" ||
      record.maximumInputCharacters !== 32_000 ||
      record.maximumOutputTokens !== 700 ||
      record.maximumRetries !== 0 ||
      !/^0x[0-9a-f]{64}$/.test(record.requestHash)
    )
      throw new Error("MODEL_BUDGET_CORRUPT");
  }
  if (existsSync(reservationPath)) {
    const reservation = JSON.parse(readFileSync(reservationPath, "utf8"));
    if (reservation.label !== label || reservation.requestHash !== requestHash)
      throw new Error("MODEL_REQUEST_CONFLICT");
    if (existsSync(resultPath)) return JSON.parse(readFileSync(resultPath, "utf8")) as T;
    throw new Error("MODEL_OUTCOME_UNCERTAIN_NO_AUTOMATIC_RETRY");
  }
  if (reservations.length >= 10) throw new Error("MODEL_BUDGET_EXHAUSTED");
  persistNewJson(reservationPath, {
    schemaVersion: "rescue-model-budget-v1",
    label,
    requestHash,
    reservedUsdCents: 50,
    totalLimitUsdCents: 500,
    model: "gpt-5.6-luna",
    maximumInputCharacters: 32_000,
    maximumOutputTokens: 700,
    maximumRetries: 0,
    pricingReference: "https://developers.openai.com/api/docs/models/gpt-5.6-luna",
    pricingVerifiedDate: "2026-09-12",
    inputUsdPerMillion: 0.2,
    outputUsdPerMillion: 1.2,
    reservationIsNotInvoice: true,
  });
  const result = await execute();
  persistNewJson(resultPath, result);
  return result;
}
