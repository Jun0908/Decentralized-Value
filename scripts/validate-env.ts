import { existsSync } from "node:fs";

import { config } from "dotenv";

import { parseEnvironment } from "../packages/shared/src/index";

const source = existsSync(".env.local") ? ".env.local" : ".env.example";

config({ path: source, quiet: true });
parseEnvironment(process.env);

console.log(`Environment key names and formats validated from ${source}.`);
