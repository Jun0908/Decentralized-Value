# Frontier Protocol 実装タスク

最終更新: 2026-09-05
対象: ETHOnline 2026 Technical Frontier MVP

## 1. ゴール

次のEnd-to-Endフローを、再現可能なデモとして完成させる。

> External AgentがBazantic Recipeを使ってArtifactの評価を依頼し、Frontier APIがENSv2からAuthorized Runnerを発見する。Runnerは同一ContextでBenchmarkを実行し、Ledger DMKでOutcome Attestationへ署名する。Ledger Key RingはHosted Runnerが必要とするScoped Credentialを保護する。署名済みAttestationをEthereum Sepoliaへ記録し、更新されたPareto FrontierをWeb画面で確認できる。

## 2. 実装原則

- Core Conceptは `Independent Value Axes`、`Hard Constraints`、`Reproducible Evaluation`、`Signed Attestations`、`Pareto Frontiers` とする。
- 最初のArenaは `Gas Efficiency × Parallel Throughput` に限定する。
- Correctness FailureしたArtifactはFrontier比較から除外する。
- Benchmark値、ENS Record、署名結果をFrontendへHardcodeしない。
- ENSv2、Bazantic、LedgerのIntegration Codeを書く前に、最新の公式Docs、Deployment、SDK、CLIを確認する。
- Sponsor連携はAdapterで分離するが、Demo PathではLoad-bearingにする。
- 秘密鍵やTokenをRepositoryへCommitしない。
- 実装判断と公式仕様との差異は `Docs/implementation-decisions.md` に記録する。

## 3. 優先順位

| 優先度 | 意味 |
| --- | --- |
| P0 | End-to-End MVPに必須。先に完了させる |
| P1 | Sponsor評価、信頼性、デモ品質を大きく高める |
| P2 | Core完成後に追加する拡張 |

## 4. Critical Path

```text
Repository基盤
  -> Artifact + Correctness Test
  -> Real Benchmark + Pareto計算
  -> Contracts + Local E2E
  -> Sepolia
  -> ENSv2 Runner Discovery
  -> Ledger-backed Attestation
  -> Frontier API
  -> Bazantic MCP / Recipe
  -> Web UI
  -> 90-120秒デモとSubmission Evidence
```

## 5. Phase 0 — 調査とRepository基盤

### P0: 仕様と外部依存の確認

- [x] `T-000` Repository内の企画資料をすべて読む。
- [x] `T-001` ENSv2公式Docsを確認する。
  - SepoliaのRegistry / Resolver / EAC構成を確認する。
  - 公式Contract Address、ABI、SDK、権限委譲方法を記録する。
  - Hierarchical NamespaceとLive Record Resolutionの実装方法を確認する。
- [x] `T-002` Bazantic公式Docsと現在のPrize要件を確認する。
  - API Service、MCP、Recipe、x402 / MPP Gatewayの公式Workflowを確認する。
  - Bazantic側でHost / Generateすべき範囲を確認する。
- [x] `T-003` Ledger Agent Stack公式Docsを確認する。
  - `wallet-cli ring` のInstall、Provisioning、Encryption / Decryption手順を確認する。
  - DMK Ethereum SignerのEIP-712 Signingと、Key RingのSecret保護を分離する。
  - VPS / CI / Hosted RunnerでKey Ringを使う構成を確認する。
- [x] `T-004` Privy、Next.js、viem / wagmiの採用Versionと互換性を決める。
- [x] `T-005` 調査結果を `Docs/implementation-decisions.md` に記録する。

### P0: Monorepo初期化

- [x] `T-010` pnpm workspaceを初期化する。
- [x] `T-011` 次のDirectoryを作成する。
  - `apps/web`
  - `apps/api`
  - `apps/runner`
  - `packages/contracts`
  - `packages/sdk`
  - `packages/shared`
  - `packages/ens-adapter`
  - `packages/ledger-adapter`
  - `artifacts/orderbook`
  - `benchmarks/evm-orderbook`
  - `bazantic`
  - `openapi`
  - `scripts`
  - `docs`
- [x] `T-012` TypeScriptをStrict Modeで統一する。
- [x] `T-013` Lint、Format、Typecheck、Testの共通Commandを用意する。
- [x] `T-014` `.gitignore` と `.env.example` を作成する。
- [x] `T-015` Zod等で環境変数Validationを実装する。
- [x] `T-016` CIでLint、Typecheck、Unit Test、Buildを実行する。Contract TestはFoundry初期化後に追加する。

### Phase 0 Exit Condition

