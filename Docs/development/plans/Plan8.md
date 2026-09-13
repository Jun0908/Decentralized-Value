# Frontier Protocol 計画8 — Secret Gate

> **Archived 2026-09-10:** 本物のoff-chain Secret Gate参照実装は完成した。LatencyとMemoryの安定した独立Tradeoffを確認できなかったため、競技化は`PIVOT`として終了した。後継のActive Planは[`../../Plan9.md`](Plan9.md)。

**作成日:** 2026-09-09
**状態:** Gateデモ公開済み・Phase 0は`PIVOT`・競技化とSepolia公開は保留
**最重要方針:** 本物のSemaphoreを使ったSecret Gateは作る。ただし、証明生成を最適化する競技は、速度とメモリの間に安定したトレードオフを実測できた場合にだけ作る。

## はじめに — この文書で使う言葉

| 言葉 | この文書での意味 |
| --- | --- |
| ゼロ知識証明（Proof） | 秘密そのものを見せずに、条件を満たしていることを証明するデータ |
| Identity | ユーザーがブラウザ内で作るDemo用の秘密の身分情報 |
| Identity Commitment | Identityの秘密を公開せず、Group登録に使う公開値 |
| Group Root | その時点のGroup Member一覧を表す値 |
| nullifier | 同じIdentityによる同じGateの二重利用を発見する公開値 |
| scope | nullifierをどのGate・期間に対して有効にするかを決める値 |
| 実行戦略（Strategy） | Worker数や読み込み方法など、証明をどう実行するかを決める設定 |
| 評価用負荷（Workload） | 1件、同時6件など、証明Requestを発生させる固定パターン |
| 評価条件（Context） | Version、Browser、CPU、Memory、測定方法などの比較条件一式 |
| 証拠データ（Evidence） | Proof検証結果、時間、Memory Sample、Hashなど、結果を確認するための記録 |
| 価値プール（Value Pool） | 速度や省Memoryなど、異なる価値を別々に支援する仕組み |

コード中の名前や既存製品の固有名は、実装時の混乱を避けるため英語のまま記載する。

## 1. この計画で作るもの

ブラウザの中で本物のSemaphore匿名メンバーシップ証明を生成し、Identityの秘密情報をサーバーへ送らずにGateへ入れるデモを作る。

最終的な成果物は、次の2つに分ける。

1. **Secret Gate**
   - ユーザーがデモ用Identityをブラウザで作る。
   - 秘密情報は端末内に残す。
   - GroupのMemberであることだけをゼロ知識証明で証明する。
   - 同じGateを同じIdentityで二重利用できないようにする。

2. **端末内証明ベンチマーク**
   - Semaphore証明の実行方法をStrategy JSONで指定する。
   - 全Strategyを同じ環境、同じ証明、同じ評価用負荷で測る。
   - 待ち時間とメモリを1つの点数に混ぜず、独立して評価する。

2つ目を競技として公開するのは、段階0の検証に合格した場合だけとする。

## 2. このデモが示すこと

必要なのは、次の4つがすべて本物であること。

```text
REAL ZK
+ REAL MEASUREMENT
+ REAL TRADEOFF
+ PLURAL VALUE JUDGMENT
```

- **本物のゼロ知識証明:** 本物のSemaphore証明を生成・検証する。
- **本物の測定:** 実際の時間とメモリを測る。
- **本物のトレードオフ:** 速いがメモリを多く使う方法、遅いがメモリを抑える方法などが実在する。
- **複数の価値判断:** 速度と省メモリを別々の価値プールで支援する。

## 3. 誤解を避けるために言わないこと

このデモでは、次の表現を使わない。

- デモ用Groupへの参加が、現実の本人確認や資格を証明するという表現
- IPアドレスやサーバーログも含めて完全に匿名であるという表現
- off-chain検証しかしていない段階で、Ethereum上で検証したという表現
- 固定PCでの測定結果が、すべてのスマートフォンでも同じだという表現
- 実行時間やメモリの実測値が、再実行しても完全に同じになるという表現
- 本番用アクセス制御や本番大会が完成しているという表現

## 4. MVPで固定する方針

