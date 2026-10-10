import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, dbConfigured } from "@/lib/db";
import { resolveUser } from "@/lib/session";
import { emitNotification } from "@/lib/notifications";

export const dynamic = "force-dynamic";

const Body = z.object({ address: z.string(), content: z.string().min(1).max(500) });

// Comments on a post, oldest first. Live only: no DB → nothing to read (503),
// never a fabricated thread.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!dbConfigured) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const { id: postId } = await params;
  try {
    const rows = await prisma.comment.findMany({
      where: { postId },
      orderBy: { createdAt: "asc" },
      take: 100,
      include: { user: { select: { username: true, displayName: true, avatarUrl: true } } }
    });
    return NextResponse.json({
      comments: rows.map((c) => ({
        id: c.id,
        user: { username: c.user.username, displayName: c.user.displayName, avatarUrl: c.user.avatarUrl },
        content: c.content,
        createdAt: c.createdAt.toISOString()
      }))
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load comments" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!dbConfigured) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const { id: postId } = await params;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid comment" }, { status: 400 });

  try {
    const user = await resolveUser(parsed.data.address);
    const comment = await prisma.comment.create({
      data: { userId: user.id, postId, content: parsed.data.content },
      include: { user: { select: { username: true, displayName: true, avatarUrl: true } } }
    });
    const post = await prisma.post.findUnique({ where: { id: postId }, select: { userId: true } });
    if (post) await emitNotification({ recipientId: post.userId, actorId: user.id, type: "comment", postId });
    return NextResponse.json({
      comment: {
        id: comment.id,
        user: { username: comment.user.username, displayName: comment.user.displayName, avatarUrl: comment.user.avatarUrl },
        content: comment.content,
        createdAt: comment.createdAt.toISOString()
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not comment" },
      { status: 500 }
    );
  }
}
