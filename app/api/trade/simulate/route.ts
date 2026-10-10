import { NextResponse } from "next/server";
import { z } from "zod";
import { quoteTrade, simulateTrade } from "@/lib/rfq";
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

// Step 2 of the RFQ flow (quote -> SIMULATE -> sign -> submit). Live only.
//
// We fetch a real quote and run it through the aggregator's pre-transaction
// simulate so the signer sees the concrete cost (fee, price impact, minimum
// received) AND any revert BEFORE their wallet is asked to sign. The same quote
// is returned so the client signs exactly what was simulated — no re-quote drift.
// If the API is not configured or the asset has no contract, we refuse (503);
// we never fabricate a simulation result.
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid simulate request" }, { status: 400 });
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
    const quote = await quoteTrade({
      symbol,
      side,
      amountUsd,
      tokenContractAddress: asset.contractAddress,
      walletAddress: address,
      provider: asset.provider
    });
    const simulation = await simulateTrade(quote);
    return NextResponse.json({ quote, simulation });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Simulation failed" },
      { status: 502 }
    );
  }
}
