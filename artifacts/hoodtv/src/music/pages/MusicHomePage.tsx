import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Search, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { YtVideo } from "./MusicVideosPage";
import {
  recordChipClick,
  recordVideoClick,
  buildFeedQuery,
  getOrderedChips,
  hasFeedData,
  type ChipDef,
} from "../lib/feedAlgorithm";

function useDebounce(value: string, ms = 500) {
  const [d, setD] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setD(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return d;
}

const BASE_CHIPS: ChipDef[] = [
  { label: "For You",    q: "" },
  { label: "All",        q: "official music video 2024" },
  { label: "Hip Hop",    q: "hip hop music video 2024" },
  { label: "Pop",        q: "pop music video 2024" },
  { label: "R&B",        q: "rnb soul music video 2024" },
  { label: "Electronic", q: "electronic music video 2024" },
  { label: "Rock",       q: "rock music video 2024" },
  { label: "Mood & Sound", q: "lofi chill vibes 2024" },
];

function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (Math.imul(31, h) + name.charCodeAt(i)) | 0;
  return `hsl(${Math.abs(h) % 360},55%,45%)`;
}

function VideoCard({
  video,
  onClick,
}: {
  video: YtVideo;
  onClick: () => void;
}) {
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
      <div
        style={{
          position: "relative", paddingTop: "56.25%",
          borderRadius: 12, overflow: "hidden",
          background: "#1a1a1a", marginBottom: 12,
          transform: hovered ? "scale(1.02)" : "scale(1)",
          transition: "transform 0.25s ease",
        }}
      >
        <img
          src={video.thumbnail}
          alt={video.title}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          loading="lazy"
        />
        {video.duration && (
          <span
            style={{
              position: "absolute", bottom: 6, right: 6,
              background: "rgba(0,0,0,0.85)", color: "#fff",
              fontSize: 11, fontWeight: 700, padding: "2px 7px",
              borderRadius: 4, fontFamily: "monospace", letterSpacing: "0.04em",
            }}
          >
            {video.duration}
          </span>
        )}
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div
          style={{
            width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
            background: color, display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 12, fontWeight: 700,
            color: "#fff", marginTop: 2,
          }}
        >
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 14, fontWeight: 600, lineHeight: 1.4,
              color: hovered ? "#c0bdf5" : "#fff",
              display: "-webkit-box", WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical", overflow: "hidden",
              marginBottom: 4, transition: "color 0.2s",
            }}
          >
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
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: "32px 20px",
      }}
    >
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i}>
          <div
            style={{
              position: "relative", paddingTop: "56.25%",
              borderRadius: 12, background: "rgba(255,255,255,0.06)",
              marginBottom: 12,
            }}
          />
          <div style={{ display: "flex", gap: 12 }}>
            <div
              style={{
                width: 36, height: 36, borderRadius: "50%",
                background: "rgba(255,255,255,0.06)", flexShrink: 0,
              }}
            />
            <div style={{ flex: 1 }}>
              <div
                style={{
                  height: 13, borderRadius: 4,
                  background: "rgba(255,255,255,0.06)", marginBottom: 8,
                }}
              />
              <div
                style={{
                  height: 12, borderRadius: 4,
                  background: "rgba(255,255,255,0.04)", width: "55%",
                  marginBottom: 6,
                }}
              />
              <div
                style={{
                  height: 11, borderRadius: 4,
                  background: "rgba(255,255,255,0.03)", width: "40%",
                }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function MusicHomePage() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  // Chips reorder on mount so scores are always fresh
  const [chips, setChips] = useState<ChipDef[]>(() => getOrderedChips(BASE_CHIPS));
  const [activeChip, setActiveChip] = useState(0);
  const [feedPersonalized, setFeedPersonalized] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery);

  // Recompute chips + personalization state from storage
  const refreshChips = useCallback(() => {
    setChips(getOrderedChips(BASE_CHIPS));
    setFeedPersonalized(hasFeedData());
  }, []);

  useEffect(() => {
    refreshChips();
  }, [refreshChips]);

  const isSearching = debouncedSearch.trim().length > 1;

  // Resolve the active query
  const activeLabel = chips[activeChip]?.label ?? "For You";
  let activeQuery: string;
  if (isSearching) {
    activeQuery = debouncedSearch;
  } else if (activeLabel === "For You") {
    activeQuery = buildFeedQuery(BASE_CHIPS);
  } else {
    activeQuery = chips[activeChip]?.q ?? "official music video 2024";
  }

  const { data, isLoading } = useQuery<{ videos: YtVideo[] }>({
    queryKey: ["yt-home", activeQuery],
    queryFn: () =>
      fetch(`/api/yt/videos?q=${encodeURIComponent(activeQuery)}&limit=24`).then((r) =>
        r.json()
      ),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const videos = data?.videos ?? [];

  const handleChipClick = (index: number) => {
    const label = chips[index]?.label;
    setActiveChip(index);
    if (label) recordChipClick(label);
    refreshChips();
    // Keep the selected chip index stable after re-sort
    // (chips don't re-sort while the user is browsing — only on next mount)
  };

  const handleVideoClick = (video: YtVideo) => {
    recordVideoClick(video.id, video.title, video.author);
    refreshChips();
    // Invalidate "For You" query so next time it reflects the new score
    queryClient.invalidateQueries({ queryKey: ["yt-home", buildFeedQuery(BASE_CHIPS)] });
    navigate(`/music/videos/${video.id}`);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f0f0f",
        fontFamily: "'DM Sans', sans-serif",
        color: "#fff",
      }}
    >
      {/* Sticky top bar */}
      <div
        style={{
          position: "sticky", top: 0, zIndex: 100,
          background: "rgba(15,15,15,0.96)",
          backdropFilter: "blur(14px)",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          padding: "10px 24px",
          display: "flex", alignItems: "center", gap: 24,
        }}
      >
        <span
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 28, letterSpacing: "0.04em", flexShrink: 0,
          }}
        >
          ho<span style={{ color: "#7F77DD" }}>o</span>dMusic
        </span>

        <div
          style={{
            flex: 1, maxWidth: 600, margin: "0 auto",
            display: "flex", alignItems: "center",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 24, padding: "8px 18px", gap: 10,
          }}
        >
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
        <div
          style={{
            display: "flex", gap: 8, padding: "12px 24px",
            overflowX: "auto", scrollbarWidth: "none",
            borderBottom: "1px solid rgba(255,255,255,0.04)",
          }}
        >
          {chips.map((chip, i) => {
            const isActive = activeChip === i;
            const isForYou = chip.label === "For You";
            return (
              <motion.button
                key={chip.label}
                onClick={() => handleChipClick(i)}
                whileTap={{ scale: 0.95 }}
                style={{
                  flexShrink: 0, padding: isForYou ? "6px 14px" : "6px 14px",
                  borderRadius: 8, cursor: "pointer", border: "none",
                  fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600,
                  display: "flex", alignItems: "center", gap: 6,
                  background: isActive
                    ? isForYou
                      ? "linear-gradient(135deg, #7F77DD, #9D97E8)"
                      : "#fff"
                    : isForYou
                    ? "rgba(127,119,221,0.15)"
                    : "rgba(255,255,255,0.1)",
                  color: isActive
                    ? isForYou ? "#fff" : "#0f0f0f"
                    : isForYou ? "#c0bdf5" : "#fff",
                  boxShadow: isActive && isForYou
                    ? "0 0 16px rgba(127,119,221,0.4)"
                    : "none",
                  transition: "background 0.18s, color 0.18s, box-shadow 0.18s",
                }}
              >
                {isForYou && (
                  <Sparkles
                    size={13}
                    style={{
                      color: isActive ? "#fff" : feedPersonalized ? "#9D97E8" : "#555",
                    }}
                  />
                )}
                {chip.label}
                {isForYou && feedPersonalized && !isActive && (
                  <span
                    style={{
                      width: 6, height: 6, borderRadius: "50%",
                      background: "#7F77DD", flexShrink: 0,
                    }}
                  />
                )}
              </motion.button>
            );
          })}
        </div>
      )}

      {/* "For You" subtitle when active + personalized */}
      <AnimatePresence>
        {!isSearching && activeLabel === "For You" && feedPersonalized && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              padding: "10px 24px 0",
              fontSize: 12, color: "#9D97E8",
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <Sparkles size={12} />
            Tailored to your taste — keeps learning as you watch
          </motion.div>
        )}
      </AnimatePresence>

      {/* Video grid */}
      <div style={{ padding: "20px 24px 40px" }}>
        {isLoading ? (
          <SkeletonGrid />
        ) : videos.length === 0 ? (
          <div style={{ textAlign: "center", color: "#555", paddingTop: 80, fontSize: 15 }}>
            No videos found
          </div>
        ) : (
          <motion.div
            key={activeQuery}
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
              <VideoCard key={v.id} video={v} onClick={() => handleVideoClick(v)} />
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
