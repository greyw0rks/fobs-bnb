import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, dbConfigured } from "@/lib/db";
import { resolveUser } from "@/lib/session";
import { postInclude, toFeedPost } from "@/lib/feed";

export const dynamic = "force-dynamic";

const Body = z.object({
  address: z.string(),
  content: z.string().min(1).max(1000),
  tradeId: z.string().optional()
});

export async function POST(request: Request) {
  if (!dbConfigured) {
    return NextResponse.json({ error: "Posting needs a database. Configure DATABASE_URL." }, { status: 503 });
  }
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid post" }, { status: 400 });

  try {
    const user = await resolveUser(parsed.data.address);
    const created = await prisma.post.create({
      data: {
        userId: user.id,
        content: parsed.data.content,
        kind: parsed.data.tradeId ? "trade" : "text",
        tradeId: parsed.data.tradeId
      },
      include: postInclude(user.id)
    });
    return NextResponse.json({ post: toFeedPost(created) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create post" },
      { status: 500 }
    );
  }
}
