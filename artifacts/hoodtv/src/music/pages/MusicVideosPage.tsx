import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Search, Play, Clock, ArrowLeft } from "lucide-react";
import { MINI_PLAYER_HEIGHT } from "../components/MiniPlayer";

export interface YtVideo {
  id: string;
  title: string;
  author: string;
  authorId: string;
  duration: string;
  durationSeconds: number;
  thumbnail: string;
  views: string;
  publishedAt: string;
}

async function fetchVideos(q: string): Promise<YtVideo[]> {
  const res = await fetch(`/api/yt/videos?${new URLSearchParams({ q, limit: "24" })}`);
  if (!res.ok) throw new Error("Failed to fetch videos");
  const data = await res.json();
  return data.videos ?? [];
}

function useDebounce(value: string, ms = 500) {
  const [d, setD] = useState(value);
  import("react").then(({ useEffect }) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
  });
  // manual debounce via state
  return d;
}

function VideoCard({ video, onClick }: { video: YtVideo; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        cursor: "pointer",
        background: "transparent",
        borderRadius: 10,
        overflow: "hidden",
        transition: "transform 0.15s",
      }}
      className="yt-card"
    >
      {/* Thumbnail */}
      <div style={{ position: "relative", paddingTop: "56.25%", background: "#111", borderRadius: 8, overflow: "hidden", marginBottom: 10 }}>
        <img
          src={video.thumbnail}
          alt={video.title}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          loading="lazy"
        />
        {/* Duration chip */}
        {video.duration && (
          <div
            style={{
              position: "absolute",
              bottom: 6,
              right: 6,
              background: "rgba(0,0,0,0.85)",
              color: "#fff",
              fontSize: 11,
              fontWeight: 600,
              padding: "2px 6px",
              borderRadius: 4,
              fontFamily: "monospace",
            }}
          >
            {video.duration}
          </div>
        )}
        {/* Hover play overlay */}
        <div
          className="yt-card-overlay"
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background 0.2s",
          }}
        >
          <div
            className="yt-card-play"
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              background: "rgba(0,0,0,0.7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: 0,
              transition: "opacity 0.2s",
            }}
          >
            <Play size={20} fill="#fff" color="#fff" strokeWidth={0} />
          </div>
        </div>
      </div>

      {/* Info */}
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 13.5,
              fontWeight: 500,
              color: "#e8e8e8",
              lineHeight: 1.35,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              marginBottom: 4,
            }}
          >
            {video.title}
          </div>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 2 }}>{video.author}</div>
          <div style={{ fontSize: 11.5, color: "#555" }}>
            {video.views}{video.views && video.publishedAt ? " · " : ""}{video.publishedAt}
          </div>
        </div>
      </div>

      <style>{`
        .yt-card:hover { transform: scale(1.02) !important; }
        .yt-card:hover .yt-card-overlay { background: rgba(0,0,0,0.2) !important; }
        .yt-card:hover .yt-card-play { opacity: 1 !important; }
      `}</style>
    </div>
  );
}

export function MusicVideosPage() {
  const [, navigate] = useLocation();
  const [searchInput, setSearchInput] = useState("");
  const [activeQuery, setActiveQuery] = useState("official music video 2024");

  const { data: videos = [], isLoading, isError } = useQuery<YtVideo[]>({
    queryKey: ["yt-videos", activeQuery],
    queryFn: () => fetchVideos(activeQuery),
    staleTime: 5 * 60 * 1000,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) setActiveQuery(searchInput.trim());
  };

  const isDefaultFeed = activeQuery === "official music video 2024";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#05050c",
        fontFamily: "'DM Sans', sans-serif",
        paddingBottom: `${MINI_PLAYER_HEIGHT + 24}px`,
      }}
    >
      {/* Top bar */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "rgba(5,5,12,0.95)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          padding: "14px 28px",
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <button
          onClick={() => navigate("/music")}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#666",
            display: "flex",
            alignItems: "center",
            padding: 0,
          }}
        >
          <ArrowLeft size={20} />
        </button>

        <h1
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 22,
            color: "#f0f0f0",
            letterSpacing: "0.06em",
            flexShrink: 0,
          }}
        >
          Music Videos
        </h1>

        <form onSubmit={handleSearch} style={{ flex: 1, maxWidth: 520 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 22,
              padding: "8px 16px",
              transition: "border-color 0.2s",
            }}
          >
            <Search size={14} color="#555" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search music videos…"
              style={{
                background: "none",
                border: "none",
                outline: "none",
                color: "#e0e0e0",
                fontSize: 13.5,
                flex: 1,
                fontFamily: "'DM Sans', sans-serif",
              }}
            />
            {searchInput && (
              <button
                type="submit"
                style={{
                  background: "#7F77DD",
                  border: "none",
                  cursor: "pointer",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "4px 12px",
                  borderRadius: 12,
                }}
              >
                Search
              </button>
            )}
          </div>
        </form>
      </div>

      <div style={{ padding: "24px 28px" }}>
        {!isDefaultFeed && (
          <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 14, color: "#777" }}>
              Results for <span style={{ color: "#c0bdf5" }}>"{activeQuery}"</span>
            </span>
            <button
              onClick={() => { setActiveQuery("official music video 2024"); setSearchInput(""); }}
              style={{
                background: "none",
                border: "1px solid rgba(255,255,255,0.1)",
                cursor: "pointer",
                color: "#555",
                fontSize: 11.5,
                borderRadius: 12,
                padding: "2px 10px",
              }}
            >
              ✕ clear
            </button>
          </div>
        )}

        {isLoading && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: 20,
            }}
          >
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i}>
                <div
                  style={{
                    paddingTop: "56.25%",
                    borderRadius: 8,
                    background: "linear-gradient(90deg, #111 25%, #1a1a2e 50%, #111 75%)",
                    backgroundSize: "200% 100%",
                    animation: "shimmer 1.5s infinite",
                    marginBottom: 10,
                  }}
                />
                <div style={{ height: 14, background: "#111", borderRadius: 4, marginBottom: 6, width: "90%" }} />
                <div style={{ height: 12, background: "#0d0d0d", borderRadius: 4, width: "60%" }} />
              </div>
            ))}
          </div>
        )}

        {isError && (
          <div
            style={{
              textAlign: "center",
              padding: "80px 0",
              color: "#444",
            }}
          >
            <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
            <div style={{ fontSize: 14 }}>Could not load videos — YouTube service may be starting up. Try again in a moment.</div>
            <button
              onClick={() => setActiveQuery(activeQuery + " ")}
              style={{
                marginTop: 16,
                background: "#7F77DD",
                border: "none",
                cursor: "pointer",
                color: "#fff",
                padding: "8px 20px",
                borderRadius: 20,
                fontSize: 13,
              }}
            >
              Retry
            </button>
          </div>
        )}

        {!isLoading && !isError && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: 24,
            }}
          >
            {videos.map((v) => (
              <VideoCard
                key={v.id}
                video={v}
                onClick={() => navigate(`/music/videos/${v.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
    </div>
  );
}
