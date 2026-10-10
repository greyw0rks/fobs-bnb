"use client";

// One post in the feed. When it is trade-backed it renders as a trade card —
// the social primitive — with the side, symbol, real figures and a BscScan
// link. The only invented-free rule holds: a null price renders as an em dash.
//
// Actions: Like (real, optimistic), Comment (inline), and Trade (routes to the
// asset so you can take the same position in YOUR size — never a one-click copy
// of someone else's).

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Heart, MessageCircle, Repeat2, ExternalLink } from "lucide-react";
import type { Comment, FeedPost } from "@/lib/types";
import { ago, money, price as fmtPrice, qty, shortHash, txUrl } from "@/lib/format";
import { Avatar } from "@/components/avatar";
import { PostText } from "@/components/feed/post-text";
import { useFobsAddress } from "@/components/connect-wallet-button";

export function FeedCard({ post }: { post: FeedPost }) {
  const address = useFobsAddress();
  const trade = post.trade;
  const [liked, setLiked] = useState(post.viewerLiked);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState("");
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [loadingComments, setLoadingComments] = useState(false);
  const [busy, setBusy] = useState(false);

  async function toggleComments() {
    const next = !showComment;
    setShowComment(next);
    // Load the thread the first time it's opened.
    if (next && comments === null && !loadingComments) {
      setLoadingComments(true);
      try {
        const res = await fetch(`/api/posts/${post.id}/comment`);
        const data = await res.json();
        setComments(res.ok ? (data.comments ?? []) : []);
      } catch {
        setComments([]);
      } finally {
        setLoadingComments(false);
      }
    }
  }

  async function toggleLike() {
    if (!address) return;
    // Optimistic.
    const next = !liked;
    setLiked(next);
    setLikeCount((n) => n + (next ? 1 : -1));
    try {
      await fetch(`/api/posts/${post.id}/like`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address })
      });
    } catch {
      // Revert on failure.
      setLiked(!next);
      setLikeCount((n) => n + (next ? -1 : 1));
    }
  }

  async function submitComment() {
    if (!address || !comment.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/posts/${post.id}/comment`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address, content: comment.trim() })
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        setComment("");
        setCommentCount((n) => n + 1);
        if (data?.comment) setComments((prev) => [...(prev ?? []), data.comment as Comment]);
      }
    } finally {
      setBusy(false);
    }
  }

  const verb = trade ? (trade.side === "buy" ? "Bought" : "Sold") : null;

  return (
    <article className={`card trade-card ${trade ? trade.side : ""}`}>
      <div className="row">
        <div className="user">
          <Avatar name={post.user.displayName} avatar={post.user.avatarUrl} />
          <span>
            <strong>
              <Link href={`/profile/${post.user.username}` as Route}>{post.user.displayName}</Link>
            </strong>
            <br />
            <span className="muted">
              @{post.user.username} ·{" "}
              {trade ? (
                <Link href={`/trade/${trade.id}` as Route} className="muted">{ago(post.createdAt)}</Link>
              ) : (
                ago(post.createdAt)
              )}
            </span>
          </span>
        </div>
        {trade ? (
          <Link href={`/stocks/${trade.symbol}` as Route} className="button fomo">
            Trade {trade.symbol}
          </Link>
        ) : null}
      </div>

      {post.content ? <p style={{ marginTop: 4 }}><PostText content={post.content} /></p> : null}

      {trade ? (
        <div className="trade-hero">
          <div>
            <h3 className="trade-title">
              {verb} <span className="num">{trade.symbol}</span>
            </h3>
            <p className="figures">
              {trade.quantity !== null ? `${qty(trade.quantity)} tokens` : "—"} at {fmtPrice(trade.price)}
            </p>
          </div>
          <div className="text-right">
            <span className="num trade-amount">{money(trade.amountUsd)}</span>
            <br />
            <span className="chip">{trade.status === "confirmed" ? "On chain" : trade.status}</span>
          </div>
        </div>
      ) : null}

      <div className="card-footer">
        <button
          type="button"
          className="muted"
          onClick={toggleLike}
          disabled={!address}
          aria-pressed={liked}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, color: liked ? "#c94c4c" : undefined }}
          title={address ? "Like" : "Connect a wallet to like"}
        >
          <Heart size={14} fill={liked ? "#c94c4c" : "none"} /> {likeCount > 0 ? likeCount : ""}
        </button>

        <button
          type="button"
          className="muted"
          onClick={toggleComments}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <MessageCircle size={14} /> {commentCount > 0 ? commentCount : ""}
        </button>

        {trade ? (
          <Link href={`/stocks/${trade.symbol}` as Route} className="muted" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Repeat2 size={14} /> Trade
          </Link>
        ) : null}

        {trade?.txHash ? (
          <a className="muted" href={txUrl(trade.txHash)} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <ExternalLink size={13} /> {shortHash(trade.txHash)}
          </a>
        ) : null}
      </div>

      {showComment ? (
        <div className="stack" style={{ marginTop: 10, gap: 10 }}>
          {loadingComments ? (
            <p className="muted" style={{ fontSize: 12 }}>Loading comments…</p>
          ) : comments && comments.length > 0 ? (
            <div className="stack" style={{ gap: 8 }}>
              {comments.map((c) => (
                <div key={c.id} className="user" style={{ alignItems: "flex-start", gap: 8 }}>
                  <Avatar name={c.user.displayName} avatar={c.user.avatarUrl} />
                  <span style={{ fontSize: 13 }}>
                    <strong>{c.user.displayName}</strong>{" "}
                    <span className="muted" style={{ fontSize: 11 }}>@{c.user.username} · {ago(c.createdAt)}</span>
                    <br />
                    {c.content}
                  </span>
                </div>
              ))}
            </div>
          ) : comments ? (
            <p className="muted" style={{ fontSize: 12 }}>No comments yet.</p>
          ) : null}

          <div className="row" style={{ gap: 8 }}>
            <input
              className="input"
              placeholder={address ? "Add a comment…" : "Connect a wallet to comment"}
              value={comment}
              disabled={!address || busy}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitComment()}
            />
            <button className="button" onClick={submitComment} disabled={!address || busy || !comment.trim()}>
              {busy ? "…" : "Reply"}
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}
