import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Play, Plus, Check, TrendingUp } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { getTrending } from "@/lib/api";
import type { MediaItem } from "@/lib/api";
import { useWatchlist } from "@/hooks/useWatchlist";

function RankBadge({ rank }: { rank: number }) {
  const isTop3 = rank <= 3;
  return (
    <div
      style={{
        fontFamily: "'Bebas Neue', sans-serif",
        fontSize: isTop3 ? "72px" : "48px",
        lineHeight: 1,
        letterSpacing: "-2px",
        color: isTop3 ? "#7F77DD" : "#2a2a2a",
        WebkitTextStroke: isTop3 ? "0" : "1px #333",
        flexShrink: 0,
        width: isTop3 ? "72px" : "52px",
        textAlign: "right",
        userSelect: "none",
      }}
    >
      {String(rank).padStart(2, "0")}
    </div>
  );
}

function TopThreeCard({ item, rank }: { item: MediaItem; rank: number }) {
  const [, setLocation] = useLocation();
  const { toggleWatchlist, isInWatchlist } = useWatchlist();
  const inList = isInWatchlist(item.id);

  const watchUrl =
    item.type === "tv"
      ? `/watch/${item.id}?title=${encodeURIComponent(item.title)}&type=tv&season=1&episode=1`
      : `/watch/${item.id}?title=${encodeURIComponent(item.title)}&type=movie`;

  return (
    <div
      className="group"
      style={{
        flex: 1,
        minWidth: 0,
        borderRadius: "14px",
        overflow: "hidden",
        position: "relative",
        border: "1px solid rgba(255,255,255,0.06)",
        cursor: "pointer",
      }}
      onClick={() => setLocation(`/title/${item.id}?type=${item.type}`)}
    >
      {/* Backdrop */}
      <div style={{ aspectRatio: "16/9", position: "relative", overflow: "hidden" }}>
        {item.backdrop ? (
          <img
            src={item.backdrop}
            alt={item.title}
            style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.5s" }}
            className="group-hover:scale-105"
          />
        ) : (
          <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg,#1a1a2e,#0f3460)" }} />
        )}
        {/* Gradient overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(to top, rgba(10,10,10,0.95) 0%, rgba(10,10,10,0.2) 60%, transparent 100%)",
          }}
        />

        {/* Rank number */}
        <div
          style={{
            position: "absolute",
            top: "10px",
            left: "14px",
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: "20px",
            letterSpacing: "1px",
            color: "#fff",
            background: rank === 1 ? "#7F77DD" : rank === 2 ? "#5a5a9a" : "#3a3a6a",
            borderRadius: "5px",
            padding: "2px 10px",
            lineHeight: 1.4,
          }}
        >
          #{rank}
        </div>

        {/* Type badge */}
        <div
          style={{
            position: "absolute",
            top: "10px",
            right: "10px",
            fontSize: "9px",
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#9D97E8",
            background: "rgba(127,119,221,0.15)",
            border: "1px solid rgba(127,119,221,0.25)",
            borderRadius: "3px",
            padding: "2px 7px",
          }}
        >
          {item.type === "tv" ? "Series" : "Movie"}
        </div>

        {/* Bottom info */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "14px 16px" }}>
          <p
            style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: "22px",
              letterSpacing: "1px",
              color: "#fff",
              marginBottom: "6px",
              lineHeight: 1,
            }}
          >
            {item.title}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {item.year && <span style={{ fontSize: "11px", color: "#aaa" }}>{item.year}</span>}
            {item.rating && (
              <span style={{ fontSize: "11px", color: "#f5c518", fontWeight: 600 }}>★ {item.rating.toFixed(1)}</span>
            )}
            {item.genres?.[0] && (
              <span style={{ fontSize: "10px", color: "#888" }}>{item.genres[0]}</span>
            )}
          </div>
        </div>
      </div>

      {/* Action row */}
      <div
        style={{
          background: "#111",
          padding: "10px 14px",
          display: "flex",
          gap: "8px",
          alignItems: "center",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setLocation(watchUrl)}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "7px",
            background: "#7F77DD",
            color: "#fff",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "12px",
            fontWeight: 600,
            padding: "9px",
            borderRadius: "7px",
            border: "none",
            cursor: "pointer",
            transition: "background 0.2s",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#9590e8"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#7F77DD"; }}
        >
          <Play size={13} fill="white" /> Play
        </button>
        <button
          onClick={() => toggleWatchlist(item)}
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "7px",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: inList ? "#7F77DD" : "#aaa",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s",
            flexShrink: 0,
          }}
        >
          {inList ? <Check size={14} /> : <Plus size={14} />}
        </button>
      </div>
    </div>
  );
}

