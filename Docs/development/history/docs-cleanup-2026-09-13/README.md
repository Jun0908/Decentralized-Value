# Documentation cleanup: original source records

Snapshot date: 2026-09-13, before the reader-facing English cleanup. These files preserve the original mixed-language descriptions, chronological working notes, unfavorable results, failed attempts and dated rule audit. Read [current status](../../../STATUS.md) for the present implementation boundary.

Current English editions reorganize chronology and remove contradictory obsolete status from the primary reading path. They are consolidated translations, not line-for-line replacements. The source records are retained unchanged so editorial decisions are inspectable.

Video-production and owner-operation source copies are retained locally under Git-ignored `Docs/local-only/source-copies/`. Their hashes remain in this manifest; public implementation details and evidence remain in the [submission verification](../../../hackathon/submission/RESCUE_HANDOFF.md) and [sponsor guide](../../../hackathon/sponsors/SPONSOR_DEMO.md).

## Byte-identical source manifest

Algorithm: SHA-256. `.gitattributes` disables text conversion for these files. Their `.md.txt` suffix intentionally exposes original Markdown as raw historical source, not as a page with misleading relative links.

| Original source                               | Raw original                                                | SHA-256                                                            |
| --------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------ |
| `Docs/product/arenas/rescue-room.md`          | [Original](originals/arenas--rescue-room.md.txt)            | `b0ae3afb38432c29ced451f1ec53fbb81d8ed3210c37a08de451d106ff630d70` |
| `Docs/HACKATHON_SUBMISSION.md.txt`            | [Original](originals/HACKATHON_SUBMISSION.md.txt)           | `8d329c2c6ba058d2c8dd3a435e7b9dce0dc372e4d9c0d84d281ae6af4dc82577` |
| `Docs/INTEGRATIONS.md.txt`                    | [Original](originals/INTEGRATIONS.md.txt)                   | `5de4c21647d0f6c96908766fc74ed674a97b0cd8d2d4eb7c2eca34f46ba258d4` |
| `Docs/RESCUE_AGENT_QUICKSTART.md.txt`         | [Original](originals/RESCUE_AGENT_QUICKSTART.md.txt)        | `0e3cec48fe8363ed4a3045b4185fb26703059498d122380211989c779608b799` |
| `Docs/RESCUE_EXECUTION_BATCH.md.txt`          | [Original](originals/RESCUE_EXECUTION_BATCH.md.txt)         | `8646def2aa0317cacc0f17b17972c875b579b93ea9533938104d41f1a62973d2` |
| `Docs/RESCUE_HANDOFF.md.txt`                  | Recording copy retained locally                             | `5999f2637f2cdfeaabcd8884562c6eca960185cb79ac257ab9bd79ee974bf93a` |
| `Docs/RESCUE_INFORMATION_STUDY.md.txt`        | [Original](originals/RESCUE_INFORMATION_STUDY.md.txt)       | `7f9a63040c4b1ab398808bf12cf8a225d9534a49b0739ea7432214d19be72f4e` |
| `Docs/STATUS.md.txt`                          | [Original](originals/STATUS.md.txt)                         | `b2d6c7ee7eb2c382d9ad00978466a74e2e462c3c9039997b04f47c8f861ba29f` |
| `Docs/sponsors/BAZANTIC_RESCUE_LIVE.md.txt`   | [Original](originals/sponsors--BAZANTIC_RESCUE_LIVE.md.txt) | `a00db3488f7f834ad16b2c6c2a72e74e3e6292473a69a3291805fa9be565b448` |
| `Docs/sponsors/MANUAL_ACTION_REQUIRED.md.txt` | Operator copy retained locally                              | `7cabda19164d6fcb51337f8b2e5517792751fd5f13fca42d64cce85dc6975b0a` |
| `Docs/sponsors/SPONSOR_DEMO_RECORDING.md.txt` | Recording copy retained locally                             | `69f6ee2c27842b6291d7e5e1c46c570bec6bc0c4093abd325058fbee294408a9` |
| `Docs/sponsors/agent-api.md.txt`              | [Original](originals/sponsors--agent-api.md.txt)            | `7fe3bcc2e99161f8d294003c4c7c7c818523879bfced31fd8dbfe3c84889ae7c` |
| `Docs/sponsors/chainlink-cre.md.txt`          | [Original](originals/sponsors--chainlink-cre.md.txt)        | `4f453a5cc6a030f70407531dddb2a23dee1717d514974c4341b3ced6791e2edf` |

An original statement such as “not deployed” or a historical login failure describes its dated batch, not a new current failure. Neither these originals nor editorial cleanup certify event eligibility, current provider pricing or a completed tournament.

The earlier eleven Plan originals have their own [independent snapshot manifest](../plan-history-2026-09-13/README.md).
