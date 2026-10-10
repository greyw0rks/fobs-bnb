"use client";

// Price history sparkline. Fetches candles from our API (which proxies the
// Binance candle endpoint when a key is configured). No data → an honest
// placeholder, never an invented line.

import { useEffect, useState } from "react";
import { AreaChart, Area, ResponsiveContainer, YAxis, Tooltip } from "recharts";

type Point = { t: number; c: number };

export function PriceChart({ symbol, contractAddress }: { symbol: string; contractAddress?: string }) {
  const [data, setData] = useState<Point[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    const params = new URLSearchParams({ symbol });
    if (contractAddress) params.set("contract", contractAddress);
    fetch(`/api/candles?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (!live) return;
        if (Array.isArray(d.candles) && d.candles.length > 0) setData(d.candles);
        else setFailed(true);
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [symbol, contractAddress]);

  if (failed || (data && data.length === 0)) {
    return (
      <div style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center" }} className="muted">
        Price history not read yet.
      </div>
    );
  }

  if (!data) {
    return <div style={{ height: 120 }} className="muted" />;
  }

  const up = data.length > 1 && data[data.length - 1].c >= data[0].c;
  const color = up ? "#23845b" : "#c94c4c";

  return (
    <div style={{ height: 140, marginTop: 12 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis domain={["dataMin", "dataMax"]} hide />
          <Tooltip
            formatter={(v) => [`$${Number(v).toFixed(2)}`, "Price"]}
            labelFormatter={() => ""}
            contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e3e2dc" }}
          />
          <Area type="monotone" dataKey="c" stroke={color} strokeWidth={1.6} fill="url(#pg)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
