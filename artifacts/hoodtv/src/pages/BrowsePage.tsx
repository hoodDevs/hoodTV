import { useState, useEffect } from "react";
import { MediaCard } from "@/components/MediaCard";
import { Skeleton } from "@/components/ui/skeleton";
import { getMovies, getTVShows, getTMDBMovieGenres, getTMDBTVGenres } from "@/lib/api";
import type { MediaItem } from "@/lib/api";
import { Film, Tv, SlidersHorizontal } from "lucide-react";

interface BrowsePageProps {
  type: "movies" | "tv";
}

export default function BrowsePage({ type }: BrowsePageProps) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [genres, setGenres] = useState<{ id: number; name: string }[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<"trending" | "rating" | "year">("trending");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    const fetchGenres = type === "movies" ? getTMDBMovieGenres : getTMDBTVGenres;
    fetchGenres().then(setGenres);
  }, [type]);

  useEffect(() => {
    setSelectedGenre(null);
  }, [type]);

  useEffect(() => {
    setLoading(true);
    setItems([]);
    setPage(1);
    const fetcher = type === "movies" ? getMovies : getTVShows;
    fetcher(1, selectedGenre ?? undefined).then((data) => {
      setItems(data);
      setLoading(false);
      setHasMore(data.length >= 18);
    });
  }, [type, selectedGenre]);

  const loadMore = async () => {
    setLoadingMore(true);
    const nextPage = page + 1;
    const fetcher = type === "movies" ? getMovies : getTVShows;
    const data = await fetcher(nextPage, selectedGenre ?? undefined);
    setItems((prev) => [...prev, ...data]);
    setPage(nextPage);
    setLoadingMore(false);
    setHasMore(data.length >= 18);
  };

  const filteredAndSorted = [...items].sort((a, b) => {
    if (sortBy === "rating") return (b.rating || 0) - (a.rating || 0);
    if (sortBy === "year") return parseInt(b.year || "0") - parseInt(a.year || "0");
    return 0;
  });

  const isMovies = type === "movies";

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0a0a0a", color: "#f0f0f0" }}>

      {/* Page header */}
      <div
        style={{
          paddingTop: "48px",
          paddingBottom: "40px",
          paddingLeft: "40px",
          paddingRight: "40px",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          background: "linear-gradient(to bottom, rgba(127,119,221,0.04) 0%, transparent 100%)",
        }}
      >
        <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "6px" }}>
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
              {isMovies ? <Film size={18} /> : <Tv size={18} />}
            </div>
            <h1
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: "42px",
                letterSpacing: "3px",
                color: "#fff",
                lineHeight: 1,
              }}
            >
              {isMovies ? "Movies" : "TV Shows"}
            </h1>
          </div>
          <p style={{ fontSize: "13px", color: "#666", marginLeft: "54px" }}>
            {isMovies
              ? "Browse thousands of movies across all genres"
              : "Discover the best TV series and binge-worthy shows"}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div
        style={{
          padding: "20px 40px",
          borderBottom: "1px solid rgba(255,255,255,0.04)",
          background: "#0a0a0a",
          position: "sticky",
          top: "68px",
          zIndex: 30,
        }}
      >
        <div
          style={{
            maxWidth: "1400px",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          {/* Genre pills */}
          <div
            className="scrollbar-hide flex items-center gap-2"
            style={{ flex: 1, overflowX: "auto", minWidth: 0 }}
          >
            <button
              onClick={() => setSelectedGenre(null)}
              data-testid="genre-all"
              style={{
                flexShrink: 0,
                padding: "6px 16px",
                borderRadius: "99px",
                fontSize: "12px",
                fontWeight: 500,
                border: selectedGenre === null
                  ? "1px solid #7F77DD"
                  : "1px solid rgba(255,255,255,0.08)",
                background: selectedGenre === null
                  ? "rgba(127,119,221,0.15)"
                  : "rgba(255,255,255,0.04)",
                color: selectedGenre === null ? "#9D97E8" : "#888",
                cursor: "pointer",
                transition: "all 0.2s",
                whiteSpace: "nowrap",
              }}
            >
              All
            </button>
            {genres.map((genre) => {
              const active = selectedGenre === genre.id;
              return (
                <button
                  key={genre.id}
                  onClick={() => setSelectedGenre(active ? null : genre.id)}
                  data-testid={`genre-${genre.id}`}
                  style={{
                    flexShrink: 0,
                    padding: "6px 16px",
                    borderRadius: "99px",
                    fontSize: "12px",
                    fontWeight: 500,
                    border: active
                      ? "1px solid #7F77DD"
                      : "1px solid rgba(255,255,255,0.08)",
                    background: active
                      ? "rgba(127,119,221,0.15)"
                      : "rgba(255,255,255,0.04)",
                    color: active ? "#9D97E8" : "#888",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    whiteSpace: "nowrap",
                  }}
                  onMouseEnter={(e) => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.color = "#f0f0f0";
                      (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.2)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      (e.currentTarget as HTMLElement).style.color = "#888";
                      (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)";
                    }
                  }}
                >
                  {genre.name}
                </button>
              );
            })}
          </div>

          {/* Sort controls */}
          <div
            style={{
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              gap: "6px",
              borderLeft: "1px solid rgba(255,255,255,0.06)",
              paddingLeft: "16px",
            }}
          >
            <SlidersHorizontal size={13} style={{ color: "#555" }} />
            {(["trending", "rating", "year"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                data-testid={`sort-${s}`}
                style={{
                  padding: "5px 12px",
                  borderRadius: "6px",
                  fontSize: "11px",
                  fontWeight: 500,
                  textTransform: "capitalize",
                  border: sortBy === s
                    ? "1px solid rgba(127,119,221,0.4)"
                    : "1px solid transparent",
                  background: sortBy === s ? "rgba(127,119,221,0.12)" : "transparent",
                  color: sortBy === s ? "#9D97E8" : "#666",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  if (sortBy !== s) (e.currentTarget as HTMLElement).style.color = "#f0f0f0";
                }}
                onMouseLeave={(e) => {
                  if (sortBy !== s) (e.currentTarget as HTMLElement).style.color = "#666";
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div style={{ padding: "32px 40px 60px", maxWidth: "1400px", margin: "0 auto" }}>
        {loading ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
              gap: "16px",
            }}
          >
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i}>
                <Skeleton className="aspect-[2/3] rounded-xl w-full bg-[#161616]" />
                <Skeleton className="h-3 w-3/4 mt-2 bg-[#161616] rounded" />
                <Skeleton className="h-3 w-1/2 mt-1 bg-[#161616] rounded" />
              </div>
            ))}
          </div>
        ) : filteredAndSorted.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "80px 0",
              color: "#555",
            }}
          >
            <div style={{ fontSize: "48px", marginBottom: "12px" }}>🎬</div>
            <p style={{ fontSize: "16px", fontWeight: 500, color: "#777" }}>No titles found</p>
            <p style={{ fontSize: "13px", marginTop: "6px" }}>Try a different genre or filter</p>
          </div>
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                gap: "16px",
              }}
            >
              {filteredAndSorted.map((item) => (
                <MediaCard key={item.id} item={item} fill />
              ))}
            </div>

            {hasMore && (
              <div style={{ display: "flex", justifyContent: "center", marginTop: "40px" }}>
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  data-testid="load-more-btn"
                  style={{
                    padding: "12px 36px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#9D97E8",
                    background: "rgba(127,119,221,0.08)",
                    border: "1px solid rgba(127,119,221,0.25)",
                    cursor: loadingMore ? "default" : "pointer",
                    opacity: loadingMore ? 0.5 : 1,
                    transition: "all 0.2s",
                    letterSpacing: "0.04em",
                  }}
                  onMouseEnter={(e) => {
                    if (!loadingMore) {
                      (e.currentTarget as HTMLElement).style.background = "rgba(127,119,221,0.16)";
                      (e.currentTarget as HTMLElement).style.borderColor = "rgba(127,119,221,0.4)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "rgba(127,119,221,0.08)";
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(127,119,221,0.25)";
                  }}
                >
                  {loadingMore ? "Loading…" : "Load More"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
