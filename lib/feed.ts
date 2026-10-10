// Feed service — reads posts (trade-backed and text) from the DB and maps them
// to the FeedPost view. Live only: the DB is a hard dependency; when it is
// unreachable the feed is empty, never fabricated.

import "server-only";
import { tryDb } from "./db";
import type { FeedPost, FeedTrade, FeedView, TradeSide, TradeStatus } from "./types";

type DbPost = {
  id: string;
  kind: string;
  content: string;
  createdAt: Date;
  user: { username: string; displayName: string; avatarUrl: string | null };
  trade:
    | ({
        id: string;
        side: string;
        symbol: string;
        amountUsd: number;
        quantity: number | null;
        price: number | null;
        txHash: string | null;
        status: string;
        user: { username: string; displayName: string; avatarUrl: string | null };
      })
    | null;
  _count: { likes: number; comments: number };
  likes?: { id: string }[];
};

function mapTrade(t: NonNullable<DbPost["trade"]>): FeedTrade {
  return {
    id: t.id,
    user: { username: t.user.username, displayName: t.user.displayName, avatarUrl: t.user.avatarUrl },
    side: t.side as TradeSide,
    symbol: t.symbol,
    amountUsd: t.amountUsd,
    quantity: t.quantity,
    price: t.price,
    txHash: t.txHash,
    status: t.status as TradeStatus,
    createdAt: t.id ? new Date().toISOString() : new Date().toISOString()
  };
}

function mapPost(p: DbPost): FeedPost {
  return {
    id: p.id,
    kind: p.kind === "text" ? "text" : "trade",
    content: p.content,
    createdAt: p.createdAt.toISOString(),
    user: { username: p.user.username, displayName: p.user.displayName, avatarUrl: p.user.avatarUrl },
    trade: p.trade
      ? { ...mapTrade(p.trade), createdAt: p.createdAt.toISOString() }
      : null,
    likeCount: p._count.likes,
    commentCount: p._count.comments,
    viewerLiked: (p.likes ?? []).length > 0
  };
}

export async function getFeed(view: FeedView, viewerId?: string | null): Promise<FeedPost[]> {
  const posts = await tryDb(async (db) => {
    // "following" needs a viewer; without one it is empty rather than faked.
    let followingIds: string[] | undefined;
    if (view === "following") {
      if (!viewerId) return [];
      const follows = await db.follow.findMany({
        where: { followerId: viewerId },
        select: { followingId: true }
      });
      followingIds = follows.map((f) => f.followingId);
      if (followingIds.length === 0) return [];
    }

    const rows = await db.post.findMany({
      where: followingIds ? { userId: { in: followingIds } } : undefined,
      orderBy:
        view === "trending"
          ? [{ likes: { _count: "desc" } }, { createdAt: "desc" }]
          : { createdAt: "desc" },
      take: 50,
      include: {
        user: { select: { username: true, displayName: true, avatarUrl: true } },
        trade: {
          include: { user: { select: { username: true, displayName: true, avatarUrl: true } } }
        },
        _count: { select: { likes: true, comments: true } },
        likes: viewerId ? { where: { userId: viewerId }, select: { id: true } } : false
      }
    });
    return rows as unknown as DbPost[];
  });

  if (posts === null) {
    // DB unreachable — honest empty feed, never fabricated posts.
    return [];
  }
  return posts.map(mapPost);
}

/** Prisma `include` for a Post that hydrates a full FeedPost (with viewerLiked). */
export function postInclude(viewerId?: string | null) {
  return {
    user: { select: { username: true, displayName: true, avatarUrl: true } },
    trade: {
      include: { user: { select: { username: true, displayName: true, avatarUrl: true } } }
    },
    _count: { select: { likes: true, comments: true } },
    likes: viewerId ? { where: { userId: viewerId }, select: { id: true } } : false
  } as const;
}

/** Map a Post row (queried with `postInclude`) to a FeedPost. */
export function toFeedPost(row: unknown): FeedPost {
  return mapPost(row as DbPost);
}
