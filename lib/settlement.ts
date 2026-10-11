// On-chain settlement reader — the "verify the fill on-chain" half of the loop.
//
// After the wallet broadcasts the swap, the only honest source of the realized
// fill is the transaction receipt. We read it directly from BNB Smart Chain and
// derive the filled quantity and price from the ERC-20 Transfer logs that moved
// the user's own tokens. Nothing here is estimated: if a leg isn't in the
// receipt, the figure stays null (an em dash), never a fabricated number.

import "server-only";
import { createPublicClient, http, formatUnits } from "viem";
import { bsc } from "viem/chains";
import { USDT_BSC } from "./rfq";
import type { TradeStatus } from "./types";

// keccak256("Transfer(address,address,uint256)")
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const USDT = USDT_BSC.toLowerCase();

/** A 32-byte indexed address topic → a 20-byte address. */
function topicAddr(topic?: string): string | null {
  return topic ? ("0x" + topic.slice(-40)).toLowerCase() : null;
}

export type FillResult = { status: TradeStatus; quantity: number | null; price: number | null };

export async function confirmFill(
  txHash: `0x${string}`,
  opts: { stockToken: string; side: "buy" | "sell"; userAddress: string }
): Promise<FillResult> {
  const rpc =
    process.env.BSC_RPC_URL ?? process.env.NEXT_PUBLIC_BSC_RPC_URL ?? "https://bsc-dataseed.binance.org";
  const client = createPublicClient({ chain: bsc, transport: http(rpc) });

  let receipt;
  try {
    receipt = await client.waitForTransactionReceipt({ hash: txHash, timeout: 60_000 });
  } catch {
    // Not mined inside the window — the tx is real and pending, but we can't read
    // a fill yet. Record it honestly as submitted, with no invented figures.
    return { status: "submitted", quantity: null, price: null };
  }
  if (receipt.status !== "success") return { status: "failed", quantity: null, price: null };

  const user = opts.userAddress.toLowerCase();
  const stock = opts.stockToken.toLowerCase();
  let quantity: number | null = null; // stock tokens that moved to/from the user
  let usdAmount: number | null = null; // USDT that moved to/from the user

  for (const log of receipt.logs) {
    if ((log.topics?.[0] ?? "").toLowerCase() !== TRANSFER_TOPIC) continue;
    const from = topicAddr(log.topics[1]);
    const to = topicAddr(log.topics[2]);
    const addr = log.address.toLowerCase();
    let amount: bigint;
    try {
      amount = BigInt(log.data);
    } catch {
      continue;
    }
    const human = Number(formatUnits(amount, 18));
    if (addr === stock && ((opts.side === "buy" && to === user) || (opts.side === "sell" && from === user))) {
      quantity = human;
    }
    if (addr === USDT && ((opts.side === "buy" && from === user) || (opts.side === "sell" && to === user))) {
      usdAmount = human;
    }
  }

  // Realized price per token = cash leg / stock leg — both read from the receipt.
  const price = quantity && quantity > 0 && usdAmount != null ? usdAmount / quantity : null;
  return { status: "confirmed", quantity, price };
}
