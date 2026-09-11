import { randomUUID } from "node:crypto";
import { Entry } from "@napi-rs/keyring";

const entry = new Entry("frontier-cli-test", `local-test-${randomUUID()}`);
const synthetic = `synthetic-${randomUUID()}`;
try {
  entry.setPassword(synthetic);
  if (entry.getPassword() !== synthetic) throw new Error("Credential roundtrip failed");
  entry.deletePassword();
  if (entry.getPassword() !== null) throw new Error("Credential deletion failed");
  console.log("OS keychain synthetic write/read/delete passed; no token printed.");
} finally {
  entry.deletePassword();
}
