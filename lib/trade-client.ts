// Client-side execution of a tokenized-stock trade — the authorization half of
// the loop, driven by the trade panel.
//
//   fresh quote + swap tx (server)  →  ERC-20 approve if needed  →  send the swap
//   →  server reads the on-chain receipt and records the real fill
//
// The wallet is the only thing that approves and broadcasts; this never holds a
// key. If the aggregator returns no transaction, we throw rather than fake a fill.

import { readContract, writeContract, sendTransaction, waitForTransactionReceipt, type Config } from "@wagmi/core";
import { erc20Abi, maxUint256 } from "viem";
import { wagmiConfig } from "@/lib/wagmi";
import type { PreparedSwap } from "@/lib/rfq";
import type { TradeSide } from "@/lib/types";

// @wagmi/core actions take the loose `Config`; our config is the strict variant
// inferred from `chains: [bsc]`. The two are structurally compatible at runtime
// — this widens the type so the actions accept it across wagmi caret upgrades.
const config = wagmiConfig as unknown as Config;

export type PlaceTradeParams = {
  address: string;
  symbol: string;
  side: TradeSide;
  amountUsd: number;
  provider?: string;
  thesis?: string;
};

export type PlaceTradeResult = { status: string; txHash: string | null; tradeId?: string };

export async function placeTrade(params: PlaceTradeParams): Promise<PlaceTradeResult> {
  // 1 — fresh quote + the raw swap transaction (quotes are short-lived, so we
  //     build the tx now, right before the wallet acts on it).
  const res = await fetch("/api/trade/swap", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(params)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Could not prepare the swap");
  const swap = data.swap as PreparedSwap;

  const fromToken = swap.fromTokenAddress as `0x${string}`;
  const spender = swap.approveTarget as `0x${string}`;
  const owner = params.address as `0x${string}`;
  const needed = BigInt(swap.amount);

  // 2 — approve the router to pull the spend leg, only if the allowance is short.
  const allowance = (await readContract(config, {
    address: fromToken,
    abi: erc20Abi,
    functionName: "allowance",
    args: [owner, spender]
  })) as bigint;
  if (allowance < needed) {
    const approveHash = await writeContract(config, {
      address: fromToken,
      abi: erc20Abi,
      functionName: "approve",
      args: [spender, maxUint256]
    });
    await waitForTransactionReceipt(config, { hash: approveHash });
  }

  // 3 — broadcast the swap. This send IS the authorization boundary.
  const txHash = await sendTransaction(config, {
    to: swap.tx.to as `0x${string}`,
    data: swap.tx.data as `0x${string}`,
    value: BigInt(swap.tx.value || "0")
  });

  // 4 — the server reads the receipt and records the realized fill.
  const submitRes = await fetch("/api/trade/submit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...params, txHash, quoteId: swap.quoteId })
  });
  const result = await submitRes.json();
  if (!submitRes.ok) throw new Error(result.error ?? "Trade failed");
  if (!result.status) throw new Error("Trade broadcast but the server returned no status.");
  return { status: result.status, txHash: result.txHash ?? txHash, tradeId: result.tradeId };
}