function ListRow({ item, rank }: { item: MediaItem; rank: number }) {
  const [, setLocation] = useLocation();
  const { toggleWatchlist, isInWatchlist } = useWatchlist();
  const inList = isInWatchlist(item.id);

  const watchUrl =
    item.type === "tv"
      ? `/watch/${item.id}?title=${encodeURIComponent(item.title)}&type=tv&season=1&episode=1`
      : `/watch/${item.id}?title=${encodeURIComponent(item.title)}&type=movie`;

  return (
    <div
      className="group flex items-center gap-5"
      style={{
        padding: "12px 16px",
        borderRadius: "10px",
        border: "1px solid rgba(255,255,255,0.04)",
        background: "transparent",
        transition: "background 0.2s, border-color 0.2s",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)";
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = "transparent";
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.04)";
      }}
      onClick={() => setLocation(`/title/${item.id}?type=${item.type}`)}
    >
      <RankBadge rank={rank} />

      {/* Thumbnail */}
      <div
        style={{
          flexShrink: 0,
          width: "96px",
          aspectRatio: "16/9",
          borderRadius: "7px",
          overflow: "hidden",
          background: "#161616",
          position: "relative",
        }}
      >
        {item.backdrop ? (
          <img
            src={item.backdrop}
            alt={item.title}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            className="group-hover:scale-105 transition-transform duration-500"
          />
        ) : item.poster ? (
          <img
            src={item.poster}
            alt={item.title}
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", background: "#1a1a2e" }} />
        )}
        <div
          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: "rgba(0,0,0,0.4)" }}
        >
          <Play size={16} fill="white" style={{ color: "white" }} />
        </div>
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "14px",
            fontWeight: 600,
            color: "#f0f0f0",
            marginBottom: "4px",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {item.title}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {item.year && <span style={{ fontSize: "11px", color: "#666" }}>{item.year}</span>}
          {item.rating && (
            <span style={{ fontSize: "11px", color: "#f5c518", fontWeight: 600 }}>★ {item.rating.toFixed(1)}</span>
          )}
          {item.genres?.[0] && (
            <span
              style={{
                fontSize: "10px",
                color: "#7F77DD",
                background: "rgba(127,119,221,0.1)",
                border: "1px solid rgba(127,119,221,0.2)",
                borderRadius: "3px",
                padding: "1px 6px",
              }}
            >
              {item.genres[0]}
            </span>
          )}
          <span
            style={{
              fontSize: "10px",
              color: "#555",
              background: "#161616",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "3px",
              padding: "1px 6px",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            {item.type === "tv" ? "Series" : "Movie"}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div
        className="flex gap-2 items-center opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ flexShrink: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setLocation(watchUrl)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            background: "#7F77DD",
            color: "#fff",
            fontSize: "12px",
            fontWeight: 600,
            padding: "7px 14px",
            borderRadius: "6px",
            border: "none",
            cursor: "pointer",
            whiteSpace: "nowrap",
            transition: "background 0.2s",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#9590e8"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#7F77DD"; }}
        >
          <Play size={12} fill="white" /> Play
        </button>
        <button
          onClick={() => toggleWatchlist(item)}
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "6px",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: inList ? "#7F77DD" : "#aaa",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {inList ? <Check size={13} /> : <Plus size={13} />}
        </button>
      </div>
    </div>
  );
}

export default function TrendingPage() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "movie" | "tv">("all");

  useEffect(() => {
    getTrending().then((data) => {
      setItems(data);
      setLoading(false);
    });
  }, []);

  const filtered = filter === "all" ? items : items.filter((i) => i.type === filter);
  const top3 = filtered.slice(0, 3);
  const rest = filtered.slice(3);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0a0a0a", color: "#f0f0f0" }}>
      <Navbar />

      {/* Header */}
      <div style={{ padding: "96px 40px 32px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "10px",
                  background: "rgba(127,119,221,0.12)",
                  border: "1px solid rgba(127,119,221,0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#7F77DD",
                }}
              >
                <TrendingUp size={18} />
              </div>
              <div>
                <h1
                  style={{
                    fontFamily: "'Bebas Neue', sans-serif",
                    fontSize: "40px",
                    letterSpacing: "2px",
                    color: "#fff",
                    lineHeight: 1,
                  }}
                >
                  Trending This Week
                </h1>
                <p style={{ fontSize: "12px", color: "#555", marginTop: "2px" }}>
                  {filtered.length} titles · Updated daily
                </p>
              </div>
            </div>

            {/* Filter tabs */}
            <div
              style={{
                display: "flex",
                gap: "4px",
                background: "#111",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: "9px",
                padding: "4px",
              }}
            >
              {(["all", "movie", "tv"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    padding: "6px 16px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: 500,
                    background: filter === f ? "#7F77DD" : "transparent",
                    color: filter === f ? "#fff" : "#777",
                    border: "none",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    whiteSpace: "nowrap",
                  }}
                >
                  {f === "all" ? "All" : f === "movie" ? "Movies" : "TV Shows"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "36px 40px 64px" }}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                style={{
                  height: "72px",
                  borderRadius: "10px",
                  background: "linear-gradient(110deg,#111 30%,#181818 50%,#111 70%)",
                  backgroundSize: "200% 100%",
                  animation: "shimmer 1.5s infinite",
                }}
              />
            ))}
          </div>
        ) : (
          <>
            {/* Top 3 — landscape cards */}
            {top3.length > 0 && (
              <>
                <p
                  style={{
                    fontFamily: "'Bebas Neue', sans-serif",
                    fontSize: "13px",
                    letterSpacing: "0.2em",
                    color: "#555",
                    textTransform: "uppercase",
                    marginBottom: "16px",
                  }}
                >
                  Top Picks
                </p>
                <div style={{ display: "flex", gap: "16px", marginBottom: "40px", flexWrap: "wrap" }}>
                  {top3.map((item, i) => (
                    <TopThreeCard key={item.id} item={item} rank={i + 1} />
                  ))}
                </div>
              </>
            )}

            {/* Rest — ranked list */}
            {rest.length > 0 && (
              <>
                <p
                  style={{
                    fontFamily: "'Bebas Neue', sans-serif",
                    fontSize: "13px",
                    letterSpacing: "0.2em",
                    color: "#555",
                    textTransform: "uppercase",
                    marginBottom: "12px",
                  }}
                >
                  Also Trending
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  {rest.map((item, i) => (
                    <ListRow key={item.id} item={item} rank={i + 4} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
      `}</style>
    </div>
  );
}
