import Link from "next/link";
import type { Route } from "next";
import { tryDb } from "@/lib/db";
import { Avatar } from "@/components/avatar";
import { FollowButton } from "@/components/follow-button";

export const dynamic = "force-dynamic";

export default async function FriendsPage() {
  const people = await tryDb((db) =>
    db.user.findMany({
      orderBy: { trades: { _count: "desc" } },
      take: 30,
      select: {
        username: true,
        displayName: true,
        avatarUrl: true,
        _count: { select: { followers: true, trades: true } }
      }
    })
  );

  return (
    <div className="stack" style={{ maxWidth: 640 }}>
      <header>
        <h1 className="trade-title" style={{ fontSize: 22 }}>People</h1>
        <p className="muted">Traders on Fobs. Follow them to fill your Following feed.</p>
      </header>

      {!people || people.length === 0 ? (
        <div className="card">
          <h3>No one here yet</h3>
          <p className="muted">Once wallets connect and trade, the most active traders show up here to follow.</p>
        </div>
      ) : (
        <div className="fobs-surface p-2">
          {people.map((u) => (
            <div key={u.username} className="row" style={{ padding: "12px 8px", borderBottom: "1px solid #efeee9" }}>
              <Link href={`/profile/${u.username}` as Route} className="user">
                <Avatar name={u.displayName} avatar={u.avatarUrl} />
                <span>
                  <strong>{u.displayName}</strong>
                  <br />
                  <span className="muted">@{u.username} · {u._count.trades} trades · {u._count.followers} followers</span>
                </span>
              </Link>
              <FollowButton targetUsername={u.username} initialFollowing={false} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