| 項目 | 方針 |
| --- | --- |
| 証明方式 | Semaphore V4を使う。実装開始時の公式版を固定し、バージョンとartifact hashを評価条件に記録する |
| Identity | デモ用Identityをブラウザで生成する |
| 秘密情報 | ユーザーの端末外へ送らない |
| Group | デモ専用の合成Groupを使い、何を証明できるGroupなのか明示する |
| MVPの証明検証 | Next.js APIでoff-chain検証する |
| 二重利用防止 | GateとepochごとのnullifierをRedisへatomicに保存する |
| AIの提出物 | 任意コードではなく、厳格な`ProofExecutionStrategy` JSONだけにする |
| 公式測定 | 固定されたBrowserと評価Runnerで実行する |
| 個人端末の測定 | 参考用の個人端末証拠として分離する |
| 正しさ | 点数ではなく必須条件にする |
| 評価軸 | p95待ち時間とピーク追加メモリの2軸から始める |
| Gas | 実際にStrategy間の差が出るまで評価軸にしない |
| Ethereum | off-chain版の完成後にSepoliaへ進む |
| Noir | MVPでは使わない |

## 5. ユーザー体験

### 5.1 Secret Gateを利用する流れ

1. ユーザーがSecret Gateを開く。
2. ブラウザ内でデモ用Semaphore Identityを生成する。
3. Identityの秘密情報は送らず、Identity Commitmentだけをデモ用Groupへ登録する。
4. GroupのSnapshotとMerkle Treeの所属情報を受け取る。
5. ユーザーが「Prove and enter」を押す。
6. Web Workerがブラウザ内で証明を生成する。
7. 証明と公開検証値をAPIへ送る。
8. APIが証明、Group Root、message、scope、nullifierを検証する。
9. 未使用nullifierをRedisへatomicに保存する。
10. すべて正しい場合だけGateを開く。

### 5.2 実行戦略を試す流れ

1. 固定されたCircuit、評価用負荷、制限、評価軸、評価条件を読む。
2. 好きなAI、または人間自身が実行戦略JSONを作る。
3. JSONがSchemaに合っているか確認する。
4. 自分の端末で練習測定を実行する。
5. 実行戦略を公式評価へ提出する。
6. 正しさ、待ち時間、メモリ、Pareto、価値プール、証拠データを見る。

### 5.3 公式評価の流れ

1. 検証済みの実行戦略を、初期状態の固定Runnerへ読み込む。
2. 実行戦略の初期化前から測定を開始する。
3. 固定された評価用負荷の全証明Requestを実行する。
4. 生成した全証明を公式Semaphore verifierで検証する。
5. リクエストごとの時間とメモリを記録する。
6. 公開済みの方法で集計する。
7. 生の証拠データと集計結果からEvidence Hashを作る。

## 6. 最小構成

```text
Browser
├─ Demo用Semaphore Identity
├─ Group membership data
├─ Proof生成Web Worker
└─ Gate / Practice UI
          │
          ▼
Next.js API
├─ Group登録とSnapshot取得
├─ Group Root / message / scope確認
├─ Semaphore Proof検証
├─ nullifierのatomic保存
└─ StrategyとEvidenceの読み書き
          │
          ├─ Redis
          │  ├─ GroupとRoot
          │  ├─ 使用済みnullifier
          │  ├─ Strategy
          │  └─ Evaluation Evidence
          │
          └─ apps/runner
             ├─ 固定Chromium
             ├─ Strategy Interpreter
             ├─ Workload Driver
             ├─ OSレベルのMemory Sampler
             └─ Evidence Writer
```

Gateで実ユーザーが作る証明と、競技で測定する証明は分離する。公式Runnerは合成ベンチマークIdentityだけを使い、実ユーザーのIdentityの秘密情報を受け取らない。

## 7. 追加予定の主なファイル

```text
packages/secret-gate/
  src/
    strategy-schema.ts
    strategy-interpreter.ts
    workloads.ts
    context.ts
    evidence.ts
    hashes.ts
    group.ts
  test/

apps/web/src/app/arenas/secret-gate/
  page.tsx
  secret-gate-workbench.tsx
  proof-worker.ts

apps/web/src/app/api/v1/secret-gate/
  enroll/route.ts
  group/route.ts
  enter/route.ts
  strategies/route.ts
  evaluations/route.ts

apps/web/src/lib/
  secret-gate-client.ts
  secret-gate-store.ts

apps/runner/src/
  secret-gate-runner.ts
  secret-gate-memory-sampler.ts

Docs/product/arenas/secret-gate.md
openapi/frontier-v1.yaml
```

