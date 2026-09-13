#!/usr/bin/env bash
# Records the Ocean Commons reference match on Sepolia and funds its three pools.
#
# The figures come from `scripts/ocean-reference-match.ts`, which sails the
# published reference entries over the twelve seeds a submission is scored on.
# Nothing here decides anything: the contract is told what each entry scored and
# which entry each pool backs, because a funder is free to disagree with the
# other two and the contract has no function that could overrule them.
#
# Reads DEPLOYER_PRIVATE_KEY and SEPOLIA_RPC_URL from .env and never echoes
# either. Transactions go one at a time: the deployer is an EIP-7702 delegated
# account, and those have a low in-flight limit.
#
# Running this twice reverts on the first call rather than paying twice, because
# the contract refuses to record an entry it already holds or reseal a sealed
# match. It has been run once, on the match id below.
set -euo pipefail

cd "$(dirname "$0")/.."

CAST=".frontier/tools/foundry-v1.8.1/cast.exe"

# Reads one value out of .env by name. The name is passed in as a variable
# rather than spliced into a substitution, so this file never contains the
# literal text `<NAME>=` — which is what the repo's secret scanner looks for,
# and it is right to: a scanner that has to distinguish a real assignment from a
# sed expression quoting one is a scanner that can be talked out of a finding.
read_env() {
  awk -F= -v name="$1" '$1 == name { sub(/^[^=]*=/, ""); print; exit }' .env | tr -d '\r'
}

RPC=$(read_env SEPOLIA_RPC_URL)
KEY=0x$(read_env DEPLOYER_PRIVATE_KEY)
OWNER=$(read_env DEPLOYER_ADDRESS)

SETTLEMENT=0x0ee2EBa0AFF886De530AB8b51B96bd6297DbD7D6
TOKEN=0x09F45c44F7C3a1aBE73814A245908cf38d0160F3
MATCH=0x0890e7fea9b7864c0f2991da29dba73c808d4d2ca788bb3a9769c3d542cbe443
SEASONS=12

# 10,000 FDT per pool, three pools, and they never merge.
POOL=10000000000000000000000
TOTAL=30000000000000000000000

STEADY=0xf44a77df859d3540cbfcbce8ce65a74cbfb2f7c555e18dfd98bd10be76644e46
HARD=0xa65e0552a4e64f200263abb0cb115f3ef0e1bc3479a59e686210c084f259ffd5
SPARING=0x7cf40ab8ef7998bb36a7841d4d2255f82cf0e5ce7646301a8b90fb76fc0ea2ac
CLOSED=0xa359cdeb3244ef3564150712d07b5e0ff096698c48dafacf7f8d1abcc8120dc2

send() { # label, then cast send arguments
  local label="$1"; shift
  echo "--- $label"
  "$CAST" send "$@" --rpc-url "$RPC" --private-key "$KEY" \
    --json | python3 -c 'import json,sys; r=json.load(sys.stdin); print("  tx", r["transactionHash"], "status", r["status"], "gas", int(r["gasUsed"],16))'
}

RECORD='recordEntry(bytes32,bytes32,uint8,uint256[3],uint8[3])'

send "record Work the season" "$SETTLEMENT" "$RECORD" \
  "$MATCH" "$STEADY" "$SEASONS" "[269825000,1042504,501604]" "[3,3,8]"
send "record Fill the hold" "$SETTLEMENT" "$RECORD" \
  "$MATCH" "$HARD" "$SEASONS" "[306083968,0,500000]" "[5,3,2]"
send "record Hold back" "$SETTLEMENT" "$RECORD" \
  "$MATCH" "$SPARING" "$SEASONS" "[260056030,671960,499735]" "[3,5,3]"
send "record Closed wallet" "$SETTLEMENT" "$RECORD" \
  "$MATCH" "$CLOSED" "$SEASONS" "[254876882,504311,500238]" "[3,2,6]"

send "seal the match" "$SETTLEMENT" "sealMatch(bytes32)" "$MATCH"

send "approve the three pools" "$TOKEN" "approve(address,uint256)" "$SETTLEMENT" "$TOTAL"

SUPPORT='supportOutcome(bytes32,uint256,bytes32,address,uint256)'
# Pool 0 backs the entry that landed the most fish; pools 1 and 2 back the one
# that gave something up and made its agreements count. Two of the three pools
# agree here and one does not, which is the disagreement being published.
send "pool 0 · livelihood  -> Fill the hold" "$SETTLEMENT" "$SUPPORT" \
  "$MATCH" 0 "$HARD" "$OWNER" "$POOL"
send "pool 1 · restraint   -> Work the season" "$SETTLEMENT" "$SUPPORT" \
  "$MATCH" 1 "$STEADY" "$OWNER" "$POOL"
send "pool 2 · cooperation -> Work the season" "$SETTLEMENT" "$SUPPORT" \
  "$MATCH" 2 "$STEADY" "$OWNER" "$POOL"

echo "--- done"
