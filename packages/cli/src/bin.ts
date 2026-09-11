#!/usr/bin/env node
import { runCli } from "./index.js";
let interrupted = false;
const interrupt = () => {
  interrupted = true;
  const envelope = {
    schemaVersion: "1",
    ok: false,
    error: {
      code: "INTERRUPTED",
      message: "Command interrupted; any server operation may still complete",
      details: { completion: "unknown" },
      retryable: false,
    },
  };
  process.stdout.write(`${JSON.stringify(envelope)}\n`, () => process.exit(7));
};
process.once("SIGINT", interrupt);
process.exitCode = await runCli(process.argv.slice(2), {
  stdout: (text) => {
    if (!interrupted) process.stdout.write(text);
  },
});
process.removeListener("SIGINT", interrupt);
