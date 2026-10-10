import { NextResponse } from "next/server";
import { z } from "zod";
import { runAgent } from "@/lib/agent";
import { viewerIdFromAddress } from "@/lib/viewer";

export const dynamic = "force-dynamic";

const Body = z.object({
  prompt: z.string().min(1).max(500),
  address: z.string().optional()
});

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "A prompt is required" }, { status: 400 });
  }
  const viewerId = await viewerIdFromAddress(parsed.data.address);
  const response = await runAgent(parsed.data.prompt, viewerId);
  return NextResponse.json(response);
}
