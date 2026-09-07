# フロントエンドと White Paper の差分分析

**対象**: `apps/web` 全ソース
**基準**: `Docs/Value_Decentralization_Whitepaper_JP.pdf`（`tmp/pdfs/whitepaper/` p.5〜20）
**作成日**: 2026-09-07

---

## 結論

フロントエンドは White Paper の5層（思想 → 工学 → プロトコル → 市場 → 実証領域）のうち、
**一番下の「Frontier Arenas（実証領域）」だけを実装しており、その上の「Frontier Markets（市場）」層が丸ごと存在しない。**

以下、重要度順に指摘する。

---

## 1. 最重要：「市場」が無い。あるのは「練習場」だけ

WP §5 のフローは **Challenge → Artifact → Runner → Attestation → Frontier → Settlement** の6段。
フロントの [arena-page-shell.tsx:44-66](../apps/web/src/components/arena-page-shell.tsx#L44-L66) は
**Build → Measure → Expand** の3段しかなく、後半3段（Attestation / Frontier更新 / Settlement）が UI から消えている。

[arenas.ts:37](../apps/web/src/lib/arenas.ts#L37) では全アリーナが以下のようにハードコードされている。

```ts
participation: "Open practice",
deadline: "No deadline",
reward: "No practice reward",
```

つまり **Challenge Sponsor が存在しない**。
WP §5.1 の「スポンサーは正解ではなく可能領域を買う」という中心命題が、画面上に一切現れない。

## 2. Frontier Contribution（限界貢献）が測られていない

WP §5.2 の概念式が本質。

```
Reward = Pool × Normalized Frontier Contribution × Reproducibility Factor × Evidence Factor
```

WOW Moment（p.9）は「**拡張した面積に対して資金が払われる**」こと。

一方フロントは [supply-allocation-demo.tsx:314](../apps/web/src/components/supply-allocation-demo.tsx#L314) の
`evaluation.pareto.frontier` による **Frontier / Dominated の二値表示**のみ。「どれだけ広げたか」が出ない。

`hypervolume` / `contribution` はリポジトリ全体（contracts、shared、api を含む）で1箇所もヒットしない。
**WP の一番の売りが未実装。**

## 3. Context が第一級オブジェクトになっていない

WP §3.1 は「重要な設計原則」として枠囲みまでして
**「Artifact をランキングするのではなく、特定 Context における Artifact の Outcome を登録する」**と宣言している。

フロントの Context は [supply-allocation-demo.tsx:276](../apps/web/src/components/supply-allocation-demo.tsx#L276) の
`<p className="hash">context {scenario.contextHash}</p>` という**ハッシュ1行の表示だけ**。

- Context の切替が無い
- Context 別 Frontier の比較が無い
- Context の version 管理が無い

結果として WP §8.2「EVM Design Registry で用途に合う非支配解を選ぶ」体験がゼロ。

## 4. Evidence Level（0〜4）が完全に欠落

WP §12.1 は5段階を定義し、**「同一レベル・同一 Context でのみ比較する」**としている。

| Level | 名称 | 内容 | 主な報酬 |
|---|---|---|---|
| 0 | Synthetic Simulation | 合成人口・仮想環境 | 設計報酬 |
| 1 | Historical Replay | 過去データで Rule を再生 | 再現性報酬 |
| 2 | Controlled Micro-Pilot | 限定地域・限定人数で実証 | Pilot 運営報酬 |
| 3 | Independent Replication | 独立主体・別地域で再現 | Replication 報酬 |
| 4 | Operational Deployment | 実運用と継続監査 | 導入・保守報酬 |

フロント側の該当表現は [sponsor-debug/page.tsx:76](../apps/web/src/app/sponsor-debug/page.tsx#L76) の
`Evaluation: Simulated public demo` の一語のみ。
Evidence バッジも、レベル別の分離も、Replication 報酬も無い。
社会領域へ移る時に最も効く差別化要素なのに UI に存在しない。

## 5. 再現性の柱（3 Runner 閾値署名）が評価フローから切れている

WP §7.2 は「3 Runner の閾値署名で Benchmark Attestation を確定」「Challenge 時は別 Runner で再実行し bond を slash」と規定。

- [runners/page.tsx](../apps/web/src/app/runners/page.tsx) の ENS discovery は実装済み（fail-closed も良い）
- しかし実際の評価 `/v1/emergency-supply/evaluations` は**単一サーバ計算**で、署名も複数 Runner 一致も無い
- [artifact/[id]/page.tsx:88-96](../apps/web/src/app/artifact/[id]/page.tsx#L88-L96) は
  `Runner ENS: Not attested` / `Signature: Not available` と正直に書いてあり、
  **この2つが構造的に接続されていない**ことを裏付けている

さらに WP §7.3 の共通コントラクト7本のうち、
`RunnerBond.sol` / `ChallengeManager.sol` / `ArtifactRoyalty.sol` の**3本が `packages/contracts/src/` に存在しない**。

## 6. 9ロールのうち1ロールしか居ない

WP §5.3 + p.9 は以下の9ロールと各々の収益を定義している。

Challenge Sponsor / Builder・Rule Designer / Benchmark・Context Author / Runner Operator /
Constraint・Rights Author / Challenger / Curator / Replicator / Adopter

フロントに存在するのは実質 **Builder だけ**。
特に Challenger は、API 側に `/v1/challenges/:id/disputes`（[apps/api/src/index.ts:218](../apps/api/src/index.ts#L218)）が
実装済みなのに、**UI から到達する導線が一切無い**。

## 7. 2軸に型レベルで固定されている

[arenas.ts:11-14](../apps/web/src/lib/arenas.ts#L11-L14) の `metrics` はタプル型で**厳密に2要素**。

```ts
metrics: readonly [
  { name: string; direction: "Minimize" | "Maximize"; unit: string },
  { name: string; direction: "Minimize" | "Maximize"; unit: string },
];
```

WP は Outcome Vector（n軸）と Hypervolume を前提としており、3軸以上の Frontier に拡張できない。
チャート（`SupplyFrontierChart`、`FrontierChart`）も2D散布図べた書き。

## 8. Social Frontier が丸ごと無い（WP の分量最大の部分）

WP §10〜§12（p.13〜16）は以下6領域を具体的な数値表つきで展開している。

Humanitarian Aid / Public Procurement / Platform Dispatch / Energy Justice / Emergency Coverage / Social Housing

フロントの2アリーナのうち `emergency-supply` は WP §11.2 の公共調達 Frontier
（調達費用 × 供給レジリエンス、Single Winner / Equal Split / Resilient Lots）に近い形をしている。
しかし **WP §10.1 の `SocialRuleArtifact` 型**が持つべき

```ts
appealProcess: AppealPolicy;
transitionPolicy: TransitionPolicy;
evidenceRequirements: EvidencePolicy;
```

がどこにも無い。
WP §12.2 が「Rule Artifact の必須要素」と定めた**異議申立て・説明・opt-out・移行期間**が UI にゼロ。
技術ベンチマークとしては成立しているが、Social Rule Artifact にはなっていない。

## 9. 「第三者が別 Frontier を作れる」が示せていない

WP §8.4 の枠囲みは、ETHGlobal で残す公共財を「UI よりも Schema / Settlement / Attestation / Adapter / SDK」と明言。
WP §9.1 は「第二 Adapter を20秒で見せる」ことで汎用 Funding Primitive であることを証明するとしている。

しかしフロントは —

- [arenas.ts:2](../apps/web/src/lib/arenas.ts#L2) で `slug: "emergency-supply" | "calldata-compression"` と union 型に閉じている
- [arenas/[slug]/page.tsx:31-45](../apps/web/src/app/arenas/[slug]/page.tsx#L31-L45) は
  `if (arena.kind === "supply")` の分岐でコンポーネントを出し分けている

**新しい Arena は必ずコード修正が必要**で、「レジストリから生成されるので拡張が容易」という
[arenas/page.tsx:28-32](../apps/web/src/app/arenas/page.tsx#L28-L32) の主張は実態と食い違っている。

加えて `packages/sdk/src/index.ts` は**バージョン文字列1行のみ**で、Builder SDK（WP §7.4）が空。

## 10. 共通言語（WP §3）を UI が採用していない

WP §3 は「分野を成立させるための最小語彙」として以下を定義している。

Value Tension / Hard Constraint / Artifact / Context / Outcome Vector /
Pareto Frontier / Frontier Contribution / Evidence Level

フロントはこれを `solution` / `axes` / `practice arena` / `measurement` と一般語に置き換えている。
UX の平易化としては妥当な判断だが、**「分野を作る」という WP の目的とは逆方向**。
少なくとも用語グロッサリへの導線は要る。

## 11. ポジショニングの主張が消えている

WP §15.1 / §16 の核心メッセージ —

> Prediction Markets pay for discovering what is true.
> **Frontier Markets pay for expanding what is possible.**

> 研究用ツールは過去を「再現・説明」する。私たちは**新しいルールを実装する**。

フロントのヒーローは [page.tsx:11](../apps/web/src/app/page.tsx#L11) の "One score should not decide everything."。
これは WP §4.1（加重平均は値を中央集権化する）の1点しか拾えておらず、
**vs 分析SaaS / vs Prediction Market の差別化軸が一切出ていない**。

`ValueOS` という名前も、WP §14 の Phase 1〜4 ロードマップもフロントに存在しない。

---

## 良い点（維持すべき）

- [sponsor-debug/page.tsx:76-88](../apps/web/src/app/sponsor-debug/page.tsx#L76-L88) の
  `Signature: Not claimed` / `Transaction: Optional`
- [runners/page.tsx:70](../apps/web/src/app/runners/page.tsx#L70) の
  "fails closed instead of presenting a fabricated runner"
- [supply-allocation-demo.tsx:387](../apps/web/src/components/supply-allocation-demo.tsx#L387) の
  "no reward transaction is being claimed here"

**証拠水準を偽らない姿勢**は WP §12.1 の Evidence 分離の精神そのもの。ここは絶対に崩さないこと。

- Hard Constraint を Frontier 比較の前に置く構造
  （[supply-allocation-demo.tsx:290-300](../apps/web/src/components/supply-allocation-demo.tsx#L290-L300)）は WP §4.3 に忠実。

---

## 優先度の提案

| 優先 | 埋めるべき差分 | 理由 |
|---|---|---|
| **1** | Frontier Contribution（hypervolume 増分）の計算と表示 | WP の WOW Moment そのもの。ここが無いと「Pareto を見せるダッシュボード」で終わる |
| **2** | Challenge Sponsor 画面（Pool / 期間 / 軸 / Hard Constraint の登録） | 「市場」を名乗る最低条件 |
| **3** | Evidence Level バッジと同一レベル内比較 | 社会領域へ行く時の最大の差別化 |
| **4** | Context セレクタ（Context 別 Frontier） | WP §3.1 の「重要な設計原則」が UI で守られていない |
| **5** | Challenger の導線（API は既にある） | 実装済み資産が死んでいる |
| **6** | n軸対応への型・チャート拡張 | 現状 2軸固定が将来の全拡張を塞ぐ |

まず 1 と 2 だけでも入れれば、「Practice Arena のカタログ」から「Frontier **Market**」へポジションが変わる。
