import { NextResponse } from "next/server";
import { z } from "zod";
import { getSwapTx } from "@/lib/rfq";
import { getAssetVariants } from "@/lib/assets";
import { DEFAULT_PROVIDER } from "@/lib/assets-registry";
import { isAddress } from "@/lib/session";

export const dynamic = "force-dynamic";

const Body = z.object({
  address: z.string(),
  symbol: z.string(),
  side: z.enum(["buy", "sell"]),
  amountUsd: z.number().positive(),
  provider: z.string().optional()
});

// Sign step: fetch a FRESH quote and the raw EVM transaction the wallet will send.
// The client approves the fromToken to `approveTarget` (if needed) and broadcasts
// `tx` — that broadcast is the authorization. Live only: no API / no contract → 503.
// We never return a synthesized transaction.
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid swap request" }, { status: 400 });
  const { address, symbol, side, amountUsd } = parsed.data;
  if (!isAddress(address)) return NextResponse.json({ error: "Valid wallet address required" }, { status: 400 });

  const variants = await getAssetVariants(symbol);
  const provider = parsed.data.provider ?? DEFAULT_PROVIDER;
  const asset = variants.find((v) => v.provider === provider) ?? variants[0] ?? null;
  if (!asset) return NextResponse.json({ error: `Unknown symbol ${symbol}` }, { status: 404 });

  const hasKeys = Boolean(process.env.OC_API_KEY && process.env.OC_SECRET_KEY);
  if (!hasKeys || !asset.contractAddress) {
    return NextResponse.json(
      { error: "Live trading unavailable — Binance Web3 API not configured or asset not on-chain" },
      { status: 503 }
    );
  }

  try {
    const swap = await getSwapTx({
      symbol,
      side,
      amountUsd,
      tokenContractAddress: asset.contractAddress,
      walletAddress: address,
      provider: asset.provider,
      price: asset.price
    });
    return NextResponse.json({ swap });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not build the swap transaction" },
      { status: 502 }
    );
  }
}
