import { checkRescuePracticeOnboarding } from "./lib/rescue-practice-preflight";

// Explicit origin only. No env reads, auth, account mutation, files, inference or payment.
const args = process.argv.slice(2);
if (args.length !== 1) {
  process.stderr.write(
    "Usage: pnpm exec tsx scripts/verify-rescue-practice-onboarding.ts http://localhost:3000\n",
  );
  process.exitCode = 1;
} else {
  const report = await checkRescuePracticeOnboarding(args[0]!);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.verified) process.exitCode = 1;
}
