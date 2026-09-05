import { parseEnvironment } from "@frontier/shared";

export const runnerService = {
  name: "frontier-runner",
  readEnvironment: () => parseEnvironment(process.env),
} as const;
