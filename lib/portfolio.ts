// Portfolio service — positions and P&L from mirrored Holding rows + live
// prices. Every figure is derived from real trades; nothing is invented. A
// position whose live price is unread shows null value/PnL (an em dash), never
// a fabricated number.

import "server-only";
import { tryDb } from "./db";
import { getAssets } from "./assets";
import type { FeedTrade, PortfolioHolding, PortfolioView, TradeSide, TradeStatus } from "./types";

export async function getPortfolio(userId: string): Promise<PortfolioView> {
  const empty: PortfolioView = { holdings: [], totalValueUsd: null, totalCostUsd: 0, totalPnlUsd: null };

  const rows = await tryDb((db) =>
    db.holding.findMany({
      where: { userId, quantity: { gt: 0 } },
      include: { asset: { select: { symbol: true, name: true } } }
    })
  );
  if (!rows || rows.length === 0) return empty;

  const { assets } = await getAssets();
  const priceOf = (symbol: string) => assets.find((a) => a.symbol === symbol)?.price ?? null;

  const holdings: PortfolioHolding[] = rows.map((h) => {
    const price = priceOf(h.asset.symbol);
    const costBasisUsd = h.quantity * h.avgPrice;
    const valueUsd = price !== null ? h.quantity * price : null;
    const pnlUsd = valueUsd !== null ? valueUsd - costBasisUsd : null;
    const pnlPct = pnlUsd !== null && costBasisUsd > 0 ? (pnlUsd / costBasisUsd) * 100 : null;
    return {
      symbol: h.asset.symbol,
      name: h.asset.name,
      quantity: h.quantity,
      avgPrice: h.avgPrice,
      price,
      valueUsd,
      costBasisUsd,
      pnlUsd,
      pnlPct
    };
  });

  const totalCostUsd = holdings.reduce((sum, h) => sum + h.costBasisUsd, 0);
  // Total value/PnL are null if ANY position's price is unread — we don't sum a
  // real figure with a fabricated 0.
  const allPriced = holdings.every((h) => h.valueUsd !== null);
  const totalValueUsd = allPriced ? holdings.reduce((s, h) => s + (h.valueUsd ?? 0), 0) : null;
  const totalPnlUsd = totalValueUsd !== null ? totalValueUsd - totalCostUsd : null;

  return { holdings, totalValueUsd, totalCostUsd, totalPnlUsd };
}

export async function getTradeHistory(userId: string, take = 30): Promise<FeedTrade[]> {
  const rows = await tryDb((db) =>
    db.trade.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take,
      include: { user: { select: { username: true, displayName: true, avatarUrl: true } } }
    })
  );
  if (!rows) return [];
  return rows.map((t) => ({
    id: t.id,
    user: { username: t.user.username, displayName: t.user.displayName, avatarUrl: t.user.avatarUrl },
    side: t.side as TradeSide,
    symbol: t.symbol,
    amountUsd: t.amountUsd,
    quantity: t.quantity,
    price: t.price,
    txHash: t.txHash,
    status: t.status as TradeStatus,
    createdAt: t.createdAt.toISOString()
  }));
}