- [x] Clean checkoutから依存関係をInstallできる。
- [x] `pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build` を実行できる。
- [x] 外部Integrationで推測のContract Address、SDK Method、CLI Flagを使っていない。

## 6. Phase 1 — Core Deterministic Demo

### P0: Shared Schema

- [ ] `T-100` `Challenge` Schemaを定義する。
  - Challenge ID、Artifact Type、Context Hash、Constraint Spec Hashを含める。
  - `gasPerOrder: MINIMIZE` と `parallelThroughput: MAXIMIZE` を定義する。
- [ ] `T-101` `Artifact`、`EvaluationContext`、`RunnerIdentity` Schemaを定義する。
- [ ] `T-102` `OutcomeVector` と `OutcomeAttestation` Schemaを定義する。
- [ ] `T-103` JSON BoundaryでBigInt / Hex / AddressのSerialization規則を定義する。
- [ ] `T-104` Attestation用Canonical EncodingとStable HashのTest Vectorを作る。

### P0: Orderbook Artifact

- [ ] `T-110` 4実装共通のOrderbook InterfaceとReference Modelを定義する。
- [ ] `T-111` `PackedBook.sol` を実装する。
- [ ] `T-112` `ShardedBook.sol` を実装する。
- [ ] `T-113` `FrontierBook.sol` を実装する。
- [ ] `T-114` `BadBook.sol` を意図が明確なFailureまたはDominated実装として作る。
- [ ] `T-115` 同一Inputで同一の論理的Final StateになることをTestする。
- [ ] `T-116` Foundry invariant / fuzz testを追加する。
- [ ] `T-117` 禁止External State、Revert Semantics、決定性を検証する。

### P0: Benchmark

- [ ] `T-120` Versioned Reference Workloadを定義する。
- [ ] `T-121` Gas per Orderを実測するHarnessを作る。
- [ ] `T-122` Parallel Throughputを測るDeterministic Harnessを作る。
- [ ] `T-123` Throughput値のうちReal EVM、Simulation、Assumptionの境界を文書化する。
- [ ] `T-124` 複数回測定しMedianを採用する。
- [ ] `T-125` Git Commit、Compiler Version / Flags、Bytecode Hash、Context Hash、Workload Version、Timestampを結果へ含める。
- [ ] `T-126` Correctness Failure時はMetricをFrontierへ渡さない。

### P0: Pareto Engine

- [ ] `T-130` 2次元Dominance判定を実装する。
- [ ] `T-131` Non-dominated Setの追加、維持、削除を実装する。
- [ ] `T-132` 同値、Tie、重複結果、境界値のUnit Testを追加する。
- [ ] `T-133` 4 Artifact中、2つ以上がNon-dominatedになるBenchmark特性を確認する。
- [ ] `T-134` 新ArtifactでFrontierが動くFixtureと可視化用JSONを生成する。

### Phase 1 Exit Condition

- [ ] 4 Artifactを同じContextで評価できる。
- [ ] すべての表示値がBenchmark出力に由来する。
- [ ] BadBookがCorrectness FailureまたはDominatedとして扱われる。
- [ ] Real Benchmark OutputでFrontierの更新を確認できる。

## 7. Phase 2 — Smart Contracts

### P0: Contract実装

- [ ] `T-200` Foundry projectを構成する。
- [ ] `T-201` `ChallengeRegistry.sol` を実装する。
- [ ] `T-202` `ArtifactRegistry.sol` を実装する。
- [ ] `T-203` `RunnerIdentityAdapter` Interfaceを定義する。
- [ ] `T-204` `BenchmarkAttestation.sol` を実装する。
  - SignatureとSigner Identityを検証する。
  - Challenge / Artifact / Context / Constraint Hashの一致を検証する。
  - Duplicate、Invalid、Expired AttestationをRejectする。
- [ ] `T-205` `ParetoSettlement.sol` を実装する。
  - 2次元Frontierのみを扱う。
  - Added、Dominated、Removed Eventを発行する。
- [ ] `T-206` 必要なRole、Ownership、Emergency Controlを最小構成で定義する。

### P0: Contract検証

- [ ] `T-210` RegistryのUnit Testを作る。
- [ ] `T-211` Signature / Replay / Duplicate / Unauthorized Runner Testを作る。
- [ ] `T-212` Pareto SettlementのInvariant / Fuzz Testを作る。
- [ ] `T-213` Malformed Payload、Zero値、Overflow、TieをTestする。
- [ ] `T-214` Local chainで登録からFrontier更新までのIntegration Testを作る。
- [ ] `T-215` Gas Snapshotを保存する。

