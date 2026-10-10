"use client";

// Renders post text with $TICKER / bare-ticker cashtags linked to the stock page.
// Only symbols in the supported universe become links — an unknown all-caps word
// (USD, BNB, LOL) is left as plain text, so we never link to a page that isn't
// there. This is the "stock ticker embedded in a post" affordance for plain posts;
// trade-backed posts already carry a Trade button.

import Link from "next/link";
import type { Route } from "next";
import { UNDERLYINGS } from "@/lib/assets-registry";

const SYMBOLS = new Set(UNDERLYINGS.map((u) => u.symbol));

export function PostText({ content }: { content: string }) {
  if (!content) return null;
  // Split on an optional `$` followed by a 2–6 char uppercase run, keeping the
  // delimiters (the capture group) interleaved in the result.
  const parts = content.split(/(\$?[A-Z]{2,6})\b/g);
  return (
    <>
      {parts.map((part, i) => {
        const symbol = part.replace(/^\$/, "");
        if (SYMBOLS.has(symbol)) {
          return (
            <Link key={i} href={`/stocks/${symbol}` as Route} className="link" style={{ fontWeight: 600 }}>
              {part}
            </Link>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}
