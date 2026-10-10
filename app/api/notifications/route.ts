import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, dbConfigured } from "@/lib/db";
import { resolveUser, isAddress } from "@/lib/session";

export const dynamic = "force-dynamic";

// Notifications for the connected wallet. Live only: without a DB there are no
// notifications to read (503), never a fabricated list.
export async function GET(request: Request) {
  if (!dbConfigured) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const address = new URL(request.url).searchParams.get("address");
  if (!isAddress(address)) return NextResponse.json({ error: "A valid wallet address is required" }, { status: 400 });

  try {
    const user = await resolveUser(address);
    const rows = await prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { actor: { select: { username: true, displayName: true, avatarUrl: true } } }
    });

    // Resolve which notified posts are trade-backed, so like/comment events can
    // deep-link to the trade. Notification has no post relation, so batch-read.
    const postIds = [...new Set(rows.map((n) => n.postId).filter((id): id is string => Boolean(id)))];
    const tradeByPost = new Map<string, string | null>();
    if (postIds.length > 0) {
      const posts = await prisma.post.findMany({
        where: { id: { in: postIds } },
        select: { id: true, tradeId: true }
      });
      for (const p of posts) tradeByPost.set(p.id, p.tradeId);
    }

    const unread = rows.filter((n) => !n.read).length;
    return NextResponse.json({
      unread,
      notifications: rows.map((n) => ({
        id: n.id,
        type: n.type,
        read: n.read,
        postId: n.postId,
        tradeId: n.postId ? tradeByPost.get(n.postId) ?? null : null,
        createdAt: n.createdAt.toISOString(),
        actor: {
          username: n.actor.username,
          displayName: n.actor.displayName,
          avatarUrl: n.actor.avatarUrl
        }
      }))
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load notifications" },
      { status: 500 }
    );
  }
}

const MarkBody = z.object({ address: z.string(), ids: z.array(z.string()).optional() });

// Mark notifications read. With `ids` marks those; otherwise marks all read.
export async function POST(request: Request) {
  if (!dbConfigured) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const parsed = MarkBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  try {
    const user = await resolveUser(parsed.data.address);
    await prisma.notification.updateMany({
      where: {
        userId: user.id,
        read: false,
        ...(parsed.data.ids ? { id: { in: parsed.data.ids } } : {})
      },
      data: { read: true }
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update notifications" },
      { status: 500 }
    );
  }
}
