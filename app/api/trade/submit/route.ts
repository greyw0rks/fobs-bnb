import { NextResponse } from "next/server";
import { z } from "zod";
import { dbConfigured } from "@/lib/db";
import { resolveUser } from "@/lib/session";
import { submitTrade, getOrderStatus } from "@/lib/rfq";
import { recordTrade } from "@/lib/trade-service";
import type { TradeStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const Body = z.object({
  address: z.string(),
  symbol: z.string(),
  side: z.enum(["buy", "sell"]),
  amountUsd: z.number().positive(),
  provider: z.string().optional(),
  userSignature: z.string().min(1),
  quoteId: z.string().nullable().optional(),
  requestId: z.string().nullable().optional(),
  vendor: z.string().optional(),
  thesis: z.string().max(1000).optional()
});

// Step 3 (+4) of the RFQ flow: submit the wallet-signed order, poll once, then
// record it. Live only: a real Binance Web3 RFQ submit is required and the
// result must persist to the DB. We never record a fabricated "confirmed" trade.
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid trade" }, { status: 400 });
  const b = parsed.data;

  const hasKeys = Boolean(process.env.OC_API_KEY && process.env.OC_SECRET_KEY);
  if (!hasKeys || !b.requestId || !b.quoteId) {
    return NextResponse.json(
      { error: "Live order routing unavailable — Binance Web3 API not configured or missing quote" },
      { status: 503 }
    );
  }
  if (!dbConfigured) {
    return NextResponse.json(
      { error: "Trade store unavailable — database not configured" },
      { status: 503 }
    );
  }

  // Submit the wallet-signed order and poll once for settlement. Every figure we
  // record comes from this live result — nothing is defaulted or invented.
  let status: TradeStatus;
  let txHash: string | null;
  let orderId: string;
  let price: number | null;
  let quantity: number | null;
  try {
    const submitted = await submitTrade({
      requestId: b.requestId,
      quoteId: b.quoteId,
      vendor: b.vendor ?? b.provider ?? "ondo",
      userSignature: b.userSignature
    });
    orderId = submitted.orderId;
    const settled = await getOrderStatus(orderId);
    status = settled.status;
    txHash = settled.txHash;
    price = settled.price;
    quantity = settled.quantity;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Order submit failed" },
      { status: 502 }
    );
  }

  try {
    const user = await resolveUser(b.address);
    const trade = await recordTrade({
      userId: user.id,
      symbol: b.symbol,
      side: b.side,
      amountUsd: b.amountUsd,
      provider: b.provider,
      price,
      quantity,
      txHash,
      orderId,
      status,
      thesis: b.thesis
    });
    return NextResponse.json({ status, txHash, orderId, tradeId: trade.id, persisted: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not record trade" },
      { status: 500 }
    );
  }
}
