# 3. Shared Evidence, Value Pools, and Pareto

## 3.1 Weighted averages conceal value judgments

Assigning weights to several metrics and reducing them to one score makes comparison easy. It also embeds the values of whoever selected those weights into the entire market.

A total score composed of 40% cost, 35% resilience, and 25% fairness is not neutral. The allocation decision was made when those percentages were chosen.

Value Decentralization keeps outcomes independent and allows different funders or communities to maintain separate Value Pools.

## 3.2 The Pareto Frontier preserves alternatives

Artifact A dominates Artifact B when A is at least as good as B on every outcome and strictly better on at least one. The Pareto Frontier is the set of artifacts that are not dominated by any other artifact.

It allows the cheapest, most resilient, fairest, and differently balanced approaches to remain visible at the same time.

Being on the frontier does not mean that an artifact is socially correct or automatically deserves funding. Pareto analysis preserves alternatives; it does not supply the value judgment itself.

## 3.3 Apply Hard Constraints first

If correctness, safety, minimum protections, or fundamental rights are treated as ordinary outcomes, the system may permit exchanges such as sacrificing safety for speed.

Value Decentralization first applies Hard Constraints and compares only the artifacts that satisfy them.

| Layer | Role | Example |
| --- | --- | --- |
| Hard Constraint | Pass or fail; not tradable | correct state, budget limit, minimum protection, safety |
| Outcome | Measured independently | cost, delivery, coverage, gas, carbon |
| Context | Conditions under which the result is valid | scenario, dataset, compiler, region |
| Evidence | Material used to reproduce or audit a result | trace, hash, bytecode, transaction |
| Value Pool | A rule that converts evidence into support | resilience, efficiency, fairness |

## 3.4 Independent Value Pools

A Value Pool publishes at least:

- the identity of the funder or community;
- a statement of the value it intends to support;
- a deterministic allocation rule;
- a budget;
- the context it references;
- a Manifest Hash; and
- whether the pool is Practice or Committed.

In the current 72-Hour Disaster Response demonstration, four pools independently evaluate the same seven-scenario evidence.

| Value Pool | Public value | Allocation rule |
| --- | --- | --- |
| Global Relief Fund | Deliver more even under the worst disruption | maximize worst-case delivered kits |
| Donor Efficiency Pool | Reduce spending among correct strategies | minimize qualified total cost |
| Local Communities Pool | Protect the most underserved region | maximize worst-region coverage |
| Frontier Expansion Pool | Create a new tradeoff | allocate proportionally to positive exclusive contribution |

Each pool contains 2,500 FDT demo credits. Resilience Mesh, Budget Sprint, and Fair Reach can receive different pools simultaneously, while the Frontier Expansion Pool can split across several positive contributors. There is no global winner.

## 3.5 Frontier Contribution is one rule

The Frontier Expansion Pool defines a candidate’s exclusive contribution as the normalized hypervolume lost when that candidate is removed from the complete field.

```text
exclusive[i] = HV(all results) - HV(all results without i)

weight[i]
  = exclusive[i]
  × reproducibilityFactor[i]
  × evidenceFactor[i]

reward[i]
  = pool × weight[i] ÷ Σ weight[j]
```

Incorrect candidates and baselines receive no contribution reward. Integer remainders are distributed deterministically by eligible weight and participant ID.

This formula does not govern every Value Pool. Resilience, efficiency, and fairness pools each use their own public rule.

## 3.6 Who decides what matters?

Value Decentralization does not automatically discover the correct social metrics. Selecting metrics, bounds, constraints, contexts, and budgets is itself an exercise of power.

At minimum, the following must remain visible:

- who created the Value Pool;
- which value they stated an intention to support;
- what is measured and what is omitted;
- under which conditions the rule may change; and
- whether another community can create a different pool.

{% hint style="info" %}
Value Decentralization does not decentralize the existence of evidence. It decentralizes the value judgments that turn evidence into capital allocation.
{% endhint %}