実装時には既存の構成を確認し、共通のHash、Pareto、Contribution、認証、Redis処理を重複して作らない。

## 8. AIが作る実行戦略

### 8.1 段階0用の小さなSchema

最初は、最適化問題が本当に存在するかを調べるため、次の4項目だけを許可する。

```json
{
  "schemaVersion": "proof-execution-strategy-v0",
  "maxParallelProofs": 2,
    "engineThreads": "sdk-default",
  "artifactLoad": "eager",
  "workerLifecycle": "reuse"
}
```

| Field | 許可する値 |
| --- | --- |
| `maxParallelProofs` | `1`から`4`の整数 |
| `engineThreads` | `sdk-default`のみ。Semaphoreの高レベルAPIがThread設定を公開していないため、競技用の可変項目から除外 |
| `artifactLoad` | `eager`または`on-demand` |
| `workerLifecycle` | `reuse`または`per-request` |

有効な組み合わせは16通りしかないため、全探索できる。この段階では「AIでなければ解けない競技」とは呼ばない。

### 8.2 競技用の候補Schema

段階0に合格した場合だけ、評価用負荷の状態に応じて動きを変える小さなルールを追加する。

```json
{
  "schemaVersion": "proof-execution-strategy-v1",
  "workers": {
    "min": 1,
    "max": 4,
    "engineThreads": "sdk-default"
  },
  "initialization": {
    "artifactLoad": "eager"
  },
  "scaling": {
    "scaleUp": [
      { "queueAtLeast": 2, "targetWorkers": 2 },
      { "queueAtLeast": 5, "targetWorkers": 4 }
    ],
    "idleTimeoutMs": 5000
  }
}
```

すべてのルールに上限を設け、信頼できるEvaluatorだけが解釈する。次のものは許可しない。

- 任意JavaScript
- 外部コードの読み込み
- Proofの使い回し
- Proof Cacheによる生成省略
- Requestの破棄
- 存在しないBatch Proofを装うこと
- Schemaにないfield

最初はFIFOで処理する。同じ種類のRequestしかない段階では、複雑なPriority Schedulingを追加しても意味がないためである。

## 9. Gateの検証規則

Gateの目的が曖昧にならないよう、messageとscopeをdomain separationする。

```text
message = hash("FRONTIER_SECRET_GATE_ENTER_V1")
scope   = hash("frontier:secret-gate:" + gateId + ":" + epoch)
```

実際に使うencodingとhash関数は、受付開始前に仕様化してテストする。

Verifierは次をすべて確認する。

- 対応しているProof versionか
- 想定したGroup IDか
- 現在信頼しているRoot、または有効期限内の旧Rootか
- 想定したmessageか
- 想定したscopeか
- Semaphore Proofが正しいか
- `(gateId, epoch, nullifier)`が未使用か

nullifier保存は1回のatomic操作で行う。同じnullifierを同時送信した場合、成功は必ず1件だけにする。

MVPではepochごとにGroup Snapshotを固定し、有効期間を明示する。これにより、Proof生成中にRootが変わって失敗する問題を減らす。

## 10. 固定する評価用負荷

| 負荷パターン | Requestの到着方法 | 調べること |
| --- | --- | --- |
| Cold Start | 未初期化状態で1件 | 初期化を含む最初の待ち時間 |
| Burst | 最初に6件同時 | Queueと並列実行による負荷 |
| Periodic | 750msごとに1件 | 継続的な利用 |
| Burst–Idle–Burst | 4件、5秒停止、4件 | Worker再利用と待機中メモリ |

artifactの読み込みやWorker作成を無料扱いしないため、Strategy初期化前からTimerを開始する。

ベンチマークの各Requestには、重複しない合成Identityとscopeを使う。Circuit、Tree Depth、artifact、Group Size、証明規則は全Strategyで同じにする。

## 11. 必ず守る条件

次のうち1つでも失敗したStrategyは、評価値を計算しても順位表や価値プールへ入れない。

