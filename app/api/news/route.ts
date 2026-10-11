import { NextResponse } from "next/server";
import type { NewsItem } from "@/lib/news";

export const dynamic = "force-dynamic";

// Company news for a stock symbol. The original Solana Fobs had no news plugin
// to port, so this reads Yahoo Finance's per-ticker headline RSS — finance-
// specific, keyless, and real. Honest-empty: any failure returns an empty list
// and the panel says "No recent headlines" rather than inventing a story.
const FEED = (symbol: string) =>
  `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(symbol)}&region=US&lang=en-US`;

function decodeEntities(s: string) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .trim();
}

function tag(block: string, name: string): string | null {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decodeEntities(m[1]) : null;
}

function hostOf(link: string | null): string | null {
  if (!link) return null;
  try {
    return new URL(link).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get("symbol") ?? "").toUpperCase().replace(/[^A-Z0-9.\-]/g, "");
  if (!symbol) return NextResponse.json({ news: [] });

  try {
    const res = await fetch(FEED(symbol), {
      headers: { "user-agent": "Mozilla/5.0 (compatible; FobsNews/1.0)" },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return NextResponse.json({ news: [] });

    const xml = await res.text();
    const items = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];

    const news: NewsItem[] = items
      .map((block) => {
        const title = tag(block, "title");
        const link = tag(block, "link");
        return title && link
          ? { title, link, source: hostOf(link), publishedAt: tag(block, "pubDate") }
          : null;
      })
      .filter((n): n is NewsItem => n !== null)
      .slice(0, 10);

    return NextResponse.json({ news });
  } catch {
    return NextResponse.json({ news: [] });
  }
}
