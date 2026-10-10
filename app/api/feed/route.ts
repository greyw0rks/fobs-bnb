import { NextResponse } from "next/server";
import { getFeed } from "@/lib/feed";
import { viewerIdFromAddress } from "@/lib/viewer";
import type { FeedView } from "@/lib/types";

export const dynamic = "force-dynamic";

const VIEWS: FeedView[] = ["for-you", "following", "trending"];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("view") ?? "for-you";
  const view = (VIEWS.includes(raw as FeedView) ? raw : "for-you") as FeedView;
  const viewerId = await viewerIdFromAddress(searchParams.get("address"));
  const posts = await getFeed(view, viewerId);
  return NextResponse.json({ posts, view });
}