- Strategy Schemaが正しい
- Workloadの全Requestをちょうど1回処理する
- 全RequestでProof生成に成功する
- 全Proofが公式Semaphore verifierを通る
- Root、message、scopeが正しい
- nullifierの規則が正しい
- 測定中に許可されていないNetwork Accessを行わない
- Circuit、artifact、Workload、Verifierを変更しない
- Time LimitとMemory Limitを超えない
- 終了後にWorkerをLeakさせない
- Identity Secretを定めた境界の外へ送らない

最低限、次の失敗テストを作る。

- invalid identity
- wrong root
- wrong scope
- wrong message
- tampered proof
- reused nullifier
- 同一nullifierの同時送信
- 不明なStrategy field
- 許容範囲外の値
- Requestの欠落
- 同一Requestの重複完了
- timeout
- memory limit超過

## 12. 評価軸

### 12.1 正式な2つの評価軸

| 評価軸 | 定義 | 方向 |
| --- | --- | --- |
| Request-to-proof latency | Request到着からQueue待ちとProof生成を経て完了するまでのp95 | 小さいほどよい |
| Peak incremental memory | 測定中のBrowser process treeまたはcgroupの最大RSSから開始前baselineを引いた値 | 小さいほどよい |

証明の成功は評価軸ではなく必須条件にする。

### 12.2 補助的な証拠データ

- enqueue時刻
- dispatch時刻
- Proof開始・終了時刻
- Queue待ち時間
- Proof生成時間
- First Proof Latency
- Throughput
- Memory SampleとPeak
- Idle後に残ったメモリ
- 取得可能な場合のCPU Time
- Proof検証結果とProof Hash
- Worker作成・再利用・終了Event

BrowserのMemory APIは補助Evidenceには使えるが、公式Settlementの唯一の値にはしない。公式値は、固定RunnerがOSレベルで測定する。

## 13. 測定方法

初期の測定方法は次のとおり。

- StrategyのTrialごとに新しいBrowser Processを使う
- 必要に応じてWarm-upを5回行う
- Strategyごとに20〜30回記録する
- Strategyの実行順を交互、またはLatin-square方式で変える
- Trial間のCooldownとRunner Health Checkを固定する
- medianとp95の計算方法を事前に決める
- 同点とみなす誤差範囲を事前に決める
- 集計値だけでなくRaw Observationも保存する

実時間とメモリは毎回完全には一致しない。そのため、ここでの「再現可能」とは、同じContextと方法で測り、公開された許容範囲内の結果になることを意味する。

## 14. 証拠データとHash

固定設定と実測値を混同しない。

```text
strategyHash = hash(canonical strategy JSON)
workloadHash = hash(canonical workload definition)
contextHash  = hash(canonical environment and methodology)
evidenceHash = hash(ordered raw observations and verification results)
resultHash   = hash(strategyHash + workloadHash + contextHash + evidenceHash + aggregates)
```

証拠データには次を含める。

- StrategyとValidation結果
- Context IDとWorkload ID
- Requestごとの順序付きTiming Event
- Memory Sampleとbaseline
- Proof検証結果とProof Hash
- 集計Outcome
- Eligibilityと失格理由
- Evaluatorと集計処理のversion

表示や運用に必要な作成日時は、決定論的なIDの入力にしない。

`resultHash`は、その1回の実行で得たRaw Evidenceを固定するためのHashである。同じStrategyを別の日に再実行して、同じHashになることを保証するものではない。

## 15. 評価条件に固定するもの

- Semaphore identity、group、proof packageのversion
- snarkjsとProof Runtimeのversion
- Circuit、WASM、proving key、verification keyのhash
- Group Size、Tree Depth、Group ID、Group Root
- messageとscopeの作り方
- Strategy SchemaとInterpreterのversion
- Workload versionとRequest到着時刻
- Chromium revisionと起動option
- OS ImageとRunner Image Digest
- CPU ModelまたはCPU quota
- 使用可能な並列数
- Memory Limit
- cross-origin isolation設定
- TimerとMemory Samplerのversion
- Warm-up、回数、Cooldown、実行順
- 集計、percentile、同点許容範囲、失格条件
- Evaluator version

