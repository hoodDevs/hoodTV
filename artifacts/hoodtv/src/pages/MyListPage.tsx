import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Play, Plus, Check, Film, Tv, X, Bookmark, TrendingUp, Star, Clock } from "lucide-react";
import { useWatchlist } from "@/hooks/useWatchlist";
import type { MediaItem } from "@/lib/api";

type Filter = "all" | "movie" | "tv";
type Sort = "added" | "rating" | "year" | "az";

function ListItem({ item, onRemove }: { item: MediaItem; onRemove: () => void }) {
  const [, setLocation] = useLocation();
  const { toggleWatchlist, isInWatchlist } = useWatchlist();
  const inList = isInWatchlist(item.id);
  const [imgErr, setImgErr] = useState(false);

  const watchUrl =
    item.type === "tv"
      ? `/watch/${item.id}?title=${encodeURIComponent(item.title)}&type=tv&season=1&episode=1`
      : `/watch/${item.id}?title=${encodeURIComponent(item.title)}&type=movie`;

  return (
    <div
      className="group flex items-center gap-5"
      style={{
        padding: "12px 16px",
        borderRadius: "12px",
        border: "1px solid rgba(255,255,255,0.05)",
        background: "rgba(255,255,255,0.02)",
        transition: "background 0.2s, border-color 0.2s",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = "rgba(127,119,221,0.05)";
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(127,119,221,0.18)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)";
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.05)";
      }}
      onClick={() => setLocation(`/title/${item.id}?type=${item.type}`)}
      data-testid={`card-media-${item.id}`}
    >
      {/* Poster thumbnail */}
      <div
        style={{
          flexShrink: 0,
          width: "52px",
          aspectRatio: "2/3",
          borderRadius: "7px",
          overflow: "hidden",
          background: "#161616",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {item.poster && !imgErr ? (
          <img
            src={item.poster}
            alt={item.title}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={() => setImgErr(true)}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#1a1a2e",
            }}
          >
            {item.type === "tv" ? (
              <Tv size={16} style={{ color: "#7F77DD", opacity: 0.5 }} />
            ) : (
              <Film size={16} style={{ color: "#7F77DD", opacity: 0.5 }} />
            )}
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
          <p
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "#f0f0f0",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {item.title}
          </p>
          <span
            style={{
              flexShrink: 0,
              fontSize: "9px",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: item.type === "tv" ? "#9D97E8" : "#888",
              background: item.type === "tv" ? "rgba(127,119,221,0.1)" : "rgba(255,255,255,0.06)",
              border: `1px solid ${item.type === "tv" ? "rgba(127,119,221,0.2)" : "rgba(255,255,255,0.08)"}`,
              borderRadius: "3px",
              padding: "2px 6px",
            }}
          >
            {item.type === "tv" ? "Series" : "Movie"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {item.year && <span style={{ fontSize: "11px", color: "#666" }}>{item.year}</span>}
          {item.rating && (
            <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
              <Star size={10} fill="#f5c518" stroke="none" />
              <span style={{ fontSize: "11px", color: "#888", fontWeight: 500 }}>{item.rating.toFixed(1)}</span>
            </div>
          )}
          {item.genres?.slice(0, 2).map((g) => (
            <span key={g} style={{ fontSize: "10px", color: "#666" }}>{g}</span>
          ))}
        </div>
      </div>

      {/* Actions — visible on hover */}
      <div
        className="flex gap-2 items-center opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ flexShrink: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setLocation(watchUrl)}
          data-testid={`play-${item.id}`}
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
          onClick={onRemove}
          data-testid={`remove-${item.id}`}
          title="Remove from My List"
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "6px",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "#666",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "rgba(220,50,50,0.12)";
            (e.currentTarget as HTMLElement).style.color = "#e05c5c";
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(220,50,50,0.25)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
            (e.currentTarget as HTMLElement).style.color = "#666";
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)";
          }}
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}

