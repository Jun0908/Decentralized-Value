# 6. Design Changes for Social Domains

In technical domains, the same bytecode and input can often reproduce the same output. Social outcomes vary with people, place, time, culture, economic conditions, and disaster conditions.

Moving into social domains therefore requires more than transplanting a technical benchmark. Context, evidence, rights, and accountability must all be expanded.

## 6.1 What remains shared and what changes

| Technical domain | Social domain |
| --- | --- |
| An artifact is code, an encoding, or a configuration | An artifact is a strategy or executable rule |
| Context is a workload, compiler, or EVM revision | Context is a population, budget, geography, period, or institutional environment |
| An evaluator is a test, compiler, or EVM | An evaluator is a simulation, replay, or pilot analysis |
| Correctness concerns state, digests, or proof validity | Constraints include rights, safety, law, and minimum protections |
| Outcomes include gas, bytes, and latency | Outcomes include cost, coverage, exclusion, and resilience |
| Reproduction uses the same execution environment | Reproduction may require another actor, period, or region |

The shared component is not one common value function. It is the ability to publish manifests, contexts, outcomes, and evidence—and to trace who applied which Value Pool rule.

## 6.2 Social Rule Artifact

An artifact in a social domain requires more than a decision rule. It must also describe appeal and transition procedures.

```typescript
type SocialRuleArtifact = {
  ruleVersion: string;
  contextSchema: ContextSchema;
  hardConstraints: Constraint[];
  outcomeMetrics: OutcomeMetric[];
  appealProcess: AppealPolicy;
  transitionPolicy: TransitionPolicy;
  evidenceRequirements: EvidencePolicy;
};
```

## 6.3 Shared evidence and different forms of legitimacy

The same evidence can support different priorities in different communities.

- A disaster-relief organization may prioritize worst-case delivery.
- A donor may prioritize cost after minimum delivery and fairness requirements are satisfied.
- A local community may prioritize coverage in the most underserved region.
- A research fund may prioritize artifacts that create new tradeoffs.

Value Decentralization does not combine these priorities into one score. It also does not legitimize every rule without limits. Shared Hard Constraints and rights review remain necessary.

## 6.4 Compete over rules, not people

The subjects of comparison are not citizens, patients, workers, or regions. What is compared is the rule or strategy used to reconcile speed, fairness, resilience, burden, and inclusion under the same resource constraints.

To avoid imposing the cost of failed rules on vulnerable people, the system distinguishes Synthetic Simulation, Recorded Observation, Independent Reproduction, Controlled Deployment, and Production Observation.

{% hint style="danger" %}
**People are not the object of competition. Rules are.**

Rights, safety, and minimum protections must be satisfied as Hard Constraints before performance outcomes are compared.
{% endhint %}