### P0: Sepolia

- [ ] `T-220` Deployment Scriptを作る。
- [ ] `T-221` SepoliaへDeployし、AddressとTransactionを記録する。
- [ ] `T-222` Contract Verificationを行う。
- [ ] `T-223` Deploy済みContractでSample ChallengeとArtifactを登録する。

### Phase 2 Exit Condition

- [ ] 実署名AttestationでSepolia上のFrontier Stateが更新される。
- [ ] Invalid / Duplicate / Unauthorized AttestationがRejectされる。
- [ ] DeploymentをScriptから再現できる。

## 8. Phase 3 — ENSv2 Integration

### P0: NamespaceとPermission

- [ ] `T-300` 実際に利用可能なENSv2 Sepolia親Nameを確定する。
- [ ] `T-301` `arenas`、`challenges`、`runners`、`agents` の階層Namespaceを作る。
- [ ] `T-302` RunnerのAddress、Role、Capability、Endpoint、Version、Status Recordを登録する。
- [ ] `T-303` Permissioned Registry / ResolverとEACを構成する。
- [ ] `T-304` Sponsor、Context Author、Runner、Maintainerの権限境界を設定する。
- [ ] `T-305` 少なくとも1つのDelegated Permission Mutationを実装・記録する。

### P0: Runtime Adapter

- [ ] `T-310` `ens-adapter` にLive Resolutionを実装する。
- [ ] `T-311` Required Capabilityを満たすActive Runnerだけを返すDiscoveryを実装する。
- [ ] `T-312` Runner EndpointとSigning AddressをENS Recordから取得する。
- [ ] `T-313` Attestation SignerとResolved Runner Identityを照合する。
- [ ] `T-314` Resolution Failure、Inactive Runner、不正RecordをFail Closedで扱う。
- [ ] `T-315` ENS設定を壊すとDispatch / Authorizationが失敗するIntegration Testを作る。

### Phase 3 Exit Condition

- [ ] UI FixtureやHard-coded Runner AddressなしでRunnerを発見できる。
- [ ] ENSv2の設定変更がRuntime Behaviorへ反映される。
- [ ] Delegated Permissionを実演できる。

## 9. Phase 4 — Ledger-backed Runner

### P0: Runner Service

- [ ] `T-400` Evaluation Jobを受けるHosted Runner Serviceを実装する。
- [ ] `T-401` Challenge、Context、Artifactを取得してHashを検証する。
- [ ] `T-402` Correctness Testを先に実行する。
- [ ] `T-403` Gas / Throughput Benchmarkを実行してOutcome Vectorを生成する。
- [ ] `T-404` Canonical Payloadから `resultHash` を生成する。

### P0: Ledger Key Ring

- [ ] `T-410` `wallet-cli ring` をInstallし、Runner HostでKey RingをProvisionする。
- [ ] `T-411` Ledger DMK Ethereum Signerを使うEIP-712 Signer Adapterを実装する。
- [ ] `T-412` DMK SignatureをEVM側で検証可能な形式へ接続する。
- [ ] `T-413` ENS Runner AddressとRecovered Signerが一致することを確認する。
- [ ] `T-414` Demo PathからRaw Private Key Signerを排除する。
- [ ] `T-415` Local Insecure Signerは明示的なDevelopment Flag下だけで有効にする。
- [ ] `T-416` `.env`、Source Tree、CI SecretsにDemo Signing Private KeyがないことをScanする。
- [ ] `T-417` Hosted Runnerに必要なScoped Credentialを確定し、Ledger Key Ringで暗号化・復号する。
- [ ] `T-418` Key Ringが単なるDecorative Integrationではなく、Credential取得失敗時にRunnerが停止することをTestする。

### P1: Hosted Evidence

- [ ] `T-420` VPS、CI Runner、Hosted AgentのいずれかへRunnerを配置する。
- [ ] `T-421` GitHub Actions等からKey Ring Signingを利用する例を作る。
- [ ] `T-422` EnrollmentとSigningのEvidenceを保存する。

### Phase 4 Exit Condition

- [ ] Runner ProcessがPlaintext Private Keyを保持せずAttestできる。
- [ ] Ledger DMK SignatureがENSv2 Identityと一致する。
- [ ] Ledger Key RingがHosted RunnerのScoped Credentialを保護する。
- [ ] BenchmarkからSepolia記録までをRunnerが完遂できる。

## 10. Phase 5 — Frontier APIとBazantic

### P0: HTTP API

