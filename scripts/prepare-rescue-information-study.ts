import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { prepareRescueInformationStudy } from "./lib/rescue-information-study";

// Preparation only. There is deliberately no execution flag, model or wallet import.
if (process.argv.length !== 2) throw new Error("PREPARATION_ONLY_NO_FLAGS");
const plan = prepareRescueInformationStudy();
const directory = resolve(".frontier/studies/rescue-information");
mkdirSync(directory, { recursive: true });
const path = resolve(directory, `${plan.planHash}.json`);
const content = `${JSON.stringify(plan, null, 2)}\n`;
if (existsSync(path)) {
  if (readFileSync(path, "utf8") !== content) throw new Error("EXISTING_PLAN_MISMATCH");
} else writeFileSync(path, content, { flag: "wx" });
console.log(
  JSON.stringify(
    {
      status: plan.status,
      planHash: plan.planHash,
      episodes: plan.cases.length,
      resourceCeiling: plan.resourceCeiling,
      output: path,
      boundary: plan.boundary,
    },
    null,
    2,
  ),
);
