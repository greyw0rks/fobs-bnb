"use client";

// Price history chart. Fetches candles from our API (which proxies the Binance
// candle endpoint when a key is configured) at a selectable timeframe. No data
// → an honest placeholder, never an invented line. Every colour is a fobs token.

import { useEffect, useMemo, useState } from "react";
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

type Point = { t: number; c: number };

const TIMEFRAMES = [
  { label: "1D", bar: "15m" },
  { label: "1W", bar: "1h" },
  { label: "1M", bar: "4h" },
  { label: "3M", bar: "1d" }
] as const;

const UP = "#23845b";
const DOWN = "#c94c4c";

function fmtAxisTime(t: number, bar: string): string {
  const d = new Date(t);
  // Intraday bars read as clock time; daily+ read as a calendar date.
  if (bar === "15m" || bar === "1h") {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function fmtFullTime(t: number): string {
  return new Date(t).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function PriceChart({ symbol, contractAddress }: { symbol: string; contractAddress?: string }) {
  const [tf, setTf] = useState<(typeof TIMEFRAMES)[number]>(TIMEFRAMES[1]);
  const [data, setData] = useState<Point[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setFailed(false);
    const params = new URLSearchParams({ symbol, bar: tf.bar });
    if (contractAddress) params.set("contract", contractAddress);
    fetch(`/api/candles?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (!live) return;
        if (Array.isArray(d.candles) && d.candles.length > 0) setData(d.candles);
        else {
          setData(null);
          setFailed(true);
        }
      })
      .catch(() => live && setFailed(true))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [symbol, contractAddress, tf]);

  const { up, color, delta, deltaPct } = useMemo(() => {
    if (!data || data.length < 2) return { up: true, color: UP, delta: null as number | null, deltaPct: null as number | null };
    const first = data[0].c;
    const last = data[data.length - 1].c;
    const rising = last >= first;
    return {
      up: rising,
      color: rising ? UP : DOWN,
      delta: last - first,
      deltaPct: first ? ((last - first) / first) * 100 : null
    };
  }, [data]);

  return (
    <div>
      <div className="chart-head">
        {delta !== null && deltaPct !== null ? (
          <span className="chart-delta" style={{ color }}>
            {up ? "▲" : "▼"} {up ? "+" : "−"}${Math.abs(delta).toFixed(2)} ({up ? "+" : ""}
            {deltaPct.toFixed(2)}%) · {tf.label}
          </span>
        ) : (
          <span className="chart-delta muted">{tf.label}</span>
        )}
        <div className="chart-tf">
          {TIMEFRAMES.map((o) => (
            <button
              key={o.label}
              type="button"
              className={`tf${o.label === tf.label ? " active" : ""}`}
              onClick={() => setTf(o)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {failed || (data && data.length === 0) ? (
        <div className="chart-empty muted">Price history not read yet.</div>
      ) : loading && !data ? (
        <div className="chart-empty muted">Loading price history…</div>
      ) : data ? (
        <div style={{ height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="#e3e2dc" strokeDasharray="2 4" />
              <XAxis
                dataKey="t"
                tickFormatter={(t) => fmtAxisTime(Number(t), tf.bar)}
                tick={{ fontSize: 10, fill: "#777872" }}
                axisLine={false}
                tickLine={false}
                minTickGap={44}
                height={18}
              />
              <YAxis
                domain={["dataMin", "dataMax"]}
                width={52}
                orientation="right"
                tick={{ fontSize: 10, fill: "#777872" }}
                tickFormatter={(v) => `$${Number(v).toFixed(2)}`}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(v) => [`$${Number(v).toFixed(2)}`, "Price"]}
                labelFormatter={(t) => fmtFullTime(Number(t))}
                contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e3e2dc", padding: "6px 10px" }}
                cursor={{ stroke: "#9b9c95", strokeDasharray: "3 3" }}
              />
              <Area
                type="monotone"
                dataKey="c"
                stroke={color}
                strokeWidth={1.8}
                fill="url(#pg)"
                activeDot={{ r: 3, fill: color, stroke: "#fff", strokeWidth: 1.5 }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="chart-empty muted">Loading price history…</div>
      )}
    </div>
  );
}
