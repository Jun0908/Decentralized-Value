import { parseEnvironment } from "@frontier/shared";

export const apiService = {
  name: "frontier-api",
  readEnvironment: () => parseEnvironment(process.env),
} as const;