- [ ] `T-500` APIのStorage / Indexing方針を決める。
- [ ] `T-501` Read Endpointを実装する。
  - `GET /v1/arenas`
  - `GET /v1/arenas/:arenaId`
  - `GET /v1/arenas/:arenaId/frontier`
  - `GET /v1/challenges/:challengeId`
  - `GET /v1/challenges/:challengeId/artifacts`
  - `GET /v1/challenges/:challengeId/attestations`
  - `GET /v1/runners`
  - `GET /v1/runners/:ensName`
- [ ] `T-502` Write Endpointを実装する。
  - `POST /v1/artifacts`
  - `POST /v1/evaluations`
  - `POST /v1/challenges/:challengeId/disputes`
- [ ] `T-503` Request / Response ValidationとError Schemaを実装する。
- [ ] `T-504` EvaluationをSyncまたはAsyncの一方へ確定し、Job Stateを定義する。
- [ ] `T-505` ENS DiscoveryからRunner Dispatchまでを接続する。
- [ ] `T-506` Runner結果、Ledger Signature、Sepolia Transaction、Frontier Statusを返す。
- [ ] `T-507` Versioned OpenAPI Specificationを作る。
- [ ] `T-508` API Contract Testを作る。

### P0: Bazantic

- [ ] `T-510` Frontier ProtocolをBazanticのAPI Serviceとして登録する。
- [ ] `T-511` Protocol Actionと1対1対応するMCP Toolを公開する。
- [ ] `T-512` `POST /v1/evaluations` をx402 / MPP Gateway経由のPaid / Gated Operationにする。
- [ ] `T-513` Read EndpointのFree / Paid境界を設定する。
- [ ] `T-514` `Evaluate an artifact against a Value Frontier` Recipeを作る。
- [ ] `T-515` RecipeへChallenge、Context、Hard Constraint、Frontier、Evaluation要否、Outcome解釈を含める。
- [ ] `T-516` Raw API情報のみのTest Aを保存する。
- [ ] `T-517` 同一Prompt / Model / SettingsでRecipe付きTest Bを保存する。
- [ ] `T-518` Tool Call Sequence、Context理解、Frontier解釈、Final Answerの差を評価する。

### Phase 5 Exit Condition

- [ ] External AgentがRecipeを使って評価タスクを自律完遂できる。
- [ ] MCPから実際のFrontier APIを呼び出している。
- [ ] Recipeありの結果がRaw APIのみより明確に改善している。

## 11. Phase 6 — Web AppとPrivy

### P0: Frontend

- [ ] `T-600` Next.js App Router + TypeScriptでWeb Appを初期化する。
- [ ] `T-601` `/` にProduct ThesisとCurrent Arenaを表示する。
- [ ] `T-602` `/arena/[id]` を実装する。
  - Challenge、Axes、Hard Constraints、Contextを表示する。
  - Frontier Chart、Artifact List、Latest Attestationsを表示する。
- [ ] `T-603` `/artifact/[id]` を実装する。
  - Source / Version、Metrics、Runner ENS、Attestation、Frontier Statusを表示する。
- [ ] `T-604` `/runners` へLive ENSv2 Identityを表示する。
- [ ] `T-605` `/sponsor-debug` を実装する。
  - ENS Resolution、Permission State、Bazantic Status、Recipe IDを表示する。
  - Ledger Signing Mode、Result Hash、Signature、Transactionを表示する。
- [ ] `T-606` Frontier更新をPollingまたはSSEで画面へ反映する。
- [ ] `T-607` Loading、Empty、Error、External Dependency Failure状態を実装する。

### P1: PrivyとUX

- [ ] `T-610` Privy LoginとEmbedded / Existing Walletを接続する。
- [ ] `T-611` User Address / ENS Identityを表示する。
- [ ] `T-612` User Transaction SigningだけをPrivyへ担当させる。
- [ ] `T-613` Keyboard、Contrast、Responsive Layoutを確認する。

### Phase 6 Exit Condition

- [ ] Fake NumberなしでArena、Artifact、Runner、Attestationを表示できる。
- [ ] Evaluation後にPareto Frontierが視覚的に更新される。
- [ ] Sponsor Integrationの内部状態をJudgeへ説明できる。

## 12. Phase 7 — Demo AutomationとSubmission

### P0: Demo Safety

- [ ] `T-700` `pnpm demo:seed` を実装する。
  - Contract、Challenge、Artifact、ENS Runner、Ledger Preflightを冪等に準備する。
  - 最後のInteresting Evaluationだけ未実行で残す。
