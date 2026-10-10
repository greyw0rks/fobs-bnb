// Seed — deliberately minimal and honest.
//
// Fobs derives all social and profitability data from REAL wallet activity, so
// this seed never fabricates traders, trades, holdings or prices. All it does is
// register the owner's own account (keyed on a wallet address you provide) so
// the profile/portfolio screens resolve to a real user before the first trade.
//
// Usage:
//   SEED_ADDRESS=0xYourWallet npm run seed
//   SEED_ADDRESS=0x... SEED_USERNAME=alice SEED_DISPLAY_NAME="Alice" npm run seed
//
// With no SEED_ADDRESS it exits cleanly and seeds nothing — that is the correct
// state, not an error.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

// Mirrors lib/session.ts so a seeded user is identical to one created on first
// wallet connect.
function deriveUsername(address: string): string {
  return `fobs_${address.slice(2, 6)}${address.slice(-4)}`.toLowerCase();
}
function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

async function main() {
  const raw = process.env.SEED_ADDRESS?.trim();
  if (!raw) {
    console.log(
      "[seed] No SEED_ADDRESS set — nothing to seed. Fobs fills its DB from real\n" +
        "       wallet-authorized activity. Set SEED_ADDRESS=0x... to register your\n" +
        "       own account before the first trade."
    );
    return;
  }
  if (!ADDRESS_RE.test(raw)) {
    throw new Error(`SEED_ADDRESS is not a valid BNB wallet address: ${raw}`);
  }

  const address = raw.toLowerCase();
  const username = process.env.SEED_USERNAME?.trim().toLowerCase() || deriveUsername(address);
  const displayName = process.env.SEED_DISPLAY_NAME?.trim() || shortAddress(address);

  const user = await prisma.user.upsert({
    where: { walletAddress: address },
    update: { username, displayName },
    create: { walletAddress: address, username, displayName }
  });

  console.log(`[seed] Registered owner @${user.username} (${shortAddress(address)}). No trades or holdings invented.`);
}

main()
  .catch((error) => {
    console.error("[seed] failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
