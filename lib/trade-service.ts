// Trade persistence — the DB side of a wallet-authorized order.
//
// Records the Trade (the social primitive), creates the Post that surfaces it
// in the feed, and updates the mirrored Holding so the portfolio reflects it.
// Called only after the wallet has signed; this never moves funds.

import "server-only";
import { prisma, tryDb } from "./db";
import { getAssetVariants } from "./assets";
import { tokenSymbolFor, underlyingName, DEFAULT_PROVIDER } from "./assets-registry";
import type { TradeDetail, TradeSide, TradeStatus } from "./types";

export type RecordTradeInput = {
  userId: string;
  symbol: string;
  side: TradeSide;
  amountUsd: number;
  provider?: string;
  price: number | null;
  quantity: number | null;
  txHash: string | null;
  orderId: string | null;
  status: TradeStatus;
  thesis?: string;
};

export async function recordTrade(input: RecordTradeInput) {
  const provider = input.provider ?? DEFAULT_PROVIDER;
  const variants = await getAssetVariants(input.symbol);
  const meta = variants.find((v) => v.provider === provider) ?? variants[0] ?? null;

  const contractAddress = meta?.contractAddress ?? `pending:${provider}:${input.symbol}`;
  const tokenSymbol = meta?.tokenSymbol ?? tokenSymbolFor(input.symbol, provider);

  const asset = await prisma.asset.upsert({
    where: { provider_contractAddress: { provider, contractAddress } },
    update: { tokenSymbol },
    create: {
      symbol: input.symbol,
      name: meta?.name ?? underlyingName(input.symbol),
      provider,
      tokenSymbol,
      contractAddress,
      decimals: 18,
      logoUrl: meta?.logoUrl
    }
  });

  // Record only the quantity the live fill reported. We never synthesize it from
  // amountUsd / price — a derived number would read as a real on-chain fill.
  const quantity = input.quantity;

  const trade = await prisma.trade.create({
    data: {
      userId: input.userId,
      assetId: asset.id,
      symbol: input.symbol,
      side: input.side,
      amountUsd: input.amountUsd,
      quantity,
      price: input.price,
      txHash: input.txHash,
      orderId: input.orderId,
      status: input.status
    }
  });

  const content =
    input.thesis?.trim() ||
    `${input.side === "buy" ? "Bought" : "Sold"} ${input.symbol}`;

  await prisma.post.create({
    data: { userId: input.userId, tradeId: trade.id, assetId: asset.id, kind: "trade", content }
  });

  // Update the mirrored position. Only when we know the quantity — no invented
  // fills. A confirmed/recorded buy adds; a sell reduces.
  if (quantity && quantity > 0) {
    const existing = await prisma.holding.findUnique({
      where: { userId_assetId: { userId: input.userId, assetId: asset.id } }
    });
    if (input.side === "buy") {
      const prevQty = existing?.quantity ?? 0;
      const prevCost = prevQty * (existing?.avgPrice ?? 0);
      const newQty = prevQty + quantity;
      const newAvg = newQty > 0 ? (prevCost + input.amountUsd) / newQty : 0;
      await prisma.holding.upsert({
        where: { userId_assetId: { userId: input.userId, assetId: asset.id } },
        update: { quantity: newQty, avgPrice: newAvg },
        create: { userId: input.userId, assetId: asset.id, quantity: newQty, avgPrice: newAvg }
      });
    } else if (existing) {
      const newQty = Math.max(0, existing.quantity - quantity);
      await prisma.holding.update({
        where: { userId_assetId: { userId: input.userId, assetId: asset.id } },
        data: { quantity: newQty } // avg cost unchanged on a sell
      });
    }
  }

  return trade;
}

/** One trade, fully expanded, for the per-trade detail page. Null when the trade
 *  doesn't exist or the DB is unreachable — never a fabricated record. */
export async function getTradeDetail(id: string): Promise<TradeDetail | null> {
  const row = await tryDb((db) =>
    db.trade.findUnique({
      where: { id },
      include: {
        user: { select: { username: true, displayName: true, avatarUrl: true } },
        asset: { select: { name: true, provider: true, tokenSymbol: true, contractAddress: true } },
        post: { select: { id: true, content: true, _count: { select: { likes: true, comments: true } } } }
      }
    })
  );
  if (!row) return null;
  return {
    id: row.id,
    user: { username: row.user.username, displayName: row.user.displayName, avatarUrl: row.user.avatarUrl },
    side: row.side as TradeSide,
    symbol: row.symbol,
    assetName: row.asset?.name ?? null,
    provider: row.asset?.provider ?? null,
    tokenSymbol: row.asset?.tokenSymbol ?? null,
    contractAddress: row.asset?.contractAddress ?? null,
    amountUsd: row.amountUsd,
    quantity: row.quantity,
    price: row.price,
    txHash: row.txHash,
    orderId: row.orderId,
    status: row.status as TradeStatus,
    createdAt: row.createdAt.toISOString(),
    postId: row.post?.id ?? null,
    content: row.post?.content ?? null,
    likeCount: row.post?._count.likes ?? 0,
    commentCount: row.post?._count.comments ?? 0
  };
}
