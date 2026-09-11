# 8. Evidence and Rights

## 8.1 Evidence Levels

Different kinds of evidence must not be treated as equally strong. The current implementation defines five levels.

| Level | Name | Required Evidence |
| ---: | --- | --- |
| 0 | Synthetic simulation | deterministic public fixture, evaluator version, Result Hash |
| 1 | Recorded observation | timestamped source dataset, provenance, Result Hash |
| 2 | Independent reproduction | two independent runner attestations, matching Outcome Vector |
| 3 | Controlled deployment | controlled environment record, signed evidence, audit trail |
| 4 | Production observation | production telemetry, independent verification, closed dispute window |

The current 72-Hour Disaster Response, Calldata Compression, and Microgrid Dispatch arenas are all published as Level 0. Even though Calldata Compression measures compiled bytecode inside an actual EVM runtime, its evidence classification remains Level 0 within a Practice context.

{% hint style="warning" %}
Simulation, direct measurement, independent reproduction, controlled deployment, and production operation must not all be described with the same word: “verified.”
{% endhint %}

## 8.2 Social Hard Constraints

In social domains, the following must not be traded against performance outcomes:

- fundamental rights and non-discrimination;
- safety and minimum protections;
- the right to appeal and receive an explanation;
- opt-out and transition periods;
- protection of personal and sensitive data; and
- protection against concentrating experimental risk on vulnerable groups.

The system should place aggregate outcomes, commitments, and audit trails onchain—not personal data itself.

## 8.3 Goodhart effects and metric gaming

Once a measurement determines rewards, participants may optimize the metric rather than the real-world purpose. Multiple Value Pools do not eliminate this problem.

Candidate safeguards include:

- fixed versions of metrics and evaluators;
- separation of public training and final workloads;
- adversarial fixtures;
- monitoring of unmeasured outcomes;
- public bounds and normalization;
- third-party reproduction of artifacts and results;
- separation of contexts after benchmark updates;
- dispute and appeal procedures; and
- continued evidence updates after adoption.

## 8.4 Separate the Context Author from the Value Pool Funder

The actor who designs the dataset, metrics, and constraints does not always need to be the actor providing the reward. Separating these roles makes conflicts of interest easier to identify when a funder could otherwise shape the evaluator in its own favor.

Future institutional designs should distinguish at least:

- Context Author;
- Evaluator Maintainer;
- Value Pool Funder;
- Rights Reviewer;
- Independent Replicator;
- Challenger; and
- Adopter.

This is not a claim that all of these roles are decentralized today. It is a proposed separation of responsibilities that Value Decentralization must investigate.

## 8.5 What evidence does not prove

A hash can show that an input has not changed; it cannot prove that the metric is socially valid. An onchain event can show that a payment occurred; it cannot prove that an evaluator accurately represented reality.

Technical verification and social legitimacy must therefore remain distinct.
