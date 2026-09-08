import "server-only";

import { verifyAccessToken, verifyIdentityToken } from "@privy-io/node";
import type { Plan5IdentityResolver } from "@frontier/api";
import { getAddress } from "viem";

function bearer(request: Request) {
  const header = request.headers.get("authorization");
  return header?.startsWith("Bearer ") ? header.slice(7) : null;
}

export function createPrivyIdentityResolver(): Plan5IdentityResolver | undefined {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const verificationKey = process.env.PRIVY_VERIFICATION_KEY?.replaceAll("\\n", "\n");
  if (!appId || !verificationKey) return undefined;

  return async (request) => {
    const accessToken = bearer(request);
    const identityToken = request.headers.get("x-privy-identity-token");
    if (!accessToken || !identityToken)
      throw new Error("Your Privy session is missing. Sign in again.");

    const [claims, user] = await Promise.all([
      verifyAccessToken({
        access_token: accessToken,
        app_id: appId,
        verification_key: verificationKey,
      }),
      verifyIdentityToken({
        identity_token: identityToken,
        app_id: appId,
        verification_key: verificationKey,
      }),
    ]);
    if (claims.user_id !== user.id) throw new Error("Privy token identities do not match");

    const ethereumWallets = user.linked_accounts.filter(
      (account) => account.type === "wallet" && account.chain_type === "ethereum",
    );
    const embedded = ethereumWallets.find(
      (account) => "connector_type" in account && account.connector_type === "embedded",
    );
    const wallet = embedded ?? ethereumWallets[0];
    if (!wallet) throw new Error("No Ethereum reward wallet is linked to this account");

    return { userId: user.id, wallet: getAddress(wallet.address) };
  };
}
