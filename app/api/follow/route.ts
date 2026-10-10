import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, dbConfigured, tryDb } from "@/lib/db";
import { resolveUser } from "@/lib/session";
import { viewerIdFromAddress } from "@/lib/viewer";
import { emitNotification } from "@/lib/notifications";

export const dynamic = "force-dynamic";

// Does `address` follow `targetUsername`? Read-only (never creates a user).
// Lets the client hydrate the Follow button, since the server page that renders
// it has no session to know the viewer. Unknown viewer/DB → false, never faked.
export async function GET(request: Request) {
  if (!dbConfigured) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const url = new URL(request.url);
  const address = url.searchParams.get("address");
  const targetUsername = url.searchParams.get("targetUsername");
  if (!targetUsername) return NextResponse.json({ error: "targetUsername is required" }, { status: 400 });

  const viewerId = await viewerIdFromAddress(address);
  if (!viewerId) return NextResponse.json({ following: false });

  const following = await tryDb(async (db) => {
    const target = await db.user.findUnique({ where: { username: targetUsername }, select: { id: true } });
    if (!target || target.id === viewerId) return false;
    return Boolean(
      await db.follow.findUnique({
        where: { followerId_followingId: { followerId: viewerId, followingId: target.id } }
      })
    );
  });
  return NextResponse.json({ following: following ?? false });
}

const Body = z.object({
  address: z.string(),
  targetUsername: z.string(),
  action: z.enum(["follow", "unfollow"])
});

export async function POST(request: Request) {
  if (!dbConfigured) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  try {
    const follower = await resolveUser(parsed.data.address);
    const target = await prisma.user.findUnique({ where: { username: parsed.data.targetUsername } });
    if (!target) return NextResponse.json({ error: "No such user" }, { status: 404 });
    if (target.id === follower.id) return NextResponse.json({ error: "You can't follow yourself" }, { status: 400 });

    if (parsed.data.action === "follow") {
      await prisma.follow.upsert({
        where: { followerId_followingId: { followerId: follower.id, followingId: target.id } },
        update: {},
        create: { followerId: follower.id, followingId: target.id }
      });
      await emitNotification({ recipientId: target.id, actorId: follower.id, type: "follow" });
    } else {
      await prisma.follow
        .delete({ where: { followerId_followingId: { followerId: follower.id, followingId: target.id } } })
        .catch(() => {});
    }
    return NextResponse.json({ following: parsed.data.action === "follow" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update follow" },
      { status: 500 }
    );
  }
}
