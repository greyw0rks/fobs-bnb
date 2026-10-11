import { NextResponse } from "next/server";
import { z } from "zod";
import { dbConfigured } from "@/lib/db";
import { resolveUser, isAddress } from "@/lib/session";
import { confirmFill } from "@/lib/settlement";
import { recordTrade } from "@/lib/trade-service";
import { getAssetVariants } from "@/lib/assets";
import { DEFAULT_PROVIDER } from "@/lib/assets-registry";

export const dynamic = "force-dynamic";

const Body = z.object({
  address: z.string(),
  symbol: z.string(),
  side: z.enum(["buy", "sell"]),
  amountUsd: z.number().positive(),
  provider: z.string().optional(),
  txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/, "A broadcast transaction hash is required"),
  quoteId: z.string().nullable().optional(),
  thesis: z.string().max(1000).optional()
});

// Final step: the wallet has already broadcast the swap. We read the on-chain
// receipt (the only honest source of the realized fill) and persist it. Live
// only: price and quantity come straight from the receipt's Transfer logs — a
// pending tx records as "submitted" with no figures, a revert as "failed". We
// never record a fabricated "confirmed" trade.
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid trade" }, { status: 400 });
  const b = parsed.data;
  if (!isAddress(b.address)) return NextResponse.json({ error: "Valid wallet address required" }, { status: 400 });

  if (!dbConfigured) {
    return NextResponse.json({ error: "Trade store unavailable — database not configured" }, { status: 503 });
  }

  const variants = await getAssetVariants(b.symbol);
  const provider = b.provider ?? DEFAULT_PROVIDER;
  const asset = variants.find((v) => v.provider === provider) ?? variants[0] ?? null;
  if (!asset?.contractAddress) {
    return NextResponse.json({ error: `Unknown or off-chain symbol ${b.symbol}` }, { status: 404 });
  }

  // Read the realized fill from the chain. Figures below are whatever the receipt
  // reports — nothing is defaulted or invented.
  let fill;
  try {
    fill = await confirmFill(b.txHash as `0x${string}`, {
      stockToken: asset.contractAddress,
      side: b.side,
      userAddress: b.address
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not read the transaction receipt" },
      { status: 502 }
    );
  }

  try {
    const user = await resolveUser(b.address);
    const trade = await recordTrade({
      userId: user.id,
      symbol: b.symbol,
      side: b.side,
      amountUsd: b.amountUsd,
      provider,
      price: fill.price,
      quantity: fill.quantity,
      txHash: b.txHash,
      orderId: b.quoteId ?? null,
      status: fill.status,
      thesis: b.thesis
    });
    return NextResponse.json({ status: fill.status, txHash: b.txHash, tradeId: trade.id, persisted: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not record trade" },
      { status: 500 }
    );
  }
}
