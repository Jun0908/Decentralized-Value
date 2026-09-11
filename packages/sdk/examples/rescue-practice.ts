/** Existing non-billable public Practice API. No API key, wallet or AI model call.
 * Run from this repository: pnpm exec tsx packages/sdk/examples/rescue-practice.ts http://localhost:3000
 */
import { FrontierClient, compareRuns, verifyRescueDoctrinePracticeIntegrity } from "../src/index";

const baseUrl = process.argv[2];
if (!baseUrl || process.argv.length !== 3)
  throw new Error("Specify the exact API origin explicitly.");
const client = new FrontierClient({ baseUrl });
const manifest = await client.arenas.get("rescue-room");
const episodeId = manifest.episodes[0]?.id;
if (!episodeId) throw new Error("No public Practice Episode is available.");
const input = {
  arenaId: "rescue-room" as const,
  context: manifest.context,
  episodeId,
  artifact: manifest.artifact.sample,
};
const first = await client.evaluations.practice(input);
const repeat = await client.evaluations.practice(input);
const integrity = verifyRescueDoctrinePracticeIntegrity({ request: input, run: first });
verifyRescueDoctrinePracticeIntegrity({ request: input, run: repeat });
console.log(
  JSON.stringify(
    {
      episodeId,
      correctness: first.correctness,
      values: first.values,
      metrics: first.context.metrics,
      artifactHash: first.artifactHash,
      resultHash: first.resultHash,
      repeatedHashMatches: first.resultHash === repeat.resultHash,
      integrity,
      comparison: compareRuns(first, repeat),
      evidence: first.raw,
      boundary: "Deterministic simulated Practice; game credits only; no Final Entry or reward.",
    },
    null,
    2,
  ),
);
