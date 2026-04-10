import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Search, Sparkles, History, Heart } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { YtVideo } from "./MusicVideosPage";
import { useMusicVideoHistory } from "@/hooks/useMusicVideoHistory";
import { useMusicVideoFavorites } from "@/hooks/useMusicVideoFavorites";
import {
  recordChipClick,
  recordChipLeave,
  recordVideoClick,
  buildFeedQueries,
  getOrderedChips,
  getConfidenceLevel,
  getWatchedIds,
  incrementFeedIteration,
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
  { label: "For You",      q: "" },
  { label: "All",          q: "official music video 2024" },
  { label: "Hip Hop",      q: "hip hop music video 2024" },
  { label: "Pop",          q: "pop music video 2024" },
  { label: "R&B",          q: "rnb soul music video 2024" },
  { label: "Electronic",   q: "electronic music video 2024" },
  { label: "Rock",         q: "rock music video 2024" },
  { label: "Mood & Sound", q: "lofi chill vibes 2024" },
];

function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (Math.imul(31, h) + name.charCodeAt(i)) | 0;
  return `hsl(${Math.abs(h) % 360},55%,45%)`;
}

/** Interleave multiple arrays round-robin, deduplicating by video ID. */
function interleaveAndDedup(buckets: YtVideo[][]): YtVideo[] {
  const seen = new Set<string>();
  const out: YtVideo[] = [];
  const maxLen = Math.max(...buckets.map((b) => b.length), 0);
  for (let i = 0; i < maxLen; i++) {
    for (const bucket of buckets) {
      const v = bucket[i];
      if (v && !seen.has(v.id)) {
        seen.add(v.id);
        out.push(v);
      }
    }
  }
  return out;
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

  const [chips, setChips] = useState<ChipDef[]>(() => getOrderedChips(BASE_CHIPS));
  const [activeChip, setActiveChip] = useState(0);
  const [confidence, setConfidence] = useState<0 | 1 | 2>(() => getConfidenceLevel());
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery);
  const prevChipLabel = useRef<string>("For You");

  const refreshState = useCallback(() => {
    setChips(getOrderedChips(BASE_CHIPS));
    setConfidence(getConfidenceLevel());
  }, []);

  useEffect(() => { refreshState(); }, [refreshState]);

  const isSearching = debouncedSearch.trim().length > 1;
  const activeLabel = chips[activeChip]?.label ?? "For You";
  const isForYou = !isSearching && activeLabel === "For You";

  // Build multi-queries for "For You"; recompute only when confidence changes
  const feedQueries = useMemo(
    () => buildFeedQueries(BASE_CHIPS),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [confidence, isForYou],
  );

  // Increment rotation counter each time "For You" comes into view
  useEffect(() => {
    if (isForYou) incrementFeedIteration();
  }, [isForYou]);

  const singleQuery = isSearching
    ? debouncedSearch
    : chips[activeChip]?.q ?? "official music video 2024";

  // ── Data fetching ────────────────────────────────────────────────────────────

  // Multi-query parallel fetch for "For You"
  const { data: forYouVideos, isLoading: forYouLoading } = useQuery<YtVideo[]>({
    queryKey: ["yt-forYou", feedQueries.join("|")],
    queryFn: async () => {
      const results = await Promise.all(
        feedQueries.map((q) =>
          fetch(`/api/yt/videos?q=${encodeURIComponent(q)}&limit=12`).then((r) => r.json()),
        ),
      );
      const buckets: YtVideo[][] = results.map((r) => r.videos ?? []);
      return interleaveAndDedup(buckets);
    },
    enabled: isForYou,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  // Single-query fetch for all other chips / search
  const { data: singleData, isLoading: singleLoading } = useQuery<{ videos: YtVideo[] }>({
    queryKey: ["yt-home", singleQuery],
    queryFn: () =>
      fetch(`/api/yt/videos?q=${encodeURIComponent(singleQuery)}&limit=24`).then((r) => r.json()),
    enabled: !isForYou,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const isLoading = isForYou ? forYouLoading : singleLoading;

  // Filter already-watched videos out of "For You"
  const rawVideos: YtVideo[] = isForYou
    ? (forYouVideos ?? [])
    : (singleData?.videos ?? []);

  const videos = useMemo(() => {
    if (!isForYou || confidence === 0) return rawVideos;
    const watched = new Set(getWatchedIds());
    const filtered = rawVideos.filter((v) => !watched.has(v.id));
    // Only apply filter if it leaves at least 6 results; otherwise show everything
    return filtered.length >= 6 ? filtered : rawVideos;
  }, [rawVideos, isForYou, confidence]);

  // ── Interaction handlers ─────────────────────────────────────────────────────

  const handleChipClick = (index: number) => {
    const newLabel = chips[index]?.label;
    const oldLabel = prevChipLabel.current;

    // Negative signal on the chip we're leaving
    if (oldLabel && oldLabel !== newLabel) recordChipLeave(oldLabel);

    setActiveChip(index);
    if (newLabel) recordChipClick(newLabel);
    prevChipLabel.current = newLabel ?? "For You";
    refreshState();
  };

  const { history } = useMusicVideoHistory();
  const { favorites } = useMusicVideoFavorites();

  const handleVideoClick = (video: YtVideo) => {
    recordVideoClick(video.id, video.title, video.author, video.publishedAt);
    refreshState();
    navigate(`/music/videos/${video.id}`);
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", background: "#0f0f0f", fontFamily: "'DM Sans', sans-serif", color: "#fff" }}>

      {/* Sticky top bar */}
      <div
        style={{
          position: "sticky", top: 0, zIndex: 100,
          background: "rgba(15,15,15,0.96)", backdropFilter: "blur(14px)",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          padding: "10px 24px", display: "flex", alignItems: "center", gap: 24,
        }}
      >
        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: "0.04em", flexShrink: 0 }}>
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
            style={{ flex: 1, background: "none", border: "none", outline: "none", color: "#fff", fontSize: 14, fontFamily: "'DM Sans', sans-serif" }}
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
            const isForYouChip = chip.label === "For You";
            return (
              <motion.button
                key={chip.label}
                onClick={() => handleChipClick(i)}
                whileTap={{ scale: 0.95 }}
                style={{
                  flexShrink: 0, padding: "6px 14px",
                  borderRadius: 8, cursor: "pointer", border: "none",
                  fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600,
                  display: "flex", alignItems: "center", gap: 6,
                  background: isActive
                    ? isForYouChip ? "linear-gradient(135deg, #7F77DD, #9D97E8)" : "#fff"
                    : isForYouChip ? "rgba(127,119,221,0.15)" : "rgba(255,255,255,0.1)",
                  color: isActive
                    ? isForYouChip ? "#fff" : "#0f0f0f"
                    : isForYouChip ? "#c0bdf5" : "#fff",
                  boxShadow: isActive && isForYouChip ? "0 0 16px rgba(127,119,221,0.4)" : "none",
                  transition: "background 0.18s, color 0.18s, box-shadow 0.18s",
                }}
              >
                {isForYouChip && (
                  <Sparkles
                    size={13}
                    style={{ color: isActive ? "#fff" : confidence >= 1 ? "#9D97E8" : "#555" }}
                  />
                )}
                {chip.label}
                {isForYouChip && confidence >= 1 && !isActive && (
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: confidence === 2 ? "#7F77DD" : "#555", flexShrink: 0 }} />
                )}
              </motion.button>
            );
          })}
        </div>
      )}

      {/* "For You" subtitle */}
      <AnimatePresence>
        {isForYou && confidence >= 1 && (
          <motion.div
            key={confidence}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              padding: "10px 24px 0", fontSize: 12,
              color: confidence === 2 ? "#9D97E8" : "#666",
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <Sparkles size={12} />
            {confidence === 1
              ? "Learning your taste — keep watching to personalise"
              : "Tailored to your taste · blending your top genres"}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recently Watched row */}
      {!isSearching && history.length > 0 && (
        <div style={{ padding: "20px 24px 4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <History size={14} color="#7F77DD" />
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: "0.06em", color: "#fff" }}>
              Recently Watched
            </span>
          </div>
          <div style={{ display: "flex", gap: 14, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 4 }}>
            {history.slice(0, 12).map((v) => (
              <div
                key={v.id}
                onClick={() => navigate(`/music/videos/${v.id}`)}
                style={{ flexShrink: 0, width: 200, cursor: "pointer" }}
              >
                <div style={{ position: "relative", width: 200, height: 112, borderRadius: 8, overflow: "hidden", background: "#111", marginBottom: 8 }}>
                  <img src={v.thumbnail} alt={v.title} style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.3s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")} />
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#ddd", lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{v.title}</div>
                <div style={{ fontSize: 11, color: "#666", marginTop: 3 }}>{v.author}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Favorites row */}
      {!isSearching && favorites.length > 0 && (
        <div style={{ padding: "16px 24px 4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <Heart size={14} color="#c0bdf5" fill="#c0bdf5" />
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: "0.06em", color: "#fff" }}>
              My Favorites
            </span>
          </div>
          <div style={{ display: "flex", gap: 14, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 4 }}>
            {favorites.slice(0, 12).map((v) => (
              <div
                key={v.id}
                onClick={() => navigate(`/music/videos/${v.id}`)}
                style={{ flexShrink: 0, width: 200, cursor: "pointer" }}
              >
                <div style={{ position: "relative", width: 200, height: 112, borderRadius: 8, overflow: "hidden", background: "#111", marginBottom: 8, border: "1px solid rgba(127,119,221,0.2)" }}>
                  <img src={v.thumbnail} alt={v.title} style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.3s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")} />
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#ddd", lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{v.title}</div>
                <div style={{ fontSize: 11, color: "#666", marginTop: 3 }}>{v.author}</div>
              </div>
            ))}
          </div>
        </div>
      )}

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
            key={isForYou ? feedQueries.join("|") : singleQuery}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25 }}
            style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "32px 20px" }}
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
