// On-chain holdings — reads the connected wallet's ACTUAL tokenized-stock
// balances directly from BNB Smart Chain (ERC-20 balanceOf), independent of the
// Fobs DB. This is the "verify on-chain" half of the loop: a wallet that holds
// NVDAon shows NVDA even if it never traded through Fobs.
//
// Cost basis is deliberately NOT invented here — on-chain balances carry no
// entry price, so value is shown but P&L is left to the DB-mirrored path.

import "server-only";
import { createPublicClient, http, getAddress } from "viem";
import { bsc } from "viem/chains";
import { getLiveTokens } from "./assets";
import { providerLabel } from "./assets-registry";
import type { WalletBalance } from "./types";

const ERC20_BALANCE_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }]
  }
] as const;

const rpcUrl = process.env.NEXT_PUBLIC_BSC_RPC_URL ?? "https://bsc-dataseed.binance.org";

// All supported tokenized stocks trade as 18-decimal tokens (issuer registry).
// BigInt() calls (not `n` literals) keep this compatible with the ES2017 target.
const TOKEN_DECIMALS = BigInt(18);
const TEN = BigInt(10);

function toQuantity(raw: bigint): number {
  // Safe for realistic balances; precision beyond ~1e-6 is irrelevant for display.
  const whole = raw / TEN ** TOKEN_DECIMALS;
  const frac = raw % TEN ** TOKEN_DECIMALS;
  return Number(whole) + Number(frac) / 1e18;
}

/** The connected wallet's on-chain tokenized-stock balances (nonzero only). */
export async function getOnchainHoldings(address: string): Promise<WalletBalance[]> {
  let owner: `0x${string}`;
  try {
    owner = getAddress(address);
  } catch {
    return [];
  }

  // Contract addresses come from the live token list, so this only runs with a
  // Binance Web3 key configured; without it there is nothing on-chain to map.
  const tokens = await getLiveTokens();
  if (!tokens || tokens.length === 0) return [];

  const priced = tokens.filter(
    (t): t is typeof t & { contractAddress: string } => Boolean(t.contractAddress)
  );
  if (priced.length === 0) return [];

  const client = createPublicClient({ chain: bsc, transport: http(rpcUrl) });

  let results: Array<{ status: "success" | "failure"; result?: unknown }>;
  try {
    results = await client.multicall({
      contracts: priced.map((t) => ({
        address: getAddress(t.contractAddress),
        abi: ERC20_BALANCE_ABI,
        functionName: "balanceOf",
        args: [owner]
      })),
      allowFailure: true
    });
  } catch {
    return []; // RPC unreachable — show nothing rather than a fabricated balance.
  }

  const balances: WalletBalance[] = [];
  results.forEach((res, i) => {
    if (res.status !== "success" || typeof res.result !== "bigint" || res.result === BigInt(0)) return;
    const token = priced[i];
    const quantity = toQuantity(res.result);
    if (quantity <= 0) return;
    const price = token.price;
    balances.push({
      symbol: token.symbol,
      name: token.name,
      provider: token.provider,
      providerLabel: providerLabel(token.provider),
      tokenSymbol: token.tokenSymbol ?? token.symbol,
      contractAddress: token.contractAddress,
      quantity,
      price,
      valueUsd: price !== null ? quantity * price : null
    });
  });

  // Largest positions first.
  balances.sort((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0));
  return balances;
}
