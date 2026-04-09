import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Search } from "lucide-react";
import { motion } from "framer-motion";
import type { YtVideo } from "./MusicVideosPage";

function useDebounce(value: string, ms = 500) {
  const [d, setD] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setD(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return d;
}

const CHIPS = [
  { label: "All",        q: "official music video 2024" },
  { label: "Hip Hop",   q: "hip hop music video 2024" },
  { label: "Pop",        q: "pop music video 2024" },
  { label: "R&B",        q: "rnb soul music video 2024" },
  { label: "Electronic", q: "electronic music video 2024" },
  { label: "Rock",       q: "rock music video 2024" },
  { label: "Mood & Sound", q: "lofi chill vibes 2024" },
];

function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (Math.imul(31, h) + name.charCodeAt(i)) | 0;
  const hue = Math.abs(h) % 360;
  return `hsl(${hue},55%,45%)`;
}

function VideoCard({ video, onClick }: { video: YtVideo; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const color = avatarColor(video.author || "YT");
  const initials = (video.author || "YT").slice(0, 2).toUpperCase();

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ cursor: "pointer", display: "flex", flexDirection: "column" }}
    >
      {/* Thumbnail */}
      <div style={{
        position: "relative", paddingTop: "56.25%",
        borderRadius: 12, overflow: "hidden",
        background: "#1a1a1a", marginBottom: 12,
        transform: hovered ? "scale(1.02)" : "scale(1)",
        transition: "transform 0.25s ease",
      }}>
        <img
          src={video.thumbnail}
          alt={video.title}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          loading="lazy"
        />
        {video.duration && (
          <span style={{
            position: "absolute", bottom: 6, right: 6,
            background: "rgba(0,0,0,0.85)", color: "#fff",
            fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 4,
            fontFamily: "monospace", letterSpacing: "0.04em",
          }}>
            {video.duration}
          </span>
        )}
      </div>

      {/* Info row */}
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
          background: color, display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: 12, fontWeight: 700,
          color: "#fff", marginTop: 2,
        }}>
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 600,
            color: hovered ? "#c0bdf5" : "#fff",
            lineHeight: 1.4,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            marginBottom: 4,
            transition: "color 0.2s",
          }}>
            {video.title}
          </div>
          <div style={{ fontSize: 12, color: "#aaa", marginBottom: 2 }}>{video.author}</div>
          <div style={{ fontSize: 12, color: "#666" }}>
            {[video.views, video.publishedAt].filter(Boolean).join(" • ")}
          </div>
        </div>
      </div>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "32px 20px" }}>
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i}>
          <div style={{ position: "relative", paddingTop: "56.25%", borderRadius: 12, background: "rgba(255,255,255,0.06)", marginBottom: 12 }} />
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.06)", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ height: 13, borderRadius: 4, background: "rgba(255,255,255,0.06)", marginBottom: 8 }} />
              <div style={{ height: 12, borderRadius: 4, background: "rgba(255,255,255,0.04)", width: "55%", marginBottom: 6 }} />
              <div style={{ height: 11, borderRadius: 4, background: "rgba(255,255,255,0.03)", width: "40%" }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function MusicHomePage() {
  const [, navigate] = useLocation();
  const [activeChip, setActiveChip] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery);

  const isSearching = debouncedSearch.trim().length > 1;
  const query = isSearching ? debouncedSearch : CHIPS[activeChip].q;

  const { data, isLoading } = useQuery<{ videos: YtVideo[] }>({
    queryKey: ["yt-home", query],
    queryFn: () =>
      fetch(`/api/yt/videos?q=${encodeURIComponent(query)}&limit=24`).then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const videos = data?.videos ?? [];

  return (
    <div style={{ minHeight: "100vh", background: "#0f0f0f", fontFamily: "'DM Sans', sans-serif", color: "#fff" }}>

      {/* Sticky top bar */}
      <div style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(15,15,15,0.96)",
        backdropFilter: "blur(14px)",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        padding: "10px 24px",
        display: "flex", alignItems: "center", gap: 24,
      }}>
        <span style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 28, letterSpacing: "0.04em", flexShrink: 0,
        }}>
          ho<span style={{ color: "#7F77DD" }}>o</span>dMusic
        </span>

        <div style={{
          flex: 1, maxWidth: 600, margin: "0 auto",
          display: "flex", alignItems: "center",
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 24, padding: "8px 18px", gap: 10,
        }}>
          <Search size={15} color="#888" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search"
            style={{
              flex: 1, background: "none", border: "none", outline: "none",
              color: "#fff", fontSize: 14, fontFamily: "'DM Sans', sans-serif",
            }}
          />
        </div>

        <div style={{ width: 120, flexShrink: 0 }} />
      </div>

      {/* Filter chips */}
      {!isSearching && (
        <div style={{
          display: "flex", gap: 8, padding: "12px 24px",
          overflowX: "auto", scrollbarWidth: "none",
          borderBottom: "1px solid rgba(255,255,255,0.04)",
        }}>
          <style>{`.chip-row::-webkit-scrollbar{display:none}`}</style>
          {CHIPS.map((chip, i) => (
            <button
              key={chip.label}
              onClick={() => setActiveChip(i)}
              style={{
                flexShrink: 0, padding: "6px 14px", borderRadius: 8,
                cursor: "pointer", border: "none",
                fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600,
                background: activeChip === i ? "#fff" : "rgba(255,255,255,0.1)",
                color: activeChip === i ? "#0f0f0f" : "#fff",
                transition: "background 0.18s, color 0.18s",
              }}
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}

      {/* Video grid */}
      <div style={{ padding: "24px" }}>
        {isLoading ? (
          <SkeletonGrid />
        ) : videos.length === 0 ? (
          <div style={{ textAlign: "center", color: "#555", paddingTop: 80, fontSize: 15 }}>
            No videos found
          </div>
        ) : (
          <motion.div
            key={query}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25 }}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: "32px 20px",
            }}
          >
            {videos.map((v) => (
              <VideoCard
                key={v.id}
                video={v}
                onClick={() => navigate(`/music/videos/${v.id}`)}
              />
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
