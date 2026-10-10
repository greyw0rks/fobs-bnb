import { NextResponse } from "next/server";
import { getPortfolio, getTradeHistory } from "@/lib/portfolio";
import { getOnchainHoldings } from "@/lib/onchain";
import { viewerIdFromAddress } from "@/lib/viewer";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address");
  const viewerId = await viewerIdFromAddress(address);

  // On-chain balances are read straight from the wallet address, so they work
  // even for a wallet that has never traded through Fobs (no DB user yet).
  const walletBalancesPromise = address ? getOnchainHoldings(address) : Promise.resolve([]);

  if (!viewerId) {
    const walletBalances = await walletBalancesPromise;
    return NextResponse.json({
      portfolio: { holdings: [], totalValueUsd: null, totalCostUsd: 0, totalPnlUsd: null },
      trades: [],
      walletBalances
    });
  }
  const [portfolio, trades, walletBalances] = await Promise.all([
    getPortfolio(viewerId),
    getTradeHistory(viewerId),
    walletBalancesPromise
  ]);
  return NextResponse.json({ portfolio, trades, walletBalances });
}
