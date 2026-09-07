# Ledger runner security

Attestations use `@ledgerhq/device-signer-kit-ethereum` 1.18.0 and its `signTypedData` EIP-712 flow. The adapter serializes Ledger `{r,s,v}` into the 65-byte EVM signature format and the runner recovers the address before matching it to ENS.

Install Wallet CLI 2.1.0 and verify the device:

```bash
pnpm add -g @ledgerhq/wallet-cli@2.1.0
wallet-cli genuine-check --output json
wallet-cli ring init
wallet-cli ring encrypt -i runner-credential.txt -o runner-credential.enc --key frontier-runner-submit
wallet-cli ring keys --output json
```

Do not let an agent choose, type, print, or persist the ring password. Supply `WALLET_PASS` to the host process from the OS keychain. Never commit the plaintext credential or decrypted temporary file. Configure `LEDGER_RING_FILE`, `LEDGER_RING_KEY`, `LEDGER_SIGNING_MODE=dmk`, and the Ledger derivation path locally.

The Key Ring credential is scoped only to runner result submission. A decrypt failure stops before signing/submission. Production rejects development signing. The explicit local escape hatch requires all three of `NODE_ENV=development`, `LEDGER_SIGNING_MODE=development`, and `ALLOW_INSECURE_LOCAL_SIGNER=true`; it is excluded from the demo path.

The manual `ledger-runner.yml` workflow requires a physically controlled self-hosted runner labelled `ledger-frontier`. Live enrollment, genuine-check, signature, and recovered-address evidence is pending a device.
