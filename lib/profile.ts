// Profile service — a public trading identity. Performance is sourced from real
// wallet activity (trades + mirrored holdings), never invented profitability.

import "server-only";
import { tryDb } from "./db";
import { getAssets } from "./assets";
import type { ProfileView, PortfolioHolding, FeedTrade, TradeSide, TradeStatus } from "./types";

export async function getProfile(handle: string, viewerId?: string | null): Promise<ProfileView | null> {
  const lower = handle.toLowerCase();
  const result = await tryDb(async (db) => {
    const user = await db.user.findFirst({
      where: { OR: [{ username: handle }, { username: lower }, { walletAddress: lower }] },
      include: {
        _count: { select: { followers: true, following: true, trades: true } },
        holdings: { where: { quantity: { gt: 0 } }, include: { asset: { select: { symbol: true, name: true } } } },
        trades: {
          orderBy: { createdAt: "desc" },
          take: 30,
          include: { user: { select: { username: true, displayName: true, avatarUrl: true } } }
        }
      }
    });
    if (!user) return null;

    const viewerFollows = viewerId
      ? Boolean(
          await db.follow.findUnique({
            where: { followerId_followingId: { followerId: viewerId, followingId: user.id } }
          })
        )
      : false;
    return { user, viewerFollows };
  });

  if (!result || !result.user) return null;
  const { user, viewerFollows } = result;

  const { assets } = await getAssets();
  const priceOf = (symbol: string) => assets.find((a) => a.symbol === symbol)?.price ?? null;

  const holdings: PortfolioHolding[] = user.holdings.map((h) => {
    const price = priceOf(h.asset.symbol);
    const costBasisUsd = h.quantity * h.avgPrice;
    const valueUsd = price !== null ? h.quantity * price : null;
    const pnlUsd = valueUsd !== null ? valueUsd - costBasisUsd : null;
    return {
      symbol: h.asset.symbol,
      name: h.asset.name,
      quantity: h.quantity,
      avgPrice: h.avgPrice,
      price,
      valueUsd,
      costBasisUsd,
      pnlUsd,
      pnlPct: pnlUsd !== null && costBasisUsd > 0 ? (pnlUsd / costBasisUsd) * 100 : null
    };
  });

  const trades: FeedTrade[] = user.trades.map((t) => ({
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

  return {
    user: {
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      walletAddress: user.walletAddress,
      xHandle: user.xHandle
    },
    followerCount: user._count.followers,
    followingCount: user._count.following,
    tradeCount: user._count.trades,
    viewerFollows,
    holdings,
    trades
  };
}
