import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, dbConfigured } from "@/lib/db";
import { resolveUser } from "@/lib/session";
import { emitNotification } from "@/lib/notifications";

export const dynamic = "force-dynamic";

const Body = z.object({ address: z.string() });

// Toggle a like. Returns the resulting state and count.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!dbConfigured) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const { id: postId } = await params;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Address required" }, { status: 400 });

  try {
    const user = await resolveUser(parsed.data.address);
    const existing = await prisma.like.findUnique({
      where: { userId_postId: { userId: user.id, postId } }
    });

    if (existing) {
      await prisma.like.delete({ where: { id: existing.id } });
    } else {
      await prisma.like.create({ data: { userId: user.id, postId } });
      const post = await prisma.post.findUnique({ where: { id: postId }, select: { userId: true } });
      if (post) await emitNotification({ recipientId: post.userId, actorId: user.id, type: "like", postId });
    }

    const likeCount = await prisma.like.count({ where: { postId } });
    return NextResponse.json({ liked: !existing, likeCount });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not like" },
      { status: 500 }
    );
  }
}
