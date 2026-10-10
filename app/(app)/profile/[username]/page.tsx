import { notFound } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { getProfile } from "@/lib/profile";
import { Avatar } from "@/components/avatar";
import { FollowButton } from "@/components/follow-button";
import { money, price as fmtPrice, pct, qty, ago, shortAddress, addressUrl, shortHash, txUrl } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const profile = await getProfile(username);
  if (!profile) notFound();

  const { user } = profile;

  return (
    <div className="stack" style={{ maxWidth: 720 }}>
      <div className="fobs-surface p-6">
        <div className="row">
          <div className="user">
            <Avatar name={user.displayName} avatar={user.avatarUrl} size="lg" />
            <span>
              <strong style={{ fontSize: 18 }}>{user.displayName}</strong>
              <br />
              <span className="muted">@{user.username}</span>
            </span>
          </div>
          <FollowButton targetUsername={user.username} initialFollowing={profile.viewerFollows} />
        </div>

        {user.bio ? <p style={{ marginTop: 12 }}>{user.bio}</p> : null}

        <div className="row" style={{ gap: 20, marginTop: 12 }}>
          <span className="muted"><strong className="num">{profile.followerCount}</strong> followers</span>
          <span className="muted"><strong className="num">{profile.followingCount}</strong> following</span>
          <span className="muted"><strong className="num">{profile.tradeCount}</strong> trades</span>
        </div>

        <a className="muted" style={{ fontSize: 11, marginTop: 10, display: "inline-block" }} href={addressUrl(user.walletAddress)} target="_blank" rel="noreferrer">
          {shortAddress(user.walletAddress)} ↗
        </a>
      </div>

      <div className="fobs-surface p-6">
        <h2 className="text-sm font-semibold" style={{ marginBottom: 12 }}>Holdings</h2>
        {profile.holdings.length === 0 ? (
          <p className="muted">No open positions.</p>
        ) : (
          <div className="stack">
            {profile.holdings.map((h) => (
              <Link key={h.symbol} href={`/stocks/${h.symbol}` as Route} className="row" style={{ borderTop: "1px solid #efeee9", paddingTop: 10 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{h.symbol}</div>
                  <div className="muted" style={{ fontSize: 11 }}>{qty(h.quantity)} @ avg {fmtPrice(h.avgPrice)}</div>
                </div>
                <div className="text-right">
                  <div className="num" style={{ fontSize: 13 }}>{money(h.valueUsd)}</div>
                  <div className="num" style={{ fontSize: 11, color: h.pnlPct == null ? "#9b9c95" : h.pnlPct >= 0 ? "#23845b" : "#c94c4c" }}>{pct(h.pnlPct)}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="fobs-surface p-6">
        <h2 className="text-sm font-semibold" style={{ marginBottom: 12 }}>Trade history</h2>
        {profile.trades.length === 0 ? (
          <p className="muted">No trades yet.</p>
        ) : (
          <div className="stack">
            {profile.trades.map((t) => (
              <div key={t.id} className="row" style={{ borderTop: "1px solid #efeee9", paddingTop: 10 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{t.side === "buy" ? "Bought" : "Sold"} {t.symbol}</div>
                  <div className="muted" style={{ fontSize: 11 }}>{ago(t.createdAt)}</div>
                </div>
                <div className="text-right">
                  <div className="num" style={{ fontSize: 13 }}>{money(t.amountUsd)}</div>
                  {t.txHash ? (
                    <a className="muted" style={{ fontSize: 11 }} href={txUrl(t.txHash)} target="_blank" rel="noreferrer">{shortHash(t.txHash)} ↗</a>
                  ) : (
                    <span className="chip">{t.status}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="muted" style={{ fontSize: 11, marginTop: 12 }}>
          Performance is read from real on-chain activity. Fobs does not invent profitability.
        </p>
      </div>
    </div>
  );
}
