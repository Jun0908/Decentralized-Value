# Bazantic × Rescue Room: verified connection and AI execution

Updated 2026-09-13. The existing gateway was repaired on September 12, followed by one successful external-AI MCP demonstration. The hosted Recipe remains a saved, **unexecuted and unpublished draft**. This separates the connection check from the later model run.

## Working entry points

- Gateway: <https://kjrjolrzlra2zd7f7uycwazhya.bazgateway.com>
- MCP: <https://kjrjolrzlra2zd7f7uycwazhya.bazgateway.com/mcp>
- Existing gateway ID: `5262972e-395c-41ac-8fe5-fd302b0327c0`.
- Service slug: `kjrjolrzlra2zd7f7uycwazhya`. The existing URL, name and ID were preserved.

## Why the gateway returned 404

MCP tools were generated from the current specification, but the gateway retained its old 15-route table. The read-only inspection corresponding to CLI 0.10.0's `gateway resync --json` found 48 specification routes missing from that table. This was a specification/routing mismatch, not an invented endpoint. [CLI reference](https://bazantic.com/docs/cli).

The old 15 routes and prices were preserved. Only these three routes were added with `priceMillicents: 0`; the management PATCH returned 200 and readback matched all 18 routes:

| Added free route                            | MCP tool                       | Purpose                                               |
| ------------------------------------------- | ------------------------------ | ----------------------------------------------------- |
| `GET /v1/cli/arenas/{id}`                   | `getCliArena`                  | Public Rescue context, schema, sample and Episode IDs |
| `GET /v1/rescue-room/starter-kit`           | `downloadRescueRoomStarterKit` | Starter download; binary verification used HTTP       |
| `POST /v1/rescue-room/doctrine-evaluations` | `evaluateRescueRoomDoctrine`   | Deterministic public-Episode evaluation               |

No bulk resync was executed. The remaining 45 routes were intentionally not added. This did not enable AI Commander, authentication, registration, Final or settlement routes, and does not make other existing routes free. The parameterized manifest route was exercised only with `id: rescue-room`.

[Before/after routes, prices and verification](../../evidence/deployments/bazantic-rescue-route-repair.json). CLI 0.10.0 was extracted into ignored `.frontier/tools/` after checking its npm tarball SHA-512 and inspecting source. Global CLI 0.8.0 and existing credentials were not overwritten.

## Non-AI connection verification

1. **Gateway HTTP: six requests, all 200.** Manifest, 12,117-byte historical Starter, its SHA-256, two evaluations of the same Doctrine, independent SDK integrity and repetition passed.
2. **Gateway MCP: 64 tools listed.** One `getCliArena` and two `evaluateRescueRoomDoctrine` calls passed.
3. **Complete result agreement.** Both MCP response JSON objects matched each other and the local `evaluateRescueDoctrinePracticeEpisode` output. SDK integrity also passed.

Episode: `episode-fabafc1906b4`. Evaluation hash: `0x144c9a882f88b116019f963cf7c3d868527b27ea642ef7784cff4b10fc914df4`.

| Independent outcome    |            Result | Direction |
| ---------------------- | ----------------: | --------- |
| User loss              |             0 USD | Minimize  |
| Served protocol demand |       845,915 ppm | Maximize  |
| Response spend         | 46 Rescue Credits | Minimize  |

[MCP evidence](../../evidence/deployments/bazantic-rescue-mcp-verification.json). This initial run evaluated the sample Doctrine; an LLM did not invent it. It did not verify every one of the 64 tools, MCP Starter binary representation or an external client's UI.

Local regression verification covered three files / 67 tests: preflight, SDK integrity and Bazantic A/B harness. Stored JSON, preservation of the old routes, three zero-price additions, Recipe definition hash and draft state were also checked. The gateway repair did not change Web, contracts or evaluator implementation and was not a fresh full build.

## Reproduce without inference or payment

From the repository root; no login, API key or wallet is needed. Standard HTTP does not automatically pay a 402.

```powershell
pnpm exec tsx scripts/verify-rescue-practice-onboarding.ts https://kjrjolrzlra2zd7f7uycwazhya.bazgateway.com
```

For MCP, initialize, send initialized, then list tools. Call `getCliArena` with `id: rescue-room`. Retain the returned sample Doctrine, public Episode and Context hashes before calling `evaluateRescueRoomDoctrine`:

```text
requestBody: { episodeId: <public Episode ID>, doctrine: <sample Doctrine> }
X-Frontier-Context-Hash: <manifest contextHash>
X-Frontier-Runtime-Context-Hash: <manifest runtimeContextHash>
```

Retain any gateway conversation ID only within that conversation; do not invent or publish it. Tool responses are text containing internal HTTP status and JSON: an outer MCP HTTP 200 is not sufficient. Check tool errors, internal status, Context and hashes. Stop on authentication, 402 or invalid results; success through another route is not success of the failing tool. Management credentials must never be forwarded to the unauthenticated data API.

## Saved Recipe draft

The existing account listed zero recipes with no next page. A draft was created using only the two tools already exercised:

- Name: `Rescue Room Strategy Comparison`.
- Handle: `rescue-room-strategy-comparison`.
- State: `draft`; not published.
- Declared model: `anthropic/claude-haiku-4.5`; this setting alone did not run inference.
- Tools: `getCliArena`, `evaluateRescueRoomDoctrine`.
- Input: desired strategy policy and optional public Episode ID.
- Task: evaluate the sample baseline and one modified candidate in the same Context/Episode, retaining separate axes and failed, tied or worse results.

[Definition](../../../bazantic/rescue-strategy-recipe.json) and [readback evidence](../../evidence/deployments/bazantic-rescue-recipe-draft.json). All definition fields matched after creation. The output example is an explicitly unexecuted format example, not measured results. [Recipe reference](https://bazantic.com/docs/recipes).

A hosted execution and output validation remain separate work. A Recipe/no-Recipe experiment must fix prompt, model, tools and Episodes and retain every run in the existing harness.

## Later real external AI execution — 2026-09-12 09:45 UTC

After the free connection check, an external OpenAI agent (`gpt-5-nano`) used the Recipe prompt to fetch the manifest, evaluate a baseline and evaluate a candidate. Three internal HTTP 200 responses, SDK integrity, local re-evaluation and independent-axis comparison passed. [Public evidence](../../evidence/deployments/bazantic-rescue-agent-demo.json) · [Recording guide](SPONSOR_DEMO.md).

Reducing investigation budget from 90 to 60 credits produced **equal results on all three axes in this one public Episode**. No improvement or generalization is claimed. Five preceding attempts failed during connection/structured input or remained uncertain and are retained in an ignored journal. This is not six successful samples or a preregistered A/B experiment.

The Recipe's declared Haiku model was not changed; this external execution explicitly used an author-model override. **The Bazantic-hosted Recipe has not run or been published; no gateway payment was made.** The successful attempt recorded four model responses, 9,358 input tokens and 1,492 output tokens. Six reservations of at most $0.10 were a conservative $0.60 budget ceiling, not an invoice. The attempt cap was reached; further executions require separate budget/journal review.

## Claims this evidence does not support

Rescue Credits are game balances, not tokens. These results alone do not establish independent paid services, ENS authorization, CRE execution, unknown Final competition, tournament rewards, AI improvement from a Recipe or full sponsor-prize eligibility. Those integrations and their separate evidence are described in [current status](../../STATUS.md).
