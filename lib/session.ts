// Session/identity for the wallet-first MVP.
//
// Fobs is wallet-first: identity is the connected BNB address. There is no
// password and (for the MVP) no mandatory X login — the client sends its
// connected `walletAddress`, and the server upserts a User keyed on it. This is
// deliberately light: enough to own trades/posts, not a full auth system.
//
// A username/displayName is derived from the address on first sight and can be
// edited later via the profile route.

import "server-only";
import { prisma } from "./db";
import { shortAddress } from "./format";

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export function isAddress(value: unknown): value is string {
  return typeof value === "string" && ADDRESS_RE.test(value);
}

function deriveUsername(address: string): string {
  // Stable, readable handle from the address tail; the user can rename later.
  return `fobs_${address.slice(2, 6)}${address.slice(-4)}`.toLowerCase();
}

/** Resolve (or create) the User that owns actions from this wallet. */
export async function resolveUser(walletAddress: string) {
  if (!isAddress(walletAddress)) throw new Error("A valid BNB wallet address is required");
  const address = walletAddress.toLowerCase();
  return prisma.user.upsert({
    where: { walletAddress: address },
    update: {},
    create: {
      walletAddress: address,
      username: deriveUsername(address),
      displayName: shortAddress(address)
    }
  });
}
