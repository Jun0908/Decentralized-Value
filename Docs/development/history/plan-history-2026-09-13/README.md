# Original Plan Records — 2026-09-13 Snapshot

This folder now distinguishes **link-repaired reading copies** (`.md` at this level) from **byte-identical original snapshots** (`originals/*.md.txt`). The original snapshots were taken immediately before the consolidated English plans and include then-uncommitted working-tree updates.

The original bytes and SHA-256 values below are unchanged. Reading copies received relative-link corrections only, so they can be navigated at their archived location. Their bytes no longer match the original snapshot hashes. No experimental outcome, failed run, acceptance criterion or execution log was rewritten in those reading copies.

For current scope, use the [English plan index](../../plans/README.md), [status](../../../STATUS.md) and [production follow-up](../../../evidence/verification/PRODUCTION_READINESS_2026-09-13.md). This archive is not an active requirement.

## Original integrity manifest

Algorithm: SHA-256. Hashes refer **only to the original raw-text files**, not to the link-repaired Markdown copies. The `.txt` suffix keeps original relative Markdown syntax as source material instead of pretending that it resolves from a different directory.

| Original source path                | Byte-identical original                              | Link-repaired reading copy         | Original SHA-256                                                   |
| ----------------------------------- | ---------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------ |
| `Docs/Plan9.md`                     | [Original](originals/Plan9.md.txt)                   | [Read](Plan9.md)                   | `667fafeb3d7334671ad8d2dd723eba66bd51c281e334bef3b2bd9e964c4d267e` |
| `Docs/Plan10.md`                    | [Original](originals/Plan10.md.txt)                  | [Read](Plan10.md)                  | `545204af2b0c2a6508a4de3756e4d9a78f768a94117a77a6ccc656cdb00d3929` |
| `Docs/Plan11.md`                    | [Original](originals/Plan11.md.txt)                  | [Read](Plan11.md)                  | `bd4c7536a135dc5b9ff359b565cd44c8cfd00cd4dd8d2792d92df2956d9d34f7` |
| `Docs/Plan12.md`                    | [Original](originals/Plan12.md.txt)                  | [Read](Plan12.md)                  | `1e55461410adf632a0968234a7a3919b696a5905301d2e567b267231330209c2` |
| `Docs/Plan-Calldata.md`             | [Original](originals/Plan-Calldata.md.txt)           | [Read](Plan-Calldata.md)           | `99dcfa33ba8affa0ec6f1e71e123f6ad282f74fe29ef1154f077cd6bf1e5a41f` |
| `Docs/Plan-Microgrid.md`            | [Original](originals/Plan-Microgrid.md.txt)          | [Read](Plan-Microgrid.md)          | `54ab372b70ace92f5b6bf09d2108f66d872fa4a41161f9c51ba61d4f8365cf34` |
| `Docs/Plan-SecretGate.md`           | [Original](originals/Plan-SecretGate.md.txt)         | [Read](Plan-SecretGate.md)         | `134c37c3368af801992438880677ec9a8a231291fc8e387e2f0a521710a0a4c3` |
| `Docs/PARALLEL_IMPLEMENTATION.md`   | [Original](originals/PARALLEL_IMPLEMENTATION.md.txt) | [Read](PARALLEL_IMPLEMENTATION.md) | `2f1263cb698733d6b1d45a4c8a4e61ee97dd8d7b2129391cefb020b8af61a4b2` |
| `Docs/NEXT_UNATTENDED_BATCH.md`     | [Original](originals/NEXT_UNATTENDED_BATCH.md.txt)   | [Read](NEXT_UNATTENDED_BATCH.md)   | `dbe7726544d07d72c7c9eb4c774fb9513c932da79e85ad3aa6447ccad32277e0` |
| `Docs/plans/ocean-commons-merge.md` | [Original](originals/ocean-commons-merge.md.txt)     | [Read](ocean-commons-merge.md)     | `da2289a070ae81562de15f867ccb9e565cd1d9285bb23910e0d44f851fce5a8b` |
| `Docs/plans/dv-ver2-integration.md` | [Original](originals/dv-ver2-integration.md.txt)     | [Read](dv-ver2-integration.md)     | `a26ab98cde3a10c840482200ca42a81749cd79f06d1b66f6ea91c657915b4130` |

## Historical section references

Original source-relative paths remain visible in the raw files. Reading-copy links resolve from this archive and historical Plan-to-Plan links stay within these historical editions where applicable. Current implementation must be checked against STATUS, not inferred from an old checkbox.

Older code/comments referring to numbered Plan 9–12 sections refer to these historical editions. Current English editions have reorganized sections. Link repair does not reopen completed or superseded requirements.
