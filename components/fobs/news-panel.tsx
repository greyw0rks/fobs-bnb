"use client";

// Market-news card for a stock page. Fetches /api/news (Yahoo Finance per-ticker
// headline RSS) and renders real, dated headlines as ticker-badged quote cards
// that link out to the source. Honest-empty: a failed or empty feed shows "No
// recent headlines" — never a placeholder story. The "Live" dot only shows when
// the feed actually returned items.

import { useEffect, useState } from "react";
import type { NewsItem } from "@/lib/news";
import { price as fmtPrice, pct } from "@/lib/format";

function timeAgo(iso: string | null): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

export function NewsPanel({
  symbol,
  company,
  price,
  change24h,
}: {
  symbol: string;
  company: string;
  price: number | null;
  change24h: number | null;
}) {
  const [news, setNews] = useState<NewsItem[] | null>(null);

  useEffect(() => {
    let live = true;
    setNews(null);
    fetch(`/api/news?symbol=${encodeURIComponent(symbol)}`)
      .then((r) => r.json())
      .then((d) => { if (live) setNews(Array.isArray(d.news) ? d.news : []); })
      .catch(() => { if (live) setNews([]); });
    return () => { live = false; };
  }, [symbol]);

  const chgDir = change24h == null ? "flat" : change24h >= 0 ? "up" : "down";

  return (
    <div className="newsfeed">
      <div className="newsfeed-head">
        <span className="newsfeed-title">Market News</span>
        {news && news.length > 0 ? (
          <span className="newsfeed-live"><span className="dot" /> Live</span>
        ) : null}
      </div>

      {news === null ? (
        <p className="muted" style={{ fontSize: 12 }}>Loading headlines…</p>
      ) : news.length === 0 ? (
        <p className="muted" style={{ fontSize: 12 }}>No recent headlines for {symbol}.</p>
      ) : (
        <div className="news-scroll">
          {news.map((item) => {
            const when = timeAgo(item.publishedAt);
            return (
              <a key={item.link} className="news-card" href={item.link} target="_blank" rel="noreferrer">
                <div className="news-card-top">
                  <span className="news-id">
                    <span className="news-badge">{symbol}</span>
                    <span className="news-co">{company}</span>
                  </span>
                  <span className="news-px">
                    <span className="news-last">{fmtPrice(price)}</span>
                    <span className={`news-chg ${chgDir}`}>{pct(change24h)}</span>
                  </span>
                </div>
                <div className="news-headline">{item.title}</div>
                <div className="news-src">{item.source ?? "source"}{when ? ` · ${when}` : ""}</div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
