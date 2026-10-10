"use client";

import { useState } from "react";
import type { FeedPost, FeedView as FeedViewName } from "@/lib/types";
import { FeedCard } from "./trade-card";
import { useFobsAddress } from "@/components/connect-wallet-button";

const TABS: { id: FeedViewName; label: string }[] = [
  { id: "for-you", label: "For you" },
  { id: "following", label: "Following" },
  { id: "trending", label: "Trending" }
];

export function FeedView({ initial }: { initial: FeedPost[] }) {
  const address = useFobsAddress();
  const [view, setView] = useState<FeedViewName>("for-you");
  const [posts, setPosts] = useState<FeedPost[]>(initial);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);

  async function load(next: FeedViewName) {
    setView(next);
    setLoading(true);
    try {
      const params = new URLSearchParams({ view: next });
      if (address) params.set("address", address);
      const res = await fetch(`/api/feed?${params.toString()}`);
      const data = await res.json();
      setPosts(data.posts ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function post() {
    if (!address || !draft.trim()) return;
    setPosting(true);
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address, content: draft.trim() })
      });
      if (res.ok) {
        const { post: created } = await res.json();
        setDraft("");
        if (view !== "following") setPosts((prev) => [created, ...prev]);
      }
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="stack">
      <div className="segmented" role="tablist" style={{ maxWidth: 360 }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={view === tab.id}
            className={view === tab.id ? "active" : ""}
            onClick={() => load(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="card">
        <textarea
          className="input"
          rows={2}
          placeholder={address ? "Share a thesis…" : "Connect a wallet to post"}
          value={draft}
          disabled={!address || posting}
          onChange={(e) => setDraft(e.target.value)}
        />
        <div className="row" style={{ justifyContent: "flex-end", marginTop: 8 }}>
          <button className="fobs-button-primary" onClick={post} disabled={!address || posting || !draft.trim()}>
            {posting ? "Posting…" : "Post"}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : posts.length === 0 ? (
        <div className="card">
          <h3>Nothing here yet</h3>
          <p className="muted">
            {view === "following"
              ? "Nobody you follow has posted yet. Find people to follow, or switch to For you."
              : "No posts yet. Make a trade from Markets to start the feed."}
          </p>
        </div>
      ) : (
        posts.map((p) => <FeedCard key={p.id} post={p} />)
      )}
    </div>
  );
}
