import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);
const patterns = [
  /(?:DEPLOYER_PRIVATE_KEY|ETHERSCAN_API_KEY|WALLET_PASS)\s*=\s*[^\s#][^\r\n]*/i,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /(?:ghp|github_pat)_[A-Za-z0-9_]{20,}/,
  /(?:sk_live|sk_test)_[A-Za-z0-9]{16,}/,
];
const findings: string[] = [];
for (const file of tracked) {
  if (file === "pnpm-lock.yaml" || file.endsWith(".test.ts") || file === ".env.example") continue;
  let content: string;
  try {
    content = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  content.split(/\r?\n/).forEach((line, index) => {
    if (patterns.some((pattern) => pattern.test(line))) findings.push(`${file}:${index + 1}`);
  });
}
if (findings.length) {
  process.stderr.write(`Potential secrets found:\n${findings.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(
    `Secret scan passed (${tracked.length} tracked files; fixtures and .env.example excluded).\n`,
  );
}