異なる`contextHash`の結果を、同じLeaderboard、Pareto Frontier、Allocationへ混ぜない。

個人端末の結果には別Contextを使い、公式Runnerの結果と混ぜない。

## 16. 価値プール

### Instant Privacy Pool

**Value Statement:** Privacy機能のために、ユーザーを長時間待たせるべきではない。
**Rule:** 合格Strategyのうち、公式p95 Request-to-proof latencyが最も小さいものを支援する。事前に決めた誤差範囲内は同点として扱う。

### Accessible Privacy Pool

**Value Statement:** Privacy機能は、メモリが限られた端末でも利用可能であるべき。
**Rule:** 合格Strategyのうち、公式Peak Incremental Memoryが最も小さいものを支援する。事前に決めた誤差範囲内は同点として扱う。

### Frontier Expansion Pool

最初から有効にしない。Phase 0で、測定ノイズを超えた安定した複数のPareto Pointを確認できた場合だけ追加する。

追加する場合は、わずかな測定誤差で偽のFrontierが生まれないよう、epsilon-aware dominanceと決定論的なexclusive contributionを使う。

Weighted Scoreや総合優勝者は作らない。

## 17. 段階0 — 競技成立性の技術検証

### 目的

本物のSemaphore client-side Proofで、安定した「待ち時間 対 メモリ」のOptimization Problemが存在するかを確認する。

### 作業項目

- [x] versionとartifactを固定した最小Proof生成PoCを作る
- [x] BrowserのWeb Worker内でProofを生成する
- [x] 生成した全Proofを公式JavaScript verifierで検証する
- [x] v0 Strategy Schemaを実装する
- [ ] 4つの固定Workloadを作る
- [x] Queue、Proof時間、全体待ち時間、OSレベルMemoryを取得する
- [x] 固定Chromium Runnerで繰り返し測定する
- [x] Variance、Dominance、Frontierの安定性を分析する
- [x] 効果がないStrategy項目は製品に残さない
- [x] `GO`、`PIVOT`、`STOP`の判断をこのPlanと`Docs/STATUS.md`へ記録する

### 2026-09-09の判定: PIVOT

本物のSemaphore Proofを32件生成し、すべて公式JavaScript verifierで検証した。4つの代表Strategyを各2回、毎回新しいGoogle Chrome processで測定したが、事前に定めた変動係数上限`0.15`を複数Strategyが超えた。したがってLatencyとMemoryのFrontierを安定した公式競技として扱わない。

- Raw/Aggregate Evidence: `benchmarks/secret-gate/results/latest.json`
- Evidence Hash: `0xe6d463a7d825dbc1ffedbf05991af8989d82803b464785263c62ca06c617b149`
- 最良Latency中央値: `1943 ms`（sequential-reuse）
- 最小Peak Incremental Memory中央値: `102.4 MiB`（sequential-fresh）
- 最大Latency CV: `0.595`
- 最大Memory CV: `0.331`

この初期成立性検証では16通りの全探索と4種類すべてのWorkloadまでは行っていない。少数試行の時点で安定性条件を満たさなかったため、Phase 2の競技、Value Pool、公式Frontierを実装せず、Secret Gateと個人端末Benchmarkだけを完成させた。

### GO条件

次をすべて満たす場合だけCompetitionへ進む。

- 意味の異なるnon-dominated Strategyが、繰り返し測定後も2つ以上残る
- Strategy間の差が、事前に決めた測定誤差より大きい
- 実行順を変えても結論が大きく逆転しない
- 比較対象の全Strategyが全Proofを生成・検証できる
- 固定Runnerで許容範囲内の結果を再現できる
- 効果のない項目を除いても、1つの設定が常にすべてを上回る状態ではない

### PIVOT条件

Proofは動くが、LatencyとMemoryのFrontierが安定しない場合はOutcomeを再検討する。

候補は次のとおり。

- First Proof Latency 対 Burst Throughput
- p95 Latency 対 OSで測ったCPU Time

実際のMemoryを測れない場合に、Worker数などの設定値をMemoryと呼んではいけない。

### STOP条件

正直な独立Tradeoffが存在しない場合は、Competition化を中止する。

その場合も、Secret GateとClient-side Proving Benchmarkは残し、Tradeoffが確認できなかった結果も公開する。

