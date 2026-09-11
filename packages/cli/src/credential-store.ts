import { CliError } from "./output.js";
import { origin } from "./project.js";

export interface CredentialStore {
  get(origin: string): Promise<string | null>;
  set(origin: string, token: string): Promise<void>;
  delete(origin: string): Promise<void>;
}
export class KeychainStore implements CredentialStore {
  private async entry(baseUrl: string) {
    try {
      const { Entry } = await import("@napi-rs/keyring");
      return new Entry("frontier-cli", origin(baseUrl));
    } catch {
      throw new CliError(
        "CREDENTIAL_STORE_UNAVAILABLE",
        "OS credential store is unavailable; inject FRONTIER_TOKEN and FRONTIER_TOKEN_ORIGIN for headless use",
        5,
      );
    }
  }
  async get(baseUrl: string) {
    try {
      return (await this.entry(baseUrl)).getPassword() ?? null;
    } catch {
      throw new CliError("CREDENTIAL_STORE_UNAVAILABLE", "OS credential store cannot be read", 5);
    }
  }
  async set(baseUrl: string, token: string) {
    try {
      (await this.entry(baseUrl)).setPassword(token);
    } catch {
      throw new CliError(
        "CREDENTIAL_STORE_UNAVAILABLE",
        "OS credential store cannot save the session; no plaintext fallback is used",
        5,
      );
    }
  }
  async delete(baseUrl: string) {
    try {
      (await this.entry(baseUrl)).deletePassword();
    } catch {
      throw new CliError(
        "CREDENTIAL_STORE_UNAVAILABLE",
        "OS credential store could not delete the session",
        5,
      );
    }
  }
}
export async function tokenFor(baseUrl: string, env: NodeJS.ProcessEnv, store: CredentialStore) {
  if (env.FRONTIER_TOKEN) {
    if (!env.FRONTIER_TOKEN_ORIGIN || origin(env.FRONTIER_TOKEN_ORIGIN) !== origin(baseUrl))
      throw new CliError(
        "TOKEN_ORIGIN_MISMATCH",
        "FRONTIER_TOKEN_ORIGIN must match the selected API origin",
        3,
      );
    if (/\s/.test(env.FRONTIER_TOKEN))
      throw new CliError("INVALID_TOKEN", "Injected token contains invalid whitespace", 3);
    return env.FRONTIER_TOKEN;
  }
  return store.get(baseUrl);
}