- [ ] `T-701` `pnpm demo:check` を実装する。
  - RPC、Sepolia Balance、Contract、ENS、Runner、Ledger、Bazantic、Webを確認する。
- [ ] `T-702` Failure時に原因と復旧手順を明示する。
- [ ] `T-703` Clean machineからSetupとDemoを再現する。

### P0: Documentation

- [ ] `T-710` Public `README.md` を作成する。
- [ ] `T-711` `Docs/architecture.md` を作成する。
- [ ] `T-712` `Docs/ens.md` を作成する。
- [ ] `T-713` `Docs/bazantic.md` を作成する。
- [ ] `T-714` `Docs/ledger.md` を作成する。
- [ ] `T-715` `Docs/demo-script.md` を作成する。
- [ ] `T-716` `Docs/prize-checklist.md` を作成する。
- [ ] `T-717` OpenAPI、Contract Address、ENS Name、Recipe ID、Deployment URLを記録する。

### P0: Evidence

- [ ] `T-720` ENSv2 Namespace、Live Records、EAC、DelegationのEvidenceを保存する。
- [ ] `T-721` Bazantic MCP、Gateway、Recipe、A/B TestのEvidenceを保存する。
- [ ] `T-722` Ledger Enrollment、Key Ring Signing、Recovered SignerのEvidenceを保存する。
- [ ] `T-723` Sepolia Attestation TransactionとFrontier UpdateのEvidenceを保存する。
- [ ] `T-724` 90–120秒のDemoを録画する。

### P1: Hardening

- [ ] `T-730` Secret ScanとDependency Auditを実行する。
- [ ] `T-731` Dead Code、Mock、未使用Feature Flagを除去する。
- [ ] `T-732` API Rate Limit、Timeout、Retry、Idempotencyを確認する。
- [ ] `T-733` 外部サービス停止時のFallback表示とDemo復旧手順を用意する。
- [ ] `T-734` License、Attribution、Open-source要件を確認する。

### Phase 7 Exit Condition

- [ ] 90–120秒で一貫したCentral Demoを実演できる。
- [ ] Sponsorごとの要件をEvidenceで証明できる。
- [ ] READMEだけで第三者がSetup、Test、Demoを再現できる。

## 13. P2 — Core完成後の拡張候補

- [ ] `T-800` Human-in-the-loopによるHigh-risk Action確認を追加する。
- [ ] `T-801` Hypervolume ContributionをOffchainで計算・表示する。
- [ ] `T-802` Runner Bond、Challenge、Dispute、Slashingを追加する。
- [ ] `T-803` Artifact / Context / Benchmark AuthorへのRoyalty設計を追加する。
- [ ] `T-804` Post-Quantum Authentication等の第2 Technical Adapterを追加する。
- [ ] `T-805` Humanitarian Aid、Public Procurement、Energy等のSocial Frontier Pilotを追加する。
- [ ] `T-806` Evidence LevelとHistorical Replay / Replication Flowを実装する。

## 14. MVP Definition of Done

- [ ] 同じPublic APIとContextで4つのArtifactを評価できる。
- [ ] CorrectnessをHard Constraintとして検証できる。
- [ ] GasとParallel Throughputが実Benchmarkから生成される。
- [ ] 少なくとも2つのNon-dominated Artifactが残る。
- [ ] ENSv2 Live DataからEligible Runnerを発見・認可できる。
- [ ] Ledger DMKでOutcome AttestationへEIP-712署名できる。
- [ ] Ledger Key RingでHosted RunnerのScoped Credentialを保護できる。
- [ ] SignerがENSv2 Runner Identityと一致する。
- [ ] Signed AttestationをSepoliaへ記録できる。
- [ ] Pareto FrontierがOnchain Stateに基づいて更新される。
- [ ] Bazantic Recipeを使うAgentがEvaluationを完遂できる。
- [ ] Web Appで一連の状態変化を確認できる。
- [ ] `pnpm demo:seed` と `pnpm demo:check` でデモを再現・事前検証できる。

## 15. 直近の着手順

1. `T-001`〜`T-005`: Sponsor公式仕様とVersionを確定する。
2. `T-010`〜`T-016`: Monorepoと品質基盤を作る。
3. `T-100`〜`T-104`: Protocol SchemaとAttestation Encodingを固定する。
4. `T-110`〜`T-126`: Artifact、Correctness Test、Benchmarkを完成させる。
5. `T-130`〜`T-134`: Pareto Engineと最初のFrontier Plotを完成させる。

この5段階が完了するまで、Frontendの作り込みやTokenomics、Social Frontierへ進まない。