## 18. 段階1 — Secret Gateの最小版

基本的な証明の技術検証が動けば開始できる。競技のGO判定は必須ではない。

### PackageとProtocol

- [x] Semaphore dependencyとローカル配信artifactを固定する
- [x] Gate、Group Snapshot、Proof Request、Proof Response、ReceiptのSchemaを作る
- [x] message、scope、epoch、Root有効期間、Hash方式を仕様化する
- [x] Semaphore ProofとPublic Signalsを検証する
- [x] Redis nullifier reservationと同じContractを持つLocal Test Adapterを作る

### Browser

- [x] Secret Gate Pageを追加する
- [x] Demo Identityを端末内で生成する
- [x] Identityを保存する場合は、ユーザーが明示的に選べるようにする
- [x] Identity CommitmentだけをGroupへ登録する
- [x] Web WorkerでProofを生成し、UIを停止させない
- [x] Progress、Cancel、Retry、Success、失敗理由を表示する
- [x] 登録前にSynthetic GroupとPrivacyの限界を説明する
- [x] 最初に読みやすいReceiptを表示し、技術詳細は展開式にする

### APIとStorage

- [x] Group Enrollment APIを作る
- [x] Group Snapshot APIを作る
- [x] Gate Entry APIを作る
- [x] 信頼していないRootと期限切れRootを拒否する
- [x] wrong messageとwrong scopeを拒否する
- [x] 同一nullifierの同時利用を必ず1件だけ成功させる
- [x] 本番でRedisやProof設定がなければfail closedにする
- [x] Public APIをOpenAPIへ記載する

### Test

- [x] scope、message、epoch、hash derivationのUnit Test
- [x] 正常なGate Entry Test
- [x] 主要なNegative Test
- [x] Local Adapterのnullifier同時利用Test
- [ ] Browser Reload、Worker Failure、CancelのTest
- [x] DesktopとMobileのBrowser確認
- [x] Console Error確認
- [x] SecretやProofがLogへ漏れていないか確認

## 19. 段階2 — 管理された実行戦略の競技

段階0が`GO`になった場合だけ開始する。評価軸を変更した場合は、新しい評価軸で再度GO条件を満たす必要がある。

- [ ] 有効だったStrategy項目だけをv1 Schemaへ入れる
- [ ] `apps/runner`に制限付きInterpreterを作る
- [ ] Training Workload、Context、Limit、Baseline、再現Commandを公開する
- [ ] Personal Device PracticeとOfficial EvaluationをUIとDataの両方で分ける
- [ ] Strategy Submission、Revision History、Final Entryを追加する
- [ ] Controlled RunとRunner Health Evidenceを追加する
- [ ] Raw EvidenceとAggregate Evidenceを出力する
- [ ] 既存のParetoとContribution処理を再利用する
- [ ] Instant Privacy Poolを実装する
- [ ] Accessible Privacy Poolを実装する
- [ ] 実測で正当化できた場合だけFrontier Expansion Poolを実装する
- [ ] Arena RegistryとWorkbench Adapterへ追加する
- [ ] HumanとAI Agent向けStarter Kitを公開する
- [ ] Tie、Rounding、Allocationの決定論的Testを追加する
- [ ] Raw Timingが決定論的であるかのような処理を入れない

Participant Uniqueness、Hidden Final、Runner Trustが未完成の間は、Controlled Practice Competitionと明記する。

## 20. 段階3 — Sepoliaでの検証と報酬処理

off-chain Gateが安定し、Evidence表示が正しくなってから開始する。

- [x] Semaphore Verificationを呼ぶ最小`SecretGate` Wrapper Contractを作る
- [x] ContractがGroup、message、scopeのPolicyを確認できるようにする
- [x] nullifier使用をon-chainへ記録するState-changing Validationを使う
- [x] 必要最小限のPublic Fieldだけを持つ`GateEntered` Eventを出す
- [x] valid proof、bad root、bad scope、nullifier再利用のContract Testを作る
- [ ] 再現可能なScriptでSepoliaへDeployする
- [ ] DeploymentとTransaction Evidenceを`Docs/deployments/`へ保存する
- [ ] 実在するReceipt、Block、Event、Contractを確認できる場合だけon-chain verifiedと表示する
- [ ] Gate Proof EvidenceとBenchmark Result Evidenceを分ける
- [ ] Competition報酬は既存`FrontierRewardPool`を再利用する
- [ ] ZK ProofがBenchmark Resultの正しさまで証明するとは言わない

