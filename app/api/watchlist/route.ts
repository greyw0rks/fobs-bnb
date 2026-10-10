import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, dbConfigured } from "@/lib/db";
import { resolveUser, isAddress } from "@/lib/session";

export const dynamic = "force-dynamic";

// The watched symbols for the connected wallet. A watchlist entry is a bookmark
// against an underlying ticker — no position or figure is implied.
export async function GET(request: Request) {
  if (!dbConfigured) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const address = new URL(request.url).searchParams.get("address");
  if (!isAddress(address)) return NextResponse.json({ error: "A valid wallet address is required" }, { status: 400 });

  try {
    const user = await resolveUser(address);
    const rows = await prisma.watchlist.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { symbol: true, createdAt: true }
    });
    return NextResponse.json({ symbols: rows.map((r) => r.symbol) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load watchlist" },
      { status: 500 }
    );
  }
}

const Body = z.object({
  address: z.string(),
  symbol: z.string().min(1).max(12),
  action: z.enum(["add", "remove"])
});

// Toggle a symbol on the watchlist. Returns the resulting watched state.
export async function POST(request: Request) {
  if (!dbConfigured) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const symbol = parsed.data.symbol.toUpperCase();
  try {
    const user = await resolveUser(parsed.data.address);
    if (parsed.data.action === "add") {
      await prisma.watchlist.upsert({
        where: { userId_symbol: { userId: user.id, symbol } },
        update: {},
        create: { userId: user.id, symbol }
      });
    } else {
      await prisma.watchlist
        .delete({ where: { userId_symbol: { userId: user.id, symbol } } })
        .catch(() => {});
    }
    return NextResponse.json({ watching: parsed.data.action === "add" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update watchlist" },
      { status: 500 }
    );
  }
}