export default function MyListPage() {
  const { watchlist, removeFromWatchlist } = useWatchlist();
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("added");

  const movieCount = watchlist.filter((i) => i.type === "movie").length;
  const tvCount = watchlist.filter((i) => i.type === "tv").length;

  const filtered = watchlist.filter((i) => filter === "all" || i.type === filter);
  const sorted = [...filtered].sort((a, b) => {
    if (sort === "rating") return (b.rating ?? 0) - (a.rating ?? 0);
    if (sort === "year") return Number(b.year ?? 0) - Number(a.year ?? 0);
    if (sort === "az") return a.title.localeCompare(b.title);
    return 0;
  });

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0a0a0a", color: "#f0f0f0" }}>

      {watchlist.length === 0 ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "80vh",
            textAlign: "center",
            padding: "40px",
          }}
          data-testid="mylist-empty"
        >
          <div
            style={{
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              background: "rgba(127,119,221,0.08)",
              border: "1px solid rgba(127,119,221,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "20px",
            }}
          >
            <Bookmark size={32} style={{ color: "#7F77DD" }} />
          </div>
          <h1
            style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: "36px",
              letterSpacing: "2px",
              color: "#fff",
              marginBottom: "10px",
            }}
          >
            Your List is Empty
          </h1>
          <p style={{ fontSize: "14px", color: "#666", maxWidth: "340px", lineHeight: 1.7, marginBottom: "28px" }}>
            Save movies and shows by tapping "+ My List" on any title. They'll appear here.
          </p>
          <div style={{ display: "flex", gap: "10px" }}>
            <Link href="/movies">
              <button
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "7px",
                  background: "#7F77DD",
                  color: "#fff",
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "13px",
                  fontWeight: 600,
                  padding: "11px 22px",
                  borderRadius: "8px",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <Film size={15} /> Browse Movies
              </button>
            </Link>
            <Link href="/trending">
              <button
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "7px",
                  background: "rgba(255,255,255,0.06)",
                  color: "#aaa",
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: "13px",
                  fontWeight: 500,
                  padding: "11px 22px",
                  borderRadius: "8px",
                  border: "1px solid rgba(255,255,255,0.1)",
                  cursor: "pointer",
                }}
              >
                <TrendingUp size={15} /> Trending
              </button>
            </Link>
          </div>
        </div>
      ) : (
        <div style={{ maxWidth: "860px", margin: "0 auto", padding: "96px 40px 64px" }}>
          {/* Header */}
          <div style={{ marginBottom: "28px" }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
              <div>
                <h1
                  style={{
                    fontFamily: "'Bebas Neue', sans-serif",
                    fontSize: "40px",
                    letterSpacing: "2px",
                    color: "#fff",
                    lineHeight: 1,
                    marginBottom: "6px",
                  }}
                >
                  My List
                </h1>
                <p style={{ fontSize: "12px", color: "#555" }}>
                  {watchlist.length} saved · {movieCount} movie{movieCount !== 1 ? "s" : ""} · {tvCount} show{tvCount !== 1 ? "s" : ""}
                </p>
              </div>

              {/* Sort */}
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                style={{
                  padding: "7px 14px",
                  borderRadius: "7px",
                  color: "#f0f0f0",
                  fontSize: "12px",
                  fontWeight: 500,
                  outline: "none",
                  cursor: "pointer",
                  background: "#161616",
                  border: "1px solid rgba(255,255,255,0.08)",
                  appearance: "none",
                }}
              >
                <option value="added">Recently Added</option>
                <option value="rating">Top Rated</option>
                <option value="year">Newest First</option>
                <option value="az">A–Z</option>
              </select>
            </div>

            {/* Filter tabs */}
            <div
              style={{
                display: "flex",
                gap: "6px",
                marginTop: "18px",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                paddingBottom: "0",
              }}
            >
              {(["all", "movie", "tv"] as Filter[]).map((f) => {
                const count = f === "all" ? watchlist.length : f === "movie" ? movieCount : tvCount;
                const active = filter === f;
                return (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    style={{
                      padding: "8px 16px 10px",
                      fontSize: "12px",
                      fontWeight: 500,
                      background: "none",
                      border: "none",
                      borderBottom: active ? "2px solid #7F77DD" : "2px solid transparent",
                      color: active ? "#9D97E8" : "#666",
                      cursor: "pointer",
                      transition: "color 0.2s",
                      marginBottom: "-1px",
                    }}
                  >
                    {f === "all" ? "All" : f === "movie" ? "Movies" : "TV Shows"}
                    <span style={{ marginLeft: "6px", color: active ? "#7F77DD" : "#444" }}>({count})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* List */}
          {sorted.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 0", color: "#555" }}>
              <p>No {filter === "movie" ? "movies" : "TV shows"} saved yet.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }} data-testid="mylist-grid">
              {sorted.map((item) => (
                <ListItem
                  key={item.id}
                  item={item}
                  onRemove={() => removeFromWatchlist(item.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