## 21. AI競技と呼べる条件

16通りを全探索する段階0は、AI競技と呼ばない。

Phase 2完成後は、まず「AI-assisted strategy challenge」と表現する。次を満たした場合にだけAI Competitionへ進める。

- 公開された評価回数だけでは単純な全探索が難しいStrategy Spaceがある
- HumanとAI Agentが同じSchemaとLimitを使う
- Public Training WorkloadとFinal Workload Policyがある
- Strategyの複雑さと評価回数に上限がある
- 測定OutcomeだけがValue Pool Allocationを決める
- AI名、説明文、利用ToolはProvenanceでありReward Signalではない
- 任意の未信頼コードを実行しなくてもCompetitionが成立する

## 22. 文書の更新

実装より先に「完成した」とDocsへ書かない。各機能が確認できた段階で更新する。

- [x] Phase 1実装時に`Docs/product/arenas/secret-gate.md`を追加する
- [x] Active Arenaになった時点で`Docs/PRODUCT.md`を更新する
- [x] Observational BenchmarkのEvidenceとTrust Boundary実装後に`Docs/ARCHITECTURE.md`を更新する
- [x] Semaphore artifact、Runner、Redis、Sepoliaの状態を`Docs/INTEGRATIONS.md`へ記載する
- [x] 検証済みDemo手順を`Docs/hackathon/DEMO.md`へ追加する
- [x] 各Phase判定後に`Docs/STATUS.md`を更新する
- [x] Public JourneyのDeploy後にだけroot `README.md`を更新する
- [x] 完了または中止後、このPlanを`Docs/development/plans/`へ移す

## 23. 全体の検証

最終的な統合時には、通常Checkを実行する。

```bash
pnpm env:check
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test:ts
pnpm test:contracts
pnpm --filter @frontier/web build
```

Secret Gate固有の確認も行う。

- 固定ChromiumでのProof生成
- DesktopとMobileの操作
- Browser Console Error
- Worker LifecycleとUI Response
- Redisに対するnullifier同時利用
- 固定RunnerでのBenchmark再現
- Raw EvidenceからAggregateを独立再計算
- Secret、環境変数、LogのLeak確認
- Phase 3でのみSepolia Transaction確認

## 24. 計画8の完了条件

次をすべて満たしたときだけPlan 8を完了とする。

1. 本物のSemaphore Proofを端末内で生成し、Gate Policyに従って検証できる。
2. Browser Identity Secretが定めた端末境界を越えない。
3. wrong root、scope、message、proof、reused nullifierを拒否できる。
4. 公式測定ContextとRaw Evidenceを再現・Downloadできる。
5. 実測値を決定論的な値と誤表示していない。
6. Phase 0の結果が否定的でも、正直に判断を記録している。
7. 安定して独立測定できるOutcomeだけにValue Poolがある。
8. Weighted Overall Scoreが存在しない。
9. Personal Device結果とOfficial Runner結果が明確に分かれている。
10. off-chain、on-chain、measured、committed、paidの表示がEvidenceと一致している。
11. Docs、API、Test、Public UIの説明が一致している。
12. 未完成のProduction Tournament機能を明示している。

## 25. 最初に実行する順番

最初の実装では、次の6項目だけに集中する。

1. `packages/secret-gate`に小さなPoCを作る。
2. Semaphore packageとProof artifactを固定する。
3. 対象ChromiumでProofを1件生成し、検証する。
4. Proof生成をWeb Workerへ移す。
5. Cold Run 1件とBurst 6件の時間・OSレベルMemoryを測る。
6. Schemaや完成UIを広げる前に、問題点と測定Varianceを記録する。

この順番にする理由は、最も危険な次の2点を最初に確認するためである。

- このRepositoryとBrowser環境で、本物のSemaphore Proofが正しく動くか。
- Secret Gateを無理なくCompetitionにできる、本物のOptimization Problemが存在するか。
